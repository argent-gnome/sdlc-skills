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
