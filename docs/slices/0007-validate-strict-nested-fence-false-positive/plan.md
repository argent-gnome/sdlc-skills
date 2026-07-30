---
id: "0007-validate-strict-nested-fence-false-positive"
kind: plan
slice: "0007-validate-strict-nested-fence-false-positive"
title: "validate --strict nested-fence false positive"
status: "shaping"
state: approved
---
# validate --strict nested-fence false positive — Implementation Plan

**Goal:** Replace the byte-oriented fenced-code-block stripper in `house validate --strict` with
line-oriented fence tracking, so a fence run appearing mid-line is no longer treated as a fence.

**Architecture:** One new **exported** helper, `stripFences()`, in `cli/lib/validate.js`, plus a four-line
change to the pipeline that consumes it. Nothing else in the file, the CLI, or the schema changes. No new
dependency.

The export is deliberate and narrow: R-5 requires both the builder and the merge-gate reviewer to measure
blast radius by comparing old and new stripping across every handoff artifact, and neither can do that
against an unexported function. **This is not the "extraction into a shared module" the No-Gos forbid** —
there is no second production caller and no new module; the symbol is exported so the verification
required by the spec is possible at all.

**Tech Stack:** Node ≥ 18 ESM, `node --test`, one runtime dependency (`js-yaml`) which this slice does not
touch. Tests are inline-string fixtures written into throwaway temp repos via
`cli/test/helpers.js` → `mkTmpRepo()`; nothing in `cli/test/` reads from `docs/`.

---

## ⚠ Reading this plan: the `«M:…»` substitution

This plan quotes test code containing well-formed clarification markers. Writing them literally here would
block this plan's own hand-off under `house validate --strict` — the exact defect the slice repairs. So:

> **Wherever this plan writes `«M:some text»`, the real file contains a well-formed marker:** an opening
> square bracket, then `NEEDS CLARIFICATION`, then a colon and a space, then `some text`, then a closing
> square bracket. Nothing else about the surrounding line changes.

This substitution applies **only to `.md` files in this repo's `docs/slices/`**. The test file
`cli/test/validate.test.js` is **not** scanned by `--strict` (the check reads only `spec.md` and `plan.md`
under `docs/slices/*/`), so the real marker text goes into the test file verbatim, exactly as the existing
tests at `cli/test/validate.test.js:173-200` already do.

Code blocks below that contain three-backtick runs are wrapped in **four**-backtick fences, so this
document reads correctly in any renderer.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `cli/lib/validate.js` | Modify — add `stripFences()` above `validate()`; rewrite the strip pipeline at lines 47-56 | The only fence logic in the codebase. Confirmed by the research pass: no other fence stripper exists in `cli/lib/`. |
| `cli/test/validate.test.js` | Modify — append five tests (four in Task 1, one in Task 2) | All `--strict` marker coverage lives here already. |

No new files. No extraction into a shared module — `derive.js` and `hooks.js` keep their own unrelated
`[\s\S]*?` uses, which are frontmatter, unit-report and dev-state-marker concerns, not fences.

---

## Task 1: line-oriented fence tracking + strip ordering (R-1, R-2)

**Files:**
- Modify: `cli/lib/validate.js:47-56`
- Test: `cli/test/validate.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `cli/test/validate.test.js`. Remember the `«M:…»` substitution — write real markers here.

````js
test('validate --strict [0007] R-1: a fence run mid-line is not a fence', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'nested fence', {});
  const dir = join(repo, 'docs/slices', id);
  // Reproduces docs/slices/0003-…/plan.md lines 48 / 58 / 84: a real ```js fence whose body holds
  // two three-backtick runs mid-line inside a JS string literal, with marker text between them.
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n' +
    '```js\n' +
    "    '```\\n«M:inside a string literal»\\n```\\n' +\n" +
    '    const x = 1;\n' +
    '```\n\n' +
    'ordinary prose after the fence\n');
  assert.deepEqual(validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error'), []);
});

test('validate --strict [0007] R-1: an odd mid-line run count does not invert later fences', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'parity', {});
  const dir = join(repo, 'docs/slices', id);
  // ONE mid-line run — the odd count that flips parity for the rest of the file under the old regex.
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n' +
    '```js\n' +
    "    const fence = '```';\n" +
    '```\n\n' +
    'prose between the two blocks\n\n' +
    '```\n' +
    '«M:quoted in a second block»\n' +
    '```\n');
  assert.deepEqual(validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error'), []);
});

test('validate --strict [0007] R-1: tilde fences are stripped', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'tilde', {});
  const dir = join(repo, 'docs/slices', id);
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n~~~\n«M:inside a tilde fence»\n~~~\n');
  assert.deepEqual(validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error'), []);
});

test('validate --strict [0007] R-2: a comment opener quoted in a fence does not pair forward', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'comment order', {});
  const dir = join(repo, 'docs/slices', id);
  // The trailing complete comment is load-bearing: the comment regex is non-greedy and needs a
  // closing --> to pair with. Without one, the quoted opener strips nothing and the bug cannot fire.
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n' +
    '```html\n' +
    '<!-- an opener with no close inside this fence\n' +
    '```\n\n' +
    '«M:must still be seen»\n\n' +
    '<!-- an ordinary complete comment -->\n');
  const errs = validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error');
  assert.equal(errs.length, 1);
  assert.match(errs[0].path, /plan\.md$/);
});
````

- [ ] **Step 2: Run them and confirm they fail — and fail for the right reason**

```bash
cd cli && node --test test/validate.test.js 2>&1 | tail -40
```

Expected: **4 failing tests.** The three R-1 tests fail on `AssertionError [ERR_ASSERTION]` with an actual
value containing one finding whose `msg` is `NEEDS CLARIFICATION marker present — handoff blocked
(--strict)` — i.e. the marker is wrongly *exposed*. The R-2 test fails the opposite way, on
`assert.equal(errs.length, 1)` with actual `0` — the marker is wrongly *swallowed* by the forward-pairing
comment. If any test fails with a different error, stop: the fixture is wrong, not the code.

- [ ] **Step 3: Add the `stripFences()` helper**

Insert into `cli/lib/validate.js` immediately above `export function validate(root, args) {` (i.e. after
the `KNOWN_DIRS` declaration, currently line 11):

````js
// [0007] Fenced-code stripping is LINE-oriented, not byte-oriented. A run of backticks or tildes
// appearing mid-line — inside a string literal, say — is not a fence, and the old `/```[\s\S]*?```/g`
// pairing against one re-exposed the text between runs. Worse, an ODD number of runs on one line
// inverted every fence after it, which fails silently in the marker-HIDING direction.
//
// Exported ONLY so the blast-radius comparison required by spec R-5 can run — the builder's own
// measurement and the merge-gate reviewer's independent re-run. There is no second production caller.
export function stripFences(text) {
  const src = text.split('\n');
  const out = src.slice();
  let open = null;                                     // { char, len, idx } while a fence is open
  for (let i = 0; i < src.length; i++) {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(src[i]);
    if (open) {
      out[i] = '';                                     // blank every line inside the fence, incl. its close
      if (m && m[1][0] === open.char && m[1].length >= open.len && m[2].trim() === '') open = null;
    } else if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
      open = { char: m[1][0], len: m[1].length, idx: i };   // CommonMark: no backtick in a ```-fence info string
      out[i] = '';
    }
  }
  // An unclosed fence must NOT hide the rest of the document. CommonMark says it runs to EOF; this check
  // deliberately does not, because --strict exists to catch open questions and must lean to a loud false
  // positive over a silent false negative. Spec R-1 / R-4.
  if (open) for (let i = open.idx; i < src.length; i++) out[i] = src[i];
  return out.join('\n');
}
````

- [ ] **Step 4: Rewrite the strip pipeline to use it, in the new order**

In `cli/lib/validate.js`, replace these four lines (currently 50-53):

````js
      const text = readFileSync(p, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')                         // template's marker lives in a comment
        .replace(/```[\s\S]*?```/g, '')                          // fenced code blocks quote, not declare
        .replace(/`[^`\n]*`/g, '');                              // inline code spans likewise
````

with:

````js
      const text = stripFences(readFileSync(p, 'utf8'))          // fences FIRST — see stripFences()
        .replace(/<!--[\s\S]*?-->/g, '')                         // template's marker lives in a comment
        .replace(/`[^`\n]*`/g, '');                              // a code span quotes, it does not declare
````

The reorder is deliberate and is spec R-2: stripping comments first let a `<!--` quoted inside a fence pair
with an unrelated later `-->` and swallow everything between them.

- [ ] **Step 5: Run the new tests and the full suite**

```bash
cd cli && node --test test/validate.test.js 2>&1 | tail -20 && npm test
```

Expected: all four new tests pass; `npm test` reports **76 pass / 0 fail** (72 before this slice, plus
these four). In particular the pre-existing `validate --strict R-1: well-formed markers only, handoff
artifacts only, --slice scoping` test at `test/validate.test.js:173-200` must still pass **unmodified** —
it is the anti-over-strip net that already exists. If it now fails, the new stripper is hiding too much;
do not edit that test to accommodate.

- [ ] **Step 6: Commit**

```bash
git add cli/lib/validate.js cli/test/validate.test.js
git commit -m "fix(validate): line-oriented fence tracking for --strict marker check (R-1, R-2)"
```

---

## Task 2: prove detection was not weakened (R-4)

Task 1 could be "passed" by a stripper that simply removes more than it should. This task exists to make
that impossible to do quietly. It adds no production code.

**Files:**
- Test: `cli/test/validate.test.js` (append)

- [ ] **Step 1: Write the guard tests**

````js
test('validate --strict [0007] R-4: genuine markers still trip the check', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'still caught', {});
  const dir = join(repo, 'docs/slices', id);
  const errs = () => validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error');

  // (a) a genuine marker AFTER a closed fence that quotes one
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n```\n«M:quoted, must not trip»\n```\n\n«M:genuine, must trip»\n');
  assert.equal(errs().length, 1, 'marker after a closed fence');

  // (b) a genuine marker BETWEEN two closed fences — proves fences close at the right line
  //     rather than the first swallowing forward into the second
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n```\nquoted\n```\n\n«M:between the blocks»\n\n```\nalso quoted\n```\n');
  assert.equal(errs().length, 1, 'marker between two closed fences');

  // (c) a genuine marker after an UNCLOSED fence. CommonMark would hide it; spec R-4 says never hide.
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n```\nthis fence is never closed\n\n«M:after an unclosed fence»\n');
  assert.equal(errs().length, 1, 'marker after an unclosed fence — never hide');
});
````

- [ ] **Step 2: Run and confirm they pass**

```bash
cd cli && node --test test/validate.test.js 2>&1 | tail -20
```

Expected: PASS. Unlike Task 1's tests these are **pins, not red-then-green** — (a) and (b) pass before the
fix as well, and that is fine; their job is to fail loudly if a future change over-strips. Case (c) is the
one that genuinely encodes a decision: it pins the deliberate departure from CommonMark.

- [ ] **Step 3: Prove the pins actually bite (tamper check)**

Temporarily make `stripFences()` return `''` (strip everything), re-run, and confirm all three assertions
in this test fail. Then revert. A guard test that passes against a deliberately broken implementation is
not a guard.

Run each line from the **repo root**, not from `cli/` — the `git checkout` path is repo-relative:

```bash
(cd cli && node --test test/validate.test.js 2>&1 | grep -c "not ok")  # non-zero count while tampered
git checkout -- cli/lib/validate.js                                    # revert the tamper
(cd cli && npm test)                                                   # back to green
```

- [ ] **Step 4: Commit**

```bash
git add cli/test/validate.test.js
git commit -m "test(validate): pin that the corrected stripper still catches genuine markers (R-4)"
```

---

## Task 3: repo-level acceptance evidence (R-3, R-5)

**Files:** none modified. This task produces evidence, and one of its outcomes is a No-Go if violated.

- [ ] **Step 1: Confirm the previously-red plan passes, untouched**

```bash
cd /Users/jake-edwards/projects/sdlc-skills && house validate --strict; echo "strict=$?"
P=docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md
git diff --stat main...HEAD -- "$P"     # committed edits on this branch, vs the merge-base
git diff --stat -- "$P"                 # uncommitted edits in the working tree
```

Expected: `strict=0`, and **both** `git diff` commands print nothing. The empty diffs are the load-bearing
half. If `--strict` is green because that file was edited, the slice has failed its own acceptance bar —
see No-Gos.

The two-diff form is deliberate: `main...HEAD` compares against the **merge-base**, so it does not
false-fail if `main` advances during the slice, and the second command catches a working-tree edit that
was never committed. A single `git diff main -- "$P"` misses neither case in the common quiescent
situation but is wrong in both edge cases.

- [ ] **Step 2: Measure the blast radius yourself (R-5)**

Do not cite the research digest's numbers. Write a throwaway script in your scratchpad — **not** in the
repo, per the `[0006]` precedent for one-off check scripts — that imports the real `stripFences()` from
`cli/lib/validate.js` (this is why Task 1 exports it), and for every tracked `docs/slices/*/spec.md` and
`docs/slices/*/plan.md` compares the marker verdict under the old pipeline against the new one.

The old pipeline is the two retired regexes, which the script inlines verbatim so the comparison is
against what actually shipped before:

````js
const old = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
````

Record in the unit report: the count of files whose verdict changed, and the name and direction of every
one. The expected result is exactly one file, `docs/slices/0003-…/plan.md`, red → green, and **zero** files
green → red.

- [ ] **Step 3: If any file went green → red, stop and route it**

A file newly reporting a marker means the old stripper was hiding a genuine open question. That marker is
**not** this slice's to resolve — resolving it may need a decision this slice's author has no standing to
make. Record it and hand it on:

```bash
house event work.discovered --slice 0007-validate-strict-nested-fence-false-positive \
  --note "corrected stripper exposes a genuine marker in <path> — needs its own triage" --actor <you>
```

Then finalize the unit as `DEVIATION` and say so in the report. Per spec R-3, `--strict` is permitted to
remain red on such a file when this slice ships. Do **not** expand the slice to fix it, and do **not** edit
the file to silence it.

> **T3's `verify` command cannot pass on this path, and that is correct, not a build failure.** The verify
> string begins `house validate --strict && …`, which fails by construction when `--strict` is legitimately
> red under R-3. If T3's verify fails *specifically* because a genuine marker was exposed elsewhere — and
> only for that reason — tick the task with `house task … --note` recording the deviation rather than
> treating the red as work still to do. A verify failure for any *other* reason is a real failure.

- [ ] **Step 4: Full verification**

```bash
cd cli && npm test; echo "tests=$?"
cd /Users/jake-edwards/projects/sdlc-skills && house validate; echo "validate=$?"
```

Expected: `tests=0` with **77** passing, `validate=0`. (72 at baseline, plus four from Task 1 and one
from Task 2. Task 1 Step 5's expected count of 76 is correct *at that point*; this step runs after Task 2
has added its test function.)

- [ ] **Step 5: Commit any record updates**

```bash
git add -A docs/slices/0007-validate-strict-nested-fence-false-positive
git commit -m "docs(0007): unit report — blast-radius measurement and acceptance evidence"
```

---

## NOT this slice

These are the scope guards. They go into the kickoff brief verbatim.

- **Do not edit `docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md`.** It must pass
  unmodified; that is the acceptance evidence, and editing it destroys the evidence rather than producing
  it.
- **Do not add an npm dependency, and do not introduce a markdown parser.** One runtime dependency
  (`js-yaml`) is the whole tree, and ADR-0003's bar is a check runnable from a bare terminal in under a
  second.
- **Do not change the marker regex, the set of scanned artifacts (`spec.md` and `plan.md` only), `--slice`
  semantics, exit codes, or the finding's message text.**
- **Do not add line or column numbers to the finding.** Useful, tempting while in this code, and a
  separate backlog item.
- **Do not extract `stripFences()` into a shared module and do not add a second caller.** Extract when a
  second caller actually exists.
- **Do not model any markdown construct beyond fenced blocks and the existing inline code spans.**
  Four-space indented code blocks, link reference definitions, setext headings and nested-list indentation
  stay unmodeled.
- **Do not touch any `skills/*/SKILL.md`.** The hand-off bar wording at `skills/house-shaper/SKILL.md:83`
  is already correct and unaffected.
- **Do not chase repo-wide `--strict` exit 0 as the goal.** The bar is the test suite. Green is an expected
  consequence, not the definition of done.
- **Do not resolve markers newly exposed elsewhere.** Route them per Task 3 Step 3.

---

## As-built

<!-- The builder annotates ON DIVERGENCE ONLY. Narration of what was done belongs in the unit report,
     not here — see the roadmap's "as-built narration belongs in the unit report only" hygiene item. -->
