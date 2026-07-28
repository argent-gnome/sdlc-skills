# sdlc-skills — dev state   (updated 2026-07-28)


> Operational tracker only (the doctrine's dev-state allowlist). Durable strategy → [`roadmap.md`](roadmap.md);
> the *why* behind decisions → specs/ADRs/retros. Keep this short; update at stage transitions and session end.

## Active slice: none building — house v2 **SHAPED** (2026-07-28)
- shaped: spec approved (owner) + S1 plan checked (GO-WITH-FIXES, all fixes folded) + `docs/adr/0002-house-v2-state-first-redesign.md`
- next action: orchestrator session to build **S1 (kernel + CLI)** from `docs/superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md`
- branch: `house-v2-shaping` worktree (docs only)   blocked on: none

## In-flight
- builders / PRs: none

## Slated (next up)
- **house v2 S1 — kernel + `house` CLI** → `docs/superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md` (ready to build)
- **house v2 S2** — skills rewrite + doctrine v2 + hooks → [`roadmap.md`](roadmap.md)
- **house v2 S3** — migrate the proving pair (sdlc-skills + edge-scanner) → [`roadmap.md`](roadmap.md)
- **house v2 S4+** — the desktop IDE (own shaping, own repo; blocked on S1–S3) → [`roadmap.md`](roadmap.md)

## Done
- **fable-profile model routing** (Fable 5 returned; judgment→Fable, throughput→Opus) — 2026-07-01 — `docs/adr/0001-fable-profile-model-routing.md` (VERSION 0.5.0)
- **Piece C** — the `house-shaper` skill (3-skill ecosystem) — 2026-06-30 — `docs/retros/2026-06-30-house-shaper-retro.md` (PR #3, `main` 79ee639; VERSION 0.4.0)
- **Piece B** — wire the remaining hygiene self-checks — 2026-06-30 — `docs/retros/2026-06-30-hygiene-self-checks-retro.md` (PR #2, `main` 40a4166; VERSION 0.3.0)
- **Piece A** — shared docs & hygiene doctrine — 2026-06-30 — `docs/retros/2026-06-30-docs-hygiene-doctrine-retro.md` (PR #1, `main` 95bd854; VERSION 0.2.0)

## Infra / secrets
- GitHub: `argent-gnome/sdlc-skills` (Pages site builds from `main`). Installed via `install.sh` (symlink mode) → `~/.claude/skills/`. Current VERSION: 0.4.0.
- **Three skills now:** `house-shaper` (fuzzy front end) · `house-orchestrator` (conductor) · `house-builder` (executor). `house-shaper` needs `./install.sh` re-run to symlink.
- Runtime doctrine: `skills/house-orchestrator/references/doctrine.md`, cited by the orchestrator + builder + shaper via the `$HOME/.claude/skills/house-orchestrator/...` path.

## Gotchas
- `docs/*.html` are **hand-authored** (no generator) — mirror any `docs/*.md` prose change into the matching `.html` by hand.
- `install.sh` symlinks each `skills/<name>` → editing the repo file IS the live skill (run `/reload-skills` to pick up changes).
- Squash-merging a PR breaks `git branch --merged` detection — confirm merged-ness via PR state before pruning (now codified in the doctrine).

## Process notes
- This repo **dogfoods the house process**: specs/plans under `docs/superpowers/`, retros under `docs/retros/`.
- Redesign decisions (locked): doctrine scope = focused (docs + hygiene); enforcement = active self-checks at gates; `roadmap.md` = blessed-canonical durable-strategy doc name.
- `roadmap.md` now exists (created at the house-v2 shaping, 2026-07-28) — durable sequencing and deferred work live there, not here.
