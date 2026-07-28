# Retro — 0001-house-v2-s2-skills-rewrite (S2: house v2 skills rewrite)

Written at closeout (T18), 2026-07-28, before `shipped`. Sources: `.house/events.jsonl`, unit reports,
gate records, and the smoke slice `0002-house-version-flag`'s full arc.

## What shipped

Three units, 17 tasks, suite 43 → 67 tests, `house validate --strict` green at every boundary:

- **Unit 1 — CLI enablers** (10 tasks, DONE): `block/unblock`, `artifact`, `unit`, `pr`, `hook`, read
  side, validate ride-alongs, kickoff schema, `install.sh`.
- **Unit 2 — doctrine v2 + the three `house2-*` skills** (5 tasks, DONE): doctrine at 194 lines,
  skills at 90/80/80 lines — targets met exactly; the R-11 keep-verbatim ledger resolved 36/36 rows.
- **Unit 3 — smoke + closeout** (2 tasks): T17 done via the smoke; T18 is this closeout.

## What the smoke proved (the point of S2)

`0002-house-version-flag` ran the whole machine for real: shaper (spec user-approved at a recorded
halt, plan-check GO_WITH_FIXES with the must-fix folded and later verified in shipped test code,
kickoff v1) → orchestrator (dispatch, gates, stacked branch with recorded `base_sha`) → builder
(TDD, DONE, evidence-ticked) → independent merge gate (Fable reviewer, refute-biased, re-ran
everything personally, GO with zero findings) → `live_check` user-approved → shipped, ff-merged
into this branch at `2c2d16b`.

**Session-loss resilience was tested by accident and passed.** A `/clear` killed the orchestrator
mid-smoke; the in-flight shaper subagent survived, finished, and wrote its records; a fresh
orchestrator resumed from the records alone with nothing lost. "The records are the substrate" held
under a real crash, not a drill.

## What was rough (all recorded, none silent)

- **Validator false positive with repo-wide blast radius**: `validate --strict`'s naive
  NEEDS-CLARIFICATION substring match (bracket omitted here so this mention does not trip it — the
  first draft of this very retro tripped it and drew a merge-gate NO_GO, proving the point twice)
  hit this slice's plan *quoting* the marker in prose, blocking 0002's handoff — the shaper had to
  reword approved plan text (recorded as a deviation). No per-slice scoping. S3 candidate, in the
  roadmap backlog.
- **Gate/event payload loss**: `house gate --payload` persists in `gates/<name>.yaml` but is dropped
  from the `events.jsonl` copy; `house event` dropped `--payload` entirely during the smoke. Backlog.
- **Artifact-record vs frontmatter drift**: 0002's spec frontmatter still read `shaping/draft` after
  user approval — the record and the document disagree and validate has no cross-check. Backlog.
- **No `house kickoff` writer**: the brief was hand-edited into `slice.yaml`. It round-tripped the
  kernel's rewrite intact, but write-time validation doesn't exist.
- **Unit 03's ledger reads `result: BLOCKED`** — the honest record of the spec_review halt. The work
  later completed orchestrator-inline (T17 tick + `deviation.raised`); doctrine §9's assumption that
  a reconcile dispatch is always possible had no inline fallback defined for tiny scopes.

## Follow-ups (owned, not vague)

- Three `work.discovered` items sit in the roadmap backlog section for S3 triage.
- ADR-0001 erratum (doctrine §3 narrows the Fable-outage fallback for hard gates) remains an open
  **shaper** call — still not folded into the ADR's own text.
- Per-merge teardown of the local `slice/0002-house-version-flag` branch awaits explicit user OK
  (auto-fix boundary).
