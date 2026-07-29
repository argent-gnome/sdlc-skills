# `house` — the house v2 state kernel CLI

The files are the contract; the CLI is a convenience. `git clone` + a text editor stays sufficient — `house`
just makes the contract cheap to honor and impossible to fake.

## Install

```bash
./install.sh            # from the repo root: npm install in cli/ + link the `house` bin (+ the skills)
cd cli && npm test      # node:test suite; Node >= 20, ESM, one runtime dep (js-yaml)
```

`install.sh` prefers `npm link`; if the global prefix is not writable it falls back to a symlink in
`~/.local/bin`. To install only the CLI: `cd cli && npm install && npm link`.

## The three-layer contract

```
DECLARED   docs/slices/<id>/slice.yaml + YAML frontmatter    written by the agent owning the stage   tracked
    │                                                        (spec.md, plan.md, tasks.yaml, gates/*,
    │                                                         units/NN-report.md)
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
- **One writer per field.** `house event` emits only free-form event types; every other event type belongs to
  its dedicated command (`house new/state/gate/task/block/unblock/artifact/unit/pr`). Each of those writers
  appends its own event, so a manifest field cannot change without OBSERVED saying so.
- **Fail-closed state machines.** `house artifact` walks `artifact_transitions` and refuses illegal jumps;
  `house state` walks `state_transitions`; a unit with no finalized record is **unknown, never DONE**.
- **No silent drops.** `house render dev-state` parses `dev-state.md` positionally — title | generated block |
  `<!-- house:manual -->` block | tail — and refuses (exit 1, nothing written) when *any* content sits outside
  those regions, naming the first offender. There is no back-compat path: fix the file, then re-render.
- **Thinning OBSERVED is counted, never silent.** `readEvents` returns a skip count for torn JSONL lines and
  `house log` prints it (`skipped: N` in `--json`).

`schema/enums.yaml` is the single normative source for every enum — states, kinds, tiers, verdicts, event
types, `free_form_events`, legal state and artifact transitions, required gates, `blocked_on` shape,
`unit_results`. `schema/kickoff.yaml` is the same thing for the builder kickoff brief, read by sender and
receiver alike. Nothing restates them.

**Malformed input is a finding, never a crash.** A placeholder `tasks.yaml` with no `tasks:` key, a stray
`.DS_Store` in `gates/`, one torn line in `events.jsonl` (an interrupted append, or a `merge=union` artifact),
or unparseable ADR frontmatter each degrade gracefully — the derived layer keeps building and `validate`
reports the problem instead of throwing.

## Commands

| Command | What it does |
|---|---|
| `house init` | Scaffold `.house/`, `docs/slices/`, `docs/adr/`, `.gitattributes` (union-merge), `.gitignore`, and **merge** the advisory hooks block into `.claude/settings.json`. Idempotent; never overwrites existing hooks. |
| `house new "<title>" [--kind <kind>] [--rigor <tier>] [--appetite <s>]` | Mint identity: `docs/slices/NNNN-slug/` + `slice.yaml` + `spec.md`; `mkdir` is the allocator lock. |
| `house new "<title>" --adr` | Mint an ADR in `docs/adr/` on its own series, MADR-lite frontmatter (`status:` + `state:`). |
| `house event <type> --slice <id> --payload '<json>'` | Append a free-form event to the OBSERVED log. |
| `house gate <name> --slice <id> --verdict <v> [--actor <who>] [--notes <s>] [--payload '<json>']` (`--by` is a legacy alias for `--actor`) | Write `gates/<name>.yaml` + a `gate.recorded` event referencing that record. Unknown gate or verdict is refused. On a **passing** verdict it auto-clears a `blocked_on` naming that gate (and emits `slice.unblocked`). |
| `house task done <task> --slice <id> [--evidence-cmd "<cmd>"]` | Run the proof, record exit/summary, flip to `done` — or refuse. |
| `house task block <task> --slice <id> --note "<why>"` | Mark blocked; the note is required. |
| `house state <id> <to>` | Guarded transition: legal edge + required gate records + passing verdicts. Terminal transitions also emit `slice.shipped` / `slice.abandoned`. |
| `house block <id> --gate <name> [--note "<why>"]` | Set `blocked_on` to the pinned `{gate, note, since}` shape + emit `gate.requested`. |
| `house unblock <id> [--note "<why>"]` | Clear `blocked_on` by hand + emit `slice.unblocked`. |
| `house artifact <id> <name> <state> [--reason "<why>"]` | Walk the artifact state machine; illegal jumps are refused, `skipped` requires a reason. |
| `house unit <id> dispatch --title "<t>"` | Append a `units[]` entry, scaffold `units/NN-report.md`, print the new unit id. |
| `house unit <id> heartbeat <unit> --note "<s>"` | Append a timestamped line to that unit's incremental report. |
| `house unit <id> finalize <unit> --result <DONE\|BLOCKED\|NEEDS_CONTEXT\|DEVIATION> [--note "<s>"]` | Close the unit record. No finalize record ⇒ unknown, never DONE. |
| `house pr <id> [--set <url>] [--base-sha <sha>]` | Set the merge projection's raw material; emits `slice.pr_set`. |
| `house status [<id>] [--json]` · `house list [--json]` | Per-slice state + evidence-backed progress. A single-slice `--json` view also carries that slice's tasks. |
| `house next [--slice <id>] [--json]` | The ready set: `todo` tasks whose `depends_on` are all `done`. Only workable states offer work — `idea`/`parked`/`abandoned` never do. |
| `house log [--slice <id>] [--n <N>] [--json]` | Recent OBSERVED events, newest last, with the unparseable-line skip count. |
| `house index` | Rebuild `.house/index.json` from DECLARED state. |
| `house validate [--strict] [--json] [--slice <id>]` | Lint the repo: enum drift, orphan files, skips without reasons, done-without-evidence, external mockup refs (incl. style-attr `url()`), ADR states, `blocked_on` shape, `tasks.yaml` structure, kickoff-brief structure, approval-boundary drift between `slice.yaml` and doc frontmatter, roadmap `[NNNN]` refs pointing at slices that exist. `--strict` also blocks on a well-formed `[NEEDS CLARIFICATION …]` marker in the handoff artifacts (`spec.md`/`plan.md`) — code spans, fences and HTML comments do not count. `--slice <id>` narrows every per-slice check to that one slice (unknown id exits 1, never green) and skips the repo-level ADR/roadmap lints. |
| `house render dev-state` | Regenerate the Active/In-flight/Slated/Parked/Done half of `docs/dev-state.md`. |
| `house hook <event>` | Hook entry point (stdin JSON → stdout JSON) — see below. |
| `house --version` | Print `cli/package.json`'s `version` to stdout, exit 0. Pre-dispatch: works from any cwd, house repo or not (slice `0002`). |

**Exit codes:** `0` clean · `1` command error or red `validate` · `2` usage error / not a house repo.
`house hook` is the exception: it **never** exits non-zero and prints nothing outside a house repo.

## Hooks (advisory-only)

`house init` merges four hooks into `.claude/settings.json`. All are advisory in S2 — observation, not
enforcement ([ADR-0004](../docs/adr/0004-house2-coexistence-and-advisory-hooks.md)); the gates stay the
enforcement point. Every path fails open, recording a `hook.degraded` event when it swallows a real error.

| Event | `house hook …` | Behavior |
|---|---|---|
| `SessionStart` | `session-start` | emit `session.started`; inject `house status` + `house next` as additionalContext |
| `SessionEnd` | `session-end` | emit `session.ended` (async) |
| `PreToolUse` (`Edit\|Write\|MultiEdit`) | `pre-write` | permission **ask** — never deny — on writes to kernel-owned paths (`.house/`, `docs/slices/*/gates/`, `slice.yaml`, `tasks.yaml`), with a reason naming the right `house` command |
| `SubagentStop` | `subagent-stop` | additionalContext naming any dispatched unit with no finalized report |

`Stop` is deliberately not wired. Blocking hooks are an S3+ increment with a named precondition (builders
declared as an agent type), per ADR-0004.

## Not in this slice

`house archive`, blocking hooks / `PreToolUse` deny, atomic (tmp+rename) writes, and the desktop IDE all land
in later slices. The v2 skills that drive this CLI (`house2-*`) and doctrine v2 ship in the same slice as
these commands but in a later unit.

**`house adopt` is not coming — it was cancelled, not deferred.** Earlier drafts of this section promised it
in a later slice; the **2026-07-29 amendment** to
[ADR-0004](../docs/adr/0004-house2-coexistence-and-advisory-hooks.md) settled the onboarding story without a
new command:

- **Greenfield repos** — repos with no work already shaped — onboard with **`house init`**, which is
  shipped.
- **Already-shaped work** — an existing spec/plan that predates the kernel — is adopted by a
  **`house2-shaper` session**, not by a command: the shaper imports the artifacts into the slice's records
  (`house new` + `house artifact`) and **records their gates** — `spec_review` re-affirmed by the user, and
  a **fresh** v2 `plan_check` run before the slice goes `ready`. Adoption done that way counts as a real v2
  slice for the cutover condition in that amendment.

Adoption is a judgment pass over artifacts that a command could only fake, so it stays where the judgment
is. Nothing in the CLI is owed here.
