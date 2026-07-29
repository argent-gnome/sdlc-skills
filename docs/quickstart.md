# Quickstart — starting a project on the house process

*[the house SDLC](process.md) · [how v2 works](process-v2.md) · [CLI reference](../cli/README.md)*

This page gets you from a clean machine to a repo that the house v2 kernel tracks, with the first
session ready to open. It assumes you have never seen this repo before. For *why* the process is
shaped this way, read [process-v2.md](process-v2.md) afterwards.

## What you need once

Clone this repo and run the installer. It links the skills into `~/.claude/skills/` and installs the
`house` binary.

```bash
git clone https://github.com/argent-gnome/sdlc-skills ~/projects/sdlc-skills
cd ~/projects/sdlc-skills
./install.sh
```

Confirm the CLI landed:

```bash
house --version      # prints a version, exit 0, from any directory
```

`house --version` works anywhere — inside a tracked repo or not. The working commands all need a repo
the kernel tracks (one with a `.house/` directory, which is what the CLI looks for as it walks up from
your working directory), and exit 2 when they can't find one. The hook entry point is the deliberate
exception: it stays silent and never fails outside a tracked repo, so it can never break a session.

Then run `/reload-skills` (or restart Claude Code) so the skills are visible to a session.

## New project, four commands

```bash
git init my-project && cd my-project
house init
$EDITOR .house/gates.yml
git add -A && git commit -m "chore: house kernel scaffolding"
```

- **`git init`** — do this first. The kernel keeps its records in git, and two of the files `house
  init` writes (`.gitattributes`, `.gitignore`) only do their job inside a repo.
- **`house init`** — scaffolds `.house/` (the event log and the gates file), `docs/slices/`,
  `docs/adr/`, a union-merge `.gitattributes` so two sessions appending events don't conflict, a
  `.gitignore` for the derived cache, and it *merges* an advisory hooks block into
  `.claude/settings.json`. It is idempotent and never overwrites hooks you added yourself.
- **Edit `.house/gates.yml`** — the one file `house init` cannot fill in for you. See the next
  section.
- **Commit** — the records are the process, so they belong in history from the first commit.

## Seed your gates

`.house/gates.yml` declares, per stack, the proof commands a build session must run green before it
may finish its unit. It is the repo's own bar. Where there is no hosted CI — as in this repo, [by
decision](adr/0003-no-hosted-ci-local-verification.md) — this file *is* the verification bar rather
than a convenience layered on top of one.

A stanza is a stack key and an ordered list of named commands:

```yaml
schema_version: 1
stacks:
  node:
    gates:
      - name: tests
        cmd: cd cli && npm test
      - name: validate
        cmd: house validate
```

Add one key per stack in the repo (`node`, `python`, `ios`, whatever you actually build). The build
session runs **every** gate for its stack, in order, and reports the real output.

The important property is that it **fails closed**: a build session handed a stack key that is absent
from this file — or handed no stack at all — stops and reports `NEEDS_CONTEXT` naming the missing key.
It never guesses a stack's gates, because guessing is how a run silently applies the wrong bar and
still reports green.

## Then invoke the shaper

Open a Claude Code session in the new repo and invoke the shaper skill (names in the table below).
Answer its first question — it will ask what you are trying to build, one question at a time, and it
converges before it writes anything. What comes out is a spec you approve, a plan, a plan-check
verdict from an independent reviewer, and a kickoff brief for the first build unit.

You do not need to hold any of that in your head afterwards. Every later session — conductor or
builder, yours or a fresh one after a crash — resumes from the records on disk. `house status` and
`house next` tell a cold session where the work stands and what is workable right now.

## Adopting already-shaped work

If the project already has a spec and a plan written before the kernel existed, you do **not** need a
migration command — there isn't one, and there isn't going to be one (see *adoption* in
[the CLI reference](../cli/README.md), which links the decision of record: the 2026-07-29 amendment to
ADR-0004, also linked from the names table below). Adoption is a judgment pass over existing
artifacts, so it happens in a shaper session:

1. Run `house init` as above, so the repo is tracked.
2. Open a shaper session and tell it you are adopting existing work.
3. The shaper mints the slice (`house new`), imports the existing spec and plan into
   `docs/slices/<id>/`, and records their provenance.
4. **You re-affirm `spec_review`.** An approval that happened in an old conversation is not a record;
   the user rung is re-run, not inherited.
5. **A fresh plan-check runs** against the imported plan before the slice can go to work.

Adopted work counts as real work through the kernel — the gates were recorded, which is the only thing
that ever counted.

## Current skill names

| skill | role | what the session does |
|---|---|---|
| `house-shaper` | shaper | fuzzy idea → spec, plan, plan-check, kickoff brief (or a recorded decision) |
| `house-orchestrator` | conductor | sequences one slice end to end: dispatches builders, holds the gates, reconciles |
| `house-builder` | builder | implements ONE unit from ONE kickoff brief, self-reviews, reports back |

These are the canonical names, taken at the **2026-07-29 cutover**. The v1 trio that held them before is
retired and archived at [`archive/skills-v1/`](../archive/skills-v1/) — see
[ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md) (and its 2026-07-29 amendment on adoption) for
the staging window that ended there.

## Where to go next

- **[process-v2.md](process-v2.md)** — how the system works: the roles, the records, the gates, and
  why the heavy work runs in subagents.
- **[../cli/README.md](../cli/README.md)** — every `house` command, and the three-layer state contract
  the CLI enforces.
- **[../cli/schema/enums.yaml](../cli/schema/enums.yaml)** — the normative list of states, gates,
  verdicts, and legal transitions. Nothing else restates them, including this page.
