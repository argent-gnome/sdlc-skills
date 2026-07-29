# house SDLC skills — v1 (retired)

These are the **v1** house skills — `house-shaper`, `house-orchestrator`, `house-builder` — plus the
two workflow scripts `house-orchestrator/workflows/merge-gate-panel.js` and `code-health-sweep.js`.

**Retired 2026-07-29** at the v2 cutover (slice `0004`), the cutover that
[ADR-0004](../../docs/adr/0004-house2-coexistence-and-advisory-hooks.md) designated as the end of the
coexistence window. The v2 skills now hold the canonical `house-*` names under `skills/`.

They live here, outside `skills/`, so `install.sh`'s `skills/*/` glob cannot link them as live skills.
This directory is a **signpost, not an installable** — git history is the real archive.

**The two workflow scripts were already orphaned before the cutover:** nothing in v2 invoked them (v2
dispatches subagents, not local JS workflows), and the merge-gate panel and code-health sweep survive
as *design intent* in the v2 doctrine, not as code. Re-adopting either means a rewrite, not a
re-link — the research digest for slice `0004` catalogues their known defects.

If a repo genuinely still needs the v1 flow, link it by hand from here:

```bash
ln -s "$PWD/archive/skills-v1/house-orchestrator" ~/.claude/skills/house-orchestrator-v1
```

Nothing was deleted. Archive, never erase.
