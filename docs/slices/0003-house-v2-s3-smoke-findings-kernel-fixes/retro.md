# Retro — 0003-house-v2-s3-smoke-findings-kernel-fixes (S3a)

Written at ship, 2026-07-29. Sources: `.house/events.jsonl`, gate records, unit 01 report, PR #9.

## What shipped

All four S2-smoke backlog findings plus the unknown-flag guard, in one unit, 5/5 tasks, suite 67 → 72,
PR #9 merged to main. Full arc in one session: shaped (spec user-approved, plan-check GO_WITH_FIXES with
M1/M2 + A1–A5 all folded, ADR-0001 erratum recorded) → built (TDD, every commitment held) → merge gate
**GO, zero findings, first pass** → live_check user-exercised (every fix poked by hand) → shipped.

## What worked

- **The gates keep catching their own operators.** The plan-check reviewer caught the repo drifted in
  exactly the way R-2 detects, and a test written against a nonexistent helper seam. The validator
  refused this very slice's `shipped` until this retro existed (the tier was bumped at shaping; the
  orchestrator forgot the consequence). Fail-closed is doing its job on everyone, including the process.
- **First-pass GO.** S2's merge gate needed a NO_GO lap; S3a's did not. The difference was folding
  seven plan-check items *before* dispatch and handing the reviewer the two on-record exceptions with
  instructions to verify the records rather than re-raise — precision about what is already known.
- **Self-referential deviation handled honestly.** The slice that fixes the marker false-positive
  could not pass the old checker itself. Recorded exception (user-approved), artifacts left readable,
  fixed by construction when T1 landed — no third rewording-to-satisfy-the-linter.
- **The fixes proved themselves in use**: the merge-gate verdict was recorded with `--actor` honored
  and full `record`/`detail`/`notes` — R-3/R-4 exercised by the act of reviewing them.

## What was rough (recorded, not silent)

- **Nested-fence residual**: T1's stripper closes an outer fence early when a fixture quotes a
  triple-backtick fence inside a fenced block — strict still errors once, on 0003's own plan.md.
  Pre-existing class, spec-conformant implementation, backlogged with a candidate fix (line-by-line
  fence tracking), sequenced post-S3a. The only strict red in the repo.
- **Retro-before-shipped ordering**: the orchestrator ran `house state shipped` before writing this
  file; `house validate` went red until it existed. Consider a validate ride-along or skill note that
  slice-tier `shipped` should be preceded by the retro in the same commit.
- Two FLAGS over-permits noted by the reviewer (`task --skip-reason`, `status --slice`) — deliberate
  posture, preference-level, left as is.

## Follow-ups

- S3b (migration slice) is next on the roadmap, sequenced after this ship so it runs on a trustworthy
  validator and gate ledger.
- Nested-fence fix rides the roadmap backlog with its candidate approach.
