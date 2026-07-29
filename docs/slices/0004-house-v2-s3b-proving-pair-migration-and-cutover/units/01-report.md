# Unit 01 — v2 cutover — archive v1, rename to canonical, sweep live surfaces, install.sh prune, close records

- slice: 0004-house-v2-s3b-proving-pair-migration-and-cutover
- dispatched: 2026-07-29T18:39:12.778Z

## Heartbeats
- 2026-07-29T18:42:20.763Z — T1 done: v1 archived to archive/skills-v1/ (byte-identical to base), v2 renamed to canonical house-*, intra-skill paths swept, install.sh v1-workflow echoes dropped. Commit ff623c4.
- 2026-07-29T18:47:42.306Z — T2 done: live surfaces swept to canonical (README coexistence section rewritten incl. M3 tokenless claims, cli/README, quickstart names table, process-v2 doctrine path, roadmap 21/52, dev-state 35/53/54). T2 verify corrected — ADR-0004 filename made the planned grep unsatisfiable; deviation recorded. Commit 8a49e1b.
- 2026-07-29T18:52:41.516Z — T3 done: install.sh prunes dangling links scoped to this repo's SKILLS_SRC (M1). test/install-prune.sh added as the behavioral verify (A3) — 4 seeded cases + idempotency, proven to fail against a too-broad prune. Real ~/.claude/skills never touched. Commit 4c61fca.

## Result

(pending — absence of a finalized result is fail-closed unknown, never DONE)
