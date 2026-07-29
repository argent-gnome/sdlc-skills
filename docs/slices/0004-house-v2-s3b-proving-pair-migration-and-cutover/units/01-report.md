# Unit 01 — v2 cutover — archive v1, rename to canonical, sweep live surfaces, install.sh prune, close records

- slice: 0004-house-v2-s3b-proving-pair-migration-and-cutover
- dispatched: 2026-07-29T18:35:51.967Z (orchestrator record, restored at the post-build merge; builder re-minted at 18:39 on a branch cut before the dispatch commit — see deviation)

## Heartbeats
- 2026-07-29T18:42:20.763Z — T1 done: v1 archived to archive/skills-v1/ (byte-identical to base), v2 renamed to canonical house-*, intra-skill paths swept, install.sh v1-workflow echoes dropped. Commit ff623c4.
- 2026-07-29T18:47:42.306Z — T2 done: live surfaces swept to canonical (README coexistence section rewritten incl. M3 tokenless claims, cli/README, quickstart names table, process-v2 doctrine path, roadmap 21/52, dev-state 35/53/54). T2 verify corrected — ADR-0004 filename made the planned grep unsatisfiable; deviation recorded. Commit 8a49e1b.
- 2026-07-29T18:52:41.516Z — T3 done: install.sh prunes dangling links scoped to this repo's SKILLS_SRC (M1). test/install-prune.sh added as the behavioral verify (A3) — 4 seeded cases + idempotency, proven to fail against a too-broad prune. Real ~/.claude/skills never touched. Commit 4c61fca.
- 2026-07-29T19:07:35.047Z — T4 done + reconcile complete. Both node gates green (72/72 tests, house validate exit 0); all four task verifies re-run green post-reconcile. Pushed d7bda94. Two items for the gate: cli/README.md was swept (scope guard says no cli/ changes, but spec R-2 + T2 verify both require it), and the reconcile subagent's fabricated 'A5/T4 Step 1b' provenance was stripped.

## Result

**DEVIATION** — All 4 tasks evidence-ticked, both node gates green, cutover built. Finalized DEVIATION not DONE: 3 verify commands had to be corrected/strengthened (T2's was unsatisfiable), cli/README.md was swept against a literal scope guard, test/install-prune.sh is a file the plan did not anticipate, and the orchestrator's unit-dispatch record was absent so the builder minted it. All disclosed; merge gate to re-judge.
- finalized: 2026-07-29T19:07:41.735Z
