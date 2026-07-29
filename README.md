# house SDLC skills

A lightweight, **plugin-free** set of Claude Code skills that run the house software-development lifecycle the
same way every time — at a fraction of the per-message token cost of a plugin.

**Three skills**, split along the way you actually work:

- **`house-shaper`** — a user-run shaping session for the fuzzy front end: research, brainstorm, spec, plan,
  plan-check, and doc reconcile. Turns an idea into ready-to-build work (or a recorded decision), then hands
  off to the orchestrator.
- **`house-orchestrator`** — the long-lived conductor session. Sequences a slice, holds the gates, dispatches
  build sessions, reviews their work via subagents, and reconciles. Resumes cold from the `house` CLI's
  records.
- **`house-builder`** — an ephemeral build session that implements ONE plan unit (TDD + stack gates +
  self-review + doc reconcile), then reports back and is torn down.

These are **house v2**: thin actors over a state-first kernel (the `house` CLI + on-disk records in
`.house/`), with a judgment-only doctrine that never restates what the kernel's `cli/schema/enums.yaml`
already owns. **They only run in a repo the kernel tracks** — one with a `.house/` directory (`house init`
creates it) — and refuse otherwise. The v1 trio that previously held these names was **retired at the
2026-07-29 cutover** and is archived, outside the install path, at
[`archive/skills-v1/`](archive/skills-v1/) — see
[ADR-0004](docs/adr/0004-house2-coexistence-and-advisory-hooks.md) for the staging window that ended there.

Reviews (plan-check, merge-gate, doc-reconcile) run as **subagents** — the diff/docs are read in *their*
context and only the verdict returns, so the orchestrator stays light. Nothing here depends on a plugin,
marketplace, or external repo.

## Install

```bash
git clone <this-repo> ~/projects/sdlc-skills
cd ~/projects/sdlc-skills
./install.sh            # symlinks skills/* into ~/.claude/skills/ (git pull = live update)
# ./install.sh copy     # or copy instead of symlink
```

Then `/reload-skills` (or restart Claude Code). Update later with `git pull` (symlink mode) or
`git pull && ./install.sh copy`.

`install.sh` also prunes stale links: any symlink in the install dir that points into this repo's `skills/`
but no longer resolves is removed before linking, so a rename or an archive never leaves a dangling skill.

## How it works

The docs are also published as web pages: **<https://argent-gnome.github.io/sdlc-skills/>**.

New to **house v2**? Start with **[docs/quickstart.md](docs/quickstart.md)** (stand up a project on the
kernel) and **[docs/process-v2.md](docs/process-v2.md)** (how the v2 loop works). The three pages below
describe the **v1** process, retired at the 2026-07-29 cutover — they are kept as background on the
lifecycle and the token economics, not as instructions for a live loop.

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
