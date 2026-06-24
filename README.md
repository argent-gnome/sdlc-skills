# house SDLC skills

A lightweight, **plugin-free** set of Claude Code skills that run the house software-development lifecycle the
same way every time — at a fraction of the per-message token cost of a plugin.

Two skills, split along the way you actually work:

- **`house-orchestrator`** — the long-lived conductor session. Sequences a slice, holds the gates, writes
  kickoff prompts for build sessions, reviews their work via subagents, and reconciles. Resumes cold from a
  per-project `docs/dev-state.md` file.
- **`house-builder`** — an ephemeral build session that implements ONE plan unit (TDD + stack gates +
  self-review + doc reconcile), then reports back and is torn down.

Reviews (plan-check, merge-gate, doc-reconcile) run as **subagents** — the diff/docs are read in *their*
context and only the verdict returns, so the orchestrator stays light. Two heavier reviews stay as **local
workflows** (`skills/house-orchestrator/workflows/`): the high-stakes merge-gate **panel** and the advisory
**code-health-sweep**. Nothing here depends on a plugin, marketplace, or external repo.

## Install

```bash
git clone <this-repo> ~/projects/sdlc-skills
cd ~/projects/sdlc-skills
./install.sh            # symlinks skills/* into ~/.claude/skills/ (git pull = live update)
# ./install.sh copy     # or copy instead of symlink
```

Then `/reload-skills` (or restart Claude Code). Update later with `git pull` (symlink mode) or
`git pull && ./install.sh copy`.

> The two `Workflow({scriptPath: ...})` lines in `house-orchestrator/SKILL.md` use an absolute install path.
> Symlink-install keeps them valid; if you copy-install elsewhere, update those two lines.

## How it works

- **[docs/process.md](docs/process.md)** (or `docs/process.html`) — the full loop, the gates, and the
  three reviews, written so you can understand the system without reading the skills.
- **[docs/best-practices.md](docs/best-practices.md)** (or `docs/best-practices.html`) — the general
  theory: how context is paid for per message, the three cost tiers, the plugin trap, subagents vs.
  registered agents, and the rules that fall out of it.
- **[docs/case-study.md](docs/case-study.md)** (or `docs/case-study.html`) — those rules applied here:
  the move-by-move refactor of the old `dev-command-center` plugin into these two skills, with the
  before/after token numbers.

## Versioning

`VERSION` + git tags. Bump on any process-rule change so sessions can tell which loop they're running.
