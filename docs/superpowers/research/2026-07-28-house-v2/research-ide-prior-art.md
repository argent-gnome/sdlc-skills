# Research digest — prior art for process-aware dev environments and their state models

> Research input for the **house v2** redesign (ground-up, IDE-native SDLC process). Not a decision record.
> Written 2026-07-28. Sources listed at the bottom; inline links throughout.
>
> Brief: research prior art for process-aware dev environments and their state models — Kiro, VS Code
> task/terminal architecture, Linear/GitHub Projects as state machines, event-sourced tooling state,
> LSP-as-decoupling-pattern, file-watcher vs git-as-event-stream, and Electron vs Tauri vs native Swift —
> then recommend an integration contract shape and an app stack.

---

## 0. TL;DR

1. **Every serious spec-driven system converged on the same three documents** (requirements → design → tasks)
   and **every one of them left status in prose or in markdown checkboxes.** Kiro is the only one that made
   the IDE *write* the checkbox, and that produced its single most-reported class of bug. House v2's
   "no machine-readable state" weakness is not a house-specific oversight; it is the industry default,
   and the industry default is measurably broken.
2. **The one system that solved it is Beads** (git-backed JSONL of record + SQLite cache + daemon). Its
   architecture — *text log is truth, database is a rebuildable projection* — is the single most directly
   stealable design in this digest.
3. **Linear's real innovation is not its statuses, it is the split between a status's `name` and its
   `type`.** Names are free-form and project-local; types come from a fixed closed enum. That one idea
   fixes house's heading-drift, stage-name-drift and retro-naming-drift problems *without* forcing every
   repo into identical prose.
4. **The LSP pattern has already been re-run for agents: Zed's Agent Client Protocol (ACP)**, JSON-RPC 2.0
   over stdio, adopted by JetBrains, with a co-launched registry as of Jan 2026. Critically, ACP already
   streams a `plan` update whose entries carry `status` — i.e. *the "agent's task list as observable
   state" problem has a live, adopted wire format.* A house "process server" should not invent one.
5. **Recommended contract: both, with a strict ownership split.** Frontmatter on artifacts = *declared*
   state (human/agent-authored, git-diffable, one writer). `.house/events.jsonl` = *observed* state
   (append-only, `merge=union`, emitted by Claude Code hooks, never hand-edited). `.house/index.json` =
   *derived* projection (gitignored, rebuildable in one command, what the IDE reads). No fourth source.
6. **Recommended stack: Electron.** Not because it's lighter (it is 10–25× heavier) but because the two
   hard requirements — a real pty pane hosting Claude Code, and *high-fidelity* rendering of self-contained
   HTML mockups — are exactly the two places Tauri's system-webview model degrades. Copy VS Code's
   three-process terminal architecture verbatim.

---

## 1. Process-aware dev environments — what shipped

### 1.1 Amazon Kiro — the closest thing to "house, as an IDE"

Kiro is the most direct prior art: an agentic IDE whose primary object is a **spec**, not a file.

**Layout** ([best practices](https://kiro.dev/docs/specs/best-practices/)):

```
.kiro/specs/
├── feature-name/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
```

Plus `.kiro/steering/*.md` (persistent project context), `.kiro/hooks/*.json` (event-driven automation),
and `~/.kiro/steering/` for global scope.

**Spec lifecycle.** Three phases with approval gates: "Define what needs to be built or fixed" → "Create
technical architecture and implementation approach" → "Generate discrete, executable implementation tasks."
There are two spec *kinds* — **Feature Specs** (requirements.md) and **Bugfix Specs** (bugfix.md, root-cause
+ regression prevention). A "Quick Spec" variant runs the same phases *"without approval gates between them."*

**Requirements are written in EARS notation** — `WHEN [condition/event] THE SYSTEM SHALL [expected behavior]` —
explicitly to buy *"clarity, testability, and traceability through implementation."*
([feature-specs](https://kiro.dev/docs/specs/feature-specs/))

**Steering files carry real frontmatter — this is the best concrete frontmatter design found anywhere in
this research** ([steering docs](https://kiro.dev/docs/steering/)):

```yaml
---
inclusion: always
---
```
```yaml
---
inclusion: fileMatch
fileMatchPattern: ["**/*.ts", "**/*.tsx"]
---
```
```yaml
---
inclusion: manual
---
```
```yaml
---
inclusion: auto
name: api-design
description: REST API design patterns
---
```

Four inclusion modes: `always` (every interaction), `fileMatch` (glob-conditional), `manual` (`#steering-file-name`
on demand), `auto` (semantic match against `description`). Steering files can also embed **live file
references** — `#[[file:api/openapi.yaml]]` — so a doc can cite a source-of-truth artifact rather than
copying it. House currently has no equivalent: doctrine.md is "read this on-demand" enforced by prose.

**Task execution and dependency waves.** *"When you run all tasks on a spec, Kiro analyzes your task list,
figures out which tasks depend on each other, and runs independent tasks concurrently"* — building a
dependency graph and grouping independent tasks into **waves**. Kiro's own docs say specs are living:
*"if code changes, Kiro updates the specs or if the specs are modified Kiro can regenerate tasks to reflect
new requirements."*

**⚠️ The single most valuable negative result in this entire digest.**
Kiro's task state lives in `tasks.md` checkboxes with **three** markers: `[ ]` not started, `[-]` in progress,
`[x]` complete. Both the IDE and the agent write that file.
[Issue #8859](https://github.com/kirodotdev/Kiro/issues/8859) reports, verbatim:

> "When clicking 'Start task' on a spec task in tasks.md, the IDE immediately marks the task with `[-]`
> (in progress) and sends 'Execute Task: X.Y ...' to the agent. The agent then reads the file, sees `[-]`,
> and refuses to execute the task."

And it is not isolated. There is a whole cluster of state-sync bugs:
- [#5011](https://github.com/kirodotdev/Kiro/issues/5011) — "Generation of tasks.md fails to enable [Start Task]"
- [#3428](https://github.com/kirodotdev/Kiro/issues/3428) — "tasks.md does not show options 'Start Task' or 'View Changes' after I Updated the IDE"
- [#951](https://github.com/kirodotdev/Kiro/issues/951) — "'Start Task' and 'Retry' buttons in task.md do not appear"
- [#1576](https://github.com/kirodotdev/Kiro/issues/1576) — tasks marked complete by the agent still render as incomplete/skipped

**Lesson:** a markdown checkbox is a *fine display* of state and a *terrible protocol between two writers.*
Kiro's IDE decorations are computed by parsing prose, so the button vanishes whenever generation drifts;
Kiro's `[-]` is simultaneously a UI affordance and an instruction to the model, and the model reads it as a
guard rather than a go-signal. House v2 must never have two writers on one field, and must never make the
agent's state marker double as agent-visible prose it will reason about.

**Agent hooks** ([hooks docs](https://kiro.dev/docs/hooks/)) are JSON files in `.kiro/hooks/`, triggered on
`PostFileSave` / file created / file deleted / `userTriggered`. Use cases: update tests or docs when a file
changes, run lint/security checks on certain paths. This is the mechanism by which Kiro makes process
automatic rather than remembered — and it is the direct analogue of Claude Code hooks, which is how house v2
should emit its events (§5.3).

### 1.2 GitHub Spec Kit — same shape, honest about the gap

[Spec Kit](https://developer.microsoft.com/blog/spec-driven-development-spec-kit/) bolts a spec-first flow
onto any agent: `specify → plan → tasks → implement`, with `constitution` once per project and
`clarify`/`analyze` when unsure. Artifacts: `constitution.md`, `spec.md`, `plan.md`, `tasks.md`, under
`.specify/` (`memory/`, `specs/`, `templates/`), with **every feature in its own numbered folder under
`specs/`** — a numbered-folder identity scheme, which is exactly what house's ambiguous "Slice N" needs.

The agent *"validates that constitution.md, spec.md, plan.md, and tasks.md are all present, then executes
tasks in order — respecting dependencies and `[P]` parallel markers."* Two things worth stealing: a
**presence precondition check** before execution, and an **inline parallelism marker** (`[P]`) that is cheap
to author and trivially machine-readable.

Its own weakness is stated plainly and is *identical to house's*:

> "there is no machine-readable approval gate: you decide when to advance to the next phase, which requires
> discipline to prevent the agent from racing ahead on a draft spec."

House's plan-check verdict (GO / GO-WITH-FIXES / NO-GO) is precisely this missing gate, and it currently
lives only in conversation.

**`constitution.md`** — *"non-negotiable principles for a project — testing conventions, CLI-first
requirements, organizational design system standards… captured once and referenced throughout every
subsequent development phase"* — is what house calls doctrine, but scoped per-project rather than
per-skill-install. House has global doctrine and no project constitution; the per-project layer is where
"this repo's stack, this repo's rigor dial, this repo's gates" belongs.

### 1.3 Beads — the one system that actually solved machine-readable state

[Beads](https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/) (`bd`, Steve Yegge, Go,
built in ~6 days with Claude) is a git-backed issue tracker built *for agents*, not for humans-with-agents.
Its framing problem is the **"50 First Dates" problem**: agents wake up with no memory of yesterday's work.
That is exactly house's `dev-state.md` resume problem, solved structurally instead of by prose.

**Architecture — the thing to steal:**

```
.beads/
├── beads.db            # SQLite — fast queries, NOT the source of truth
├── beads.db-shm/-wal   # WAL sidecars
├── issues.jsonl        # "the text-based log of all database changes"  ← the only file committed to git
├── config.yaml         # local, gitignored
├── daemon.log/.pid/.lock
└── bd.sock             # unix socket for CLI/agent comms
```

The flow, verbatim: *"When changes occur in the SQLite database, a background daemon automatically exports
changes as new lines in the `issues.jsonl` file, which is the only issue-related file committed to Git."*
Inbound: *"User B pulls… their local Beads daemon detects the change and automatically imports the new
information."*

**Dependency model:** four typed edges — `blocks`, `related`, `parent-child`, `discovered-from` — forming a
graph agents can traverse. `discovered-from` is notable: it encodes *"I found this while doing that,"* which
is exactly house's "fold concerns forward into later units" and its health-sweep backlog, both currently
prose-only.

**`bd ready`** *"queries the database for all open issues with no uncompleted dependencies"* — i.e. the
graph computes the next action instead of a human writing "next action:" into a tracker. House's
`dev-state.md` has a hand-written `next action:` field that goes stale; `ready` is the mechanized version.

IDs look like `setup-react-xyz`, `install-deps-abc`, `brew-ui-eci` — slugified title + random suffix.
Human-readable *and* collision-free without a central counter. That is the answer to "two `Slice N` series
can coexist in one repo with nothing disambiguating."

Ecosystem signal (relevance check): a [Rust port](https://github.com/Dicklesworthstone/beads_rust), a
[graph TUI with a robot-mode JSON API](https://github.com/Dicklesworthstone/beads_viewer), an integration
request into [vibe-kanban](https://github.com/BloopAI/vibe-kanban/issues/1394), ~18.7k stars. This is a
real, converged-upon pattern, not a curiosity.

**Caveat found:** the guide does **not** document merge-conflict handling for `issues.jsonl`, and the
record shape is not published in the write-ups reviewed. Both are gaps house v2 must close explicitly
(see §5.2 — union merge + idempotent event IDs).

### 1.4 Agent-orchestration desktop apps — the UI competitive set

Direct competitors to the IDE Jake wants to build, all converging on **git worktrees as the isolation
primitive** (which house already uses):

- **[Conductor](https://conductor.build)** — macOS desktop app, parallel Claude Code agents, isolated
  workspaces, progress monitoring, worktree management.
- **Crystal** — Electron desktop app, multiple Claude Code sessions in parallel worktrees, persistent
  conversation tracking, built-in git ops, change visualization, desktop notifications.
- **[Vibe Kanban](https://github.com/BloopAI/vibe-kanban)** — Rust + TypeScript, kanban board over multiple
  agents (Claude Code, Gemini CLI, Codex), parallel/sequential execution, task status tracking.
  **Bloop shut down in early 2026**; the project continues community-maintained. Worth noting as a
  cautionary data point on the "agent orchestration UI" category, and as an argument for building on
  file-format contracts you own rather than a vendor's service.

**Gap none of them fill, and where house v2's IDE is differentiated:** all three are *task/session runners*.
None of them treat the **spec/plan/ADR/retro doc corpus** as the first-class object with the terminal
attached to it. Kiro does that but has no multi-session orchestration and owns the agent. House v2's
proposition — *the doc model is the home screen; sessions are how it advances* — is genuinely unoccupied.

### 1.5 Claude Code's own state features (moving target — check before designing around)

Reported in the searches, treat as directionally true and verify against current docs before depending on:
native **Tasks** in Claude Code 2.1+ with "first-class support for multi-task orchestration," and a common
community pattern of *"storing project specifications in markdown files, hydrating the task list from the
spec at session start, and syncing progress back to spec files as work completes."* That is a
**bidirectional sync** — the exact topology that produced Kiro's `[-]` bug. Prefer one-way: spec/plan is the
declaration, session tasks are ephemeral, and completion is recorded as an *event*, not written back into
the plan by a second writer.

---

## 2. State models — Linear, GitHub Projects, and what a "status" actually is

### 2.1 Linear — name vs type is the whole lesson

Linear has **six state types**, a fixed closed enum: `triage`, `backlog`, `unstarted`, `started`,
`completed`, `canceled`. Teams then define **arbitrarily many named statuses**, each *mapped to* one type.
The docs' own example:

| type | team-chosen names |
|---|---|
| backlog | Icebox, Backlog |
| unstarted | Todo |
| started | In Progress, In Review, Ready to Merge |
| completed | Done |
| canceled | Canceled, Could not reproduce, Won't Fix |

Teams can reorder statuses *within* a category, but **"the categories themselves stay in a fixed order."**
The API exposes `WorkflowState` objects with a `type` field; mutating an issue's status requires the target
state's `stateId` (a UUID), so you must query the workflow first — you cannot set status by typing a string.

**Why this is the key steal.** House's real-world drift — dev-state headings drift, retro filenames have
three styles, spec `Status:` lines go stale, stage names vary — is all *naming* drift. Forcing every repo to
use identical prose will fail again (it already did). Forcing every named thing to declare a `type` from a
six-ish-value enum lets the prose drift harmlessly while the IDE, the sweeps, and the resume logic read the
type. Jake gets project-local vocabulary; the tooling gets a state machine.

Note also that Linear treats `canceled` as a **terminal state distinct from completed**. House has no
"abandoned slice" concept at all — a shaped-but-dropped slice currently just rots in `Slated`.

### 2.2 GitHub Projects v2 — fields, and automation-as-a-consequence-of-events

Projects v2 gives items **typed custom fields**: text, number, date, **single select** (with colors and
descriptions), and iteration. State lives in a `single select` field, queried via GraphQL
(`ProjectV2ItemFieldValue`); REST support was added Sept 2025.

The genuinely instructive part is **built-in workflows**: two are enabled by default —
*"When issues or pull requests in your project are closed, their status is set to Done"* and *"when pull
requests in your project are merged, their status is set to Done."* Others set status on add, archive on
criteria, auto-add matching repo items.

**Lesson:** status is derived from events that were going to happen anyway (PR merged, issue closed), not
from someone remembering to update a field. House has an exact analogue sitting unused — **the slice's PR
merging is an unambiguous, already-occurring event that should mechanically drive `Active slice → Done`,
tick the plan's checkboxes, and flip the spec's `Status:` from Draft to Shipped.** All three of house's
staleness bugs (unticked checkboxes, stale spec status, dev-state Done drift) die to one merge-triggered
projection.

Also note the shape: **fields have declared types**, and a single-select's options are enumerated up front.
That is frontmatter with a schema, i.e. §5.1.

---

## 3. Event-sourced tooling state, and where the events come from

### 3.1 Claude Code transcripts — an event log already exists under the floor

Transcripts live at `~/.claude/projects/<project>/<session-id>.jsonl`, where `<project>` is the cwd with
non-alphanumerics replaced by `-`. One JSON object per line, **append-only**. Every line carries
`sessionId`, `timestamp`, `cwd`, `gitBranch`, and a UUID-chained `parentUuid` linking it to the previous
turn — user prompts, assistant responses with content blocks (text, tool calls, thinking), tool results,
system prompts, summaries, and git snaps. Sessions resume via `claude -p --resume <session-id>`.

**The warning matters more than the format**, from the docs: *"The entry format is internal to Claude Code
and changes between versions, so scripts that parse these files directly can break on any release. To build
on session data, use `/export` or the script interfaces instead."*

So: **the IDE must not parse transcripts as its state store.** But three things are safely usable —
(a) the *existence* and path of a session file as the join key between "a terminal pane" and "a slice",
(b) `sessionId` as a durable identifier to record in house's own events, (c) `gitBranch` + `cwd` to bind a
session to a worktree. Anything semantic should be emitted deliberately by hooks (§5.3), not scraped.

Prior art for reading these anyway (useful for a session-history pane, at your own risk):
[simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts),
[claude-code-log](https://github.com/daaain/claude-code-log), and a Rust
[`claude_code_transcripts`](https://docs.rs/claude-code-transcripts) crate.

### 3.2 Git as an event stream — trailers and notes

**Trailers** are `key: value` lines at the end of a commit message. Crucially they are *not* just a hosting
convention: *"Git itself understands trailers through built-in support… allowing them to be parsed, added,
and normalized in a structured way,"* via `git interpret-trailers`. They are already used in the wild to
drive release-note generation and dependency automation, and are pitched as a better-typed alternative to
Conventional Commits' subject-line encoding.

House already writes trailers (`Co-Authored-By:`, `Claude-Session:` in this very repo's commit convention).
Extending that to `House-Slice:`, `House-Unit:`, `House-Verdict:`, `House-Retro:` gives a **permanent,
tamper-evident, rebase-surviving record of gate outcomes attached to the artifact that shipped** — and it
survives even if `.house/` is deleted, because it is in the commit history.

**Notes** attach metadata *outside* the commit message — *"like Post-it notes you can stick on commits
without changing their SHA-1 hash."* Attractive for post-hoc annotation (a retro link added after the merge)
but they live in a separate ref (`refs/notes/*`) that is **not fetched or pushed by default** and merges
poorly. **Recommendation: use trailers, avoid notes.** Solo-dev convenience does not survive the first
`git clone` on a second machine.

**Caveat house already knows and must encode in tooling, not prose:** the doctrine correctly documents that
`git branch --merged` does not recognize a squash-merged branch, so merged-ness must come from
`gh pr list --state merged`. If PR-merge is going to be the event that drives status (§2.2), the emitter
must use the PR API, not reachability.

### 3.3 File watchers — the delivery mechanism, and its sharp edges

If the IDE auto-opens specs/plans/mockups "as Claude Code sessions produce them," it needs a watcher. The
failure modes are well-documented and will bite:

- **Atomic saves.** Editors (and agents writing via temp-file-plus-rename) produce `rename`, not `change`.
  chokidar has an explicit `atomic` option because *"some file editors use them, and changes are reported as
  add/change/unlink instead of rename,"* plus `awaitWriteFinish` for exactly this.
- **Platform divergence.** *"The same save in your editor may fire one event on macOS and three on Linux."*
- **FSEvents batching.** macOS *"supports recursive watching but events come in batches with debounce; you
  may see one event per save or one event covering several saves depending on the rate."*
- **Silent misses.** Built-in watchers *"miss events on some editors due to atomic saves"*; some watchers
  report nothing at all for certain editors on macOS.
- **Scale.** chokidar has *"performance considerations on huge trees,"* with Watchman and `@parcel/watcher`
  as the escape hatches.

**Design consequence:** treat the watcher as a *hint*, never as truth. Every watcher event should trigger a
**re-read + re-derive of the affected artifact**, and the app must expose an idempotent "reindex everything"
path that produces an identical result. Never accumulate state from the event stream of a file watcher. This
is the same rule as §5.2's rebuildable projection, and it makes missed events a latency bug instead of a
correctness bug.

---

## 4. LSP-as-decoupling — and the fact that it has already been done for agents

### 4.1 The pattern

LSP *"decouples core (programming) language features functionality from editor smarts, thus lowering the
effort required to extend an IDE to support a language."* The economics: it *"reduces a m × n problem of
implementing each language debugger for each development tool into a m + n problem."*

The pattern has been re-run repeatedly: **DAP** for debugging (*"two abstract protocols allow for decoupling
the editing and debugging user interfaces in the 'frontend' from the language specific smartness and
debugging functionality provided by 'backend' components"*), **BSP** for build systems, and even
**SLSP** — an academic [Specification Language Server Protocol](https://cister-labs.pt/f-ide2021/images/preprints/F-IDE_2021_paper_3.pdf)
proposal, *"designed to be an extension to LSP to support specification language features in a decoupled
manner, thus transforming the M × N problem into M + N as LSP does."* That last one is the closest formal
precedent for "a server that exposes *spec* state to any editor" — the exact idea in the brief.

### 4.2 ACP — the LSP for coding agents, already adopted

**[Agent Client Protocol](https://agentclientprotocol.com)** — published by Zed Industries Aug 2025.
JSON-RPC 2.0 over stdio for local subprocess agents (HTTP/WebSocket for remote). The editor is the **client**;
the agent is the **server**. *"Agents that implement ACP work with any compatible editor. Editors that
support ACP gain access to the entire ecosystem of ACP-compatible agents."* It deliberately *"re-uses the
JSON representations used in MCP where possible, but includes custom types for useful agentic coding UX
elements, like displaying diffs,"* and defaults to Markdown for text.

Adoption trajectory: JetBrains joined shortly after launch; Oct 2025 co-development partnership to bring
native ACP to IntelliJ/PyCharm/WebStorm; **Jan 2026 co-launched ACP Registry** built into both editors;
by mid-2026 *"dozens of agents and a growing list of editors implement the spec."*

**Core shape.** Work is organized into *"sessions (a conversation with shared context) and turns (one
prompt-to-response cycle within a session)."* Methods seen: `session/new` (can declare `mcpServers` the
agent should connect to), `session/prompt`, `session/update`, `fs/read_text_file`. Permissions, UX, and
workspace mediation stay with the editor — the agent is driven, not in charge.

**`session/update` variants:** `agent_message_chunk`, `tool_call`, `tool_call_update`, `usage_update`, and —
the one that matters here — **`plan`**:

```json
{
  "sessionUpdate": "plan",
  "entries": [
    { "content": "Check for syntax errors",        "priority": "high",   "status": "pending" },
    { "content": "Identify potential type issues", "priority": "medium", "status": "pending" }
  ]
}
```

**This is the piece of prior art that most changes the design.** A *streamed, typed, statused task list from
the agent to the editor* is precisely the missing channel that forced Kiro to abuse `tasks.md` checkboxes as
an IPC mechanism. ACP does it out-of-band. House v2's IDE should render live unit progress from a channel
like this, and treat the plan file as the durable *declaration* only.

**Verdict on "could a process server expose SDLC state to any editor?"** Yes, and it should be a **separate,
smaller server than ACP, not an ACP extension.** The two have different lifetimes and different truth
sources: ACP is *session-scoped and ephemeral* (what the agent is doing right now); a house process server
is *repo-scoped and durable* (what state this slice is in, across sessions, across machines, across months).
Conflating them means your durable SDLC state dies when the session ends — which is exactly today's bug
(verdicts and builder reports are conversation-only).

Concretely: **the durable contract must be files in the repo (§5); the process server is a convenience
layer over those files, not a second source of truth.** If the server is down, `git clone` + read the
markdown must still tell you everything. That is a hard constraint, and it is what stops house v2 from
becoming another Vibe Kanban (§1.4) — a UI whose value evaporates with its vendor.

---

## 5. Recommended integration contract

**Both a manifest and an event log — but with a strict three-layer ownership split, and exactly one writer
per layer.** The Kiro `[-]` bug (§1.1) is the whole argument for the ownership rule; Beads (§1.3) is the
whole argument for the layering.

```
DECLARED  → YAML frontmatter on each artifact        writer: shaper/builder agent   git-tracked   truth
OBSERVED  → .house/events.jsonl (append-only)        writer: hooks only             git-tracked   truth
DERIVED   → .house/index.json                        writer: `house index` only     GITIGNORED    cache
```

Rule: **nothing reads DERIVED to decide anything it then writes back.** DERIVED is for the IDE, sweeps, and
`house ready`. Deleting `.house/index.json` and rebuilding must be a no-op. That single invariant is what
makes missed watcher events (§3.3) and JSONL merge weirdness (§5.2) non-fatal.

### 5.1 DECLARED — frontmatter with a closed-enum `state`

Every artifact under `docs/` gets frontmatter. Modeled on Kiro's steering frontmatter (§1.1) with Linear's
name/type split (§2.1):

```yaml
---
id: edge-scanner-014-dfs-oom            # slug + repo prefix; globally unique, no bare "Slice 3"
kind: spec                              # enum: spec | plan | adr | retro | mockup | health | roadmap | dev-state
slice: edge-scanner-014-dfs-oom         # the slice this belongs to (self, for spec)
title: DFS optimizer MLB /dfs OOM fix
status: Shipped                         # FREE TEXT — project-local vocabulary
state: completed                        # CLOSED ENUM — triage|backlog|unstarted|started|blocked|completed|canceled
stage: 11-reconcile                     # closed enum of house stages 0..11
updated: 2026-07-27
supersedes: null
---
```

- `status` free / `state` enum is the Linear steal. Prose drifts; `state` does not.
- `id` uses the Beads scheme (slug + repo prefix). Kills slice-identity ambiguity permanently.
- `canceled` and `blocked` exist as first-class terminal/stuck states — house currently has neither.
- **Validate in CI.** Mature tooling exists: [`remark-lint-frontmatter-schema`](https://github.com/JulianCataldo/remark-lint-frontmatter-schema)
  validates frontmatter against a JSON Schema as a remark-lint rule, usable in CLI and IDE;
  or a GitHub Action that *"converts each file's frontmatter to JSON and validates it against a JSON
  Schema."* A `docs/schema/*.schema.json` set plus one CI job removes an entire category of drift.
- **Mockups get the same frontmatter** in an HTML comment or a sidecar `.meta.yaml`, which finally
  determines the unspecified mockup path: `docs/mockups/<slice-id>/<name>.html`, one dir, one naming rule,
  discoverable by `kind: mockup` rather than by convention.

### 5.2 OBSERVED — `.house/events.jsonl`

Append-only, one JSON object per line, **never edited, never reordered**:

```jsonl
{"id":"01J9X…","ts":"2026-07-27T18:04:11Z","event":"plan_check.verdict","slice":"edge-scanner-014-dfs-oom","actor":"reviewer","session":"a1b2…","payload":{"verdict":"GO_WITH_FIXES","fixes":3}}
{"id":"01J9Y…","ts":"2026-07-27T18:40:02Z","event":"builder.report","slice":"edge-scanner-014-dfs-oom","unit":"3","actor":"house-builder","session":"c3d4…","payload":{"result":"DONE_WITH_CONCERNS","branch":"fix/dfs-oom-mlb","pr":42}}
{"id":"01J9Z…","ts":"2026-07-27T19:12:55Z","event":"merge_gate.verdict","slice":"edge-scanner-014-dfs-oom","actor":"reviewer-fable","payload":{"verdict":"GO","panel":false}}
{"id":"01JA0…","ts":"2026-07-27T19:31:07Z","event":"slice.merged","slice":"edge-scanner-014-dfs-oom","payload":{"pr":42,"sha":"f141bbe"}}
```

Design decisions and why:

- **This is where the currently-lost data goes.** Plan-check `GO / GO-WITH-FIXES / NO-GO` and the builder's
  4-state `DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT` stop being conversation-only. Spec Kit's
  admitted gap — *"no machine-readable approval gate"* — is closed: `house gate` refuses to advance a slice
  whose latest `plan_check.verdict` is `NO_GO`.
- **`id` is a ULID → idempotent replay.** Beads' write-up does not document conflict handling; this is the
  fix. Rebuilding the index dedupes by `id`, so double-appends and re-imports are harmless.
- **`.gitattributes`: `.house/events.jsonl merge=union`.** Append-only + union merge ≈ conflict-free across
  worktrees and branches, which matters because house runs a worktree per unit. Union merge can reorder or
  duplicate lines; ULID `id` + `ts` sorting makes that irrelevant. *This one line is the difference between
  a JSONL log being pleasant and being a daily merge tax.*
- **Never parse Claude Code transcripts into this** (§3.1) — emit deliberately, so a Claude Code release
  cannot break house's state.

### 5.3 The emitters — hooks, not discipline

The reason house's checkboxes are 11/13 unticked is that ticking them is a remembered chore. Fix it the way
Kiro fixed it (§1.1, `.kiro/hooks/`) and the way GitHub Projects fixed it (§2.2, merge → Done):

- **Claude Code hooks** (`SessionStart`, `PostToolUse`, `Stop`, `SubagentStop`) append `session.started`,
  `unit.started`, `unit.finished` — zero agent discipline required.
- **A `house event` CLI** the skills call at explicit gate moments (verdicts, reports, deviations). One
  line in each skill's stage table.
- **Git `post-merge` / a PR-merge check** emits `slice.merged` using `gh pr list --state merged` (never
  reachability — the squash caveat, §3.2), and the projection then ticks the plan's checkboxes, flips the
  spec's `status`/`state`, and moves the dev-state entry to Done. **All three staleness bugs die here.**
- **Git trailers** (`House-Slice:`, `House-Verdict:`, `House-Retro:`) on the merge commit as the
  belt-and-braces durable record that survives `.house/` deletion.

### 5.4 DERIVED — `.house/index.json` and `house ready`

`house index` reads all frontmatter + replays `events.jsonl` → one JSON document: slices with computed
`state`, per-unit progress, open gates, dangling artifacts, drift warnings (e.g. *spec says `state: started`
but a `slice.merged` event exists*). The IDE reads only this file, plus the raw markdown for rendering.

`house ready` is Beads' `bd ready` (§1.3): the set of units with no unsatisfied blockers and no failing
gate. This replaces the hand-maintained `next action:` line in `dev-state.md` — that line becomes *rendered*,
not *written*.

Consequence for the doc model: **`dev-state.md` should become a generated view, not an authored file.**
Its allowlist stops being a rule Jake enforces in reconcile and becomes a schema the generator can't violate.
`roadmap.md` stays hand-authored (durable strategy is genuinely prose) but gains a frontmatter-tagged
backlog section so items can be referenced by `id` from events.

---

## 6. Recommended app stack

### 6.1 The two hard requirements decide it

**(a) A real pty hosting Claude Code.** Copy VS Code's architecture — it is the reference implementation and
it is battle-tested: three components, a **Renderer** hosting terminal UI + xterm.js rendering, a **Pty Host**
managing shell process lifecycle and IO *in a dedicated process*, and an **Extension Host** controlling
terminals via API proxies. The pty-host split exists specifically to *"protect the extension host and
renderer from crashes"* and to introduce *"flow control mechanisms to ensure the pty does not get too far
ahead of xterm.js"* ([vscode#74620](https://github.com/microsoft/vscode/issues/74620)). `TerminalProcessManager`
is the renderer-side bridge handling profiles, an acknowledgement buffer for flow control, capabilities, and
**process lifecycle including reconnection**.

Three things to steal regardless of framework: **put the pty in its own process** (a long-running Claude
Code session must survive a renderer crash — this is the single highest-value architectural decision in the
whole app); **implement flow control with an ack buffer** (Claude Code emits fast bursts, and unthrottled
pty→xterm floods are a real crash class — see [vscode#252018](https://github.com/microsoft/vscode/issues/252018),
"All terminals in all VSCode windows crashing with PTY Host error with long input"); and **support
reconnect** so closing a workspace tab doesn't kill an in-flight builder.

**(b) High-fidelity rendering of self-contained HTML mockups.** This is where Tauri loses. Tauri *"uses the
WebView already present on the user's operating system"* — WKWebView on macOS, WebView2 on Windows,
WebKitGTK on Linux — which *"means inconsistent rendering across platforms,"* whereas Electron *"ships its
own Chromium and is consistent everywhere — and that consistency is sometimes worth 100MB.
Visual-fidelity-critical products… usually pick Electron for this reason."*

A mockup pane exists to answer *"is this what it will look like?"* If the pane is WKWebView and the product
ships to Chromium, **the pane lies**, and the entire feature's value is the fidelity. This is not a
performance tradeoff; it is a correctness one.

### 6.2 The cost, stated honestly

| | Tauri v2 | Electron |
|---|---|---|
| Hello-world bundle | ~3.2 MB | ~85 MB |
| Typical installed app | 5–10 MB | 80–150 MB |
| Real IDE-class datapoint | **SideX: 31.2 MB** | **VS Code: 775.1 MB** |
| Webview | OS-native (WKWebView / WebView2 / WebKitGTK) | bundled Chromium, identical everywhere |
| Pty | `portable-pty` (Rust) | `node-pty` (native module) |
| Release engineering | *"has an updater, but the ecosystem around release engineering is younger"* | *"mature, battle-tested… differential updates, staged rollouts, and code-signing and notarization workflows that just work"* |
| Native-module burden | none | *"track ABI compatibility issues and rebuild the native module when the framework is updated"* |

The [SideX experiment](https://dev.to/kendallbooker/i-rebuilt-vs-code-on-tauri-instead-of-electron-and-just-open-sourced-it-53ao)
is the most relevant datapoint available: a VS Code rebuild on Tauri, **31.2 MB vs 775.1 MB installed**,
with *"real PTY via portable-pty (replaces node-pty)"* across a 49-command Rust backend. Working: Monaco,
terminal with real PTY, file explorer, basic git, themes, Open VSX extension loading. Not working: *"The
extension host remains incomplete, debugging is scaffolded but nonfunctional, and settings UI/search/
multi-window support need development,"* and the author's own summary — *"a lot of stuff is still rough or
incomplete."* They frame it as proof-of-concept, not victory.

Tauri's pty story is nonetheless **real and no longer exotic**: `portable-pty` + xterm.js is the standard
recipe, there's a maintained [`tauri-plugin-pty`](https://github.com/Tnze/tauri-plugin-pty) (updated Jan 2026),
plus shipped terminals ([Terminon](https://github.com/Shabari-K-S/terminon), Terax) using WebGL xterm
rendering. Pty is not the reason to reject Tauri. **Webview fidelity is.**

### 6.3 Native Swift — rejected

You would hand-build or wrap: a terminal emulator (or ship SwiftTerm), a markdown renderer, a code viewer,
and — unavoidably — **WKWebView for the mockup pane**, which means you pay the fidelity cost *anyway* while
losing all cross-platform optionality and the entire xterm/Monaco ecosystem. For a solo dev whose leverage
comes from Claude Code writing TypeScript, this is the worst ratio of the three. The only argument for it is
macOS-native polish, which is not the product's differentiator.

### 6.4 Recommendation

**Electron.** Specifically: Electron + xterm.js (WebGL renderer) + node-pty **in a dedicated utility process**
with flow control and reconnect (VS Code's model), markdown rendered in the renderer, mockups in a sandboxed
`<webview>`/`BrowserView` with a locked-down CSP, and `.house/index.json` watched via `@parcel/watcher` or
chokidar with `awaitWriteFinish` + `atomic` (§3.3) — always re-deriving, never accumulating.

Accept the ~120 MB. The app's job is fidelity and session durability, and Electron is the only option where
both are the default rather than the project.

**Revisit Tauri if and only if** the mockup pane is downgraded to "approximate preview, open in real browser
to verify" — at which point Tauri v2 + `portable-pty` becomes the better engineering choice by a wide margin,
and the SideX numbers say it's achievable.

**Build the CLI first, regardless of stack.** `house index` / `house ready` / `house event` / `house gate`
must be a standalone binary the skills call and the IDE merely visualizes. If the IDE is where the contract
lives, the contract dies when the IDE is between rewrites — and the skills need it working from a plain
terminal on day one.

---

## 7. What house v2 should steal — the punch list

Ordered by (value ÷ effort). Each maps to a named weakness from the audit.

| # | Steal | From | Fixes |
|---|---|---|---|
| 1 | **`state` (closed enum) alongside free-text `status`** in frontmatter on every artifact | Linear state types (§2.1) | heading drift, stale spec Status, retro-name drift, dev-state drift — *all of it, at once* |
| 2 | **PR-merge as the event that drives status** — tick plan checkboxes, flip spec state, move dev-state to Done, mechanically | GitHub Projects built-in workflows (§2.2) | 11/13 unticked plans; "shipped slices still say Draft" |
| 3 | **`.house/events.jsonl`, append-only, ULID-keyed, `merge=union`** | Beads (§1.3) | plan-check verdicts + builder 4-state reports being conversation-only |
| 4 | **Text log = truth, DB/index = rebuildable cache, gitignored** | Beads (§1.3) | makes watcher misses & merge weirdness non-fatal (§3.3) |
| 5 | **Slug+prefix global IDs (`edge-scanner-014-dfs-oom`)**, never bare "Slice N" | Beads IDs (§1.3) + Spec Kit numbered folders (§1.2) | ambiguous slice identity; two "Slice N" series in one repo |
| 6 | **ONE writer per field. Never make a state marker double as agent-readable prose.** | Kiro `[-]` bug, #8859 (§1.1) | prevents house v2 from reinventing Kiro's worst bug when the IDE starts writing files |
| 7 | **A machine-readable approval gate** — `house gate` refuses to advance past a `NO_GO` | Spec Kit's stated gap (§1.2) | verdicts that bind nothing |
| 8 | **`house ready`** — compute the next action from the dependency graph instead of writing it down | Beads `bd ready` (§1.3) | stale hand-written `next action:`; makes dev-state a *generated view* |
| 9 | **Frontmatter validated against JSON Schema in CI** (`remark-lint-frontmatter-schema`) | docs-as-code practice (§5.1) | drift becomes a red build, not an audit finding |
| 10 | **Typed dependency edges — incl. `discovered-from`** | Beads (§1.3) | "fold concerns forward into later units" and health-sweep backlog become graph edges, not prose |
| 11 | **A per-project `constitution.md`** (stack, rigor dial, gates) distinct from global doctrine | Spec Kit (§1.2) + Kiro steering (§1.1) | doctrine currently can't express per-repo policy |
| 12 | **Frontmatter inclusion modes + live file refs** (`inclusion: fileMatch`, `#[[file:…]]`) | Kiro steering (§1.1) | "read doctrine on-demand" enforced by prose → enforced by metadata |
| 13 | **Emit events from Claude Code hooks, not from agent discipline** | Kiro `.kiro/hooks/` (§1.1) | every "the agent forgot to update the doc" failure |
| 14 | **Git trailers `House-Slice/Verdict/Retro` on merge commits** | git trailers (§3.2) | durable gate record that survives `.house/` deletion |
| 15 | **`canceled` + `blocked` as first-class states** | Linear (§2.1) | shaped-then-dropped slices currently rot in `Slated` |
| 16 | **`[P]` parallel markers in plans** | Spec Kit (§1.2) | Kiro's dependency "waves" become expressible cheaply |
| 17 | **Fixed mockup path `docs/mockups/<slice-id>/` + `kind: mockup` frontmatter** | §5.1 | "2 dirs × 4 naming styles in the wild" |
| 18 | **EARS notation for spec rules** (`WHEN … THE SYSTEM SHALL …`) | Kiro (§1.1) | reviewers cite spec rules by ID; makes "spec-rule citation" in the merge-gate rubric mechanical |
| 19 | **Pty in its own process, flow-controlled, reconnectable** | VS Code (§6.1) | a renderer crash killing a 40-minute builder session |
| 20 | **Do NOT parse Claude Code transcripts as state** | CC docs' own warning (§3.1) | a CC point release breaking house |

**And one thing to deliberately *not* steal:** don't build the durable contract into the IDE or into an
ACP-style session protocol. ACP (§4.2) is session-scoped and ephemeral; house state is repo-scoped and
durable. `git clone` + read markdown must remain sufficient. Use ACP-style streaming for *live* unit progress
in the UI, and files for everything that must still be true next month.

---

## Sources

Spec-driven IDEs & toolkits
- [Kiro — Specs](https://kiro.dev/docs/specs/) · [Feature Specs](https://kiro.dev/docs/specs/feature-specs/) · [Best practices](https://kiro.dev/docs/specs/best-practices/) · [Steering](https://kiro.dev/docs/steering/) · [Hooks](https://kiro.dev/docs/hooks/) · [Introducing Kiro](https://kiro.dev/blog/introducing-kiro/)
- [Kiro issue #8859 — `[-]` in-progress marker misinterpreted by agent](https://github.com/kirodotdev/Kiro/issues/8859) · [#5011](https://github.com/kirodotdev/Kiro/issues/5011) · [#3428](https://github.com/kirodotdev/Kiro/issues/3428) · [#951](https://github.com/kirodotdev/Kiro/issues/951) · [#1576](https://github.com/kirodotdev/Kiro/issues/1576)
- [Diving Into Spec-Driven Development With GitHub Spec Kit — Microsoft for Developers](https://developer.microsoft.com/blog/spec-driven-development-spec-kit/) · [GitHub Spec Kit: How It Works (2026)](https://codemyspec.com/blog/github-spec-kit-guide) · [Practitioner's guide](https://felipefontoura.com/articles/github-spec-kit/)

Agent-native state
- [Beads: A Git-Friendly Issue Tracker for AI Coding Agents — Better Stack](https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/) · [beads_rust](https://github.com/Dicklesworthstone/beads_rust) · [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) · [vibe-kanban #1394](https://github.com/BloopAI/vibe-kanban/issues/1394)
- [Manage sessions — Claude Code Docs](https://code.claude.com/docs/en/sessions) · [Claude Code JSONL transcript format](https://claude-dev.tools/docs/jsonl-format) · [simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) · [claude-code-log](https://github.com/daaain/claude-code-log)
- [9 Open-Source Agent Orchestrators for AI Coding (2026) — Augment](https://www.augmentcode.com/tools/open-source-agent-orchestrators) · [awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators) · [Vibe Kanban](https://vibe-kb.com/)

State machines
- [Issue status — Linear Docs](https://linear.app/docs/configuring-workflows) · [Custom statuses for projects — Linear Changelog](https://linear.app/changelog/2024-03-19-custom-statuses-for-projects) · [Linear via Bugwarrior](https://bugwarrior.readthedocs.io/en/latest/services/linear.html)
- [About Projects — GitHub Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) · [Using the built-in automations](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations) · [Automating Projects using Actions](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)

Protocols
- [Agent Client Protocol — Introduction](https://agentclientprotocol.com/overview/introduction) · [Prompt Turn / session updates](https://agentclientprotocol.com/protocol/prompt-turn) · [ACP: The LSP for AI Coding Agents — Marc Nuri](https://blog.marcnuri.com/agent-client-protocol-acp-introduction) · [Bring Your Own Agent to Zed](https://zed.dev/blog/bring-your-own-agent-to-zed) · [ACP vs MCP — Morph](https://www.morphllm.com/agent-client-protocol)
- [New home for the Debug Adapter Protocol — VS Code blog](https://code.visualstudio.com/blogs/2018/08/07/debug-adapter-protocol-website) · [The Specification Language Server Protocol (F-IDE 2021, PDF)](https://cister-labs.pt/f-ide2021/images/preprints/F-IDE_2021_paper_3.pdf)

Terminal / desktop stack
- [Integrated Terminal — microsoft/vscode (DeepWiki)](https://deepwiki.com/microsoft/vscode/6-integrated-terminal) · [xterm.js integration & rendering](https://deepwiki.com/microsoft/vscode/6.3-xterm.js-integration-and-rendering) · [vscode#74620 — node-pty host with flow control](https://github.com/microsoft/vscode/issues/74620) · [vscode#252018 — PTY host crash on long input](https://github.com/microsoft/vscode/issues/252018) · [node-pty](https://www.npmjs.com/package/node-pty)
- [I rebuilt VS Code on Tauri instead of Electron (SideX)](https://dev.to/kendallbooker/i-rebuilt-vs-code-on-tauri-instead-of-electron-and-just-open-sourced-it-53ao) · [tauri-plugin-pty](https://github.com/Tnze/tauri-plugin-pty) · [marc2332/tauri-terminal](https://github.com/marc2332/tauri-terminal) · [Terminon](https://github.com/Shabari-K-S/terminon) · [Tauri Shell plugin](https://v2.tauri.app/plugin/shell/)
- [Tauri vs Electron 2026 — PkgPulse](https://www.pkgpulse.com/blog/best-desktop-app-frameworks-2026) · [Electron vs Tauri 2026: Bundle, RAM, Security, Team Fit](https://www.pkgpulse.com/guides/electron-vs-tauri-2026) · [Tauri vs Electron vs PWA — Oviompt](https://oviompt.com/blog/tauri-vs-electron-vs-pwa/) · [Tauri v2 vs Electron: The Honest Comparison](https://www.buildmvpfast.com/blog/tauri-v2-vs-electron-desktop-apps-2026)

Watchers, git metadata, schema validation
- [chokidar](https://github.com/paulmillr/chokidar) · [chokidar README (atomic, awaitWriteFinish)](https://github.com/paulmillr/chokidar/blob/main/README.md) · [How to Watch File Changes in Node.js](https://oneuptime.com/blog/post/2026-01-22-nodejs-watch-file-changes/view) · [fs.watch cross-platform quirks](https://fixdevs.com/blog/nodejs-fs-watch-not-working/)
- [Git Trailers — Alchemists](https://alchemists.io/articles/git_trailers) · [Git Notes & Trailers — Ris Adams](https://risadams.com/blog/2025/04/17/git-notes/) · [Understanding Git Commit Trailers](https://www.simonegigante.com/posts/commit-trailers/)
- [remark-lint-frontmatter-schema](https://github.com/JulianCataldo/remark-lint-frontmatter-schema) · [sourcemeta/jsonschema — validate](https://github.com/sourcemeta/jsonschema/blob/main/docs/validate.markdown) · [frontmatter-to-schema](https://github.com/tettuan/frontmatter-to-schema)
