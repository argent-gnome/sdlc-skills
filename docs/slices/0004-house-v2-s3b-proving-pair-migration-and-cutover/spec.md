---
id: "0004-house-v2-s3b-proving-pair-migration-and-cutover"
kind: spec
slice: "0004-house-v2-s3b-proving-pair-migration-and-cutover"
title: "house v2 S3b — v2 cutover (rename + v1 archive)"
status: "shaped 2026-07-29; user-approved"
state: approved
---
# Spec — v2 cutover: rename + v1 archive

## Problem
The `house2-*` names were a migration affordance, and per ADR-0004 "a `house2-*` name surviving past
S3 is a defect, not a convention." The cutover condition is now satisfied and user-ruled (both proving
repos shipped real work through the v2 loop; the ruling and its one letter-gap are in this slice's
`deviation.raised`). Meanwhile the temporary names actively bite: any doc linking the ADR-0004
filename or the doctrine path trips the names-containment checks (this slice's `work.discovered`),
and v1's seven skill files plus two orphaned workflows still install as live skills.

## Appetite
1 session. Inputs are pre-researched: `research/migration-cutover.md` holds the rename inventory
(34 live lines / 22 files / 3 dir renames; 74 historical lines that must NOT change), the archive
mechanics, and the install/collision analysis.

## Solution
One coordinated slice: archive v1 out of `skills/`, `git mv` the three v2 skills to canonical names,
sweep the live surfaces, add the missing prune step to `install.sh`, and verify the installed global
namespace ends clean. History stays as written.

## Rabbit Holes
- No v2 rewrite of `docs/process.md`/`.html` — banner reword only; the rewrite is its own slice.
- No doctrine content changes — the file moves with its directory; its text is untouched.
- The done-check is a **scoped** grep over live surfaces, never `grep -c house2 == 0` repo-wide —
  that bar would force rewriting history (slice records, events, ADR-0004), which is forbidden.

## No-Gos
- NOT renaming `docs/adr/0004-house2-coexistence-and-advisory-hooks.md` (the record OF the decision).
- NOT touching historical records: `docs/slices/*` specs/plans/research, `.house/events.jsonl`,
  retros, ADR bodies (beyond ADR-0004's short cutover-done note, R-4).
- NOT any change under `cli/` (the CLI has no `house2` references).
- NOT deleting v1 content — archive, never erase.

## Requirements

### R-1: v1 archives out of the install path
The v1 skills (`skills/house-shaper`, `skills/house-orchestrator`, `skills/house-builder` — including
the two orphaned workflows `merge-gate-panel.js` and `code-health-sweep.js`) move via `git mv` to
`archive/skills-v1/` (outside `skills/`, so the install glob cannot link them), with a short
`archive/skills-v1/README.md` stating what they are, when and why they were retired (link ADR-0004),
and that re-adoption of the workflows means a rewrite. `install.sh`'s three trailing echo lines about
v1 workflow paths are removed.

#### Scenario: the archive is not installable
- When I run `./install.sh` after the move
- Then no `archive`-derived entry appears in `~/.claude/skills/`

### R-2: the three v2 skills take the canonical names
`git mv skills/house2-shaper skills/house-shaper` (same for orchestrator and builder), in the same
commit as R-1's moves so no commit has two claimants to one name. All intra-skill references (the
doctrine path cited inside the skills and docs) update to the new paths. The live surfaces sweep to
canonical names: root `README.md`, `cli/README.md`, `docs/roadmap.md`, `docs/dev-state.md` (manual
block), `docs/quickstart.md` (the names table drops its migration caption and lists canonical names —
its table-only containment rule dissolves with it), `docs/process-v2.md`.

#### Scenario: live surfaces are clean, history is untouched
- When I grep `house2` over the live surfaces named above plus `skills/` and `install.sh`
- Then there are zero hits — while `docs/slices/`, `.house/events.jsonl`, and the ADR-0004 file
  still contain their historical mentions unchanged

### R-3: `install.sh` prunes dangling skill links
`install.sh` gains a prune step: any symlink in `~/.claude/skills/` that points into this repo's
`skills/` but no longer resolves (its target moved or vanished) is removed before linking. Idempotent;
copies-mode installs are out of scope (symlink mode is the default and the installed reality).

#### Scenario: no dangling links after the rename
- Given `~/.claude/skills/house2-shaper` pointing at the now-moved directory
- When I run `./install.sh`
- Then the dangling `house2-*` links are gone, the three canonical names point at the v2 skills, and
  every remaining link resolves

### R-4: the record and the banner close the loop
The 0005 banner on `docs/process.md`/`.html` rewords from "still live for repos that have not
migrated" to "retired at the 2026-07-29 cutover; archived at `archive/skills-v1/`" (links updated,
blob URLs preserved in the html). ADR-0004 gains a one-line dated note that the cutover executed and
the coexistence window closed. The roadmap S3b row and dev-state reflect shipped-at-cutover.

#### Scenario: a reader cannot land on a live v1 claim
- When I read the process banner, README, quickstart, or ADR-0004 after the cutover
- Then each states v1 is archived, none says "still live"

### R-5: cutover-day coordination is written down
Because the global namespace changes the moment the merge lands, the slice's live_check includes the
coordination steps, executed with the user: merge → `./install.sh` → verify `~/.claude/skills/` (three
canonical links to v2, zero `house2-*`, zero dangling) → `/reload-skills` or restart in any open
session. The ~15 unmigrated repos lose installed v1 skills by design — the recorded, user-ruled cost
of cashing in ADR-0004's staging window; a repo that needs the old flow re-links it from
`archive/skills-v1/` by hand.

#### Scenario: an open session survives the cutover
- Given a session opened before the merge
- When the user runs `/reload-skills` (or restarts) after `./install.sh`
- Then invoking `house-orchestrator` loads the v2 conductor and no stale `house2-*` skill remains
