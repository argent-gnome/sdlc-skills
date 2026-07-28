---
id: "0001-house-v2-s2-skills-rewrite"
kind: spec
slice: "0001-house-v2-s2-skills-rewrite"
title: "house v2 S2 — skills rewrite"
status: "shaped 2026-07-28; user-approved"
state: approved
---
# Spec — house v2 S2 — skills rewrite

## Problem

S1 shipped the kernel (`house` CLI + on-disk records), but the three skills that drive the process are
still v1: **431 lines of prose of which ~40% restates state the kernel now owns** — three incompatible
stage-numbering schemes, gate lists stated three times and disagreeing, a builder kickoff contract whose
sender and receiver lists diverge by four fields (making `NEEDS_CONTEXT` unevaluable), and three different
dev-state shapes. Meanwhile the CLI itself can't yet carry thin actors: **`slice.yaml` has ten fields and
the CLI writes exactly one of them** (`state`); `slice.shipped` is an enum entry with no producer; the
OBSERVED event log has no reader; and the S1 merge-gate GO was conditional on fixing the `renderDevState`
letter-gap silent drop. Until both halves land, "read state → act → write state" is aspiration, not
mechanism.

## Appetite

**3 sessions.** Roughly: (1) CLI enablers + hooks plumbing, (2) doctrine v2 + the three skills,
(3) smoke slice + gates + merge. Blowing the appetite is a surfaced event → scope-hammer or park;
the pre-scoped hammer order is: drop validate ride-alongs first, then `house log`, then narrow the
smoke slice — never the letter-gap fix, the manifest writers, or the smoke slice itself.

## Solution

One slice, built CLI-first so the repo is compile-green and useful at every boundary:

1. **CLI enablers** — the letter-gap fix, manifest-field writers (every write emits its event, making
   the one-writer invariant mechanical), a producer for `slice.shipped`, the read-side commands a
   resuming session needs, validate ride-alongs, and `install.sh` wiring.
2. **Doctrine v2** — one prose file for judgment only, under the hard rule **"doctrine may point at an
   enum, never restate one"**; `cli/schema/enums.yaml` stays the sole normative source for everything
   countable; per-repo stack lore moves to `.house/gates.yml`.
3. **Three v2 skills from scratch** — `house2-shaper` / `house2-orchestrator` / `house2-builder`, each
   reduced to loop + judgment; all countables become CLI reads. Shipped **alongside untouched v1**;
   rename-to-canonical + v1 archive happen at S3 cutover.
4. **Advisory-only hooks** — SessionStart / SessionEnd / PreToolUse-ask / SubagentStop-advisory via one
   `house hook <event>` subcommand. Blocking is explicitly deferred.
5. **Smoke slice** — one tiny patch-tier slice driven end-to-end through the three v2 skills on this
   repo; its evidence is required at S2's merge gate.

### Settled contradictions (binding for doctrine v2)

- **Merge-gate cadence is per-slice** (diff from `base_sha`); builder self-review stays per-unit. This
  codifies S1's actual practice.
- **Unattended high-stakes work halts at `gate.requested`** — it never silently downgrades a panel to a
  single reviewer. A false halt is safe; a false pass is not.
- **`parked` renders as its own dev-state section; `abandoned` renders nowhere** (its history stays in
  events + the slice dir; `house list` still shows it).

### Recorded deviations from the v2 program spec

- **Hooks ship advisory-only** (program spec §4 names two *blocking* hooks). Verified against the
  installed harness: `Stop` fires every assistant turn (not at session end), and `SubagentStop` cannot
  distinguish a builder from a research subagent while builders are plain subagents. Blocking becomes an
  S3+ increment after a slice of observed behavior.
- **`slice.merged` (§3.5) loses to the shipped `slice.shipped` enum** — the event name in `enums.yaml`
  wins; §3.5 is recorded as an erratum rather than renaming a shipped enum.

## Rabbit Holes

- **Comment-preserving YAML** — no new dependency. The rule is the fix: no meaning in YAML comments,
  anywhere the CLI round-trips.
- **A general `house set` field-writer** — tempting, but it bypasses per-field validation and events.
  Dedicated writers only.
- **Doctrine-as-CLI-data** (`house doctrine`) — drift-proof but the largest possible S2 and strains
  "git clone + a text editor is sufficient." Not this slice.
- **Perfecting the stage-table ↔ `slice_states` mapping** — stages in doctrine v2 are the 9 states plus
  named gate rungs, full stop. No finer sequence, no fractional stages.
- **`house init` editing `.claude/settings.json`** — smallest possible generated block, always merge,
  never overwrite; mis-merging degrades the user's whole harness.

## No-Gos

- Blocking hooks, `PreToolUse` **deny**, and builder-as-`.claude/agents/`-type — S3+.
- Atomic (tmp+rename) writes — git-tracked files are recoverable; noted, not built.
- `house archive` / `house adopt` — S3/v2.1 by prior decision.
- Full per-stack lens configuration — S2 ships only the minimal `.house/gates.yml` schema + reader.
- The v1→canonical skill rename and v1 archival — S3 cutover.
- Windows / glob portability — record-only per ADR-0003.
- Delta-specs, daemon/database, a fourth agent role — standing program no-gos.
- Editing the v1 skills in place — v2 ships alongside; v1 is not touched.

## Requirements

### R-1 — `renderDevState` refuses to drop the letter-gap (the S1 GO condition)

Positional parse of `docs/dev-state.md` — title | generated | gap | manual | tail — refusing (exit 1,
nothing written) when gap or tail is non-empty. Format-neutral: no closing-marker change, no back-compat
path.

#### Scenario: content wedged between generated block and manual marker
Given a `dev-state.md` with a stray line between the end of the generated sections and
`<!-- house:manual -->`, `house render dev-state` exits 1 naming the offending content, and the file is
unchanged. (The v1 code exits 0 and silently deletes it — the discriminating input.)

### R-2 — manifest-field writers, one event per write

New commands, each validating against `enums.yaml` and appending its event to `.house/events.jsonl`:
- `house block <id> --gate <name> [--note]` / `house unblock <id>` — `blocked_on` shape pinned in the
  schema; `house gate` **auto-clears** a `blocked_on` that names the gate it just recorded.
- `house artifact <id> <name> <state>` — walks §3.3's artifact state machine; refuses illegal jumps.
- `house unit <id> dispatch|heartbeat|finalize` — writes `units[]` and the incremental
  `units/NN-report.md`; a unit with no finalize record is **unknown, never DONE**.
- `house pr <id> --set <url>` and `--base-sha <sha>` — the merge projection's raw material.

#### Scenario: blocked slice unblocks itself on gate record
Given slice X blocked on gate `spec_review`, recording `house gate spec_review --slice X --verdict GO`
clears `blocked_on`, emits both events, and `house status X` shows the slice unblocked — with no
hand-edit of `slice.yaml` anywhere in the flow.

#### Scenario: artifact state machine refuses a jump
`house artifact X spec approved` when the spec is in state `todo` (never `awaiting_review`) exits 1
citing the legal transitions.

### R-3 — `slice.shipped` gains a producer

Terminal `house state` transitions emit the matching terminal event (`slice.shipped` /
`slice.abandoned`). `readEvents` surfaces a skip count the moment the first event-reading consumer
lands (`house log`), so a torn JSONL line is visible, not silent.

#### Scenario: shipping emits the event
`house state X shipped` (gates satisfied) appends `slice.state_changed` **and** `slice.shipped`;
`house log --slice X` shows both, and reports `skipped: N` if any log line failed to parse.

### R-4 — read side for resuming sessions

`house status <id> --json` (single slice), `house next --slice <id>` (no cross-slice noise),
`house validate --json` (machine-readable findings), `house log --slice <id>` (recent events, newest
last).

#### Scenario: fresh session resumes mid-slice
A session with no conversational history runs `house status X --json` + `house log --slice X` and can
name the current state, the open blocker, and the last three events — satisfying "resume from records
alone."

### R-5 — validate ride-alongs

While `validate.js` is open: roadmap `[NNNN]` reference lint (referenced ids must exist), the mockup
self-containment grep extended to style-attr `url()` refs, `status:` slot added to `templates/adr.md`,
and structural rules for `tasks.yaml` (`{id,title,state,verify,depends_on}`; unknown keys warn).

#### Scenario: roadmap references a ghost slice
A roadmap line citing `[0007]` when no `docs/slices/0007-*` exists → `house validate` reports it as an
error, exit 1.

### R-6 — `install.sh` installs the CLI

`install.sh` runs `npm install` in `cli/` and links the `house` bin (npm link or symlink into PATH),
idempotently. A bare skill-symlink install that leaves `house` unresolvable is a failure.

#### Scenario: clean machine
On a checkout with no `cli/node_modules`, `./install.sh` ends with `house --version` (or `house status`)
executable from an arbitrary directory.

### R-7 — doctrine v2

One file, shipped in the v2 skills bundle, containing **judgment only**: doc-model, routing table,
hygiene checklist, reconcile-subagent contract, the canonical stage table (fixed columns — owner ·
entry precondition · exit artifact · gate rung — each row **pointing** at `enums.yaml` names), the one
rigor dial (`decision · patch/hotfix · slice · high/epic`, floor verbatim: the dial never skips the
merge gate, and proposing to is itself a hard gate), the take/suppress/own composition contract, the
enumerated loop-backs with **iteration-cap-2 hard stop**, and the three settled contradictions above.

#### Scenario: the point-never-restate rule is checkable
Grep doctrine v2 for any literal list of slice states, gate names, or verdicts → zero matches; every
countable appears only as a pointer to `enums.yaml`. A reviewer can verify this mechanically.

### R-8 — `house2-shaper`

From scratch. Mints via `house new` at intake **before anything else** (a dying shaping session leaves a
resumable `state: shaping` slice, not an orphan spec); forks mode + rigor tier **before** brainstorming;
owns the rigor dial, mockup and spike stages; writes every gate record via `house gate`; authors
`tasks.yaml` at planning from the R-5 schema (no meaning in comments); writes the versioned kickoff
brief; decision-only mode has a ⛔ ADR-approval gate.

#### Scenario: shaping session dies mid-brainstorm
Kill the session after intake: `house status` on a fresh session shows the minted slice in `shaping`
with its research digests persisted in the slice dir — nothing lives only in the dead transcript.

### R-9 — `house2-orchestrator`

From scratch, ~half v1's length. Never-builds becomes mechanical (write access = `docs/` + `.house/`
only) while keeping the self-catching prose tripwire; stage table, gates list, dev-state format, and
dispatch payload are all deleted in favor of CLI reads (`house status/next/validate`); workflows
**write** their verdict files; real `modelProfile` arg read from `.house/config.yaml`; merge gate runs
per-slice against `base_sha`.

#### Scenario: resume is a read, not a memory
A fresh orchestrator session begins with `house status` + `house next` and dispatches the correct next
unit with no reference to any prior transcript.

### R-10 — `house2-builder` + minimal `.house/gates.yml`

From scratch. Consumes the validated kickoff brief — missing/invalid ⇒ `NEEDS_CONTEXT` with named
`missing_inputs`, never a guess; writes its report incrementally via `house unit` (absence of a
finalized record = unknown, never DONE); ticks tasks only via `house task done --evidence-cmd`; stack
gates read from `.house/gates.yml` (minimal schema: per-stack list of `{name, cmd}`); **unknown stack ⇒
`NEEDS_CONTEXT`** — the v1 fail-open holes close. Keep-verbatim: discriminating-test rule, CI-red
taxonomy, destructive-change proof obligations, compile-at-boundary.

#### Scenario: builder dies at task 4/6
Re-dispatching the unit finds tasks 1–3 ticked with evidence and the incremental report showing the last
heartbeat; the new builder resumes at task 4 without re-doing or re-guessing anything.

#### Scenario: unknown stack
A kickoff brief naming stack `flutter` with no `flutter` entry in `.house/gates.yml` → the builder
returns `NEEDS_CONTEXT` naming the missing gates entry. (v1 silently applied iOS lenses — the
discriminating input.)

### R-11 — the keep-verbatim ledger

The plan carries the ~24 keep-verbatim judgment rules (rigor floor · never-builds tripwires · redirect
guard · `NEEDS_CONTEXT` don't-guess · five plan-check lenses · merge-gate rubric · don't-trust-the-report
· independence axes · discriminating-test rule · proof obligations · CI-red taxonomy + tiebreak ·
squash-merge reasoning · auto-fix boundary · session-shape economics · research-dispatch contract ·
brainstorm-cannot-be-a-subagent · read-doctrine-on-demand · folded-advisory-is-a-commitment ·
didn't-get-to-it-is-a-deviation · compile-at-boundary · scope-guards-as-negative-space · INCONCLUSIVE ≠
pass · false-NO-GO-is-safe · unattended-never-downgrades) as an explicit checklist; each is ticked with
its new home (which skill/doctrine section) before the skills task closes.

#### Scenario: audit
For any rule on the ledger, a reviewer can name the exact v2 file + section where it now lives; zero
rules resolve to "dropped."

### R-12 — advisory hooks via `house hook`

One `house hook <event>` subcommand (stdin JSON → stdout JSON contract), unit-tested by feeding stdin
and asserting stdout + exit code:
- `SessionStart` → emit `session.started`, inject `house status` + `house next` as additionalContext.
- `SessionEnd` (async) → emit `session.ended`.
- `PreToolUse` (Edit|Write|MultiEdit) → permission **ask** (not deny) on writes to kernel-owned paths —
  `.house/`, `docs/slices/*/gates/`, and `docs/slices/*/{slice,tasks}.yaml` — reason pointing at the right
  `house` command. *(As-built reconcile 2026-07-28: the last pair was in the plan and the build from the
  start; this line was the narrow one.)*
- `SubagentStop` → advisory additionalContext naming any dispatched unit lacking a finalized report.
- New `hook.degraded` event type in `enums.yaml`; every hook path exits 0 when outside a house repo or
  when `house` is missing, recording `hook.degraded` when it swallows a real error.
- `house init` **merges** the minimal hooks block into `.claude/settings.json`, preserving existing
  hooks; never overwrites.

#### Scenario: not a house repo
Any hook fired in a repo with no `.house/` exits 0 with empty output — sessions there are untouched.

#### Scenario: init merges, never clobbers
`house init` in a repo whose `.claude/settings.json` already has unrelated hooks leaves those hooks
byte-identical and adds only the house block.

### R-13 — the smoke slice (done bar)

Before S2's merge gate: mint one deliberately tiny patch-tier slice on this repo and drive it end-to-end
through `house2-shaper` → `house2-orchestrator` → `house2-builder` (shape, build, gate, ship, render).
The smoke slice's event log + gate records are attached as merge-gate evidence. Standing bar unchanged:
`cd cli && npm test` green + `house validate` exit 0, independently re-run by the merge-gate reviewer.

#### Scenario: the smoke run is inspectable
At S2's merge gate the reviewer can replay the smoke slice from its records alone: every stage
transition has its event, every gate its record, every task its evidence — with zero reference to the
sessions' transcripts.

### R-14 — the versioned kickoff brief

Schema defined in this slice in a sibling schema file (`cli/schema/kickoff.yaml`): `kickoff` block in `slice.yaml`
(version int, incremented on every reissue) + per-dispatch fields (unit id, tasks, folded plan-check
commitments, fold_forward, stakes, attended flag). `house validate` checks structure; a builder
receiving a brief that fails validation returns `NEEDS_CONTEXT` naming the fields.

#### Scenario: sender/receiver can no longer diverge
The orchestrator dispatches whatever the brief schema says and nothing else; the builder validates
against the same schema. The v1 four-field divergence is structurally impossible.
