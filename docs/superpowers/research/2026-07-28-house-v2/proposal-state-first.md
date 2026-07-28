# house v2 — the state-first proposal

**Stance:** design the machine-readable state model FIRST — one canonical on-disk state (manifest +
append-only event log + typed artifact frontmatter) that the skills and the IDE both treat as the single
source of truth — then rewrite the three skills as thin actors that read and write that state. Prose docs
become **projections** of state, never the place status lives.

**One-line diagnosis this proposal answers:** every weakness in the audit — unpersisted verdicts, unticked
checkboxes, stale Status lines, ambiguous slice identity, undefined mockup/retro paths, drifting dev-state —
is the same bug expressed six ways: *the process's state lives in conversations and prose, and nothing owns
the write.* The deep-dives show it per skill (shaper mints no identity and records no gate outcome;
orchestrator's every verdict dies in the transcript; builder's 4-state report is a sentence in a destroyed
session). The research shows the industry converged on the fix: Beads' three-layer text-log/cache split,
OpenSpec's location-is-status archive-merge, Linear's name/type split, Kiro's hooks-not-discipline, and the
durable-execution rule that *an approval decision is a recordable, resumable boundary*.

**The organizing rule of house v2:** _a gate that does not write a record did not run; a status nobody owns
the write for does not exist; anything derivable is derived, never hand-written._

---

## Part 0 — The three-layer contract (the constitution of v2)

Everything else in this proposal is an application of this contract. Three layers, **exactly one writer
each**, per repo:

```
DECLARED   YAML frontmatter on each artifact           writer: the authoring agent (shaper/builder)   git-tracked   TRUTH
OBSERVED   .house/events.jsonl  (append-only)          writer: the `house` CLI + Claude Code hooks    git-tracked   TRUTH
DERIVED    .house/index.json    (rebuildable cache)    writer: `house index` only                     gitignored    CACHE
```

- **Nothing reads DERIVED to decide something it then writes back.** Deleting `.house/index.json` and
  rebuilding must be a byte-identical no-op. This single invariant makes file-watcher misses, JSONL merge
  weirdness, and IDE crashes latency bugs instead of correctness bugs.
- **One writer per field, ever.** The Kiro `[-]` bug (IDE writes a checkbox, agent reads it as a guard and
  refuses to work — kirodotdev/Kiro#8859) is what happens when a state marker is simultaneously a UI
  affordance and agent-visible prose. In v2 the agent never hand-edits a state field the tooling owns, and
  the tooling never edits prose the agent owns.
- **Agents don't append to the event log directly.** They call `house event` / `house gate` / `house task`
  (a CLI), or a Claude Code hook emits on their behalf. The log is `merge=union` in `.gitattributes`,
  ULID-keyed for idempotent replay, so parallel worktrees never produce a merge tax.
- **`git clone` + read markdown must remain sufficient.** The IDE, the CLI daemon (there is none — see
  below), and any process server are conveniences over files. If every tool is deleted, the repo still says
  everything. (This is the anti-Vibe-Kanban clause: the contract lives in files Jake owns, not in an app.)

**Build order consequence:** the `house` CLI ships **before** the IDE and before the skill rewrite. The
skills call it; the IDE visualizes it; it works from a bare terminal on day one.

---

## Part 1 — Artifact & state model

### 1.1 Identity: the directory IS the id

Every unit of work — buildable slice, decision, spike, hotfix — is born by **minting a work id** and
creating its directory. Adopted from Oxide RFDs + spec-kit + OpenSpec (all three converged on
directory-as-identity):

```
docs/slices/0014-dfs-oom-mlb/          # zero-padded monotonic ordinal + kebab slug, repo-scoped
docs/slices/archive/2026-07-28-0014-dfs-oom-mlb/   # after ship: date + id (location IS status)
```

- **Allocator:** `house new "<title>" --kind slice` scans `docs/slices{,archive}/`, takes max+1, and
  `mkdir`s the directory — directory creation is the lock. No two sessions can mint `0014` twice, and the
  shaper stops being "the only stage that mints no identity."
- **Global id** (used in events, branches, PR titles, trailers): `<repo>-0014-dfs-oom-mlb` — readable AND
  collision-free across the fleet, Beads-style. **Date is never identity** (eight retros stamped
  `2026-07-07` in edge-scanner proved that); dates appear only in the archive path for human sorting.
- **Everything derives from the id, mechanically:** branch `slice/0014-dfs-oom-mlb` (unit branches
  `slice/0014/u2-<slug>`), PR title prefix `[0014]`, worktree dir, commit trailer `House-Slice: 0014`.
  There is no retro-filename key, mockup path, or branch convention left to define, because there are no
  names left to choose. The two-"Slice N"-series bug and the 4-retro-naming-styles bug die here.
- **Ideas are first-class:** `house new --kind idea` mints an id for a backlog item on day one (Oxide's
  `ideation` state). Slice identity is stable from the moment the idea exists, not the moment shaping
  starts; a re-shaped audible keeps its id instead of orphaning a date-keyed plan.

### 1.2 The per-slice directory — one folder, every artifact

```
docs/slices/0014-dfs-oom-mlb/
├── slice.yaml            # the slice manifest (DECLARED layer, schema below)
├── pitch.md              # WHY — Shape Up's 5 slots: Problem·Appetite·Solution·Rabbit Holes·No-Gos
├── spec.md               # WHAT — spec rules (EARS-style WHEN…SHALL where it fits), or spec-delta/ (§1.6)
├── plan.md               # HOW — prose approach; NO checkboxes (see tasks.yaml)
├── tasks.yaml            # the task ledger — the ONLY progress store (§1.5)
├── research/             # durable research digests + spike reports (verdict in frontmatter)
│   └── 01-oom-repro.md
├── mockups/              # ONE canonical home; self-contained HTML only (§1.8)
│   └── 01-optimizer-panel.html
├── gates/                # every gate verdict, as a file (§1.4)
│   ├── spec-review.yaml
│   ├── plan-check.yaml
│   ├── merge-gate.yaml
│   └── live-check.yaml
├── units/                # builder briefs + incrementally-written reports (§2.3)
│   ├── u1.brief.yaml
│   └── u1.report.yaml
└── retro.md              # stage ledger as frontmatter DATA + prose narrative
```

Net artifact count per slice goes **down**, not up (spec-kit's top complaint is volume): pitch+spec+plan+
retro is the same four docs as today, now joined by an id instead of scattered across three trees with
three naming schemes. The IDE side pane is a directory listing.

### 1.3 Frontmatter: Linear's name/type split, everywhere

Every markdown artifact under `docs/` carries frontmatter validated against a JSON Schema
(`.house/schema/*.schema.json`, shipped with the CLI, checked by `house validate` in the merge gate and a
pre-push hook):

```yaml
---
id: 0014
kind: spec            # closed enum: pitch|spec|plan|research|spike|mockup-meta|adr|retro|gate
slice: 0014-dfs-oom-mlb
title: DFS optimizer MLB /dfs OOM fix
status: "Approved for planning"      # FREE TEXT — Jake's project-local vocabulary, drift-safe
state: approved       # CLOSED ENUM — the only field tooling reads
updated: 2026-07-21
supersedes: null
---
```

**The Linear steal is the whole trick:** `status` is free prose that may drift harmlessly; `state` is a
closed enum with one normative definition in one schema file (the BMAD lesson: an enum defined twice will
drift — #1105/#496). Artifact `state` vocabulary, defined once:

```
todo | draft | awaiting_review | approved | done | skipped | superseded
```

with the OpenSpec rule: **`skipped` requires a `skip_reason` and drops out of the progress denominator.**
There is no silent third state between done and not-done — that rule alone kills "11/13 plans 100%
unchecked" as a reporting artifact.

Slice-level `state` (in `slice.yaml`), also a closed enum:

```
idea | shaping | ready | building | gating | live_check | shipped | postponed | abandoned
```

`blocked` is deliberately **not** a state — it's an orthogonal field (`blocked_on: {gate, since, question,
owner}`) so a slice can be `building` AND blocked, which is how reality works. `postponed` and `abandoned`
are first-class terminal states (Rust RFCs / Linear `canceled`): "we decided not to" finally has a home
other than deletion or rotting in Slated.

`slice.yaml` (the manifest — the DECLARED rollup):

```yaml
id: 0014
slug: dfs-oom-mlb
title: "DFS optimizer MLB /dfs OOM fix"
kind: slice                 # slice | decision | spike | hotfix | epic-parent
tier: slice                 # rigor tier: decision | patch | slice | epic  (§3.1)
state: building
blocked_on: null
appetite: "1 session"       # Shape Up: declared before the plan exists; blowing it is an event, not a vibe
created: 2026-07-20
branch: slice/0014-dfs-oom-mlb
pr: null
adrs: [0007]                # forward links; ADR frontmatter carries the backlink
artifacts:                  # states mirror the files' own frontmatter; `house validate` cross-checks
  pitch:  {path: pitch.md,  state: done}
  spec:   {path: spec.md,   state: approved}
  plan:   {path: plan.md,   state: done}
  mockups:{path: "mockups/*.html", state: skipped, skip_reason: "backend-only slice"}
units:
  - {id: u1, title: "cap auto-optimizer pool", tasks: [t1,t2,t3], state: done}
  - {id: u2, title: "surface server-action errors", tasks: [t4,t5], state: building}
```

### 1.4 Gate records: "an unrecorded gate is an unpassed gate"

Every gate — soft or hard — writes a file in `gates/` **and** appends an event. The orchestrator/CLI may
not advance slice `state` unless the gating record exists and says pass. Enums, defined once in schema:

| Gate | File | Verdict enum | Held by |
|---|---|---|---|
| spec review | `gates/spec-review.yaml` | `approved \| changes_requested` | **human (hard)** |
| mockup sign-off | `gates/mockup-signoff.yaml` | `approved \| changes_requested` | **human (hard, UI tiers)** |
| plan-check | `gates/plan-check.yaml` | `GO \| GO_WITH_FIXES \| NO_GO` | agent (soft) |
| merge-gate | `gates/merge-gate.yaml` | `GO \| NO_GO \| INCONCLUSIVE` | agent (soft; NO-GO escalates) |
| CI | derived from `gh run view --json` | `green \| code_red \| infra_only \| no_ci` | deterministic |
| live/device check | `gates/live-check.yaml` | `approved \| changes_requested` | **human (hard)** |

`plan-check.yaml` carries the structure the shaper deep-dive specified — this is what finally makes
"commitments survive into the artifact" (house-builder's best unenforceable rule) *checkable*:

```yaml
verdict: GO_WITH_FIXES
checked: 2026-07-21T14:02:11Z
by: {model: claude-fable-5, session: a1b2…}
lenses_run: [arch-fit, spec-coverage, risk-sequencing, testability, simpler-path]
must_fix:        [{id: mf1, text: "…", folded_at: 2026-07-21T14:30:00Z}]
advisory_folded: [{id: af1, text: "…"}]     # each folded advisory = a commitment with an id
advisory_waived: [{id: aw1, text: "…", reason: "…"}]
```

The merge-gate panel and health-sweep workflows already build well-shaped return objects against JSON
Schemas in their own source — **the only missing line is the write**. v2's versions write
`gates/merge-gate.yaml` (including `lenses_run` so INCONCLUSIVE is auditable) and
`docs/health/<id>.yaml`; confirmed should-fixes and `outOfScope` notes get a defined destination:
`house event work.discovered` (Beads' `discovered-from` edge) routing to the roadmap backlog or
`accepted.md`. Human gates write an **attestation** (who/when/what was checked) — the stage-9 "reload the
app after a UI change / launch against a previous-schema store" instructions become attestation checkboxes.

**Belt and braces:** the merge commit carries trailers — `House-Slice: 0014`, `House-Verdict: GO`,
`House-Session: <id>` — a tamper-evident record that survives even `.house/` deletion, parsed with
`git interpret-trailers`.

### 1.5 `tasks.yaml` — progress is data, and evidence is mandatory

Plan prose describes approach. **Progress lives only in `tasks.yaml`:**

```yaml
tasks:
  - id: t4
    unit: u2
    title: "surface server-action errors in the UI"
    depends_on: [t3]
    parallel_ok: false               # spec-kit's [P] marker, as a field
    spec_rules: [SR-3]               # traceability: task → spec rule
    verify: "npm test -- --filter server-actions"   # the command that proves it
    state: done                      # todo | doing | done | blocked | skipped
    evidence: {cmd_exit: 0, summary: "81/81", log: ".house/logs/0014/u2-t4.log", at: 2026-07-27T…}
    note: null                       # blocked/skipped REQUIRE a note (the "[ ] + italic reason" pattern, formalized)
```

- The builder marks a task done via **`house task done t4 --evidence-cmd "npm test …"`** — the CLI runs
  the verify command, captures exit/summary/log, and refuses the transition on failure. Ticking is a
  completion *claim*; the CLI is the `verification-before-completion` gate made deterministic.
- `house next` computes the ready set (no unmet `depends_on`, no failing gate) — Beads' `bd ready`.
  The hand-written "next action:" line dies; it becomes a projection.
- Kiro's dependency waves fall out for free: independent `parallel_ok` tasks in the same wave.
- Optionally, each unit reports a **hill position** (0–1, uphill=figuring-out / downhill=executing) at
  report time — one float that makes stalls visible in the IDE where unticked checkboxes never were.

### 1.6 Specs: location is status; shipping updates the truth

The deepest v1 bug — `Status: Draft` on shipped specs — is structural: one document is both proposal and
truth, so no operation's *definition* is "make this true." v2 adopts OpenSpec's split:

- `docs/spec/<capability>.md` — **current truth**: how the system behaves today. No status field at all;
  existence is the status.
- A slice's `spec.md` is written as **deltas** where a truth spec exists (`## ADDED / MODIFIED (full
  content) / REMOVED (reason + migration) / RENAMED Requirements`, every requirement ≥1 `#### Scenario:`),
  or as a plain spec for repos that haven't grown a truth spec yet.
- **`house archive 0014`** = apply deltas into `docs/spec/` + move the directory to
  `docs/slices/archive/2026-07-28-0014-…/` + emit `slice.shipped`. Triggered by the PR-merge event
  (from `gh pr list --state merged` — never `git branch --merged`; the squash caveat is code now, not
  doctrine prose). The shipped spec is *produced by the act of shipping*, not maintained by discipline.

GitHub-Projects lesson applied: PR-merge is an event that was going to happen anyway; deriving
`shipped` + archive + task-close from it kills all three staleness bugs with one trigger.

### 1.7 ADRs, retros, roadmap, dev-state

- **ADR** (`docs/adr/NNNN-<slug>.md`): keeps its global lane (a v1 differentiator worth keeping). Gains
  MADR frontmatter: `state: proposed|accepted|deprecated|superseded`, `superseded_by`, `slices: [0014]`
  (the backlink Rust's tracking issues taught), `decided_by: jake|agent`, and a **Confirmation** section —
  how a health sweep would check the code still obeys it. Numbers are allocated by `house new --kind
  decision` (same mkdir-lock allocator), ending the NNNN race. ADRs are immutable; only state changes.
  A written threshold list (needs-an-ADR / doesn't) replaces "on any decision."
- **Retro** (`retro.md` in the slice dir — no filename key needed): the stage ledger moves into
  frontmatter as data — `ledger: [{stage: merge_gate, disposition: ran|skipped|n_a, reason: "…"}]` —
  keeping v1's exact semantics ("'I didn't get to it' is a deviation, not a skip") but *computed-then-
  narrated* instead of reconstructed. `house validate` fails a `shipped` slice with an incomplete ledger.
- **`docs/dev-state.md` becomes a generated projection** — `house render dev-state`, run at reconcile and
  by the Stop hook. The allowlist stops being a lint rule with no linter and becomes a template the
  generator cannot violate. The 368-line `## Active work` files can't recur. Gotchas / Infra / Process
  notes — the genuinely-authored sections — live in `docs/steering/` (Kiro-style, with
  `inclusion: always|fileMatch|manual` frontmatter) and are *transcluded* into the rendered view.
- **`docs/roadmap.md` stays authored** (durable strategy is genuinely prose) but gets a format contract:
  frontmatter + a `## Backlog` section whose items are `- [0021] <title> — <one line>` so events can
  reference them by id. `house validate` checks only the contract, not the prose.

### 1.8 Mockups — the IDE's flagship artifact, finally specified

- **One path:** `docs/slices/<id>/mockups/NN-<slug>.html`. Nothing else validates.
- **Self-containment is a declared, checked contract:** no external fetches (the IDE renders in a
  sandboxed, CSP-locked webview); `house validate` greps for `http(s)://` refs in src/href and fails.
- **Typed fidelity** (Shape Up): `fidelity: breadboard | sketch | mockup` in a sidecar
  `NN-<slug>.meta.yaml` (or leading HTML comment), so the pane knows what question the artifact answers.
- **Sign-off is a gate record** (`gates/mockup-signoff.yaml`), required by the `slice` tier for UI work,
  skippable-with-reason otherwise. The gate the orchestrator always believed the shaper held now exists in
  the shaper's own instruction set — as a state transition, not folklore.

### 1.9 The event log and the CLI surface

`.house/events.jsonl` — append-only, ULID `id`, `merge=union`:

```jsonl
{"id":"01J9X…","ts":"…","event":"slice.created","slice":"0014","actor":"shaper","session":"…","payload":{"kind":"slice","tier":"slice"}}
{"id":"01J9Y…","ts":"…","event":"gate.recorded","slice":"0014","payload":{"gate":"plan_check","verdict":"GO_WITH_FIXES"}}
{"id":"01J9Z…","ts":"…","event":"gate.requested","slice":"0014","payload":{"gate":"spec_review","question":"…","blocking":true}}
{"id":"01JA0…","ts":"…","event":"unit.report","slice":"0014","unit":"u2","payload":{"state":"DONE_WITH_CONCERNS","pr":142}}
{"id":"01JA1…","ts":"…","event":"work.discovered","slice":"0014","payload":{"from":"merge_gate","text":"…","routed_to":"roadmap#0021"}}
{"id":"01JA2…","ts":"…","event":"slice.shipped","slice":"0014","payload":{"pr":142,"sha":"f141bbe"}}
```

Minimum event set: `slice.created/.state_changed/.shipped/.abandoned`, `artifact.written`,
`gate.requested/.recorded`, `unit.dispatched/.heartbeat/.report`, `task.done/.blocked`,
`work.discovered`, `deviation.raised`, `session.started/.ended`, `audible.received/.resolved`.
The `gate.requested`/`gate.recorded` pair is what makes "notify and halt" real: a halt writes a record the
IDE renders as an approvals inbox, instead of a terminal that stopped scrolling.

**The `house` CLI** (a standalone binary; the skills call it, hooks call it, the IDE shells out to it):

```
house new · house status [--slice] --json · house list --json · house next --json
house gate <name> --verdict … · house event <type> … · house task done|block <id> …
house validate [--all --strict] (exit 1 = red build)  · house archive <id>
house index (rebuild DERIVED) · house render dev-state · house doctor · house adopt (migration, §5)
```

`house validate` enforces, per real v1 failure: frontmatter schema; every artifact `done|skipped+reason`;
`shipped` ⇒ zero open tasks (or recorded deviations) + retro ledger complete + gates recorded;
enums ∈ normative lists; mockups in-dir and self-contained; dev-state is generator-output;
every file under `docs/slices/` reachable from a manifest.

**Enforcement is hooks, not discipline** (the Anthropic gate-strength ladder — every v2 gate is annotated
with its rung, and nothing claims load-bearing while sitting on "advisory prompt"):

| Rule | Mechanism |
|---|---|
| builder can't finish with failing verifies | `SubagentStop` hook → `house validate --unit`, exit 2 |
| orchestrator can't end a session without state write | `Stop` hook → `house render dev-state` + validate, exit 2 |
| mockup path can't be wrong | `PreToolUse` on Write, `updatedInput` rewrites the path |
| events on session lifecycle | `SessionStart`/`SessionEnd` hooks append automatically |
| IDE auto-open | `PostToolUse` matcher on Write/Edit under `docs/**` |

Never parse Claude Code transcripts as state (the docs' own warning); emit deliberately.

---

## Part 2 — Skill / agent topology

Three roles survive (the phase split is justified because the handoff artifact — the slice directory — is
self-contained; Anthropic's multi-agent guidance says that's the test). But they are rewritten as **thin
actors over shared state**: every skill step is *read index → act → write state via `house`*. Prose
instructions shrink because the process definition itself moves into data: a `workflow.yaml` (OpenSpec
schema-style: artifacts with `id`, `generates`, `requires` DAG, `instruction`), shipped with the CLI and
forkable per-repo at `.house/workflow.yaml`. The skills *read* the workflow instead of restating it in
three places — which is precisely how "the mockup path is unspecified" becomes structurally impossible.

### 2.1 house-shaper — the identity minter

Session shape unchanged (interactive, research-heavy, disposable transcript — v1's best idea). New
obligations, all state writes:

1. **Intake mints identity first:** `house new` before anything else. The manifest exists from minute one;
   a session that dies mid-shape leaves a resumable `state: shaping` slice, visible to any resume, instead
   of an invisible orphan spec.
2. **Mode/tier fork happens BEFORE brainstorming** (fixing the composition bug where brainstorming's
   thrice-stated "terminal state is writing-plans" steamrolls decision-only mode). The shaper invokes
   brainstorming in a declared sub-mode and explicitly owns its terminal transition; output paths are
   pinned to the slice dir, closing both composed skills' "user preferences override this path" escapes.
3. **Research digests are durable** (`research/NN-*.md`, frontmatter verdict for spikes:
   `GO|NO_GO|INCONCLUSIVE`) and are handed to the plan-check reviewer along with existing ADRs and the
   roadmap — fixing the reviewer-judges-arch-fit-blind problem.
4. **Every gate writes its record** — spec review (`gate.requested` → human → `gate.recorded`), mockup
   sign-off, plan-check with ids on folded advisories. The shaper is now an explicit state machine with
   loop-backs (`NO_GO → replan`, `spec-defect → respec`, `scope-explosion → decompose into N slices`,
   iteration cap → escalate) persisted at every transition, so an interrupted shaping session resumes at
   `awaiting_review` instead of restarting.
5. **Hand-off is a payload, not prose:** the shaper writes `units/uN.brief.yaml` skeletons; the
   orchestrator's stage-0 gate becomes a field check (`house status 0014 --json` → `state: ready`).

The mockup and spike stages, and the rigor tier, live in the shaper's own instruction set + workflow.yaml
— reachable, at last. The tier is *set by the shaper at intake* and recorded in the manifest; the
orchestrator reads it rather than re-deriving it.

### 2.2 house-orchestrator — from load-bearing session to resumable step function

The deepest reversal, straight from the orchestrator deep-dive: the long-lived session becomes an
**optimization**, not the substrate. The conductor loop is:

```
read state (house status/next) → compute the single next action → perform exactly that action
→ write state + event → repeat
```

Each iteration idempotent and crash-safe. A long session just skips re-reading; a dead session loses
nothing because nothing lived only in it. Consequences, all previously impossible:
- **Multiple slices in flight** are representable (the driver is stateless w.r.t. which slice it
  advances; edge-scanner's Track A/B/C stops being off-model).
- **"Notify and halt" is real:** halting writes `gate.requested`; the IDE (or a push notification)
  surfaces it; resolution wakes a fresh conductor invocation.
- **Mid-stage death is recoverable:** in-flight builder handles (`unit.dispatched` + heartbeats) are on
  disk *at dispatch time*, so "builder died" vs "builder is working" is decidable without a transcript.

Stage numbers (0–4¼–7½–9½–11) are deleted in favor of **named states** (§3): fractional numbering was an
append-only changelog of process amendments wearing an enum costume. The never-builds invariant stays
verbatim and becomes mechanical where possible (conductor gets write access to `docs/` + `.house/` only).
Workflow scripts get the fixes the deep-dive itemized: they **write their verdict files**; per-lens quorum
with the escalation-triggering lens mandatory; a real `modelProfile` arg so the Fable→Opus fallback is
executable (a Fable spend-limit outage must not turn the panel into a NO-GO generator); lens sets
data-driven per stack (no `stack === 'web' ? … : IOS_LENSES` fail-open); the panel receives the plan-check
commitments so it can re-verify them.

### 2.3 house-builder — the writer of progress; the orchestrator becomes its verifier

- **One versioned `UnitBrief` schema** (`units/uN.brief.yaml`), owned in exactly one place, replacing the
  two divergent prose kickoff lists. Fields include everything both lists had *plus* the demonstrably
  missing ones: `slice_id/unit_id`, `branch/base_ref/worktree`, `plan_check` (the folded commitments to
  honor), `fold_forward` (prior units' concerns), `stakes`, `attended` (is a human reachable), `gate_profile`.
  `NEEDS_CONTEXT` becomes precise: brief failed validation, `missing_inputs[]` named — re-dispatch is
  mechanical.
- **The report is an artifact written incrementally** (`units/uN.report.yaml`): opened at start
  (`state: IN_PROGRESS` + heartbeat), `stage_cursor` and gate evidence appended as it goes, finalized to
  the 4-state before returning; the conversational report is generated *from* it. Fail-closed on absence:
  no record, or IN_PROGRESS with a stale heartbeat, is an incident — never a silent pass. A builder that
  dies at task 4/6 is **re-dispatched with its own record as the brief** and resumes.
- Report states get definitions and field lists (adopting the composed SDD implementer-prompt's — which
  was better specified than the house skill wrapping it), plus `IN_PROGRESS`/`ABANDONED`, plus a
  partial-completion shape (per-task states carry it; the unit state summarizes honestly).
- **The builder ticks tasks** via `house task done --evidence-cmd` (evidence rule enforced by the CLI) and
  flips artifact frontmatter states. The orchestrator's docs-audit stage becomes a *verifier* — assert
  every done task has evidence, every gate has a record — i.e. the stage ledger is computed, not narrated.
- **Stack gate sets move to a per-repo declarative profile** (`.house/gates.yml`: name/cmd/parse/
  required_for + annotated lore assertions). The skill keeps the *policy* (CI-red taxonomy verbatim,
  discriminating-test rule, "is not proof" destructive-change obligations). **Unknown stack or missing
  profile ⇒ NEEDS_CONTEXT, never proceed** — closing the one fail-open hole, which happens to sit exactly
  where the Electron IDE project will step.
- **Composition contract stated as take/suppress/own:** take TDD's iron law + SDD's two-stage review
  templates; suppress SDD's controller framing, `finishing-a-development-branch` (the orchestrator owns
  finish — flat prohibition), and worktree creation mandates (ownership: orchestrator creates, builder
  uses, teardown at finish); drop `executing-plans` as an alternative path (it has no review stage —
  incompatible quality floors). The nested 4-state collision gets an explicit propagation rule.
- **Ownership split for docs:** builder writes the slice's own artifacts + its records; orchestrator owns
  dev-state/roadmap/retro projections. The concurrent-write race on dev-state.md dies (and dev-state is
  generated anyway).

### 2.4 Session ↔ state binding

Every session start emits `session.started {session_id, slice, role}` via hook; commits carry
`House-Slice`/`Claude-Session` trailers. This is Faros's "hardest and most valuable measurement
infrastructure" — `session ↔ unit ↔ branch ↔ PR` — captured for free, and it's what lets the IDE attach a
terminal pane to a slice.

---

## Part 3 — Stage & gate model

### 3.1 Rigor tiers select the workflow (ceremony scaled by data, not vibes)

`tier` in the manifest picks a workflow variant (all declared in workflow.yaml, not prose):

| Tier | Required artifacts | Gates |
|---|---|---|
| `decision` | ADR (+ roadmap touch) | ADR review = **hard** (v1's backwards-most gap: decision-only had zero gates) |
| `patch` | tasks.yaml + verify evidence | merge-gate single reviewer (floor: never skipped) |
| `slice` | pitch + spec + plan + plan-check + tasks + retro (+ mockup for UI) | full set below |
| `epic` | parent manifest + child slices | per-child, + sequencing in roadmap |

Kept verbatim: stakes-not-file-type; **the dial never skips the merge-gate, and proposing to skip it is
itself a hard gate**. One dial, in one file, reconciled with intent-first's — set by the shaper, read by
everyone.

### 3.2 The slice lifecycle — named states, typed transitions

```
idea ──shape──▶ shaping ──[spec_review:approved]──▶ (mockup_signoff if UI) ──plan──▶
  ──[plan_check:GO|GO_WITH_FIXES]──▶ ready ──dispatch──▶ building (units loop: brief→report→review)
  ──all units done──▶ gating ──[merge_gate:GO]──[ci:green|authorized infra-only]──▶
  live_check ──[live_check:approved]──▶ shipped (= house archive: deltas merged, dir moved, retro required)

loop-backs: plan_check NO_GO → shaping(plan) · spec-defect → shaping(spec) · scope-explosion → decompose
terminal:   postponed · abandoned (reason required)   orthogonal: blocked_on{...} at any state
```

Each transition declares: **owner** (human/agent/deterministic), **entry precondition** (an artifact that
must exist), **exit artifact** (the record it writes), and **gate-strength rung** (advisory / goal / hook /
independent verifier). Hard (human) gates: spec review, mockup sign-off, live check, irreversible actions,
infra-only CI merge-through, any rigor downgrade. Soft (agent) gates: plan-check, merge-gate, per-task
review — each emitting a record a human can audit asynchronously. Deterministic gates: CI, `house
validate`, task-evidence checks. Health-sweep stays advisory and keeps `accepted.md` as the generalized
suppression ledger for *every* gate's accepted findings.

Ledger semantics preserved exactly (`ran | skipped(reason) | n_a`; unaccounted = deviation) — now written
at state-exit time as data, rendered into the retro.

Two v1 deadlocks resolved explicitly: unattended + high-stakes ⇒ **halt at a `gate.requested`** (never
fall back to the single reviewer — the floor holds); merge-gate scope = **per-slice** against a recorded
`slice_base_ref` captured at slice start (so multi-PR-per-unit topologies still produce a true slice diff),
with per-unit review remaining the builder's two-stage pass.

---

## Part 4 — The IDE contract

The desktop app (Electron; pty in its own flow-controlled, reconnectable process — VS Code's split) reads
**exactly four things**, and renders everything without heuristics:

1. **`.house/index.json`** (DERIVED) — the home screen: every slice, state, blocked_on, task progress,
   open gates, in-flight units with heartbeats, drift warnings. Rebuilt by `house index`; the IDE watches
   it (chokidar `atomic` + `awaitWriteFinish`), and every watcher event triggers re-read-and-re-derive —
   never accumulate from the stream; "reindex everything" is always available and idempotent.
2. **`.house/events.jsonl` tail** — the live timeline and the **approvals inbox**: unresolved
   `gate.requested` entries render as actionable cards ("spec 0014 awaiting review since 14:02 — open →
   approve/request changes"), and resolving one writes the gate record via `house gate`. The IDE is the
   asynchronous-review channel v1's ⛔-block-forever gates never had. A `question.raised` event from a
   builder becomes a notification with a resume token — NEEDS_CONTEXT stops being die-and-redispatch.
3. **Artifact frontmatter + markdown** — the side pane groups by `slice`, badges by `state` (closed enum
   ⇒ no fuzzy slug matching), auto-opens on `artifact.written`/PostToolUse events, renders plans with live
   task progress from tasks.yaml (a real progress bar, or the hill chart), shows gate records as an
   **evidence panel** (cmd + exit + summary + click-through to `.house/logs/**`).
4. **Mockups** — `docs/slices/*/mockups/*.html` in a sandboxed CSP-locked webview; the self-containment
   contract is what makes this safe, and `fidelity:` tells the pane what it's showing. Sign-off happens in
   the pane and writes the gate record.

The embedded terminal binds sessions to slices via `session.started` events + trailers; a strip shows
"builder u2 · task t4 · gate `npm test` running (4m)" from unit heartbeats. The IDE **writes** only
through `house` commands (gate resolutions, audible notes) — it is a client of the same contract as the
skills, never a second writer of any field. Live session streaming can later ride an ACP-style channel,
but the durable contract stays files: if the IDE is mid-rewrite, the process still runs from a terminal.

---

## Part 5 — Migration for the ~15 existing projects

Principle: **v2 is per-repo opt-in; no forced rewrite; legacy artifacts are frozen, not converted.**

1. **`house init`** (any repo): creates `.house/` (events.jsonl, gates.yml stub, workflow.yaml default),
   `docs/slices/`, schema files, hook wiring, `.gitattributes` union-merge line. ~2 minutes, no content
   changes. New work uses v2 from the next slice.
2. **`house adopt`** (optional, per repo): scans `docs/superpowers/{specs,plans}`, `docs/retros`,
   `docs/mockups`, `docs/adr` and builds `docs/slices/archive/legacy/` entries — best-effort manifests
   with `state: shipped|abandoned` inferred from retros/PR history, fuzzy-joined by slug (flagged
   `legacy: true`, joins never trusted for validation). Old files stay where they are; manifests *point*
   at them. The IDE gets a browsable history without rewriting a byte. Numbering starts above the imported
   count.
3. **Recommended split:** the 2–3 active repos (edge-scanner, athlete-data, web-services) run
   `init` + `adopt` before their next slice; dormant repos get `init` lazily if ever touched again;
   nothing else is done. `house validate` runs in **warn mode** on adopted repos for the first slice, then
   strict.
4. **Skill cutover is atomic per repo, not per fleet:** v2 skills detect `.house/` and refuse to run the
   v1 prose flow in an initialized repo (and vice versa: in a non-initialized repo they say "run
   `house init` first"). No repo ever runs half-v1/half-v2.
5. **dev-state.md**: on first `house render dev-state`, authored content that fails the allowlist is moved
   to `docs/steering/` or flagged for roadmap/ADR routing — the one-time migration the reconcile stage was
   always supposed to do, done once by a tool.

---

## Part 6 — What v1 got right: kept verbatim

These are the earned intellectual property; v2 gives them an artifact, an evidence requirement, and a
verifier — it does not reword them.

1. **Session boundary = context boundary** — three context tiers (throwaway-read / interactive-dialogue /
   durable-artifact), heavy reading in subagents, transcripts disposable, only artifacts persist — now
   with the corollary enforced: *every decision is written before the session that made it can end.*
2. **The never-builds invariant**, phrased as a behavioral tripwire, and the builder's complementary
   bounded-authority invariant ("you build; you do not decide the slice").
3. **Fail-closed everywhere:** "unsure whether a gate is hard → treat it as hard"; INCONCLUSIVE is not a
   pass; "a false NO-GO is safe; a false GO is not"; when unsure, code-red.
4. **The rigor floor:** the dial never skips the merge-gate; *proposing to skip it is itself a hard gate.*
5. **Three independence axes** (perspective / architecture / context) in review; Opus builds, Fable
   reviews; **"don't trust the report"** — reviewers re-run builds/tests (v2 downgrades it from
   full-re-derivation to audit-of-evidence, keeping the adversarial pass).
6. **The discriminating-test rule** (a falsifiability criterion for tests) and its cousin, the
   virtualization-robust-discriminator rule — now with named plausible-wrong implementations recorded as
   evidence.
7. **The CI-red taxonomy** (infra-only / code-red / no-CI, tiebreak to strict, anti-normalization clause,
   "never piped exit codes") and the **destructive-change proof obligations** ("a fresh CI DB passing is
   not proof"; known-good-merge-commit rule).
8. **The suppression ledger** (`accepted.md`), the **auto-fix boundary**, the **squash-merge caveat**,
   scope guards as first-class negative space, `NEEDS_CONTEXT`-don't-guess, "commitments survive into the
   artifact," the stage-ledger semantics, and the research-dispatch contract ("one question per agent;
   read a lot, conclude a little; change nothing").

---

## Part 7 — Risks and honest costs

1. **CLI-before-everything is a real dependency.** If the `house` binary lags, the skill rewrite stalls.
   Mitigation: the MVP surface is small (new/status/event/gate/task/validate/index — no daemon, no DB;
   plain file reads + JSONL append), and it's exactly the kind of tool the current system can build as its
   own first v2 slice.
2. **Schema churn early.** The first three slices will amend enums and fields. Mitigation:
   `schema_version` on every record from day one; `house index` reads all prior versions; events are
   append-only so history never needs rewriting.
3. **Two-writer temptation returns via the IDE.** The moment the IDE edits a file an agent also writes,
   Kiro's #8859 recurs. The contract (IDE writes only through `house`) must be enforced in review of the
   IDE itself.
4. **Hook fragility / safety valves.** Stop hooks are overridden after 8 consecutive blocks; hooks must
   fail open *with a recorded event*, so enforcement gaps are visible instead of silent.
5. **Ceremony regression risk.** v2 adds YAML files; the counterweights are the tier system (decision =
   ADR only; patch = tasks + evidence only), net-reduced per-slice doc count, and the CLI doing the
   writing. Watch the first retros for gate friction and cut fields that nobody reads.
6. **Delta-spec adoption is the speculative piece.** Truth-spec + deltas is proven in OpenSpec but is the
   largest authoring-habit change; that's why it's staged (plain spec.md allowed until a repo grows
   capability specs), while location-is-status archiving lands everywhere immediately.
