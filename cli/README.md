# `house` — the house v2 state kernel CLI

The files are the contract; the CLI is a convenience. `git clone` + a text editor stays sufficient — `house`
just makes the contract cheap to honor and impossible to fake.

## Install

```bash
cd cli && npm link      # global `house` bin; Node >= 20, ESM, one runtime dep (js-yaml)
npm test                # node:test suite
```

## The three-layer contract

```
DECLARED   docs/slices/<id>/slice.yaml + YAML frontmatter    written by the agent owning the stage   tracked
    │                                                        (spec.md, plan.md, tasks.yaml, gates/*)
    ├─ append ──▶
OBSERVED   .house/events.jsonl   append-only, ULID ids, merge=union   written ONLY by `house`   tracked
    │
    ├─ derive ──▶
DERIVED    .house/index.json     rebuildable cache            written ONLY by `house index`    gitignored
```

Rules the code enforces, not just documents:

- **An unrecorded gate is an unpassed gate.** `house state` refuses to advance without a `gates/<name>.yaml`
  record, and refuses again if the recorded verdict is not in that gate's `passing_verdicts`. Fail-closed:
  `INCONCLUSIVE` is not a pass.
- **Evidence-gated ticks.** `house task done` runs the verify command and refuses the tick on a nonzero exit.
  A task with no `verify:` and no `--evidence-cmd` cannot be ticked at all; a done task cannot be re-ticked.
- **Anything derivable is derived.** Delete `.house/index.json`, run `house index` — byte-identical.
- **One writer per field.** `house event` emits only free-form event types; `slice.created`,
  `slice.state_changed`, `task.done`, `gate.recorded` belong to their dedicated commands.
- **No silent drops.** `house render dev-state` refuses (exit 1) when hand-authored content sits outside the
  `<!-- house:manual -->` markers.

`schema/enums.yaml` is the single normative source for every enum — states, kinds, tiers, verdicts, event
types, `free_form_events`, legal transitions, required gates. Nothing restates them.

**Malformed input is a finding, never a crash.** A placeholder `tasks.yaml` with no `tasks:` key, a stray
`.DS_Store` in `gates/`, one torn line in `events.jsonl` (an interrupted append, or a `merge=union` artifact),
or unparseable ADR frontmatter each degrade gracefully — the derived layer keeps building and `validate`
reports the problem instead of throwing.

## Commands

| Command | What it does |
|---|---|
| `house init` | Scaffold `.house/`, `docs/slices/`, `docs/adr/`, `.gitattributes` (union-merge), `.gitignore`. Idempotent. |
| `house new "<title>" [--kind <kind>] [--rigor <tier>]` | Mint identity: `docs/slices/NNNN-slug/` + `slice.yaml` + `spec.md`; `mkdir` is the allocator lock. |
| `house new "<title>" --adr` | Mint an ADR in `docs/adr/` on its own series, MADR-lite frontmatter. |
| `house event <type> --slice <id> --payload '<json>'` | Append a free-form event to the OBSERVED log. |
| `house gate <name> --slice <id> --verdict <v> [--by <who>] [--notes <s>] [--payload '<json>']` | Write `gates/<name>.yaml` + a `gate.recorded` event. Unknown gate or verdict is refused. |
| `house task done <task> --slice <id> [--evidence-cmd "<cmd>"]` | Run the proof, record exit/summary, flip to `done` — or refuse. |
| `house task block <task> --slice <id> --note "<why>"` | Mark blocked; the note is required. |
| `house state <id> <to>` | Guarded transition: legal edge + required gate records + passing verdicts. |
| `house status [--json]` · `house list [--json]` | Per-slice state + evidence-backed progress. |
| `house next [--json]` | The ready set: `todo` tasks whose `depends_on` are all `done`. |
| `house index` | Rebuild `.house/index.json` from DECLARED state. |
| `house validate [--strict]` | Lint the repo: enum drift, orphan files, skips without reasons, done-without-evidence, external mockup refs, ADR states. `--strict` also blocks on `[NEEDS CLARIFICATION]`. |
| `house render dev-state` | Regenerate the Active/In-flight/Slated/Done half of `docs/dev-state.md`. |

**Exit codes:** `0` clean · `1` command error or red `validate` · `2` usage error / not a house repo.

## Not in this slice

Hooks wiring, `house archive`, `house adopt`, the skill rewrite, and the IDE all land in later slices. The
`blocked_on` field and the `gate.requested` event type ship here as schema; their writers arrive with the
skills in S2.
