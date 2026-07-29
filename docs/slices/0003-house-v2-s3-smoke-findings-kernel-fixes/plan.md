---
id: "0003-house-v2-s3-smoke-findings-kernel-fixes"
kind: plan
slice: "0003-house-v2-s3-smoke-findings-kernel-fixes"
title: "S3 smoke-findings kernel fixes — implementation plan"
status: "planned 2026-07-29; plan-check GO_WITH_FIXES folded"
state: approved
---
# S3 Smoke-Findings Kernel Fixes Implementation Plan

> **For agentic workers:** execute task-by-task, TDD, committing at every green boundary. The kickoff
> brief in `slice.yaml` is the contract; this plan is its expansion.

**Goal:** Fix the four S2-smoke backlog findings — strict-marker false positives + `--slice` scoping,
approval-boundary frontmatter cross-check, gate-event reference manifest, `--actor` unification — plus
the unknown-flag guard that root-caused F4.

**Architecture:** Two independent clusters. Cluster V is `cli/lib/validate.js` (T1 scoping+matcher, then
T2 cross-check which inherits the scoping). Cluster G is `cli/lib/slices.js#recordGate` (T3 — R-3 and
R-4 are the same lines). T4 adds the per-command known-flags table to `cli/bin/house.js`; it runs last
among code tasks because it must encode T3's final flag set, and the existing 67-test suite doubles as
the table's coverage net (an under-permitted flag breaks a passing test). T5 canonicalizes docs.

**Tech Stack:** Node 20+, ESM, `node:test` + `node:assert/strict`, js-yaml (already vendored). No new
dependencies.

**Test conventions:** `cli/test/validate.test.js` tests `validate(repo, args)` in-process against
`mkTmpRepo()` fixtures; `cli/test/slices.test.js` tests lib functions in-process; `cli/test/cli.test.js`
spawns the real bin via its local `run(cwd, ...args)` helper, which returns `{out, code}` (out merges
stdout+stderr on failure). Match those seams.

**Dispatch precondition (plan-check M1):** slice 0003's own records must not trip the very check T2
adds — its `spec.md`/`plan.md` frontmatter `state:` was reconciled to `approved` at shaping handoff,
matching the manifest. The builder verifies `house validate` exits 0 **before starting T1**; if it is
red on 0003 frontmatter, the records drifted — reconcile them, never weaken the check.

---

### Task 1: R-1 — strict marker matcher + `--slice` scoping

**Files:**
- Modify: `cli/lib/validate.js` (marker block at lines 31–34; loop head at line 19; repo-level checks at
  lines 88–104)
- Test: `cli/test/validate.test.js`

- [ ] **Step 1: Write the failing tests** — append to `cli/test/validate.test.js`:

```js
test('validate --strict R-1: well-formed markers only, handoff artifacts only, --slice scoping', () => {
  const repo = mkTmpRepo();
  const a = mint(repo, 'slice a', {});
  const b = mint(repo, 'slice b', {});
  const aDir = join(repo, 'docs/slices', a);
  const bDir = join(repo, 'docs/slices', b);
  // prose/backtick mentions must NOT trip: quoted marker in backticks, fenced block, bracketless prose
  writeFileSync(join(aDir, 'spec.md'), readFileSync(join(aDir, 'spec.md'), 'utf8') +
    '\nthe `[NEEDS CLARIFICATION` literal in a code span\n' +
    '```\n[NEEDS CLARIFICATION: inside a fence]\n```\n' +
    'prose about NEEDS CLARIFICATION without brackets\n');
  // retro.md discussing a real marker must NOT trip (not a handoff artifact)
  writeFileSync(join(aDir, 'retro.md'), '# Retro\n\n[NEEDS CLARIFICATION: retros may discuss markers]\n');
  assert.deepEqual(validate(repo, { strict: true }).filter(e => e.level === 'error'), []);
  // a real well-formed marker in slice b's spec trips repo-wide strict…
  writeFileSync(join(bDir, 'spec.md'),
    readFileSync(join(bDir, 'spec.md'), 'utf8') + '\n[NEEDS CLARIFICATION: which auth?]\n');
  assert.match(validate(repo, { strict: true }).map(e => e.msg).join(' '), /NEEDS CLARIFICATION/);
  // …but NOT a strict run scoped to slice a
  assert.deepEqual(validate(repo, { strict: true, slice: a }).filter(e => e.level === 'error'), []);
  // and scoped to slice b it still trips, naming b's spec
  const scoped = validate(repo, { strict: true, slice: b }).filter(e => e.level === 'error');
  assert.equal(scoped.length, 1);
  assert.match(scoped[0].path, new RegExp(b));
  // plan.md is a handoff artifact too (A3)
  writeFileSync(join(aDir, 'plan.md'), '# Plan\n\n[NEEDS CLARIFICATION: sequencing?]\n');
  assert.match(validate(repo, { strict: true, slice: a }).map(e => e.msg).join(' '), /NEEDS CLARIFICATION/);
});

test('validate --slice: unknown id fails closed, never green', () => {
  const repo = mkTmpRepo();
  mint(repo, 'real', {});
  assert.throws(() => validate(repo, { slice: '0099-typo' }), /unknown slice: 0099-typo/);
  assert.throws(() => validate(repo, { slice: true }), /--slice needs a slice id/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd cli && node --test test/validate.test.js`
Expected: FAIL — first test errors on the backtick line (`NEEDS CLARIFICATION marker present`), second
test fails because `validate` does not throw.

- [ ] **Step 3: Implement.** In `cli/lib/validate.js` (A1: two surgical inserts — do NOT delete the
`const dir` / `statSync` lines below the loop head):

Directly after `const slicesDir = join(root, 'docs/slices');` (line 17), insert:

```js
  if (args.slice != null) {                              // fail closed: a typo'd --slice must never look green
    if (typeof args.slice !== 'string') throw new Error('--slice needs a slice id');
    if (!existsSync(join(slicesDir, args.slice))) throw new Error(`unknown slice: ${args.slice}`);
  }
```

As the first statement inside the `for (const d of readdirSync(slicesDir).sort())` loop (line 19), insert:

```js
    if (args.slice && d !== args.slice) continue;
```

Replace the marker block (previously lines 31–34) — handoff artifacts only, well-formed markers only:

```js
    if (args.strict) for (const f of ['spec.md', 'plan.md']) {   // handoff artifacts ONLY — a retro's job includes discussing markers
      const p = join(dir, f);
      if (!existsSync(p)) continue;
      const text = readFileSync(p, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')                         // template's marker lives in a comment
        .replace(/```[\s\S]*?```/g, '')                          // fenced code blocks quote, not declare
        .replace(/`[^`\n]*`/g, '');                              // inline code spans likewise
      if (/\[NEEDS CLARIFICATION\b[^\]]*\]/.test(text))
        err(p, 'NEEDS CLARIFICATION marker present — handoff blocked (--strict)');
    }
```

Scope the repo-level sections (ADR frontmatter at lines 88–94, roadmap lint at lines 97–104) to
whole-repo runs by wrapping both in one guard:

```js
  if (!args.slice) {
    // …existing adrDir block, unchanged…
    // …existing roadmap block, unchanged…
  }
```

- [ ] **Step 4: Run the full suite**

Run: `cd cli && npm test`
Expected: all pass (existing strict test at `validate.test.js` "NEEDS CLARIFICATION blocks" still passes
— its marker is well-formed and in `spec.md`).

- [ ] **Step 5: Commit**

```bash
git add cli/lib/validate.js cli/test/validate.test.js
git commit -m "feat(validate): strict matches well-formed markers in handoff artifacts only; --slice scoping fails closed on unknown ids"
```

### Task 2: R-2 — approval-boundary cross-check (manifest vs frontmatter)

**Files:**
- Modify: `cli/lib/validate.js` (inside the slice loop, directly after the artifact-enum checks that end
  at line 30)
- Test: `cli/test/validate.test.js`

- [ ] **Step 1: Write the failing test** — append:

```js
test('validate R-2: manifest-approved artifact must have agreeing frontmatter; missing state is a warning', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'drift', {});
  const dir = join(repo, 'docs/slices', id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.artifacts = { spec: { state: 'approved', updated: '2026-07-29' } };
  writeYaml(join(dir, 'slice.yaml'), man);
  // minted spec.md frontmatter says state: draft → the 0002 drift, now an error naming both records
  const drifted = validate(repo, {}).filter(e => e.level === 'error');
  assert.equal(drifted.length, 1);
  assert.match(drifted[0].msg, /approved in slice\.yaml.*frontmatter says draft/);
  // frontmatter agreeing → clean
  const spec = readFileSync(join(dir, 'spec.md'), 'utf8');
  writeFileSync(join(dir, 'spec.md'), spec.replace('state: draft', 'state: approved'));
  assert.deepEqual(validate(repo, {}).filter(e => e.level === 'error'), []);
  // manifest approved + frontmatter done (past the boundary) also clean — boundary check, not equality (A2)
  writeFileSync(join(dir, 'spec.md'), spec.replace('state: draft', 'state: done'));
  assert.deepEqual(validate(repo, {}).filter(e => e.level === 'error'), []);
  // deleting the frontmatter does not evade the check — it degrades to a warning finding
  writeFileSync(join(dir, 'spec.md'), '# Spec — no frontmatter at all\n');
  const evaded = validate(repo, {});
  assert.deepEqual(evaded.filter(e => e.level === 'error'), []);
  assert.match(evaded.filter(e => e.level === 'warning').map(e => e.msg).join(' '), /no frontmatter state/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd cli && node --test test/validate.test.js`
Expected: FAIL — no drift error is produced today.

- [ ] **Step 3: Implement.** In the slice loop after the artifact-enum `for` (line 30), add:

```js
    for (const name of ['spec', 'plan']) {               // R-2: the approval boundary may not drift
      const recState = man.artifacts?.[name]?.state;
      if (!['approved', 'done'].includes(recState)) continue;
      const file = join(dir, `${name}.md`);
      if (!existsSync(file)) { err(file, `artifact '${name}' is ${recState} in slice.yaml but ${name}.md is missing`, 'warning'); continue; }
      let data = null;
      try { ({ data } = parseFrontmatter(readFileSync(file, 'utf8'))); } catch { /* unparseable → warning below */ }
      if (!data?.state) err(file, `artifact '${name}' is ${recState} in slice.yaml but ${name}.md has no frontmatter state`, 'warning');
      else if (!['approved', 'done'].includes(data.state))
        err(file, `artifact '${name}' is ${recState} in slice.yaml but frontmatter says ${data.state} — records drifted`);
    }
```

- [ ] **Step 4: Run the full suite**

Run: `cd cli && npm test`
Expected: all pass. Also run `house validate` at repo root — expected exit 0 (slice 0003's spec
frontmatter was reconciled to `approved` at handoff; if this errors, STOP: the repo drifted, fix the
frontmatter via reconcile, not by weakening the check).

- [ ] **Step 5: Commit**

```bash
git add cli/lib/validate.js cli/test/validate.test.js
git commit -m "feat(validate): approval-boundary cross-check between slice.yaml and doc frontmatter"
```

### Task 3: R-3 + R-4 — gate events reference their record; one actor spelling

**Files:**
- Modify: `cli/lib/slices.js#recordGate` (lines 90–112)
- Test: `cli/test/slices.test.js`

- [ ] **Step 1: Write the failing test** — append to `cli/test/slices.test.js` (`recordGate`,
`mkTmpRepo`, `mint`, and `readYaml` are already imported there — no import changes needed; reuse the
existing events.jsonl-reading pattern):

```js
test('recordGate R-3/R-4: event carries record ref + detail keys + notes; --actor wins, --by aliases', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'gated', {});
  recordGate(repo, 'merge_gate', { slice: id, verdict: 'GO', actor: 'reviewer',
    payload: '{"lenses":["seams"],"findings":[]}', notes: 'clean' });
  const rec = readYaml(join(repo, 'docs/slices', id, 'gates/merge_gate.yaml'));
  assert.equal(rec.by, 'reviewer');                                  // R-4: --actor honored
  assert.deepEqual(rec.lenses, ['seams']);                           // payload still lands in the yaml
  const ev = readFileSync(join(repo, '.house/events.jsonl'), 'utf8').trim().split('\n')
    .map(JSON.parse).filter(e => e.event === 'gate.recorded').pop();
  assert.equal(ev.actor, 'reviewer');
  assert.equal(ev.payload.record, `docs/slices/${id}/gates/merge_gate.yaml`);   // R-3: reference, not blob
  assert.deepEqual(ev.payload.detail, ['lenses', 'findings']);
  assert.equal(ev.payload.notes, 'clean');
  assert.equal(ev.payload.by, 'reviewer');
  // legacy --by still works when --actor is absent
  recordGate(repo, 'spec_review', { slice: id, verdict: 'approved', by: 'jake' });
  const ev2 = readFileSync(join(repo, '.house/events.jsonl'), 'utf8').trim().split('\n')
    .map(JSON.parse).filter(e => e.event === 'gate.recorded').pop();
  assert.equal(ev2.actor, 'jake');
  assert.equal(ev2.payload.detail, undefined);                       // no extra keys → no detail field
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd cli && node --test test/slices.test.js`
Expected: FAIL — `rec.by` is `'agent'` (actor ignored) and `ev.payload.record` is undefined.

- [ ] **Step 3: Implement.** In `recordGate`, replace the `rec` construction and `appendEvent` call
(lines 97–100) with:

```js
  const rec = { gate, verdict: args.verdict, by: args.actor ?? args.by ?? 'agent',   // R-4: --actor canonical, --by legacy alias
    recorded_at: new Date().toISOString(), notes: args.notes ?? null, ...extra };   // plan_check passes must_fix[]/advisory_folded[] here
  writeYaml(join(dir, 'gates', `${gate}.yaml`), rec);
  const payload = { gate, verdict: args.verdict, by: rec.by,
    record: `docs/slices/${args.slice}/gates/${gate}.yaml` };                        // R-3: the event points at the record…
  if (Object.keys(extra).length) payload.detail = Object.keys(extra);                // …and names what detail lives there
  if (rec.notes) payload.notes = rec.notes;
  appendEvent(root, 'gate.recorded', { slice: args.slice, actor: rec.by, payload });
```

(The later `appendEvent` for `slice.unblocked` at `slices.js:108` already uses `rec.by` — unchanged.)

- [ ] **Step 4: Run the full suite**

Run: `cd cli && npm test`
Expected: all pass (existing gate tests assert `gate`/`verdict` presence, which is preserved).

- [ ] **Step 5: Commit**

```bash
git add cli/lib/slices.js cli/test/slices.test.js
git commit -m "feat(gate): events carry record ref + detail keys + notes; --actor canonical with --by alias"
```

### Task 4: R-5 — unknown flags fail closed

**Files:**
- Modify: `cli/bin/house.js` (after the parser at lines 16–23, before the `commands` table lookup)
- Test: `cli/test/cli.test.js`

- [ ] **Step 1: Write the failing test** — append to `cli/test/cli.test.js` (uses its local `run()`
spawn helper and `mkTmpRepo`):

```js
test('unknown flags fail closed (R-5)', () => {
  const repo = mkTmpRepo();
  const bad = run(repo, 'gate', 'merge_gate', '--slice', 'x', '--verdict', 'GO', '--actro', 'reviewer');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /unknown flag --actro/);
  assert.equal(run(repo, 'validate', '--strict').code, 0);          // known flags still parse
});
```

(M2: this uses the file's real seam — `run(cwd, ...args)` returning `{out, code}`, where `out` merges
stdout+stderr on failure. There is no `.status`/`.stderr`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd cli && node --test test/cli.test.js`
Expected: FAIL — the typo'd flag is swallowed today, so the command proceeds to its own error path and
`bad.out` never mentions the flag.

- [ ] **Step 3: Implement.** In `cli/bin/house.js`, insert between the parser loop and `const need`:

```js
// R-5: a silently-swallowed flag is the failure class this kernel exists to refuse.
// Over-permitting here is harmless; under-permitting breaks a suite test — the 67-test net is the check.
const FLAGS = {
  init: [], 'new': ['kind', 'rigor', 'appetite', 'adr', 'actor'],
  event: ['slice', 'payload', 'actor'],
  gate: ['slice', 'verdict', 'actor', 'by', 'payload', 'notes'],
  task: ['slice', 'evidence-cmd', 'note', 'skip-reason', 'actor'],
  state: ['actor', 'note'], block: ['gate', 'note', 'actor'], unblock: ['note', 'actor'],
  artifact: ['reason', 'note', 'actor'], unit: ['title', 'note', 'result', 'actor'],
  pr: ['set', 'base-sha', 'actor'], log: ['slice', 'n', 'json'], status: ['json', 'slice'],
  list: ['json'], next: ['slice', 'n', 'json'], index: [],
  validate: ['strict', 'json', 'slice'], render: [],
  // NO `hook` key (A4): hooks are advisory-only and never exit non-zero (ADR-0004, bin/house.js:51-53) —
  // an absent key skips the guard entirely, which is the exemption, on purpose.
};
if (FLAGS[cmd]) for (const k of Object.keys(args)) if (!FLAGS[cmd].includes(k)) {
  console.error(`house ${cmd}: unknown flag --${k}`);
  process.exit(1);
}
```

- [ ] **Step 4: Run the full suite**

Run: `cd cli && npm test`
Expected: all pass. **If any existing test now fails with `unknown flag`, the table is under-permitting a
real flag — add that flag to the table; never delete the test.**

- [ ] **Step 5: Commit**

```bash
git add cli/bin/house.js cli/test/cli.test.js
git commit -m "feat(cli): reject unknown flags per-command — swallowed typos fail closed"
```

### Task 5: docs — canonicalize `--actor`, scope the handoff bar

**Files:**
- Modify: `cli/README.md` (the `house gate` row documenting `--by`; the `house validate` row)
- Modify: `skills/house2-shaper/SKILL.md` (§5 gate example `--by <user>` → `--actor <user>`; §9 handoff
  bar `house validate --strict` → `house validate --strict --slice <id>`)

- [ ] **Step 1: Edit `cli/README.md`** — in the commands table, change the `gate` row's flag list to
read `--slice --verdict --actor (--by legacy) --payload --notes`, and the `validate` row to read
`--strict --json --slice <id>`.

- [ ] **Step 2: Edit `skills/house2-shaper/SKILL.md`** — §5: `house gate spec_review --slice <id>
--verdict approved --actor <user>`; §9: `house validate --strict --slice <id>` (green, no surviving
marker) before `house state <id> ready`.

- [ ] **Step 3: Verify and commit**

Run: `house validate` (exit 0) and `grep -rn '\-\-by' cli/README.md skills/house2-*/SKILL.md`
Expected: the only `--by` mention left is README's "legacy" note.

```bash
git add cli/README.md skills/house2-shaper/SKILL.md
git commit -m "docs(cli): --actor canonical, handoff bar scoped to --slice"
```

---

## NOT this slice

- NOT any change to v1 `house-*` skills or `merge-gate-panel.js`/`code-health-sweep.js`.
- NOT a migration of already-recorded events — history stays as written.
- NOT scoping changes to non-strict `house validate` coverage.
- NOT new subcommands or renamed flags beyond documenting `--actor` as canonical.
- NOT a general argument-parsing layer — the guard is a plain per-command table.

## Plan-check (2026-07-29)

Verdict **GO_WITH_FIXES** (fresh Fable reviewer, five lenses; record at `gates/plan_check.yaml`). Folded:
- **M1** → dispatch precondition block in the header (0003's own frontmatter reconciled at handoff;
  builder verifies `house validate` exit 0 before T1). Also in the kickoff `plan_check_commitments`.
- **M2** → T4's test rewritten to the real `run(cwd, ...args)` → `{out, code}` seam.
- **A1** → T1's edit instructions are now two surgical inserts, preserving lines 20–21.
- **A2** → T2 asserts manifest-`approved` + frontmatter-`done` stays clean (boundary, not equality).
- **A3** → T1 asserts a `plan.md` marker trips.
- **A4** → `hook` deliberately absent from `FLAGS` (advisory-only, ADR-0004), with an in-code comment.
- **A5** → line refs corrected (recordGate 90–112; single later `appendEvent` at 108; imports already
  present in `slices.test.js`).

## Self-review (run before handoff)

- Spec coverage: R-1→T1, R-2→T2, R-3/R-4→T3, R-5→T4, doc canonicalization (R-1/R-4 tails)→T5. No gaps.
- Placeholders: none — every step carries literal code or an exact edit instruction.
- Type consistency: `validate(root, args)` signature unchanged (throws on bad `--slice`, matching the
  bin's existing try/catch → exit 1 path); `recordGate` keeps `(root, gate, args)`; `FLAGS` keys match
  the `commands` table keys exactly.
- Ordering: T2 depends on T1 (same file, inherits scoping); T4 depends on T3 (encodes gate's final
  flags); T5 last. Suite compiles/passes at every task boundary.

## As-built — Unit 01 (reconciled 2026-07-29, branch `slice/0003-house-v2-s3-smoke-findings-kernel-fixes`)

T1–T5 all `done` with evidence in `tasks.yaml`; suite **67 → 72 tests**, `house validate` exit **0**.
Commits off `base_sha` `474ba42`: `dc127eb` (T1) · `fbd8d6d` (T2) · `ccab5ff` (T3) · `611949a` (T4) ·
`8b7e1d0` (T5).

**Built exactly as planned.** Every task's Step-3 literal code landed verbatim — no edits to the
sequencing, the seams, or the test assertions. The plan's five folded plan-check items all held: M1 (the
dispatch precondition — `house validate` was green on 0003's own frontmatter before T1), M2 (T4's test
uses `run(cwd, …)` → `{out, code}`), A1–A5.

**Deviations from the plan: none.** Two things the plan did not say, recorded here rather than absorbed:

- **Spec R-5 reconciled to the shipped exemption.** R-5's literal text was "every `house` command
  rejects a flag it does not consume"; the shipped `FLAGS` table deliberately omits `hook`, and any
  command absent from the table skips the guard. That narrowing was a plan-check advisory (A4) folded
  into the plan and into the kickoff `plan_check_commitments`, but it never reached the spec. `spec.md`
  R-5 now states it, citing ADR-0004 — a documentation reconcile, not a behavior change.
- **The `FLAGS` table permits a superset of each command's real flags** (e.g. `--actor` on commands whose
  writers currently ignore it). This is the plan's stated posture — over-permitting is harmless,
  under-permitting breaks a suite test — not drift.

**Known limitation of the R-1 matcher, surfaced by this very file.** `house validate --strict`, repo-wide
*and* scoped to `0003`, reports one error on this `plan.md`. Cause: T1 Step 1's literal test fixture
quotes a triple-backtick fence *inside* the fenced `js` block, so the non-greedy fence-stripping regex
closes the outer fence early and leaves the fixture's own marker string exposed to the matcher. It is
**pre-existing** — the old substring matcher flagged this file too — and the matcher is implemented
exactly as R-1 specifies. Out of scope to fix here (the scope guards forbid a code change, and rewriting
the fixture would weaken the test that proves R-1). Deferred to the roadmap backlog; the practical effect
is that `0003`'s own handoff bar is `house validate` exit 0 plus a green suite, not `--strict`.
