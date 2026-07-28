# house SDLC skills

A lightweight, **plugin-free** set of Claude Code skills that run the house software-development lifecycle the
same way every time — at a fraction of the per-message token cost of a plugin.

**Six skills, two coexisting generations** ([ADR-0004](docs/adr/0004-house2-coexistence-and-advisory-hooks.md)),
split along the way you actually work:

- **`house-shaper`** / **`house2-shaper`** — a user-run shaping session for the fuzzy front end: research,
  brainstorm, spec, plan, plan-check, and doc reconcile. Turns an idea into ready-to-build work (or a recorded
  decision), then hands off to the orchestrator.
- **`house-orchestrator`** / **`house2-orchestrator`** — the long-lived conductor session. Sequences a slice,
  holds the gates, dispatches build sessions, reviews their work via subagents, and reconciles. Resumes cold
  from a per-project `docs/dev-state.md` file (v1) or the `house` CLI's records (v2).
- **`house-builder`** / **`house2-builder`** — an ephemeral build session that implements ONE plan unit (TDD +
  stack gates + self-review + doc reconcile), then reports back and is torn down.

The `house2-*` trio is the **house v2** rewrite: thin actors over a state-first kernel (the `house` CLI +
on-disk records in `.house/`), with a judgment-only doctrine that never restates what the kernel's
`cli/schema/enums.yaml` already owns. **They only run in a repo the kernel tracks** — one with a `.house/`
directory (`house init` creates it) — and refuse otherwise, same as the `house-*` trio refuses once a repo
has migrated. The two sets install side by side and don't touch each other; v1 is untouched, unarchived, and
still the default until a repo migrates. The rename to canonical names and the v1 archive are a planned S3
cutover, not done yet — see [`docs/roadmap.md`](docs/roadmap.md).

Reviews (plan-check, merge-gate, doc-reconcile) run as **subagents** — the diff/docs are read in *their*
context and only the verdict returns, so the orchestrator stays light. Two heavier v1 reviews stay as **local
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

The docs are also published as web pages: **<https://argent-gnome.github.io/sdlc-skills/>**.

- **[docs/process.md](docs/process.md)** (or `docs/process.html`) — the full loop, the gates, and the
  three reviews, written so you can understand the system without reading the skills.
- **[docs/best-practices.md](docs/best-practices.md)** (or `docs/best-practices.html`) — the general
  theory: how context is paid for per message, the three cost tiers, the plugin trap, subagents vs.
  registered agents, and the rules that fall out of it.
- **[docs/case-study.md](docs/case-study.md)** (or `docs/case-study.html`) — those rules applied here:
  the move-by-move refactor of the old `dev-command-center` plugin into these three skills, with the
  before/after token numbers.

## Versioning

`VERSION` + git tags. Bump on any process-rule change so sessions can tell which loop they're running.

## License

[MIT](LICENSE).
