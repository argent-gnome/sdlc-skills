# Unit 01 — unit 01 — fence-stripper correction (T1–T3)

- slice: 0007-validate-strict-nested-fence-false-positive
- dispatched: 2026-07-30T01:09:28.922Z

## Heartbeats
- 2026-07-30T01:12:21.830Z — T1 done: stripFences() added+exported, pipeline reordered to fences/comments/spans; 4 new tests red-then-green; suite 76 pass
- 2026-07-30T01:14:49.840Z — T2 done: 3 R-4 pins added; tamper check (stripFences returning '') flips all three cases 1->0 errs, so every pin bites; suite 77 pass
- 2026-07-30T01:14:49.894Z — T3 evidence: strict=0 repo-wide with 0003/plan.md byte-identical (blob 178a1e9 at base and HEAD); own blast-radius measurement = 1 file changed (0003 plan RED->GREEN), 0 GREEN->RED

## Evidence

> Wording note, same convention as this slice's plan: this report does not write a well-formed
> clarification marker literally. `«M:…»` stands for one.

### What shipped

`cli/lib/validate.js` — new exported `stripFences()` above `validate()` (line-oriented fence tracker),
and the `--strict` strip pipeline reordered to **fences → HTML comments → code spans**, dropping the
retired `/```[\s\S]*?```/g` byte-pairing. `cli/test/validate.test.js` — five appended tests. No new
dependency, no new file, no second caller, no extraction. The export is R-5's requirement (commitment
M1), not the forbidden extraction.

### Test counts personally observed

| Point | Command | Result |
|---|---|---|
| Baseline, before any edit | `cd cli && npm test` | **72 pass / 0 fail** |
| T1 Step 2 (tests written, code not yet) | `node --test test/validate.test.js` | **4 fail** — 3 R-1 tests assert-fail with the marker wrongly *exposed*; the R-2 test fails `errs.length` actual `0` vs expected `1`, i.e. wrongly *swallowed*. Both predicted directions. |
| T1 Step 5 | `cd cli && npm test` | **76 pass / 0 fail** (72 + 4) |
| T3 Step 4 | `cd cli && npm test` | **77 pass / 0 fail** (72 + 4 + 1) — commitment M2 met |

The pre-existing `[0003]` R-1 test at `cli/test/validate.test.js:173-200` passes **unmodified**; it was
never touched (R-4's anti-over-strip net).

### R-4 tamper check (Task 2 Step 3) — the pins bite

`node:test` aborts a test at its first failing assertion, so the plan's `grep -c "not ok"` proves only
that *one* of the three cases bites. Ran a throwaway scratchpad probe evaluating all three fixtures
independently against the on-disk implementation:

| Case | untampered | `stripFences()` → `''` |
|---|---|---|
| (a) genuine marker after a closed fence | errs=1 | errs=0 |
| (b) genuine marker between two closed fences | errs=1 | errs=0 |
| (c) genuine marker after an **unclosed** fence | errs=1 | errs=0 |

All three flip, so all three assertions genuinely fail against a deliberately broken stripper. Tampered
suite also showed 8 not-ok lines. Reverted with `git checkout -- cli/lib/validate.js`; `git diff --stat`
on that path is empty and the suite returned to 77 pass. Case (c) pins the deliberate departure from
CommonMark: an unclosed fence hides nothing.

### R-3 acceptance — the previously-red plan passes untouched

- `house validate --strict` → **exit 0** repo-wide (was exit 1 with exactly one error on
  `docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md`).
- `git diff --stat main...HEAD -- <0003 plan>` → empty. `git diff --stat -- <0003 plan>` → empty.
  Two-diff form per commitment A2 (merge-base, plus working tree).
- Stronger than the diffs: the file's blob sha is `178a1e97dc4e561689996f71a82ee2ecc376cd69` at both
  `c2f88db` (the `[0006]` ship / this slice's base) and at `HEAD` — byte-identical, not merely
  diff-clean.

### R-5 blast radius — measured against the shipped implementation, not the digest

Throwaway scratchpad script importing the real `stripFences()` from `cli/lib/validate.js` and comparing
the retired pipeline's verdict (both old regexes inlined verbatim) against the new one, per file. Marker
regex unchanged in both arms.

| Sweep | Files | Verdict changed | Detail |
|---|---|---|---|
| Scanned set (`docs/slices/*/{spec,plan}.md`, tracked) | 14 | **1** | `0003-…/plan.md` **RED → GREEN** |
| All tracked markdown (supplementary) | 78 | **1** | same single file |

**Zero files went GREEN → RED** in either sweep. No genuine marker was newly exposed anywhere, so spec
R-3 / Task 3 Step 3's `work.discovered` deviation route did **not** trigger and no marker was left
unresolved. This is the builder's own count; it happens to agree with the digest, which was evidence and
not authority. The merge-gate reviewer still owes an independent re-measurement per R-5 — this record
does not discharge that obligation.

### Stack gates (`.house/gates.yml` → `node`), run in order

- `cd cli && npm test` → exit **0** (77 pass / 0 fail)
- `house validate` → exit **0**

### Scope guards — all held

No 0003-plan edit; no dependency added (`js-yaml` still the whole tree) and no markdown parser; marker
regex, scanned-artifact set, `--slice` semantics, exit codes and finding message text all unchanged; no
line/column numbers added; no shared-module extraction and no second caller; nothing modeled beyond
fences and the existing code spans; no `skills/*/SKILL.md` touched. Repo-wide `--strict` exit 0 was
treated as a consequence, not the bar — the bar was the suite.

### One incidental finding (not acted on)

The kickoff brief asks the builder to report via `house unit <slice> report <unit>`. That verb does not
exist: `unitCmd` in `cli/lib/slices.js:211` accepts only `dispatch`, `heartbeat` and `finalize` — it is
`finalize` that emits the `unit.report` event. Reporting was therefore done with heartbeats plus
finalize. Also note `finalize` rewrites everything from `## Result` onward, which is why this evidence
section sits above it. Both are brief/CLI wording nits for the orchestrator, not blockers, and fixing
them is outside this slice.

## Result

(pending — absence of a finalized result is fail-closed unknown, never DONE)
