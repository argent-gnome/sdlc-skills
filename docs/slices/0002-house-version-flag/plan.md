---
id: "0002-house-version-flag"
kind: plan
slice: "0002-house-version-flag"
title: "house --version flag — implementation plan"
status: "planned 2026-07-28; plan-check GO_WITH_FIXES folded"
state: approved
---
# house --version Implementation Plan

> **For agentic workers:** executed by a house2-builder under a kickoff brief — not by
> superpowers:subagent-driven-development or superpowers:executing-plans (suppressed per doctrine §7).

**Goal:** `house --version` prints the `version` from `cli/package.json` to stdout and exits 0.

**Architecture:** One pre-dispatch special case in `cli/bin/house.js`, placed before the `commands`
table lookup and before any repo-root resolution, so it works outside a house repo. The version is read
from `../package.json` resolved relative to `import.meta.url` (never cwd). No new files, no new deps.

**Tech Stack:** Node ESM, `node:test` via `cd cli && npm test`.

## NOT this slice
- NOT `-v` or `house version` aliases.
- NOT version output in `house status` / `house --help` / usage text.
- NOT any change to other commands' parsing or exit codes.
- NOT a general flag-parsing layer or a version constant in `cli/lib/`.

---

### Task T1: `--version` pre-dispatch flag

**Files:**
- Modify: `cli/bin/house.js` (immediately after `const [cmd, ...rest] = process.argv.slice(2);`)
- Test: `cli/test/cli.test.js` (append; reuses that file's local `run` helper and existing imports)

- [ ] **Step 1: Write the failing test** — append to `cli/test/cli.test.js`:

```js
test('cli: --version prints package.json version, exit 0, works outside a repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'house-ver-'));            // NOT a house repo (R-1)
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  const r = run(dir, '--version');
  assert.equal(r.code, 0);
  assert.equal(r.out, `${pkg.version}\n`);
  const repo = mkTmpRepo();                                         // house-tracked repo (R-1 scenario 1;
  const r2 = run(repo, '--version');                                //  plan-check must-fix)
  assert.equal(r2.code, 0);
  assert.equal(r2.out, `${pkg.version}\n`);
  assert.equal(run(dir, 'frobnicate').code, 2);                     // unknown-cmd path unchanged (R-2)
});
```

(`mkTmpRepo` is already imported in `cli/test/cli.test.js`.)

- [ ] **Step 2: Run it and verify it fails**

Run: `cd cli && node --test test/cli.test.js`
Expected: FAIL — `r.code` is 2, not 0 (`--version` hits the unknown-command path).

- [ ] **Step 3: Minimal implementation** — in `cli/bin/house.js`, insert directly after
`const [cmd, ...rest] = process.argv.slice(2);` (before arg parsing and `repoRoot()`):

```js
if (cmd === '--version') {                        // pre-dispatch: must work outside a house repo
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}
```

(`readFileSync` is already imported at the top of the file.)

- [ ] **Step 4: Run the test and the full suite, verify green**

Run: `cd cli && node --test test/cli.test.js` → PASS. Then `cd cli && npm test` → all pass
(guards R-2: the existing `frobnicate`/exit-2 assertions still hold).

- [ ] **Step 5: Commit**

```bash
git add cli/bin/house.js cli/test/cli.test.js
git commit -m "feat(cli): house --version prints cli/package.json version"
```

---

## Plan-check
Verdict: GO_WITH_FIXES. Must-fix (folded into T1 step 1 above): the test also asserts `--version`
inside a house-tracked repo (spec R-1 scenario 1), not only outside. No advisories declined.
Note: `house gate --payload` silently dropped the JSON detail (recorded event carries only
gate+verdict), so this section and the kickoff `plan_check_commitments` are the durable record.

## Self-review
- Spec coverage: R-1 (both scenarios: in-repo trivially subsumed by outside-repo tmpdir + exact
  stdout/exit assertions) → T1 steps 1/3; R-2 → step 1's `frobnicate` assertion + full suite in step 4.
- Placeholder scan: none — all code shown.
- Type consistency: single task; test helper `run` already exists in `cli/test/cli.test.js`.

---

## As-built — Unit 1 (reconciled 2026-07-28, branch `slice/0002-house-version-flag`, commit `35c32d1`)

**No deviations.** T1 landed as the literal code in steps 1 and 3 above — the five-line pre-dispatch block
in `cli/bin/house.js` (inserted directly after `const [cmd, ...rest] = process.argv.slice(2);`, before arg
parsing and `repoRoot()`) and the one appended test in `cli/test/cli.test.js`, verbatim. Two files
touched, 18 lines added, no new files and no new dependencies, exactly as the plan's Architecture line
predicted. Nothing under `cli/lib/` was touched, and no scope guard was approached.

The plan-check must-fix carried in the kickoff brief (`plan_check_commitments`) is satisfied in the
shipped test: it asserts `--version` **twice** — once from a bare `mkdtempSync` tmpdir that is not a house
repo (spec R-1 scenario 2) and once from a `mkTmpRepo()` house-tracked repo (spec R-1 scenario 1) — plus
the `frobnicate` exit-2 assertion that guards R-2.

Both stack gates green at the task boundary: `cd cli && npm test` → **67/67 pass** (66 → 67, the one new
test), `house validate` → **exit 0**. Evidence is recorded on T1 in `tasks.yaml` by `house task done`; the
matching `task.done` event is in `.house/events.jsonl`.

Reconciled alongside this section: the spec's own frontmatter still read `status: "shaping"` /
`state: draft` after the user approved it — the operational record (`slice.yaml` artifact `spec: approved`,
written by `house artifact` and backed by an `artifact.state_changed` event) was the correct layer, so the
DECLARED frontmatter was brought up to it, matching slice `0001`'s approved-spec convention. This plan had
no frontmatter block at all; one was added in the same shape.

## As-built — gating → shipped (reconciled 2026-07-28)

The slice ran the full back half in-session: `gating` (merge gate **GO**, `gates/merge_gate.yaml` — all
four lenses, **zero findings**; the reviewer re-ran `cd cli && npm test` 67/67, `house validate` exit 0,
and the manual `--version` checks in-repo, out-of-repo, and the `bogus` exit-2 path personally) →
`live_check` (halted at `gate.requested` for the user; **approved**, `gates/live_check.yaml` — the user ran
`house --version` live: stdout `0.1.0`, no stderr) → `shipped` (`slice.shipped` recorded).

**Merge shape (as-built): no PR.** `pr: null` is correct, not an omission — the branch
`slice/0002-house-version-flag` was fast-forward-merged into `slice/0001-house-v2-s2-skills-rewrite` at
`2c2d16b`, so this slice's two-file diff rides S2's merge-gate diff to `main` while its own gates ran
per-slice on this slice's records (base_sha `d023fc1` on the manifest bounds the reviewed diff).

At gating, three `work.discovered` findings from the smoke were recorded on this slice and routed to the
roadmap backlog ("Backlog — discovered in the `[0002]` smoke run" in `docs/roadmap.md`): the validator
artifact/frontmatter drift cross-check, `house gate --payload` being dropped from the events.jsonl copy of
`gate.recorded`, and `house validate --strict`'s lack of per-slice scoping. None block anything here.
