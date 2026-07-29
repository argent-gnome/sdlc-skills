# Unit 01 — onboarding docs (T1-T3)

- slice: 0005-v2-onboarding-docs-quickstart-process-narrative
- dispatched: 2026-07-29T14:26:32.205Z

## Heartbeats
- 2026-07-29T14:29:44.258Z — T1 as-built note: the ADR-0004 filename itself contains 'house2', so a bare prose link to it would break R-1's names-containment check. Resolved without weakening the grep — the live ADR link sits in the names-table note row (semantically its home: it IS the migration-window decision), and the adoption section names ADR-0004 in plain text and routes via cli/README.md's adoption section, which links it. Plan T1 step 5's 'link the ADR' is honored one hop away rather than inline.
- 2026-07-29T14:41:23.004Z — Gates green: cli npm test 72/72, house validate exit 0. Reconcile subagent ran (plan.md as-built, roadmap Docs row, dev-state active slice + Gotchas mirror-exception). Tree clean at 8bb54b1.

## Result

**DONE** — T1-T3 evidence-ticked; quickstart.md + process-v2.md new, v1 banner +4/-0 and +6/-0 with zero deletions, README inbound sentence. M1/M2/M3/A2 all held; 2 placement deviations recorded in plan.md as-built.
- finalized: 2026-07-29T14:41:23.060Z
