---
id: "0001-house-v2-s2-skills-rewrite"
kind: plan
slice: "0001-house-v2-s2-skills-rewrite"
title: "house v2 S2 — skills rewrite — implementation plan"
status: "planned 2026-07-28"
state: draft
---
# house v2 S2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking. In the house flow, the orchestrator dispatches one builder per **unit** (below); the builder
> executes that unit's tasks in order.

**Goal:** Make the three house skills thin actors over the S1 kernel — CLI writers/readers first, then
doctrine v2 + three from-scratch `house2-*` skills, advisory hooks, and a smoke slice proving the loop.

**Architecture:** One slice, three units built CLI-first so the repo is compile-green and dogfood-usable at
every task boundary. Unit 1 grows `house` (writers for the nine unwritable manifest fields, terminal-event
producers, read-side commands, validate ride-alongs, `house hook`, install wiring). Unit 2 writes the prose
(doctrine v2 under "point at an enum, never restate one"; three skills reduced to loop + judgment). Unit 3
drives the smoke slice end-to-end as S2's done bar.

**Tech Stack:** Node ≥20 ESM, `js-yaml` (only real dep), `node --test` + `assert/strict`, hand-rolled arg
parser in `cli/bin/house.js`. No new dependencies anywhere in this plan.

**Model routing (fable-profile, ADR-0001):** builders run on **Opus** (`claude-opus-4-8`); the plan-check
and merge-gate reviewers and any escalation run on **Fable** (`claude-fable-5`). If Fable is unavailable,
halt at `gate.requested` — never silently downgrade (spec, Settled contradictions).

**Scope guards — NOT this slice:** blocking hooks · `PreToolUse` deny · builder-as-`.claude/agents/`-type ·
atomic writes · `house archive`/`adopt` · full per-stack lens config · v1→canonical rename or any edit to
the v1 skills · comment-preserving YAML · Windows portability · delta-specs / daemon / fourth role.

**Verification bar (ADR-0003, no hosted CI):** `cd cli && npm test` green + `house validate` exit 0 at
every task boundary; both independently re-run by the merge-gate reviewer.

---

## File map

| Path | Role |
|---|---|
| `cli/lib/derive.js` | modify: `renderDevState` positional parse + Parked section; add `log()`; `status()` takes an id |
| `cli/lib/slices.js` | modify: `recordGate` auto-clear, `setState` terminal events; add `block/unblock/artifactCmd/unitCmd/prCmd` |
| `cli/lib/core.js` | modify: `readEvents` returns `{events, skipped}` |
| `cli/lib/validate.js` | modify: roadmap lint, style-attr `url()` grep, `tasks.yaml` structure, kickoff check |
| `cli/lib/hooks.js` | create: `house hook <event>` handlers (stdin JSON → stdout JSON) |
| `cli/bin/house.js` | modify: dispatch for `block/unblock/artifact/unit/pr/log/hook`; `status <id>`; `validate --json` |
| `cli/schema/enums.yaml` | modify: new event types, `artifact_transitions`, `blocked_on_fields`, `unit_results` |
| `cli/schema/kickoff.yaml` | create: kickoff-brief schema |
| `cli/templates/adr.md` | modify: `status:` slot |
| `cli/test/{derive,slices,core,validate,hooks,cli}.test.js` | tests per task |
| `install.sh` | modify: `npm install` in `cli/` + link `house` bin |
| `skills/house2-orchestrator/references/doctrine.md` | create: doctrine v2 |
| `skills/house2-{shaper,orchestrator,builder}/SKILL.md` | create: the three v2 skills |
| `.house/gates.yml` | create: this repo's declarative stack gates (node) |

---

# Unit 1 — CLI enablers (builder session 1)

### Task 1: `renderDevState` — positional parse (R-1, the S1 GO condition) + Parked section

**Files:**
- Modify: `cli/lib/derive.js:45-75`
- Test: `cli/test/derive.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// append to cli/test/derive.test.js (it already imports mkTmpRepo from ./helpers.js and a run() helper;
// if this file's run() differs, copy the one from cli/test/cli.test.js verbatim)
test('render dev-state: refuses content wedged between generated block and manual marker (MF6 letter-gap)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'First slice');
  assert.equal(run(dir, 'render', 'dev-state').code, 0);           // baseline render
  const p = join(dir, 'docs/dev-state.md');
  const before = readFileSync(p, 'utf8');
  writeFileSync(p, before.replace('<!-- house:manual -->', 'REMEMBER: wedged hand note\n<!-- house:manual -->'));
  const r = run(dir, 'render', 'dev-state');
  assert.equal(r.code, 1);                                          // v1 exits 0 here — discriminating input
  assert.match(r.out, /wedged hand note/);                          // refusal names the content
  assert.match(readFileSync(p, 'utf8'), /REMEMBER: wedged hand note/); // file untouched on refusal
});

test('render dev-state: refuses content after the closing manual marker (tail)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'First slice');
  run(dir, 'render', 'dev-state');
  const p = join(dir, 'docs/dev-state.md');
  writeFileSync(p, readFileSync(p, 'utf8') + '\nstray tail line\n');
  const r = run(dir, 'render', 'dev-state');
  assert.equal(r.code, 1);
  assert.match(r.out, /stray tail line/);
});

test('render dev-state: parked gets its own section; abandoned renders nowhere', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Parky');                                         // 0001, state shaping
  run(dir, 'new', 'Deady');                                         // 0002, state shaping
  assert.equal(run(dir, 'state', '0001-parky', 'parked').code, 0);
  assert.equal(run(dir, 'state', '0002-deady', 'abandoned').code, 0);
  assert.equal(run(dir, 'render', 'dev-state').code, 0);
  const ds = readFileSync(join(dir, 'docs/dev-state.md'), 'utf8');
  assert.match(ds, /## Parked\n- \*\*0001-parky\*\*/);
  assert.doesNotMatch(ds, /0002-deady/);                            // abandoned: events + slice dir only
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd cli && node --test test/derive.test.js`
Expected: the three new tests FAIL (wedge test: got exit 0 expected 1; parked test: no `## Parked` section).

- [ ] **Step 3: Replace `renderDevState` with the positional parse**

Replace the whole function (`cli/lib/derive.js:45-75`) with:

```js
export function renderDevState(root) {
  const idx = buildIndex(root);
  const byState = (states) => idx.slices.filter(s => states.includes(s.state));
  const active = byState(['shaping', 'ready', 'building', 'gating', 'live_check']);
  const slated = byState(['idea']);
  const parked = byState(['parked']);
  const done = byState(['shipped']);                 // abandoned renders in NO section (spec, settled) —
                                                     // its history is the event log + the slice dir
  const line = (s) => `- **${s.id}** — ${s.title} · state: ${s.state} · ${s.progress.done}/${s.progress.total}` +
    (s.blocked_on ? ` · ⛔ blocked on ${s.blocked_on.gate ?? s.blocked_on}` : '');
  const inflight = idx.slices.filter(s => s.pr != null || (s.units ?? []).some(u => u.state === 'building'));
  const gen = ['<!-- generated by `house render dev-state` — do not hand-edit above the manual marker -->',
    '## Active', ...(active.length ? active.map(line) : ['- none']),
    '## In-flight', ...(inflight.length ? inflight.map(s => `- **${s.id}** — PR ${s.pr ?? 'n/a'}`) : ['- none']),
    '## Slated', ...(slated.length ? slated.map(line) : ['- none']),
    '## Parked', ...(parked.length ? parked.map(line) : ['- none']),
    '## Done', ...(done.length ? done.map(line) : ['- none']), ''].join('\n');
  const dsPath = join(root, 'docs/dev-state.md');
  const cur = existsSync(dsPath) ? readFileSync(dsPath, 'utf8') : '';
  const manual = /<!-- house:manual -->[\s\S]*?<!-- \/house:manual -->/.exec(cur)?.[0]
    ?? '<!-- house:manual -->\n<!-- /house:manual -->';
  const title = /^# .*$/m.exec(cur)?.[0] ?? '# dev state';
  // POSITIONAL PARSE — title | generated region | manual block | tail. The v1 regex-strip consumed the
  // letter-gap (content wedged between generated block and the manual marker) and silently dropped it
  // with exit 0 (the MF6 finding; S1 merge-gate GO condition). Here every non-blank line of the
  // pre-manual region must be one the generator itself emits — anything else is named and refused.
  if (cur) {
    const manStart = cur.indexOf('<!-- house:manual -->');
    const manEnd = manual === null ? -1 : cur.indexOf('<!-- /house:manual -->');
    const pre = manStart === -1 ? cur : cur.slice(0, manStart);
    const tail = manStart === -1 ? '' : cur.slice(manEnd + '<!-- /house:manual -->'.length);
    const GEN_HEADERS = new Set(['## Active', '## In-flight', '## Slated', '## Parked', '## Done',
      '## Done (hand-authored history — slices with no slice.yaml to derive from)']);
    const stray = [];
    for (const l of pre.split('\n')) {
      const t = l.trim();
      if (!t) continue;
      if (t === title.trim()) continue;
      if (t.startsWith('<!-- generated by')) continue;
      if (GEN_HEADERS.has(t)) continue;
      if (t === '- none' || t.startsWith('- **')) continue;        // generator bullet shapes
      stray.push(t);
    }
    for (const l of tail.split('\n')) if (l.trim()) stray.push(l.trim());
    if (stray.length)
      throw new Error(`dev-state.md has content outside the generated block / <!-- house:manual --> markers` +
        ` — move it inside the manual block first (no silent drops): ${JSON.stringify(stray[0])}`);
  }
  writeFileSync(dsPath, `${title}\n\n${gen}\n${manual}\n`);
}
```

Known residual (record, don't fix): a hand-written line crafted in the exact generator bullet shape
(`- **…`) inside the pre-manual region is indistinguishable from generated output and survives. The
merge-gate-verified failure was stray *prose*, which this catches. Note this in the task's commit body.

- [ ] **Step 4: Run the full suite**

Run: `cd cli && npm test`
Expected: all tests PASS, including the 3 new ones. If the existing `derive.test.js` baseline tests
assert on the old 4-section render, update their expectations to include `## Parked` — that section is
now part of the format.

- [ ] **Step 5: Re-render this repo's dev-state and commit**

```bash
house render dev-state && house validate
git add cli/lib/derive.js cli/test/derive.test.js docs/dev-state.md
git commit -m "fix(cli): renderDevState positional parse — refuse the letter-gap (S1 GO condition); Parked section"
```

### Task 2: `house block` / `house unblock` + gate auto-clear (R-2)

**Files:**
- Modify: `cli/schema/enums.yaml`, `cli/lib/slices.js`, `cli/bin/house.js`
- Test: `cli/test/slices.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// append to cli/test/slices.test.js
test('block/unblock: writes pinned shape, gate record with passing verdict auto-clears', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Blocky');
  assert.equal(run(dir, 'block', '0001-blocky', '--gate', 'spec_review', '--note', 'awaiting user').code, 0);
  let man = readYaml(join(dir, 'docs/slices/0001-blocky/slice.yaml'));
  assert.deepEqual(Object.keys(man.blocked_on).sort(), ['gate', 'note', 'since']);   // shape pinned
  assert.equal(man.blocked_on.gate, 'spec_review');
  // a NON-passing verdict must NOT clear the block
  run(dir, 'gate', 'spec_review', '--slice', '0001-blocky', '--verdict', 'changes_requested');
  man = readYaml(join(dir, 'docs/slices/0001-blocky/slice.yaml'));
  assert.ok(man.blocked_on);
  // a passing verdict clears it and emits slice.unblocked — no hand-edit anywhere (spec R-2 scenario)
  run(dir, 'gate', 'spec_review', '--slice', '0001-blocky', '--verdict', 'approved');
  man = readYaml(join(dir, 'docs/slices/0001-blocky/slice.yaml'));
  assert.equal(man.blocked_on, null);
  const ev = readFileSync(join(dir, '.house/events.jsonl'), 'utf8');
  assert.match(ev, /"gate\.requested"/);
  assert.match(ev, /"slice\.unblocked"/);
});

test('unblock: manual clear; refuses when not blocked; block refuses unknown gate', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Blocky');
  assert.equal(run(dir, 'block', '0001-blocky', '--gate', 'nonsense').code, 1);
  assert.equal(run(dir, 'unblock', '0001-blocky').code, 1);        // not blocked — refuse
  run(dir, 'block', '0001-blocky', '--gate', 'merge_gate');
  assert.equal(run(dir, 'unblock', '0001-blocky', '--note', 'user said proceed').code, 0);
  const man = readYaml(join(dir, 'docs/slices/0001-blocky/slice.yaml'));
  assert.equal(man.blocked_on, null);
});
```

If `slices.test.js` lacks a `run()`/`readYaml` helper, copy `run()` from `cli/test/cli.test.js` and use
`js-yaml` + `readFileSync` for `readYaml` exactly as the existing tests in that file do.

- [ ] **Step 2: Run to verify failure**

Run: `cd cli && node --test test/slices.test.js`
Expected: FAIL — `house block` is an unknown command (exit 2).

- [ ] **Step 3: Schema — pin the shape and the new event**

In `cli/schema/enums.yaml`: append `slice.unblocked` to `event_types` (dedicated-command-only — do NOT
add it to `free_form_events`), and add at the bottom:

```yaml
blocked_on_fields: [gate, note, since]   # the object `house block` writes; bare-string blocked_on is retired
```

- [ ] **Step 4: Implement in `cli/lib/slices.js`**

```js
export function block(root, id, args) {
  if (!args.gate || args.gate === true) throw new Error('--gate <name> is required');
  const { gate_verdicts } = loadEnums();
  if (!gate_verdicts[args.gate]) throw new Error(`unknown gate: ${args.gate}`);
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.blocked_on = { gate: args.gate, note: args.note ?? null, since: new Date().toISOString().slice(0, 10) };
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'gate.requested', { slice: id, actor: args.actor ?? 'agent',
    payload: { gate: args.gate, note: man.blocked_on.note } });
}

export function unblock(root, id, args) {
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  if (!man.blocked_on) throw new Error(`slice ${id} is not blocked`);
  const was = man.blocked_on;
  man.blocked_on = null;
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'slice.unblocked', { slice: id, actor: args.actor ?? 'agent',
    payload: { gate: was.gate, via: 'manual', note: args.note ?? null } });
}
```

And in `recordGate`, after the existing `appendEvent(root, 'gate.recorded', …)` line, add the auto-clear
— **only on a passing verdict** (a `changes_requested` record is exactly when the block must hold):

```js
  const man = readYaml(join(dir, 'slice.yaml'));
  const { passing_verdicts } = loadEnums();
  if (man.blocked_on?.gate === gate && (passing_verdicts[gate] ?? []).includes(args.verdict)) {
    man.blocked_on = null;
    writeYaml(join(dir, 'slice.yaml'), man);
    appendEvent(root, 'slice.unblocked', { slice: args.slice, actor: rec.by,
      payload: { gate, via: 'gate.recorded' } });
  }
```

In `cli/bin/house.js` add to the dispatch table:

```js
  block:   () => slices.block(need(root), pos[0], args),
  unblock: () => slices.unblock(need(root), pos[0], args),
```

- [ ] **Step 5: Run suite, commit**

Run: `cd cli && npm test` — expected: PASS.

```bash
git add cli/schema/enums.yaml cli/lib/slices.js cli/bin/house.js cli/test/slices.test.js
git commit -m "feat(cli): house block/unblock — blocked_on writer, pinned shape, passing-gate auto-clear"
```

### Task 3: `house artifact` — the artifact state machine gets a writer (R-2)

**Files:**
- Modify: `cli/schema/enums.yaml`, `cli/lib/slices.js`, `cli/bin/house.js`
- Test: `cli/test/slices.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('artifact: walks the state machine, refuses illegal jumps, records skip reasons', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Arty');
  // spec R-2 scenario: todo → approved is an illegal jump, named with the legal transitions
  const bad = run(dir, 'artifact', '0001-arty', 'spec', 'approved');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /illegal transition/);
  assert.equal(run(dir, 'artifact', '0001-arty', 'spec', 'draft').code, 0);
  assert.equal(run(dir, 'artifact', '0001-arty', 'spec', 'awaiting_review').code, 0);
  assert.equal(run(dir, 'artifact', '0001-arty', 'spec', 'approved').code, 0);
  const man = readYaml(join(dir, 'docs/slices/0001-arty/slice.yaml'));
  assert.equal(man.artifacts.spec.state, 'approved');
  assert.equal(run(dir, 'artifact', '0001-arty', 'mockups', 'skipped').code, 1);   // skip needs --reason
  assert.equal(run(dir, 'artifact', '0001-arty', 'mockups', 'skipped', '--reason', 'CLI slice, no UI').code, 0);
  assert.match(readFileSync(join(dir, '.house/events.jsonl'), 'utf8'), /"artifact\.state_changed"/);
});
```

- [ ] **Step 2: Run to verify failure** — `cd cli && node --test test/slices.test.js` → FAIL (unknown command).

- [ ] **Step 3: Schema — transitions + event type**

In `cli/schema/enums.yaml`: append `artifact.state_changed` to `event_types` (dedicated-only), and add:

```yaml
artifact_transitions:         # from → allowed to; `house artifact` fails closed on anything else
  todo: [draft, skipped]
  draft: [awaiting_review, superseded, skipped]
  awaiting_review: [approved, draft, superseded]
  approved: [done, superseded]
  done: [superseded]
  skipped: [draft]
  superseded: []
```

- [ ] **Step 4: Implement `artifactCmd` in `cli/lib/slices.js`**

```js
export function artifactCmd(root, id, name, to, args) {
  if (!name || !to) throw new Error('usage: house artifact <slice-id> <name> <state> [--reason …]');
  const { artifact_states, artifact_transitions } = loadEnums();
  if (!artifact_states.includes(to)) throw new Error(`unknown artifact state: ${to}`);
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  const cur = man.artifacts?.[name]?.state ?? 'todo';
  const allowed = artifact_transitions[cur] ?? [];
  if (!allowed.includes(to))
    throw new Error(`artifact '${name}': illegal transition ${cur} → ${to} (allowed: ${allowed.join(', ') || 'none'})`);
  if (to === 'skipped' && !args.reason) throw new Error(`artifact '${name}': skip requires --reason`);
  man.artifacts = man.artifacts ?? {};
  man.artifacts[name] = { ...(man.artifacts[name] ?? {}), state: to,
    ...(args.reason ? { skip_reason: args.reason } : {}), updated: new Date().toISOString().slice(0, 10) };
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'artifact.state_changed', { slice: id, actor: args.actor ?? 'agent',
    payload: { artifact: name, from: cur, to } });
}
```

Dispatch: `artifact: () => slices.artifactCmd(need(root), pos[0], pos[1], pos[2], args),`

- [ ] **Step 5: Run suite, commit**

`cd cli && npm test` → PASS.

```bash
git add cli/schema/enums.yaml cli/lib/slices.js cli/bin/house.js cli/test/slices.test.js
git commit -m "feat(cli): house artifact — artifact state machine writer, fail-closed transitions"
```

### Task 4: `house unit` — dispatch / heartbeat / finalize + incremental reports (R-2)

**Files:**
- Modify: `cli/schema/enums.yaml`, `cli/lib/slices.js`, `cli/bin/house.js`
- Test: `cli/test/slices.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('unit: dispatch allocates NN + report skeleton; heartbeat appends; finalize records 4-state', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Unity');
  const d = run(dir, 'unit', '0001-unity', 'dispatch', '--title', 'CLI enablers');
  assert.equal(d.code, 0);
  const man1 = readYaml(join(dir, 'docs/slices/0001-unity/slice.yaml'));
  assert.equal(man1.units.length, 1);
  assert.equal(man1.units[0].id, '01');
  assert.equal(man1.units[0].state, 'building');
  const report = join(dir, 'docs/slices/0001-unity/units/01-report.md');
  assert.match(readFileSync(report, 'utf8'), /never DONE/);        // fail-closed pending marker
  assert.equal(run(dir, 'unit', '0001-unity', 'heartbeat', '01', '--note', 'task 2/5 done').code, 0);
  assert.match(readFileSync(report, 'utf8'), /task 2\/5 done/);
  // finalize requires a valid 4-state result
  assert.equal(run(dir, 'unit', '0001-unity', 'finalize', '01', '--result', 'SHRUG').code, 1);
  assert.equal(run(dir, 'unit', '0001-unity', 'finalize', '01', '--result', 'DONE', '--note', 'all green').code, 0);
  const man2 = readYaml(join(dir, 'docs/slices/0001-unity/slice.yaml'));
  assert.equal(man2.units[0].state, 'finalized');
  assert.equal(man2.units[0].result, 'DONE');
  const ev = readFileSync(join(dir, '.house/events.jsonl'), 'utf8');
  assert.match(ev, /"unit\.dispatched"/); assert.match(ev, /"unit\.heartbeat"/); assert.match(ev, /"unit\.report"/);
  // and `house event` may no longer forge unit lifecycle events
  assert.equal(run(dir, 'event', 'unit.report', '--slice', '0001-unity').code, 1);
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (unknown command `unit`).

- [ ] **Step 3: Schema**

In `cli/schema/enums.yaml`: **remove** `unit.dispatched`, `unit.heartbeat`, `unit.report` from
`free_form_events` (they become dedicated-command-owned; `event_types` keeps them), and add:

```yaml
unit_results: [DONE, BLOCKED, NEEDS_CONTEXT, DEVIATION]   # the builder 4-state; absence of a finalized
                                                          # record is fail-closed UNKNOWN, never DONE
```

- [ ] **Step 4: Implement `unitCmd` in `cli/lib/slices.js`**

```js
export function unitCmd(root, id, action, unitId, args) {
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.units = man.units ?? [];
  const now = () => new Date().toISOString();
  if (action === 'dispatch') {
    if (!args.title) throw new Error('--title is required');
    const uid = String(man.units.length + 1).padStart(2, '0');
    man.units.push({ id: uid, title: args.title, state: 'building', result: null, dispatched: now() });
    mkdirSync(join(dir, 'units'), { recursive: true });
    writeFileSync(join(dir, 'units', `${uid}-report.md`),
      `# Unit ${uid} — ${args.title}\n\n- slice: ${id}\n- dispatched: ${now()}\n\n## Heartbeats\n\n## Result\n\n` +
      `(pending — absence of a finalized result is fail-closed unknown, never DONE)\n`);
    writeYaml(join(dir, 'slice.yaml'), man);
    appendEvent(root, 'unit.dispatched', { slice: id, actor: args.actor ?? 'orchestrator',
      payload: { unit: uid, title: args.title } });
    return uid;
  }
  const unit = man.units.find(u => u.id === unitId);
  if (!unit) throw new Error(`no such unit: ${unitId}`);
  const reportPath = join(dir, 'units', `${unitId}-report.md`);
  if (action === 'heartbeat') {
    if (!args.note) throw new Error('--note is required for a heartbeat');
    const cur = readFileSync(reportPath, 'utf8');
    writeFileSync(reportPath, cur.replace('\n## Result', `- ${now()} — ${args.note}\n\n## Result`));
    appendEvent(root, 'unit.heartbeat', { slice: id, actor: args.actor ?? 'builder',
      payload: { unit: unitId, note: args.note } });
  } else if (action === 'finalize') {
    const { unit_results } = loadEnums();
    if (!unit_results.includes(args.result))
      throw new Error(`--result must be one of ${unit_results.join('|')} — got: ${args.result}`);
    unit.state = 'finalized'; unit.result = args.result; unit.finalized = now();
    const cur = readFileSync(reportPath, 'utf8');
    writeFileSync(reportPath, cur.replace(/## Result[\s\S]*$/,
      `## Result\n\n**${args.result}** — ${args.note ?? ''}\n- finalized: ${now()}\n`));
    writeYaml(join(dir, 'slice.yaml'), man);
    appendEvent(root, 'unit.report', { slice: id, actor: args.actor ?? 'builder',
      payload: { unit: unitId, result: args.result } });
  } else throw new Error(`unknown unit action: ${action}`);
}
```

Dispatch: `unit: () => { const r = slices.unitCmd(need(root), pos[0], pos[1], pos[2], args); if (r) console.log(r); },`

- [ ] **Step 5: Run suite, commit**

`cd cli && npm test` → PASS.

```bash
git add cli/schema/enums.yaml cli/lib/slices.js cli/bin/house.js cli/test/slices.test.js
git commit -m "feat(cli): house unit — dispatch/heartbeat/finalize, incremental unit reports, 4-state results"
```

### Task 5: `house pr` + terminal events + `house log` with skip count (R-2, R-3)

These three are one task: the terminal-event emit and the log reader are the producer/consumer pair the
spec couples ("skip count lands with the first event-reading consumer"), and `pr` shares the same commit.

**Files:**
- Modify: `cli/lib/slices.js` (`prCmd`, `setState`), `cli/lib/core.js` (`readEvents`), `cli/lib/derive.js` (`log`), `cli/bin/house.js`, `cli/schema/enums.yaml`
- Test: `cli/test/slices.test.js`, `cli/test/core.test.js`, `cli/test/derive.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// slices.test.js
test('pr: sets pr + base_sha; state shipped emits slice.shipped (spec R-3 scenario)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Shippy');
  assert.equal(run(dir, 'pr', '0001-shippy').code, 1);             // nothing to set — refuse
  assert.equal(run(dir, 'pr', '0001-shippy', '--set', 'https://github.com/x/y/pull/9',
    '--base-sha', 'abc123').code, 0);
  const man = readYaml(join(dir, 'docs/slices/0001-shippy/slice.yaml'));
  assert.equal(man.pr, 'https://github.com/x/y/pull/9');
  assert.equal(man.base_sha, 'abc123');
  // walk to shipped through the gate machinery, then check the terminal event
  run(dir, 'gate', 'spec_review', '--slice', '0001-shippy', '--verdict', 'approved');
  run(dir, 'gate', 'plan_check', '--slice', '0001-shippy', '--verdict', 'GO');
  run(dir, 'state', '0001-shippy', 'ready');
  run(dir, 'state', '0001-shippy', 'building');
  run(dir, 'state', '0001-shippy', 'gating');
  run(dir, 'gate', 'merge_gate', '--slice', '0001-shippy', '--verdict', 'GO');
  assert.equal(run(dir, 'state', '0001-shippy', 'shipped').code, 0);
  const ev = readFileSync(join(dir, '.house/events.jsonl'), 'utf8');
  assert.match(ev, /"slice\.pr_set"/);
  assert.match(ev, /"slice\.shipped"/);
});

// core.test.js
test('readEvents: returns skip count for torn lines instead of thinning OBSERVED silently', () => {
  const dir = mkTmpRepo();
  appendFileSync(join(dir, '.house/events.jsonl'),
    '{"id":"X","ts":"2026-07-28T00:00:00Z","event":"work.discovered","slice":null,"payload":{}}\n' +
    '{"torn line no close\n');
  const { events, skipped } = readEvents(dir);
  assert.equal(events.length, 1);
  assert.equal(skipped, 1);
});

// derive.test.js
test('log: filters by slice, surfaces skip count, --json shape', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Loggy');
  run(dir, 'new', 'Other');
  appendFileSync(join(dir, '.house/events.jsonl'), '{"garbage\n');
  const r = run(dir, 'log', '--slice', '0001-loggy');
  assert.equal(r.code, 0);
  assert.match(r.out, /slice\.created/);
  assert.doesNotMatch(r.out, /0002-other/);
  assert.match(r.out, /1 unparseable line/);
  const j = JSON.parse(run(dir, 'log', '--slice', '0001-loggy', '--json').out);
  assert.equal(j.skipped, 1);
  assert.ok(Array.isArray(j.events));
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (`readEvents` returns an array today; `pr`/`log` unknown).

- [ ] **Step 3: Implement**

`cli/schema/enums.yaml`: append `slice.pr_set` to `event_types` (dedicated-only).

`cli/lib/core.js` — change `readEvents`'s return (its only current callers are tests; update them):

```js
export function readEvents(root) {
  const raw = readFileSync(join(root, '.house', 'events.jsonl'), 'utf8');
  // One torn line (an interrupted append, or a conflict artifact under `merge=union`) must not make the
  // whole OBSERVED log unreadable — but OBSERVED is a truth layer: thinning it must be COUNTED, not silent.
  const events = []; let skipped = 0;
  for (const l of raw.split('\n')) {
    if (!l.trim()) continue;
    try { events.push(JSON.parse(l)); } catch { skipped++; }
  }
  return { events, skipped };
}
```

`cli/lib/slices.js`:

```js
export function prCmd(root, id, args) {
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  const sha = args['base-sha'];
  if ((!args.set || args.set === true) && (!sha || sha === true))
    throw new Error('nothing to set: pass --set <pr-url> and/or --base-sha <sha>');
  if (args.set && args.set !== true) man.pr = args.set;
  if (sha && sha !== true) man.base_sha = sha;
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'slice.pr_set', { slice: id, actor: args.actor ?? 'orchestrator',
    payload: { pr: man.pr, base_sha: man.base_sha } });
}
```

In `setState`, after the existing `appendEvent(root, 'slice.state_changed', …)`:

```js
  if (to === 'shipped')
    appendEvent(root, 'slice.shipped', { slice: id, actor: args.actor ?? 'agent', payload: { pr: man.pr } });
  if (to === 'abandoned')
    appendEvent(root, 'slice.abandoned', { slice: id, actor: args.actor ?? 'agent', payload: {} });
```

`cli/lib/derive.js` (import `readEvents` from `./core.js`):

```js
export function log(root, args) {
  const { events, skipped } = readEvents(root);
  const rows = events.filter(e => !args.slice || e.slice === args.slice);
  const shown = args.n ? rows.slice(-Number(args.n)) : rows;
  if (args.json) return JSON.stringify({ skipped, events: shown }, null, 2);
  const head = skipped ? [`(warning: ${skipped} unparseable line${skipped === 1 ? '' : 's'} skipped — OBSERVED is thinner than it looks)`] : [];
  return head.concat(shown.map(e => `${e.ts}  ${e.event}  ${e.slice ?? '-'}  ${JSON.stringify(e.payload ?? {})}`))
    .join('\n') || '(no events)';
}
```

`cli/bin/house.js` dispatch:

```js
  pr:  () => slices.prCmd(need(root), pos[0], args),
  log: () => console.log(derive.log(need(root), args)),
```

- [ ] **Step 4: Run suite** — `cd cli && npm test` → PASS (fix any existing `readEvents` destructuring in tests).

- [ ] **Step 5: Commit**

```bash
git add cli/schema/enums.yaml cli/lib/{core,slices,derive}.js cli/bin/house.js cli/test/
git commit -m "feat(cli): house pr + terminal slice events + house log with OBSERVED skip count"
```

### Task 6: read side — `house status <id> --json`, `house next --slice`, `house validate --json` (R-4)

**Files:**
- Modify: `cli/lib/derive.js`, `cli/bin/house.js`
- Test: `cli/test/derive.test.js`, `cli/test/cli.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// derive.test.js
test('status <id>: single-slice JSON includes tasks; unknown id refuses', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Solo');
  run(dir, 'new', 'Noise');
  const j = JSON.parse(run(dir, 'status', '0001-solo', '--json').out);
  assert.equal(j.slices.length, 1);
  assert.equal(j.slices[0].id, '0001-solo');
  assert.ok('tasks' in j.slices[0]);                               // single-slice view carries tasks
  assert.equal(run(dir, 'status', '0009-ghost').code, 1);
});

test('next --slice: only the named slice; excludes parked/abandoned slices repo-wide', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Busy');
  run(dir, 'new', 'Idle');
  const tasks = 'tasks:\n  - id: T1\n    title: do busy thing\n    state: todo\n    verify: "true"\n';
  writeFileSync(join(dir, 'docs/slices/0001-busy/tasks.yaml'), tasks);
  writeFileSync(join(dir, 'docs/slices/0002-idle/tasks.yaml'),
    'tasks:\n  - id: T1\n    title: do idle thing\n    state: todo\n    verify: "true"\n');
  run(dir, 'state', '0002-idle', 'parked');
  const scoped = run(dir, 'next', '--slice', '0001-busy');
  assert.match(scoped.out, /do busy thing/);
  assert.doesNotMatch(scoped.out, /idle/);
  const all = run(dir, 'next');
  assert.doesNotMatch(all.out, /idle/);                            // parked never surfaces as ready work
});

// cli.test.js
test('validate --json: machine-readable findings', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Val');
  writeFileSync(join(dir, 'docs/slices/0001-val/stray.txt'), 'orphan');
  const r = run(dir, 'validate', '--json');
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.ok(j.findings.some(f => f.msg.includes('orphan file')));
  assert.equal(typeof j.errors, 'number');
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

`cli/lib/derive.js` — replace `status` and `next`:

```js
export function status(root, args, id = args?._id ?? null) {
  const idx = buildIndex(root);
  const picked = id ? idx.slices.filter(s => s.id === id) : idx.slices;
  if (id && !picked.length) throw new Error(`no such slice: ${id}`);
  if (args.json)                                                    // single-slice view keeps tasks; repo view drops them
    return JSON.stringify({ slices: picked.map(({ tasks, ...s }) => id ? { ...s, tasks } : s) }, null, 2);
  return picked.map(s => `${s.id}  [${s.state}]  ${s.progress.done}/${s.progress.total}  ${s.title}` +
    (s.blocked_on ? `  ⛔ ${s.blocked_on.gate ?? s.blocked_on}` : '')).join('\n') || '(no slices)';
}
export const list = (root, args) => status(root, args, null);       // list stays the whole-repo projection

const WORKABLE = ['shaping', 'ready', 'building', 'gating', 'live_check', 'idea'];
export function next(root, args) {
  const idx = buildIndex(root);
  const pool = idx.slices.filter(s => WORKABLE.includes(s.state))   // parked/abandoned never offer work
    .filter(s => !args.slice || s.id === args.slice);
  const ready = pool.flatMap(s => (s.tasks ?? [])
    .filter(t => t.state === 'todo' && (t.depends_on ?? []).every(d => s.tasks.find(x => x.id === d)?.state === 'done'))
    .map(t => ({ slice: s.id, id: t.id, title: t.title })));
  return args.json ? JSON.stringify(ready, null, 2) : ready.map(t => `${t.slice} ${t.id} ${t.title}`).join('\n') || '(nothing ready)';
}
```

`cli/bin/house.js`:

```js
  status:  () => console.log(derive.status(need(root), args, pos[0] ?? null)),
  validate: () => {
    const errs = validate(need(root), args);
    if (args.json) console.log(JSON.stringify({ errors: errs.filter(e => e.level === 'error').length, findings: errs }, null, 2));
    else errs.forEach(e => console.error(`${e.level}: ${e.path}: ${e.msg}`));
    process.exit(errs.some(e => e.level === 'error') ? 1 : 0);
  },
```

- [ ] **Step 4: Run suite** — PASS. - [ ] **Step 5: Commit**

```bash
git add cli/lib/derive.js cli/bin/house.js cli/test/
git commit -m "feat(cli): read side — status <id> --json, next --slice, validate --json; parked offers no work"
```

### Task 7: validate ride-alongs — roadmap lint, style-attr url(), tasks.yaml structure, ADR status: (R-5)

**Files:**
- Modify: `cli/lib/validate.js`, `cli/templates/adr.md`
- Test: `cli/test/validate.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('validate: roadmap [NNNN] refs must exist; style-attr url() breaks self-containment; tasks.yaml structure', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Vali');
  writeFileSync(join(dir, 'docs/roadmap.md'), '# Roadmap\n\n- [0001] real ref\n- [0007] ghost ref\n');
  mkdirSync(join(dir, 'docs/slices/0001-vali/mockups'), { recursive: true });
  writeFileSync(join(dir, 'docs/slices/0001-vali/mockups/m.html'),
    '<div style="background: url(https://evil.example/x.png)">hi</div>');
  writeFileSync(join(dir, 'docs/slices/0001-vali/tasks.yaml'),
    'tasks:\n  - id: T1\n    title: a\n    state: todo\n    verify: "true"\n' +
    '  - id: T1\n    title: dup id\n    state: todo\n' +                       // duplicate id → error
    '  - id: T3\n    title: b\n    state: todo\n    depends_on: [T9]\n' +      // ghost dep → error
    '  - id: T4\n    title: c\n    state: todo\n    frobnicate: yes\n');       // unknown key → warning
  const r = run(dir, 'validate', '--json');
  assert.equal(r.code, 1);
  const msgs = JSON.parse(r.out).findings.map(f => `${f.level}:${f.msg}`).join('\n');
  assert.match(msgs, /error:.*\[0007\].*no such slice/);
  assert.doesNotMatch(msgs, /\[0001\].*no such slice/);
  assert.match(msgs, /error:.*style.*url\(/i);
  assert.match(msgs, /error:.*duplicate task id/);
  assert.match(msgs, /error:.*depends_on.*T9/);
  assert.match(msgs, /warning:.*unknown key.*frobnicate/);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement in `cli/lib/validate.js`**

Inside the mockups loop, extend the external-ref check (the existing `if` gains one more pattern):

```js
      if (/\b(?:src|href)\s*=\s*["']https?:\/\//i.test(html) || /@import\s+url\(/i.test(html)
          || /style\s*=\s*["'][^"']*url\(\s*["']?\s*https?:\/\//i.test(html))
        err(join(mockups, f), 'mockup has external ref (src/href/@import/style url()) — self-containment contract violated');
```

Extend the tasks.yaml block (after the existing per-task checks):

```js
    const TASK_KEYS = new Set(['id', 'title', 'state', 'verify', 'depends_on', 'evidence', 'note', 'skip_reason']);
    if (existsSync(tasksFile)) {
      const ts = readYaml(tasksFile)?.tasks ?? [];
      const ids = new Set();
      for (const t of ts) {
        if (!t.id || !t.title || !t.state) err(tasksFile, `task ${t.id ?? '?'}: id, title, state are required`);
        if (ids.has(t.id)) err(tasksFile, `duplicate task id: ${t.id}`);
        ids.add(t.id);
        for (const d of t.depends_on ?? []) if (!ts.some(x => x.id === d))
          err(tasksFile, `task ${t.id}: depends_on unknown task ${d}`);
        for (const k of Object.keys(t)) if (!TASK_KEYS.has(k))
          err(tasksFile, `task ${t.id}: unknown key '${k}' — YAML comments and stray keys carry no meaning`, 'warning');
      }
    }
```

After the ADR loop, add the roadmap lint (spec §3.5: "validate checks only that referenced ids exist"):

```js
  const roadmap = join(root, 'docs/roadmap.md');
  if (existsSync(roadmap)) {
    const text = readFileSync(roadmap, 'utf8');
    for (const m of text.matchAll(/\[(\d{4})\]/g)) {
      const hit = existsSync(slicesDir) && readdirSync(slicesDir).some(d => d.startsWith(`${m[1]}-`));
      if (!hit) err(roadmap, `roadmap references [${m[1]}] but no such slice exists`);
    }
  }
```

`cli/templates/adr.md`: add a `status: "{{DATE}} — proposed"` line to the frontmatter, directly above the
existing `state:` line (spec §3.3: free-text `status:` + closed `state:` enum on every artifact).

- [ ] **Step 4: Run suite; also run `house validate` on THIS repo** (the roadmap lint now fires here —
`docs/roadmap.md` references `0001` which exists, so it must stay green). Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add cli/lib/validate.js cli/templates/adr.md cli/test/validate.test.js
git commit -m "feat(cli): validate ride-alongs — roadmap id lint, style url() grep, tasks.yaml structure, ADR status slot"
```

### Task 8: kickoff-brief schema + validation (R-14)

**Files:**
- Create: `cli/schema/kickoff.yaml`
- Modify: `cli/lib/validate.js`
- Test: `cli/test/validate.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('validate: kickoff brief — required fields, version int, tasks must exist', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Kicky');
  writeFileSync(join(dir, 'docs/slices/0001-kicky/tasks.yaml'),
    'tasks:\n  - id: T1\n    title: a\n    state: todo\n    verify: "true"\n');
  const manPath = join(dir, 'docs/slices/0001-kicky/slice.yaml');
  const man = readYaml(manPath);
  man.kickoff = { version: 'one', unit: '01', tasks: ['T1', 'T9'], stakes: 'low', attended: true };
  // missing scope_guards; version not an int; T9 does not exist
  writeFileSync(manPath, yaml.dump(man));
  const r = run(dir, 'validate', '--json');
  assert.equal(r.code, 1);
  const msgs = JSON.parse(r.out).findings.map(f => f.msg).join('\n');
  assert.match(msgs, /kickoff.*scope_guards.*required/);
  assert.match(msgs, /kickoff.*version.*integer/);
  assert.match(msgs, /kickoff.*T9/);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Create `cli/schema/kickoff.yaml`**

```yaml
# The versioned builder kickoff brief (spec R-14). ONE schema, read by sender (orchestrator) and
# receiver (builder) alike — the v1 four-field sender/receiver divergence is structurally impossible.
# A builder receiving a brief that fails validation returns NEEDS_CONTEXT naming missing_inputs.
schema_version: 1
required: [version, unit, tasks, scope_guards, stakes, attended]
optional: [plan_check_commitments, fold_forward, stack, notes]
types:
  version: int          # incremented on EVERY reissue — a builder must be able to say "brief v3, not v2"
  unit: string          # unit id this brief dispatches (units[] entry)
  tasks: list           # task ids from tasks.yaml, in dispatch order
  scope_guards: list    # the "NOT this slice" lines, verbatim from the plan
  stakes: string        # free text: what a wrong-but-plausible decision costs here
  attended: bool        # false ⇒ every hard gate halts at gate.requested (never downgrades)
  plan_check_commitments: list   # folded advisories — each is a commitment, not a suggestion
  fold_forward: list    # carry items owed by this unit
  stack: string         # key into .house/gates.yml; unknown/absent stack ⇒ NEEDS_CONTEXT
  notes: string
```

- [ ] **Step 4: Implement the check in `cli/lib/validate.js`**

Load once near the top of `validate()` (`kickoff.yaml` sits next to `enums.yaml`; mirror `loadEnumsPath`):

```js
import { fileURLToPath } from 'node:url';
const kickoffSchema = readYaml(fileURLToPath(new URL('../schema/kickoff.yaml', import.meta.url)));
```

Inside the per-slice loop, after the artifact checks:

```js
    if (man.kickoff != null) {
      const k = man.kickoff;
      for (const f of kickoffSchema.required) if (!(f in k)) err(manFile, `kickoff: '${f}' is required`);
      if ('version' in k && !Number.isInteger(k.version)) err(manFile, `kickoff: version must be an integer`);
      const known = new Set([...kickoffSchema.required, ...kickoffSchema.optional]);
      for (const key of Object.keys(k)) if (!known.has(key)) err(manFile, `kickoff: unknown field '${key}'`, 'warning');
      const tIds = (existsSync(tasksFile) ? readYaml(tasksFile)?.tasks ?? [] : []).map(t => t.id);
      for (const t of k.tasks ?? []) if (!tIds.includes(t)) err(manFile, `kickoff: brief names task ${t} which is not in tasks.yaml`);
    }
```

(Note: `tasksFile` is already defined in this loop — reuse it; do not redeclare.)

- [ ] **Step 5: Run suite, commit**

```bash
git add cli/schema/kickoff.yaml cli/lib/validate.js cli/test/validate.test.js
git commit -m "feat(cli): kickoff-brief schema + validation — one schema for sender and receiver"
```

### Task 9: `house hook` — advisory hooks + `hook.degraded` + `init` settings merge (R-12)

**Files:**
- Create: `cli/lib/hooks.js`
- Modify: `cli/bin/house.js`, `cli/schema/enums.yaml`, `cli/lib/slices.js` (`init`)
- Test: `cli/test/hooks.test.js` (create)

- [ ] **Step 1: Write the failing tests**

```js
// cli/test/hooks.test.js (new file — reuse the run() helper pattern, but hooks need stdin:)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkTmpRepo } from './helpers.js';

const BIN = fileURLToPath(new URL('../bin/house.js', import.meta.url));
const hook = (cwd, event, input) => {
  try { return { out: execFileSync(process.execPath, [BIN, 'hook', event],
    { cwd, encoding: 'utf8', input: JSON.stringify(input) }), code: 0 }; }
  catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status }; }
};

test('hook: exits 0 with no output outside a house repo — sessions there are untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nothouse-'));
  const r = hook(dir, 'session-start', { source: 'startup' });
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), '');
});

test('hook session-start: emits session.started + injects status as additionalContext', () => {
  const dir = mkTmpRepo();
  execFileSync(process.execPath, [BIN, 'new', 'Hooky'], { cwd: dir });
  const r = hook(dir, 'session-start', { source: 'startup', session_id: 's1' });
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.match(j.hookSpecificOutput.additionalContext, /0001-hooky/);
  assert.match(readFileSync(join(dir, '.house/events.jsonl'), 'utf8'), /"session\.started"/);
});

test('hook pre-write: asks on kernel-owned paths, silent elsewhere', () => {
  const dir = mkTmpRepo();
  const guarded = hook(dir, 'pre-write',
    { tool_name: 'Edit', tool_input: { file_path: join(dir, '.house/events.jsonl') } });
  const j = JSON.parse(guarded.out);
  assert.equal(j.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(j.hookSpecificOutput.permissionDecisionReason, /house/);
  const free = hook(dir, 'pre-write',
    { tool_name: 'Edit', tool_input: { file_path: join(dir, 'src/app.js') } });
  assert.equal(free.out.trim(), '');                               // no opinion outside kernel paths
});

test('hook subagent-stop: advisory names units still building', () => {
  const dir = mkTmpRepo();
  execFileSync(process.execPath, [BIN, 'new', 'Subby'], { cwd: dir });
  execFileSync(process.execPath, [BIN, 'unit', '0001-subby', 'dispatch', '--title', 'half-done unit'], { cwd: dir });
  const r = hook(dir, 'subagent-stop', { agent_type: 'general-purpose' });
  const j = JSON.parse(r.out);
  assert.match(j.hookSpecificOutput.additionalContext, /01.*no finalized report|half-done unit/);
});

test('init: merges hooks into .claude/settings.json without clobbering existing hooks; idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'house-init-'));
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify(
    { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'my-precious-hook.sh' }] }] } }, null, 2));
  execFileSync(process.execPath, [BIN, 'init'], { cwd: dir });
  execFileSync(process.execPath, [BIN, 'init'], { cwd: dir });     // run twice — must be idempotent
  const s = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
  const cmds = s.hooks.SessionStart.flatMap(h => h.hooks.map(x => x.command));
  assert.ok(cmds.includes('my-precious-hook.sh'));                 // existing hook preserved byte-for-byte
  assert.equal(cmds.filter(c => c.includes('house hook session-start')).length, 1);
  assert.ok(s.hooks.PreToolUse.some(h => h.matcher === 'Edit|Write|MultiEdit'));
});
```

- [ ] **Step 2: Run to verify failure** — `cd cli && node --test test/hooks.test.js` → FAIL (unknown command `hook`).

- [ ] **Step 3: Schema + implementation**

`cli/schema/enums.yaml`: append `hook.degraded` to `event_types` (dedicated-only — "fail open with a
recorded event": the gap in enforcement is itself visible in OBSERVED).

Create `cli/lib/hooks.js`:

```js
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { appendEvent, readYaml } from './core.js';
import { status, next } from './derive.js';

// Every handler: advisory-only in S2 (spec: Recorded deviations). Every path FAILS OPEN —
// a broken hook must never cost a session; it records hook.degraded instead (best-effort).
export function run(root, event, stdinText) {
  if (!root) return '';                              // not a house repo — exit 0, no output, no opinion
  let input = {};
  try { input = JSON.parse(stdinText || '{}'); } catch { /* malformed stdin — treat as empty */ }
  try {
    switch (event) {
      case 'session-start': {
        appendEvent(root, 'session.started', { actor: 'hook',
          payload: { source: input.source ?? null, session_id: input.session_id ?? null } });
        const ctx = `house repo state:\n${status(root, {})}\n\nready tasks:\n${next(root, {})}`;
        return JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } });
      }
      case 'session-end': {
        appendEvent(root, 'session.ended', { actor: 'hook',
          payload: { session_id: input.session_id ?? null } });
        return '';
      }
      case 'pre-write': {
        const p = input.tool_input?.file_path ?? '';
        const rel = relative(root, p);
        const guarded = rel === '.house' || rel.startsWith('.house/') ||
          (/^docs\/slices\/[^/]+\/gates\//.test(rel)) ||
          (/^docs\/slices\/[^/]+\/(slice|tasks)\.yaml$/.test(rel));
        if (!guarded) return '';
        return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `kernel-owned file (one writer per field): prefer the house CLI ` +
            `(house gate/task/state/block/artifact/unit/pr) over hand-edits to ${rel}` } });
      }
      case 'subagent-stop': {
        const dir = join(root, 'docs/slices');
        const open = [];
        if (existsSync(dir)) for (const d of readdirSync(dir)) {
          const manFile = join(dir, d, 'slice.yaml');
          if (!existsSync(manFile)) continue;
          for (const u of readYaml(manFile)?.units ?? [])
            if (u.state === 'building') open.push(`${d}/units/${u.id} ("${u.title}") has no finalized report`);
        }
        if (!open.length) return '';
        return JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStop',
          additionalContext: `advisory: ${open.join('; ')} — absence of a finalized unit record is ` +
            `fail-closed unknown, never DONE (house unit <slice> finalize <id> --result …)` } });
      }
      default: return '';                            // unknown hook event — no opinion, exit 0
    }
  } catch (e) {
    try { appendEvent(root, 'hook.degraded', { actor: 'hook', payload: { event, error: e.message } }); }
    catch { /* even the record failed — still exit 0; a hook must never cost a session */ }
    return '';
  }
}
```

`cli/bin/house.js` — the `hook` command must NOT use `need(root)` (it must exit 0 outside a house repo)
and must never exit non-zero. Add to the dispatch table:

```js
  hook: () => {
    const out = hooks.run(repoRoot(), pos[0], readFileSync(0, 'utf8'));
    if (out) console.log(out);
  },
```

with `import * as hooks from '../lib/hooks.js';` and `readFileSync` imported from `node:fs` at top.
Note: `readFileSync(0, …)` blocks for stdin — Claude Code always pipes hook stdin (even empty), and the
tests pass `input:`; nothing else invokes `house hook`.

`cli/lib/slices.js` — in `init()`, add the settings merge (call it at the end of `init`):

```js
function mergeClaudeHooks(dir) {
  const p = join(dir, '.claude', 'settings.json');
  let cur = {};
  if (existsSync(p)) {
    try { cur = JSON.parse(readFileSync(p, 'utf8')); }
    catch { throw new Error(`.claude/settings.json is not valid JSON — fix it by hand; refusing to touch it`); }
  }
  cur.hooks = cur.hooks ?? {};
  const add = (ev, matcher, command, extra = {}) => {
    const arr = cur.hooks[ev] = cur.hooks[ev] ?? [];
    if (arr.some(h => (h.hooks ?? []).some(x => x.command === command))) return;   // idempotent
    arr.push({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command, ...extra }] });
  };
  add('SessionStart', null, 'house hook session-start');
  add('SessionEnd', null, 'house hook session-end', { async: true });
  add('PreToolUse', 'Edit|Write|MultiEdit', 'house hook pre-write');
  add('SubagentStop', null, 'house hook subagent-stop');
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(p, JSON.stringify(cur, null, 2) + '\n');
}
```

- [ ] **Step 4: Run suite** — `cd cli && npm test` → PASS.

- [ ] **Step 5: Wire this repo + commit** — run `house init` here (idempotent; adds the hooks block to
this repo's `.claude/settings.json` — it currently has none), then:

```bash
git add cli/lib/hooks.js cli/lib/slices.js cli/bin/house.js cli/schema/enums.yaml cli/test/hooks.test.js .claude/settings.json
git commit -m "feat(cli): house hook — advisory SessionStart/End, PreToolUse ask, SubagentStop nudge; hook.degraded; init merges settings"
```

### Task 10: `install.sh` installs the CLI (R-6)

**Files:**
- Modify: `install.sh`
- Test: manual verification commands (shell script — no unit test; ADR-0003 bar still applies via the commands below)

- [ ] **Step 1: Read `install.sh` end-to-end** (it currently only symlinks `skills/*` → `~/.claude/skills/`).
Confirm whether its skill loop globs `skills/*` (then `house2-*` dirs ride along automatically in Unit 2)
or names skills explicitly (then Unit 2's tasks must add them).

- [ ] **Step 2: Append the CLI install block** (adapt variable names to the file's existing style):

```sh
# ---- house CLI (v2 S2): deps + global bin ------------------------------------
# cli/node_modules is gitignored — a bare symlink of bin/house.js cannot resolve js-yaml.
echo "Installing house CLI dependencies…"
(cd "$(dirname "$0")/cli" && npm install --no-fund --no-audit --silent)
if command -v house >/dev/null 2>&1; then
  echo "house CLI already on PATH: $(command -v house)"
else
  echo "Linking house CLI (npm link)…"
  (cd "$(dirname "$0")/cli" && npm link) || {
    echo "npm link failed (global prefix not writable?) — falling back to ~/.local/bin"
    mkdir -p "$HOME/.local/bin"
    ln -sf "$(cd "$(dirname "$0")/cli" && pwd)/bin/house.js" "$HOME/.local/bin/house"
    case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "NOTE: add ~/.local/bin to PATH";; esac
  }
fi
```

- [ ] **Step 3: Verify** — run `./install.sh` twice (idempotency), then from an unrelated directory:
`house --help || house status; echo $?` → the usage line / exit 2 proves the bin resolves `js-yaml`
from anywhere. Expected: no `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat(install): npm install + link the house CLI — skills that shell out get a working bin"
```

### Task 11: Unit 1 closeout

- [ ] Run the full bar: `cd cli && npm test` (all green) and `house validate` (exit 0) and
`house render dev-state` (exit 0 — proves this repo's real dev-state survives the stricter parse).
- [ ] `house unit 0001-house-v2-s2-skills-rewrite heartbeat <unit-id> --note "unit 1 tasks complete"` and
finalize per the builder skill's own contract (the orchestrator dispatched this unit; the builder
finalizes with `--result DONE` only when everything above is green).

---

# Unit 2 — doctrine v2 + the three skills (builder session 2)

Prose tasks. TDD does not apply; the *check* for each task is the R-11 ledger (Task 16) plus the
mechanical greps written into each step. The point-never-restate rule is testable: **grep the new prose
for enum literals and find zero.**

### Task 12: doctrine v2

**Files:**
- Create: `skills/house2-orchestrator/references/doctrine.md`

- [ ] **Step 1: Write the file with exactly these sections, in order:**

1. **The kernel contract** (~10 lines): the three state layers + one-writer rule; "an unrecorded gate did
   not run"; "never parse transcripts as state"; `git clone` + a text editor stays sufficient. Pointer to
   `cli/schema/enums.yaml` as the SOLE normative source for states/gates/verdicts/tiers — with the
   standing rule verbatim: **"doctrine may point at an enum, never restate one."**
2. **The canonical stage table.** Named states only (stage numbers 0–11 and 4¼/7½/9½ are dead). Columns:
   *state (name from `slice_states`) · owner · entry precondition · exit artifact · gate rung (name from
   `required_gates`)*. One row per state; cell contents are prose ("shaper", "user-approved spec"), never
   enum lists. Loop-backs enumerated below the table: plan-check NO_GO → replan; spec defect found
   building → respec (state back via the legal `building → shaping` edge); scope explosion → decompose
   into N minted slices; **iteration cap 2 → hard stop, surface to the user**.
3. **The rigor dial.** One dial, set at intake by the shaper, stored in `slice.yaml` `rigor:` (values:
   pointer to `tiers` in enums). Per-tier artifact expectations in prose. The floor verbatim: **"the dial
   never skips the merge gate, and proposing to skip it is itself a hard gate."** Unattended rule:
   `attended: false` in the kickoff ⇒ every hard gate halts at `gate.requested` — a panel is never
   silently downgraded to a single reviewer.
4. **Hard gates.** The list by *name* (pointer to `gate_verdicts` keys) + the fail-closed philosophy
   verbatim: "unsure whether a gate is hard → treat it as hard"; "INCONCLUSIVE is not a pass"; "a false
   NO-GO is safe, a false GO is not"; "running unattended never downgrades a hard gate". Every halt
   writes `house block` (which emits `gate.requested`).
5. **Merge-gate cadence** (settled): per-slice, `git diff $(base_sha)...HEAD`; builder self-review is
   per-unit. Reviewer independence axes (perspective/architecture/context) + why Opus builds while Fable
   reviews (ADR-0001). "Don't trust the report" — the reviewer re-runs build/tests personally. The
   squash-merge caveat with its reasoning (PR state, not `git branch --merged`, decides merged-ness).
6. **The doc model & routing table** (carried from v1, updated): one job per doc; slice artifacts live in
   `docs/slices/<id>/` (literal paths, no placeholders); `docs/superpowers/` is retired for new work;
   roadmap = durable strategy; dev-state = generated + manual marker block; ADRs = the why. The
   dev-state allowlist: hand content lives ONLY between the manual markers.
7. **Composition contract (take / suppress / own).** Take: TDD's iron law; brainstorming's dialogue.
   Suppress: writing-plans' execution menu + worktree assumption; brainstorming's forced terminal
   transition; `finishing-a-development-branch` and `executing-plans` drop from the loops entirely.
   Own: the house loop itself — dispatch, gates, reconcile.
8. **Hygiene checklist** (carried from v1, stated ONCE): per-merge teardown; session-end sweep;
   "never shape inline — that's a house2-shaper session"; health-sweep findings → `work.discovered` →
   roadmap backlog or `accepted.md`.
9. **The reconcile-subagent contract** (carried from v1): changes only docs, reports what it changed;
   dispatched at stage transitions, session end, and merges.

- [ ] **Step 2: Mechanical check** — from repo root:
`grep -nE '\b(idea|shaping|ready|building|gating|live_check|shipped|parked|abandoned)\b.*\b(idea|shaping|ready|building|gating|live_check|shipped|parked|abandoned)\b' skills/house2-orchestrator/references/doctrine.md`
Expected: zero hits — no line enumerates two or more state names (single mentions in prose rows are fine;
a *list* is a restated enum). Same spot-check for verdict lists (`GO.*NO_GO`, `approved.*changes_requested`).

- [ ] **Step 3: Commit**

```bash
git add skills/house2-orchestrator/references/doctrine.md
git commit -m "docs(doctrine): doctrine v2 — judgment-only, points at enums.yaml, settled contradictions written down"
```

### Task 13: `skills/house2-shaper/SKILL.md`

**Files:**
- Create: `skills/house2-shaper/SKILL.md`

- [ ] **Step 1: Write the skill.** Frontmatter `name: house2-shaper`, description triggering on "new
idea/slice/decision needing shaping in a `.house/` repo". Then, in order:

1. **Preflight (mutual refusal):** run `house status`; exit 2 (not a house repo) ⇒ STOP: "this repo is
   not house-v2-migrated — use the v1 `house-shaper` skill or run `house init`". Never continue v1-style.
2. **Intake — mint FIRST:** `house new "<title>" --kind <kind> --rigor <tier> --appetite <appetite>`
   before any research or dialogue (a dying shaping session must leave a resumable `state: shaping`
   slice, not an orphan spec). Mode/tier fork (buildable vs decision-only; rigor dial per doctrine §3)
   happens HERE, before brainstorming. Appetite is declared now, in the manifest.
3. **Research:** dispatch subagents ("read a lot, conclude a little; change nothing"), digests persisted
   to `docs/slices/<id>/research/` — never only in the transcript.
4. **Brainstorm:** compose `superpowers:brainstorming` + `intent-first-spec-anchored` inline (the
   dialogue CANNOT be a subagent). Suppress brainstorming's spec path (spec lives at
   `docs/slices/<id>/spec.md`) and its forced transition to writing-plans (the loop below owns sequencing).
5. **Spec** → slice dir; `house artifact <id> spec draft` → `awaiting_review`; ⛔ user review;
   `house gate spec_review --slice <id> --verdict approved --by <user>` on approval, then
   `house artifact <id> spec approved`. Decision-only mode: ADR via `house new "<t>" --adr`, ⛔
   `adr_review` gate, reconcile, STOP (nothing to build).
6. **Mockups/spike** (when the tier calls for them): `mockups/` in the slice dir, self-containment
   contract (validate enforces it), ⛔ `mockup_signoff`.
7. **Plan** → `docs/slices/<id>/plan.md` via `superpowers:writing-plans` (suppress its execution-menu
   handoff and worktree assumption). Author `tasks.yaml` from the schema in the validate rules — id,
   title, state, verify, depends_on only; **no meaning in YAML comments** (they die on the first
   `house task` tick).
8. **Plan-check:** one fresh reviewer subagent (Fable), five lenses (arch-fit · spec-coverage ·
   risk/sequencing · testability · simpler-path); record via
   `house gate plan_check --slice <id> --verdict <GO|GO_WITH_FIXES|NO_GO> --payload '{"must_fix":[…],"advisory_folded":[…]}'`.
   A folded-in advisory is a commitment.
9. **Handoff:** write the kickoff block (schema: `cli/schema/kickoff.yaml`) into `slice.yaml`, bump
   `version` on every reissue; `house validate --strict` must be green (no `[NEEDS CLARIFICATION`
   markers); `house state <id> ready`. Hand to a `house2-orchestrator` session.

Keep-verbatim rules this file owns (from the R-11 ledger): session-shape economics · research-dispatch
contract · brainstorm-cannot-be-a-subagent · read-doctrine-on-demand · folded-advisory-is-a-commitment ·
the five plan-check lenses · scope-guards-as-negative-space · fail-closed gate philosophy (pointer to
doctrine §4). Model routing: shaping session + plan-check on Fable; research + reconcile subagents on Opus.

- [ ] **Step 2: Check** — the file contains zero stage numbers, zero enum lists, zero
`docs/superpowers/` paths; every state/gate/verdict it names appears as a `house` command argument, not a
list. `wc -l` target: ≤ 90.

- [ ] **Step 3: Commit** — `git add skills/house2-shaper && git commit -m "feat(skills): house2-shaper — thin actor over house state"`

### Task 14: `skills/house2-orchestrator/SKILL.md`

**Files:**
- Create: `skills/house2-orchestrator/SKILL.md` (its `references/doctrine.md` landed in Task 12)

- [ ] **Step 1: Write the skill.** Frontmatter `name: house2-orchestrator`, description triggering on
"start of a development session driving an active slice in a `.house/` repo". Sections:

1. **Preflight:** as shaper's (mutual refusal via `house status` exit code).
2. **The invariant, verbatim self-catching phrasing:** the orchestrator never builds — "if you catch
   yourself about to Write/Edit product code: STOP — that's a dispatch". Mechanical form: write access =
   `docs/` + `.house/` only. The redirect guard: work arriving mid-session that isn't the active slice →
   "unsure → treat it as shaping" → a `house2-shaper` session; record it `house event work.discovered`.
3. **The loop:** every iteration = read (`house status <id> --json`, `house next --slice <id>`,
   `house log --slice <id>`) → one action → write (`house unit/gate/state/block` + events). A fresh
   session resumes from records alone — the long-lived session is an optimization, never the substrate.
4. **Dispatch:** `house unit <id> dispatch --title …`; hand the builder ONLY the kickoff brief (its
   schema is the contract — nothing rides in prose beside it); builder model per `modelProfile` in
   `.house/config.yaml` (Opus; reviewers Fable; on Fable outage: halt at `gate.requested`, never
   downgrade — doctrine §3).
5. **Gates:** every hard-gate halt = `house block <id> --gate <name>`; resolution comes via
   `house gate … --verdict …` (auto-clears). Verdict-producing workflows must WRITE their verdict files
   (`gates/*.yaml` via `house gate`) — an unrecorded gate did not run.
6. **Merge gate (per-slice):** diff `base_sha...HEAD` (set via `house pr <id> --base-sha` at branch
   time, `--set` at PR time); reviewer re-runs `cd cli && npm test` + `house validate` personally
   (don't trust the report); INCONCLUSIVE is not a pass; `house state <id> shipped` only after GO.
7. **Reconcile:** dispatch the doctrine §9 reconcile-subagent at stage transitions/session end/merge;
   `house render dev-state` after every state change; per-merge teardown per doctrine §8.
8. **Audibles/deviations:** `house event deviation.raised --payload …`; "I didn't get to it" is a
   deviation, not a skip.

Keep-verbatim owners: never-builds tripwire · redirect guard · don't-trust-the-report · independence
axes · INCONCLUSIVE ≠ pass · unattended-never-downgrades · squash-merge reasoning (pointer to doctrine
§5) · auto-fix boundary. Target ≤ 80 lines.

- [ ] **Step 2: Check** — zero stage numbers; no dev-state format block (the renderer owns it); no
builder-payload field list (the kickoff schema owns it); no model-name string literals (config owns them
— the *rationale* stays).

- [ ] **Step 3: Commit** — `git add skills/house2-orchestrator/SKILL.md && git commit -m "feat(skills): house2-orchestrator — conductor over shared state"`

### Task 15: `skills/house2-builder/SKILL.md` + this repo's `.house/gates.yml`

**Files:**
- Create: `skills/house2-builder/SKILL.md`, `.house/gates.yml`

- [ ] **Step 1: Write `.house/gates.yml`** (this repo's stack — the minimal schema IS this file's shape):

```yaml
# Declarative per-stack gates (minimal S2 schema): stacks.<key>.gates = ordered {name, cmd} list.
# The builder runs every gate for its brief's `stack:`; an absent/unknown stack ⇒ NEEDS_CONTEXT.
schema_version: 1
stacks:
  node:
    gates:
      - name: tests
        cmd: cd cli && npm test
      - name: validate
        cmd: house validate
```

- [ ] **Step 2: Write the skill.** Frontmatter `name: house2-builder`, description triggering on "handed
a kickoff brief for one unit in a `.house/` repo". Sections:

1. **Preflight:** validate the brief against `cli/schema/kickoff.yaml` semantics — any missing required
   field ⇒ finalize `--result NEEDS_CONTEXT` naming `missing_inputs`; **never guess.** Unknown or absent
   `stack:` key in `.house/gates.yml` ⇒ NEEDS_CONTEXT (v1's silent-iOS-lens fail-open is dead). "You
   build; you do not decide the slice."
2. **The loop per task:** TDD iron law (test first, watch it fail, minimal pass); tick ONLY via
   `house task done <tid> --slice <id> [--evidence-cmd …]` — the CLI refuses a tick without green
   evidence, and that refusal is the contract, not an obstacle. Blocked → `house task block … --note`.
   Compile-green at every task boundary. Heartbeat per task: `house unit <id> heartbeat <uid> --note …`.
3. **Discriminating tests:** for each spec rule touched, at least one input where the rule and the
   nearest plausible-wrong implementation disagree.
4. **Proof obligations:** destructive migrations exercised against a store populated under the previous
   schema — a fresh install passing is NOT proof. CI-red taxonomy (infra-only vs code-red; no-CI repos
   per ADR-0003 run the gates file); "when unsure, treat as code-red".
5. **Stack gates:** run every `gates:` entry for the brief's stack before self-review; all green or the
   unit does not finalize DONE.
6. **Self-review + finalize:** per-unit self-review against the plan; then
   `house unit <id> finalize <uid> --result <DONE|BLOCKED|NEEDS_CONTEXT|DEVIATION> --note …`. The report
   is already incremental — a builder that dies mid-unit is re-dispatchable from its own record; absence
   of a finalized record is unknown, never DONE.

Keep-verbatim owners: NEEDS_CONTEXT-don't-guess · discriminating-test rule · proof obligations ·
CI-red taxonomy + tiebreak · compile-at-boundary · builder-mirror tripwire. Target ≤ 80 lines.

- [ ] **Step 3: Check + install** — re-run `./install.sh`; confirm all three `house2-*` skills are
symlinked into `~/.claude/skills/` (if Task 10 Step 1 found an explicit skill list, add them there).
`house validate` still exit 0.

- [ ] **Step 4: Commit** — `git add skills/house2-builder .house/gates.yml install.sh && git commit -m "feat(skills): house2-builder + declarative stack gates"`

### Task 16: the keep-verbatim ledger audit (R-11)

Every rule below must resolve to a real section in the v2 prose. Tick each with its home; **zero rules
may resolve to "dropped."** If a home is missing, go back and add the rule before this task closes.

- [ ] rigor floor ("never skips the merge gate; proposing to is a hard gate") → doctrine §3
- [ ] "unsure whether a gate is hard → treat it as hard" → doctrine §4
- [ ] INCONCLUSIVE ≠ pass → doctrine §4 + orchestrator §6
- [ ] "a false NO-GO is safe, a false GO is not" → doctrine §4
- [ ] unattended never downgrades a hard gate → doctrine §3 + kickoff `attended:`
- [ ] never-builds self-catching tripwire → orchestrator §2
- [ ] builder mirror ("you build; you do not decide the slice") → builder §1
- [ ] redirect guard ("unsure → treat it as shaping") → orchestrator §2
- [ ] NEEDS_CONTEXT — don't guess → builder §1
- [ ] five plan-check lenses → shaper §8
- [ ] merge-gate rubric (cross-task seams · spec-rule citation · regression/data-safety · gate compliance) → doctrine §5
- [ ] don't-trust-the-report (reviewer re-runs) → doctrine §5 + orchestrator §6
- [ ] independence axes + why-Opus-builds-Fable-reviews → doctrine §5
- [ ] suppression-ledger handed to every reviewer → doctrine §5
- [ ] discriminating-test rule → builder §3
- [ ] destructive-migration proof obligation → builder §4
- [ ] CI-red taxonomy + "unsure → code-red" + anti-normalization → builder §4
- [ ] squash-merge caveat reasoning → doctrine §5
- [ ] auto-fix boundary → orchestrator §8
- [ ] session-shape economics (heavy reads die in subagents; dialogue stays) → shaper §3–4
- [ ] research-dispatch contract ("read a lot, conclude a little; change nothing") → shaper §3
- [ ] brainstorm cannot be a subagent → shaper §4
- [ ] read-doctrine-on-demand, never preload → all three preflights
- [ ] folded-in advisory is a commitment → shaper §8 + kickoff `plan_check_commitments`
- [ ] "I didn't get to it" is a deviation, not a skip → orchestrator §8
- [ ] compile-at-every-task-boundary → builder §2
- [ ] scope guards as first-class negative space → shaper §9 + kickoff `scope_guards`

- [ ] Commit any fixes: `git commit -am "docs(skills): keep-verbatim ledger audit — every rule has a home"`

---

# Unit 3 — smoke slice + closeout (builder session 3 / orchestrator)

### Task 17: the smoke slice (R-13)

The done bar. A real, tiny, patch-tier change driven end-to-end through the v2 skills **by actually
invoking them** in fresh sessions — not simulated inline.

- [ ] **Step 1:** In a fresh session, invoke `house2-shaper`: shape **"`house --version`"** (print
`cli/package.json` version; currently an unknown command, exit 2 — real, one function, no design risk).
Expect: minted patch-tier slice, micro-spec, tasks.yaml, kickoff block, `state: ready`, gates recorded.
- [ ] **Step 2:** In a fresh session, invoke `house2-orchestrator`: resume from `house status` alone,
dispatch the one unit to a `house2-builder`, gate it, merge it, `house state … shipped`,
`house render dev-state`.
- [ ] **Step 3:** Verify the trail (spec R-13 scenario): `house log --slice <smoke-id>` shows
created → state_changed(s) → gate.recorded(s) → unit.dispatched/heartbeat/report → task.done →
slice.pr_set → slice.shipped, and every gate has its `gates/*.yaml`. Replayable with zero transcript
reference. Any gap = a v2-skill bug — fix the skill, not the record, and re-run.
- [ ] **Step 4:** Attach the smoke evidence to THIS slice:
`house event artifact.written --slice 0001-house-v2-s2-skills-rewrite --payload '{"kind":"smoke-evidence","slice":"<smoke-id>"}'`.

### Task 18: S2 closeout

- [ ] Full bar: `cd cli && npm test` green; `house validate --strict` exit 0; `house render dev-state`.
- [ ] Finalize the last unit; `house state 0001-house-v2-s2-skills-rewrite gating`; merge-gate reviewer
(Fable, fresh session) re-runs everything personally; retro (slice-tier ⇒ `retro.md` required by
validate before `shipped`).

---

## Plan self-review (completed at write time)

**Spec coverage:** R-1→T1 · R-2→T2/T3/T4/T5 · R-3→T5 · R-4→T6 · R-5→T7 · R-6→T10 · R-7→T12 · R-8→T13 ·
R-9→T14 · R-10→T15 · R-11→T16 · R-12→T9 · R-13→T17/T18 · R-14→T8. No gaps.
**Known residual (recorded):** T1's shape-check can't detect a hand line in exact generator-bullet form.
**Type consistency:** `blocked_on {gate,note,since}` (T2) matches derive.js's existing
`s.blocked_on.gate` read (T1 render) and the kickoff `attended` flag (T8) matches doctrine §3 (T12).
`readEvents → {events, skipped}` consumers: T5's `log` only.
