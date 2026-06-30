# sdlc-skills — dev state   (updated 2026-06-30)


> Operational tracker only (the doctrine's dev-state allowlist). Durable strategy → a roadmap doc;
> the *why* behind decisions → specs/retros. Keep this short; update at stage transitions and session end.

## Active slice: none — between pieces of the ecosystem redesign
- stage: idle            next action: scope Piece C (the house-shaper skill)
- branch: main (clean)   blocked on: none

## In-flight
- builders / PRs: none (PR #1 merged)

## Slated (next up)
- **Piece C** — new `house-shaper` skill: front-of-loop research/brainstorm → reconcile (dialogue inline; research + reconcile in subagents). Last piece of the redesign.

## Done
- **Piece B** — wire the remaining hygiene self-checks — 2026-06-30 — `docs/retros/2026-06-30-hygiene-self-checks-retro.md` (PR #2, `main` 40a4166; VERSION 0.3.0)
- **Piece A** — shared docs & hygiene doctrine — 2026-06-30 — `docs/retros/2026-06-30-docs-hygiene-doctrine-retro.md` (PR #1, `main` 95bd854; VERSION 0.2.0)

## Infra / secrets
- GitHub: `argent-gnome/sdlc-skills` (Pages site builds from `main`). Installed via `install.sh` (symlink mode) → `~/.claude/skills/`. Current VERSION: 0.3.0.
- Runtime doctrine: `skills/house-orchestrator/references/doctrine.md`, cited by both skills via the `$HOME/.claude/skills/house-orchestrator/...` path.

## Gotchas
- `docs/*.html` are **hand-authored** (no generator) — mirror any `docs/*.md` prose change into the matching `.html` by hand.
- `install.sh` symlinks each `skills/<name>` → editing the repo file IS the live skill (run `/reload-skills` to pick up changes).
- Squash-merging a PR breaks `git branch --merged` detection — confirm merged-ness via PR state before pruning (now codified in the doctrine).

## Process notes
- This repo **dogfoods the house process**: specs/plans under `docs/superpowers/`, retros under `docs/retros/`.
- Redesign decisions (locked): doctrine scope = focused (docs + hygiene); enforcement = active self-checks at gates; `roadmap.md` = blessed-canonical durable-strategy doc name.
- A standalone `roadmap.md` for this repo doesn't exist yet — create one if the redesign backlog grows beyond Pieces B/C.
