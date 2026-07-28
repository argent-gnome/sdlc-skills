# Research digest — spec-driven / AI-native dev tooling, on-disk artifact models (2025–2026)

**Purpose:** input to the house SDLC v2 redesign. Survey of how the 2025–2026 SDD tools structure on-disk
artifacts, track state, and expose themselves to IDEs — and what house v2 should steal.
**Date:** 2026-07-28. **Method:** primary sources (raw repo files, official docs) + community criticism threads.

> Note on scope: the orchestrator passed an unresolved output path (`undefined/`). This digest was written to
> `/Users/jake-edwards/projects/sdlc-skills/docs/research/` — the repo the redesign targets.

---

## 0. TL;DR — the six conventions that have converged

Across spec-kit, Kiro, OpenSpec, BMAD, Cline, Cursor, Antigravity and the Agent Skills standard, six things
have stabilized into de-facto standards. Everything else is still contested.

| # | Convention | Who does it | Confidence |
|---|---|---|---|
| 1 | **Tool-owned root dir** (`.specify/`, `.kiro/`, `openspec/`, `.beads/`) separate from human docs | all | very high |
| 2 | **One folder per unit of change**, artifacts inside it (`proposal/spec/design/tasks`) | spec-kit, Kiro, OpenSpec, Antigravity | very high |
| 3 | **The 3-artifact spine: WHY → WHAT → HOW → TASKS** | universal (naming differs) | very high |
| 4 | **YAML frontmatter as the metadata carrier** for markdown that agents load | Kiro steering, Cursor `.mdc`, Claude `SKILL.md` | very high |
| 5 | **`- [ ] N.M description` checkboxes as the progress ledger**, parsed by the tool | Kiro, OpenSpec, BMAD, Antigravity | high |
| 6 | **A CLI with `--json` as the machine-readable surface**, markdown stays the storage | OpenSpec, Beads | rising fast — this is the 2026 move |

The single biggest 2026 shift: **nobody serious is putting status *in* the prose anymore.** They either (a)
derive status from parsing structured markdown, or (b) keep a sidecar DB/JSONL. house v2 sits squarely on
weakness (a)+(b) being absent.

---

## 1. GitHub spec-kit

**Repo:** https://github.com/github/spec-kit — ~93k stars, v0.8.7 (May 2026), 30+ agents supported.
Python CLI (`specify`), installed via `uv tool install specify-cli`.

### On-disk layout

```
project-root/
├── .specify/
│   ├── memory/
│   │   ├── constitution.md                 # governing principles — the gate
│   │   └── constitution_update_checklist.md
│   ├── templates/
│   │   └── overrides/                      # project-local template customization
│   ├── extensions/templates/
│   ├── presets/templates/
│   └── scripts/                            # bash + powershell prereq checkers
├── specs/
│   └── NNN-feature-name/                   # zero-padded numeric + kebab slug
│       ├── spec.md                         # /speckit.specify
│       ├── plan.md                         # /speckit.plan
│       ├── research.md                     # Phase 0 output
│       ├── data-model.md                   # Phase 1 output
│       ├── quickstart.md                   # Phase 1 output
│       ├── contracts/                      # Phase 1 output
│       ├── tasks.md                        # /speckit.tasks
│       └── checklists/                     # /speckit.checklist
└── .claude/commands/                       # generated per-agent command files
    (also .github/prompts/, .cursor/commands/, … one per integration)
```

### Commands (namespaced since v0.5-ish)

`/speckit.constitution` · `/speckit.specify` · `/speckit.clarify` · `/speckit.plan` · `/speckit.tasks` ·
`/speckit.analyze` · `/speckit.implement` — plus `/speckit.checklist` and `/speckit.taskstoissues`.
Skills-mode install emits `$speckit-*` skills instead of slash-command prompt files.

### Metadata & state — the weak spot

Spec-kit's metadata is **prose key-value lines in the markdown body**, not frontmatter. Verbatim from
`templates/spec-template.md`:

```markdown
# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`
**Created**: [DATE]
**Status**: Draft
**Input**: User description: "$ARGUMENTS"
```

and from `templates/plan-template.md`:

```markdown
# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
```

**`Status: Draft` is exactly the house-shaper bug.** Spec-kit has the identical failure — the field exists,
nothing owns transitioning it. There is no `Status: Shipped`, no state machine, no writer.

### Task format — *no checkboxes at all*

`templates/tasks-template.md` uses the format `[ID] [P?] [Story] Description`:

```
T001 Create project structure per implementation plan
T012 [P] [US1] Create [Entity1] model in src/models/[entity1].py
```

- `T###` sequential IDs
- `[P]` = parallelizable ("different files, no dependencies")
- `[US1]` = links the task back to a prioritized user story
- Phases: Setup → Foundational → User Story 1..N (P1/P2/P3) → Polish
- **Checkpoints** between phases: *"At this point, User Story 1 should be fully functional and testable independently"*

Notably the template contains **no `- [ ]` syntax**. Progress is not represented on disk at all. Contrast
with `templates/checklist-template.md`, which *does* use checkboxes with stable IDs:

```markdown
## [Category 1]

- [ ] CHK001 First checklist item with clear action
- [ ] CHK002 Second checklist item
```

So spec-kit has two incompatible list conventions in the same toolkit.

### The good idea: `constitution.md` + Constitution Check gate

`.specify/memory/constitution.md` holds immutable project principles (stack, testing expectations, UX
guidelines). `plan-template.md` embeds a hard gate:

```markdown
## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]
```

This is the best-designed piece of spec-kit: a **named, re-entrant gate that is re-checked after design**,
and whose criteria live in one versioned file rather than being re-derived per feature.
`/speckit.analyze` is the second good idea — a **cross-artifact consistency check** run *before* implement
(does the plan cover every spec requirement? does every task map to a requirement?).

### What users complain about

From `github/spec-kit` Discussion #1784, "SpecKit creates the illusion of work":

> "Files are created ignoring the project structure" … "Overengineering, because the LLM … is busy
> analyzing kilobytes of text and generating new texts." — NaikSoftware

> "Even instead of simply adding a test to the existing structure, it tries to create new files and generates
> hundreds of unnecessary tests"

> "Most of the time I keep deleting half the stuff and manually adjusting the rest. But it's still better than
> not having specs at all." — Foertel

From Discussion #1686, "High Level Design Concerns":

> "after several hours work, I have a wonderfully specified app, but the implementation is poor"

> The model lacks integration between specification artifacts and issue tracking — an **"as specified vs.
> as implemented gap"** with no unified mechanism to measure or bridge it.

> the risk of "great specs — no MVP"

A defender's reframe worth keeping (Amondnet): *"The balance has shifted from ~80% coding to 50% planning,
20% coding, 30% validation."*

**Lesson for house v2:** volume ≠ fidelity. The complaint is not "specs are bad," it's "the artifact set is
too large per unit of change and nothing closes the loop back from code to spec." Also: phased gates fit
well-understood features; research-heavy work fights the structure.

---

## 2. Amazon Kiro

**Site:** https://kiro.dev — agentic IDE (VS Code fork) + CLI, v1.0 July 2026.

### Layout

```
.kiro/
├── steering/
│   ├── product.md      # purpose, business objectives
│   ├── tech.md         # stack, frameworks, dev guidelines
│   └── structure.md    # file organization, naming conventions
├── specs/
│   └── {feature-name}/
│       ├── requirements.md   # or bugfix.md for bug specs
│       ├── design.md
│       └── tasks.md
└── hooks/                    # event-triggered agent actions
```

Plus a **global** scope at `~/.kiro/steering/` applying across all workspaces.

### Steering frontmatter — the best-designed context-loading contract in the survey

```yaml
---
inclusion: always
---
```

```yaml
---
inclusion: fileMatch
fileMatchPattern: "components/**/*.tsx"     # or ["**/*.ts", "**/*.tsx"]
---
```

```yaml
---
inclusion: manual
---
```
(referenced in chat as `#steering-file-name`)

```yaml
---
inclusion: auto
name: api-design
description: REST API design patterns and conventions. Use when creating or modifying API endpoints.
---
```

And **live file references** so steering docs don't duplicate content:

```
#[[file:api/openapi.yaml]]
```

That transclusion syntax is a genuinely good idea — it makes a steering doc a *pointer* rather than a copy,
which is the single most common cause of doc drift.

### Requirements format — EARS

Kiro's `requirements.md` uses EARS notation: `WHEN [condition] THE SYSTEM SHALL [behavior]`. The 2026
"Requirements Analysis" feature runs **formal logic / SMT solvers over EARS requirements to catch
contradictions before code generation**. That's the furthest anyone has pushed machine-checkable specs.

### Task execution — dependency waves

Kiro parses `tasks.md` into a **dependency graph** and groups independent tasks into "waves": wave 1 = all
tasks with no dependencies, run concurrently; subsequent waves sequential, concurrent within. The IDE shows
"real-time status updates" and **ticks the `- [ ]` checkboxes itself as work completes**.

There is also a "Quick Spec" mode that generates all three artifacts **without approval gates** for
well-understood features — an explicit rigor dial.

### What users complain about

- **Spec drift is the headline failure.** "Both Kiro and Antigravity produce the same failure mode: specs
  drift out of sync with code." Kiro lets you *manually request* a spec update after code changes; it does
  not reconcile automatically.
- **Checkbox ticking is IDE-only.** [Kiro issue #6826](https://github.com/kirodotdev/Kiro/issues/6826) —
  "CLI: Auto-track tasks.md checkbox completion (parity with IDE)": when driving from Kiro CLI, `[ ]` is
  never marked `[x]`. The reporter's framing is *exactly* Jake's problem: *"With 24 tasks and multiple
  sessions, this creates real risk of tasks.md drifting from actual implementation state — making it
  unreliable as a progress tracker and handoff document between sessions."*
- **Ceremony floor too high:** *"I just wanted to change a button color, and Kiro asked me to write a
  requirement doc first."*
- Failed tasks lost all context and required a restart (early access).

**Lesson:** the checkbox convention only works if *something automated owns the write*. Kiro proves both
directions — the IDE ticks them and it works; the CLI doesn't and it rots. house v2's builder must own the
tick as a hard obligation, or the IDE must.

---

## 3. OpenSpec — the most relevant model for house v2

**Repo:** https://github.com/Fission-AI/OpenSpec (`@fission-ai/openspec`, Node ≥20.19). ~52k stars.
Scored highest overall in a Feb 2026 independent evaluation for change-accountability workflows.

Philosophy, verbatim from the README:

```text
→ fluid not rigid
→ iterative not waterfall
→ easy not complex
→ built for brownfield not just greenfield
→ scalable from personal projects to enterprises
```

### Layout

```
openspec/
├── specs/                          # SOURCE OF TRUTH — how the system behaves TODAY
│   ├── auth/spec.md
│   ├── payments/spec.md
│   └── ui/spec.md
├── changes/                        # in-flight work
│   ├── add-dark-mode/
│   │   ├── .openspec.yaml          # ← per-change machine-readable config
│   │   ├── proposal.md             # WHY
│   │   ├── specs/<capability>/spec.md   # WHAT — as DELTAS
│   │   ├── design.md               # HOW
│   │   └── tasks.md                # checklist
│   └── archive/
│       └── 2025-01-23-add-dark-mode/    # ISO-date + change-id
└── config.yaml                     # project config

.claude/skills/  .cursor/skills/  .cursor/commands/   # generated per tool
```

Commands: `/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`
(expanded profile adds `/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:verify`, `/opsx:bulk-archive`,
`/opsx:onboard`).

### The killer idea #1 — deltas, and archive-merges-into-truth

Changes never edit the main spec. They carry **delta operations**:

```markdown
## ADDED Requirements

### Requirement: User can export data
The system SHALL allow users to export their data in CSV format.

#### Scenario: Successful export
- **WHEN** user clicks "Export" button
- **THEN** system downloads a CSV file with all user data

## REMOVED Requirements

### Requirement: Legacy export
**Reason**: Replaced by new export system
**Migration**: Use new export endpoint at /api/v2/export
```

Operations: `ADDED` / `MODIFIED` / `REMOVED` / `RENAMED` (FROM:/TO:). MODIFIED **must include the full
updated content** — "Common pitfall: Using MODIFIED with partial content loses detail at archive time."

**`/opsx:archive` merges the deltas into `openspec/specs/` and moves the change folder to
`changes/archive/YYYY-MM-DD-<id>/`.** That is the mechanism that solves spec-staleness: the shipped spec is
*produced by the act of shipping*, not maintained by discipline. As one writeup put it: *"merged deltas leave
you with a system-level spec that grows with the codebase rather than a pile of stale planning docs."*

This is the direct answer to house's "Spec `Status:` lines go stale after merge" weakness — the fix isn't a
status field, it's **two locations** (in-flight vs truth) and a merge step.

### The killer idea #2 — a declarative artifact schema with a dependency graph

`schemas/spec-driven/schema.yaml` (verbatim head):

```yaml
name: spec-driven
version: 1
description: Default OpenSpec workflow - proposal → specs → design → tasks
artifacts:
  - id: proposal
    generates: proposal.md
    description: Initial proposal document outlining the change
    template: proposal.md
    instruction: |
      Create the proposal document that establishes WHY this change is needed.
      ...
    requires: []

  - id: specs
    generates: "specs/**/*.md"
    template: spec.md
    instruction: | ...
    requires: [proposal]

  - id: design
    generates: design.md
    requires: [proposal]

  - id: tasks
    generates: tasks.md
    requires: [specs]
```

Each artifact declares `id`, `generates` (glob!), `template`, `requires` (DAG edges), and a long
`instruction` block. **The process itself is data.** New workflows are forked, not forked-code:
`openspec schema init | fork | validate | which`.

### The killer idea #3 — status derived from disk, emitted as JSON

`openspec status --change add-dark-mode`:

```
Change: add-dark-mode
Schema: spec-driven
Progress: 2/4 artifacts complete

[x] proposal
[x] specs
[ ] design
[-] tasks (blocked by: design)
```

`--json`:

```json
{
  "changeName": "add-dark-mode",
  "schemaName": "spec-driven",
  "isComplete": false,
  "applyRequires": ["tasks"],
  "artifacts": [
    {"id": "proposal", "outputPath": "proposal.md", "status": "done", "requires": []},
    {"id": "specs", "outputPath": "specs/**/*.md", "status": "done", "requires": ["proposal"]},
    {"id": "design", "outputPath": "design.md", "status": "ready", "requires": ["proposal"]},
    {"id": "tasks", "outputPath": "tasks.md", "status": "blocked", "requires": ["specs","design"],
     "missingDeps": ["design"]}
  ]
}
```

Status vocabulary: **`done` / `ready` / `blocked` / `skipped`**. Docs note: *"Artifacts are listed in
dependency order … So the first `ready` entry is the artifact to write next."* The CLI computes the next
action rather than a human writing "next action:" in prose.

`skip_specs: true` in the change's `.openspec.yaml` renders as `[~] specs (skipped: change declares
skip_specs)` and is excluded from the progress denominator — an **explicit, recorded opt-out** rather than a
silently-empty artifact.

### Killer idea #4 — validation as a first-class CI surface

`openspec validate --all --strict --json`:

```json
{
  "version": "1.0.0",
  "results": { "changes": [ { "name": "add-dark-mode", "valid": true,
    "warnings": ["design.md: missing 'Technical Approach' section"] } ] },
  "summary": { "total": 1, "valid": 1, "invalid": 0 }
}
```

Hard structural rules that are *enforced*, not hoped for:
- *"Scenarios MUST use exactly 4 hashtags (`####`). Using 3 hashtags or bullets will fail silently."*
- *"Every requirement MUST have at least one scenario."*
- *"`openspec validate` rejects a change with zero deltas unless the change's `.openspec.yaml` sets
  `skip_specs: true`."*
- `--strict` flags a `## Purpose` shorter than 50 characters as too brief.

Also: `openspec doctor` (relationship health for the resolved root) — a health sweep as a command.

### Task format (and the reason it's enforced)

From the tasks artifact instruction, verbatim:

> **IMPORTANT: Follow the template below exactly.** The apply phase parses checkbox format to track
> progress. Tasks not using `- [ ]` won't be tracked.

```markdown
## 1. Setup

- [ ] 1.1 Create new module structure
- [ ] 1.2 Add dependencies to package.json

## 2. Core Implementation

- [ ] 2.1 Implement data export function
```

`## N. Group` + `- [ ] N.M description`. Hierarchical, stable, addressable IDs.

### Project config — context/rules injection

`openspec/config.yaml`:

```yaml
schema: spec-driven

context: |
  Tech stack: TypeScript, React, Node.js, PostgreSQL
  API style: RESTful, documented in docs/api.md
  Testing: Jest + React Testing Library

rules:
  proposal:
    - Include rollback plan
  specs:
    - Use Given/When/Then format

operations:
  apply:
    guidance:
      - Run focused tests before the full suite
  archive:
    guidance:
      - Keep the completion summary concise
```

Injected into the prompt as XML-fenced `<context>` / `<rules>` / `<template>` blocks. **`context` appears in
ALL artifacts; `rules` only for the matching artifact.** Note the careful distinction they draw:
*"operation guidance does not constrain artifact content, and artifact rules are never relabeled as operation
guidance"* — and guidance never overrides "CLI-controlled state, resolved paths, built-in steps, explicit
user choices."

### Human vs agent command split (explicit in the docs)

| Human-only (interactive) | Agent-compatible (`--json`) |
|---|---|
| `init`, `view` (dashboard), `config edit`, `feedback`, `completion install` | `list`, `show`, `validate`, `status`, `instructions`, `templates`, `schemas`, `new change`, `workset *`, `store *` |

They also ship `openspec context` (assemble the working set) and personal **worksets** — local, named
working views you can open in your tool. And **Stores** (beta): a standalone OpenSpec repo shared across
repos by `git push`, so a cross-repo feature is one change with one plan.

### Their own competitive framing

> **vs. Spec Kit** — "Thorough but heavyweight. Rigid phase gates, lots of Markdown, Python setup."
> **vs. Kiro** — "Powerful but you're locked into their IDE and limited to Claude models."

---

## 4. Beads (`bd`) — the machine-readable-state extreme

**Repo:** https://github.com/steveyegge/beads. Steve Yegge, Oct 2025. *"A magical 4-dimensional graph-based
git-backed fairy-dusted issue-tracker database, designed to let coding agents track all your work and never
get lost again."*

- Storage: embedded Dolt DB at `.beads/embeddeddolt/` (or `.beads/dolt/` server mode). A daemon exports to
  **`.beads/issues.jsonl`** for git interchange — explicitly *"not the source of truth or a backup."*
- Record fields: `id` (hash-based, e.g. `bd-a1b2`), `title`, `status`, `priority`, `type`, `dependencies`,
  `created`/`updated`, `notes`, `assignee`.
- Dependency types: `blocks`, `related`, `parent-child`, `discovered-from`, `duplicates`, `supersedes`,
  `replies-to`. **`discovered-from` is the standout** — it records work found *while doing* other work, which
  is exactly what house's "plan deviation" concept is groping at.
- Commands: `bd ready` ("list tasks with no open blockers"), `bd create "Title" -p 0`,
  `bd update <id> --claim` ("atomically claim a task (sets assignee + in_progress)"), `bd dep add`,
  `bd show <id>` (details + **audit trail**), `bd prime` (inject workflow context + persistent memories),
  `bd remember "insight"`.
- Reported effect: *"Agents have switched from using markdown plans to using the issue tracker exclusively,
  granting them unprecedented continuity from session to session."*

**Lesson:** `bd ready` and `openspec status --json`'s "first `ready` entry" are the same insight from two
directions — **the system should compute the next action, not store a human's guess at it.** house's
`dev-state.md` "next action" line is a hand-maintained cache of something derivable.

Caution: Beads is a full DB with a daemon. That's a lot of machinery for a solo dev. The *JSONL export*
and the *ready-queue query* are the stealable parts; the Dolt engine is not.

---

## 5. Cline memory-bank

Pure-prompt pattern, no tooling. Files in `memory-bank/`, with an explicit **dependency hierarchy**:

```
projectbrief.md  (foundation)
   ├── productContext.md   (why it exists, problems solved, UX goals)
   ├── systemPatterns.md   (architecture, key technical decisions, design patterns)
   └── techContext.md      (stack, setup, constraints, dependencies)
             ↓
      activeContext.md     (current focus, recent changes, next steps, active decisions)
             ↓
        progress.md        (what works, what's left, current status, known issues)
```

Quality bar from the prompt, worth stealing verbatim: entries must be *"factual with no assumptions, only
verified information; complete with sufficient context for a fresh session; unambiguous with no room for
multiple interpretations; and current, reflecting actual project state."*

`activeContext.md` ≈ house `dev-state.md`; `progress.md` ≈ the Done section; `systemPatterns.md` ≈ the ADR
corpus flattened. Notably Cline **splits durable-context from operational-state at the file level** — the
same instinct behind house's dev-state/roadmap allowlist split, and evidence that split is correct.

Weakness: it's prose all the way down, updated only when the human says "update memory bank." Same class of
failure as house today.

---

## 6. Cursor rules & AGENTS.md — the context-loading standard

### Cursor `.cursor/rules/*.mdc`

MDC frontmatter, exactly three fields — `description`, `globs`, `alwaysApply` — producing four rule types:

| Type | `alwaysApply` | `description` | `globs` | Behavior |
|---|---|---|---|---|
| Always | `true` | — | — | in every session |
| Auto Attached | `false` | — | provided | attaches when a matching file is touched |
| Agent Requested | `false` | provided | — | model decides from the description |
| Manual | `false` | — | — | only on `@`-mention |

Guidance: keep rules **under 500 lines**, "focused, actionable, and scoped"; reference files rather than
duplicating; don't restate what a linter enforces. Nested rules per subdirectory; precedence
Team → Project → User. Remote imports of `.mdc` from GitHub.

This is the **same four-mode taxonomy as Kiro steering** (`always` / `fileMatch` / `auto` / `manual`) and the
same shape as Claude `SKILL.md` (`description` drives model-invoked loading; `disable-model-invocation`
forces manual). **Three independent vendors converged on identical semantics — treat this as settled.**

### AGENTS.md

Formalized Aug 2025 (OpenAI + Google + Cursor + Factory + Sourcegraph); under the Linux Foundation's
**Agentic AI Foundation** since Dec 2025 alongside MCP. 60,000+ public repos by May 2026; read natively by
Codex, Copilot, Cursor, Claude Code, Jules/Gemini, Amp, Windsurf, Zed, RooCode, Aider.
**Deliberately schema-free** — plain markdown, no required structure, nested files with precedence cascading
upward.

Implication for house v2: the *entry point* is a solved, standardized, zero-structure file. Don't invent a
competing one. Put house's machine-readable state somewhere else and have AGENTS.md/CLAUDE.md point at it.

---

## 7. BMAD-METHOD

Multi-agent "AI agile": PM/Architect/SM/Dev/QA personas. Two things matter here:

**(a) Sharding.** The big PRD and architecture docs are broken into **individual self-contained story files**.
Each story carries its rationale, explicit constraints, embedded tests, and links back to source docs. The
Scrum-Master agent drafts the next story from sharded epics + architecture; the Dev agent implements and
marks it "Ready for Review."

**(b) An explicit story status state machine** — and the instructive part is that **BMAD has bugs from not
pinning it down**:
- Documented in two forms: `Draft → Approved → InProgress → Done`, and a longer
  `backlog → drafted → ready-for-dev → in-progress → review → done`.
- [Issue #1105](https://github.com/bmad-code-org/BMAD-METHOD/issues/1105): *"dev-story workflow uses 'Ready
  for Review' but canonical status is 'review'"*.
- [Issue #496](https://github.com/bmad-code-org/BMAD-METHOD/issues/496): *"Dev agent fails to update story
  status due to conflicting instructions in dev.md"*.

**Lesson:** a status vocabulary that isn't a single normative enum in a single file *will* drift between the
agents that write it. This is a direct warning about house's builder 4-state report and the plan-check
GO/GO-WITH-FIXES/NO-GO verdict — if v2 persists them, the enum needs exactly one definition and a validator.

---

## 8. Google Antigravity — the IDE-native artifact model (most relevant to Jake's IDE)

**Docs:** https://antigravity.google/docs/artifacts

Antigravity's core concept is the **Artifact**: *"a structured deliverable created by the agent to accomplish
its task and communicate its progress."* Artifact types:

- **Implementation Plans** — rich markdown plans
- **Task Lists** — "structured plans the agent creates before coding, showing the sequence of steps it
  intends to follow"; created *after* the implementation plan is approved
- **Walkthroughs** — created *after* coding: "a concise summary of the changes that have been made,"
  explaining what the agent did and verifying results
- Code diffs, architecture diagrams, images, **browser recordings**

The **Agent Manager** (Antigravity 2.0) is a standalone app — a command center for multiple parallel local
agents and scheduled tasks, deliberately decoupled from the editor.

**This is the closest existing thing to Jake's desktop IDE**, and its lesson is a vocabulary lesson: the unit
the UI lists is not "a file," it's **an artifact with a type and a lifecycle position** (plan → task list →
walkthrough). The side pane doesn't tail a directory; it renders a typed stream. It also independently
invents "walkthrough" ≈ house's retro, and places it at the same point in the loop.

---

## 9. Tessl — the maximalist position (and a caution)

Spec Registry (open beta) + Tessl Framework (closed beta, plugs into agents via MCP). Thesis: *the spec
becomes the artifact you maintain, and code becomes a regenerable output* stamped
`// GENERATED FROM SPEC - DO NOT EDIT`. The Registry distributes 10,000+ "usage specs" for OSS libraries so
agents consume dependencies correctly.

Status mid-2026: **the Framework still hasn't reached GA after ~9 months in closed beta.** The Registry (a
read-only knowledge artifact) shipped; the regenerate-code-from-spec loop did not. Read that as evidence:
full spec→code regeneration is not a 2026-viable target. **Deltas and reconciliation are; regeneration isn't.**

---

## 10. Cross-cutting analysis

### 10.1 Where the metadata lives — three answers

| Approach | Examples | Verdict |
|---|---|---|
| **Prose key-value in the body** (`**Status**: Draft`) | spec-kit, house today | ✗ rots — nothing owns the write |
| **YAML frontmatter** | Kiro steering, Cursor `.mdc`, `SKILL.md`, BMAD stories | ✓ standard for *context-loading* metadata |
| **Sidecar config + derived status** | OpenSpec (`config.yaml`, `.openspec.yaml`, `status --json`), Beads (JSONL) | ✓ standard for *lifecycle/progress* |

The important distinction the winners make: **declared metadata is authored (frontmatter); derived status is
computed (CLI).** Nobody successful hand-writes progress. house currently hand-writes everything.

### 10.2 The naming convergence

| Role | spec-kit | Kiro | OpenSpec | BMAD | house today |
|---|---|---|---|---|---|
| Principles / always-context | `constitution.md` | `steering/*.md` | `config.yaml: context` | core-config | CLAUDE.md + doctrine.md |
| WHY | (in spec.md) | (in requirements.md) | `proposal.md` | PRD | (implicit) |
| WHAT | `spec.md` | `requirements.md` | `specs/**/spec.md` | sharded epics | `docs/superpowers/specs/` |
| HOW | `plan.md` | `design.md` | `design.md` | architecture | `docs/superpowers/plans/` |
| TASKS | `tasks.md` | `tasks.md` | `tasks.md` | story files | (inside plan) |
| Post-hoc summary | — | — | archive summary | — | `docs/retros/` |
| Decisions | constitution | — | (in design.md Decisions) | — | `docs/adr/` |

**`tasks.md` is universal.** `design.md` is 2-for-3. house's ADR corpus and retros are *differentiators* —
only house and (partly) Antigravity's walkthroughs have a post-hoc artifact, and nobody else has ADRs as a
first-class lane. Keep those.

### 10.3 The unit-of-change identity problem — solved conventions

house's "two 'Slice N' series can coexist with nothing disambiguating" is solved three ways in the wild:

1. **Zero-padded ordinal + slug directory**: `specs/003-photo-albums/` (spec-kit). Ordering is free; identity
   is the directory name; all artifacts inherit it.
2. **Slug-only directory, date applied at archive**: `changes/add-dark-mode/` →
   `changes/archive/2025-01-23-add-dark-mode/` (OpenSpec). Live changes read well; archived ones sort by ship
   date.
3. **Hash IDs** (`bd-a1b2`, Beads) — collision-free, unreadable.

All three make **the directory the identity** and **every artifact a file inside it**. house's flat
`docs/superpowers/specs/2026-06-30-house-shaper-design.md` + `plans/2026-06-30-house-shaper.md` +
`retros/2026-06-30-house-shaper-retro.md` spreads one unit across three trees with three naming conventions
and no enforced join key. That is the root cause of the retro-filename-key and mockup-path weaknesses
simultaneously.

### 10.4 The universal, unsolved problem: closing the loop

Every single tool surveyed is criticized for spec drift. Only OpenSpec has a *mechanism* rather than an
*intention*: the archive-merge. The pattern named in the 2026 literature is **"synchronization, an owner, a
gate"** — a sync step, a named owner for it, and a gate that fails if it didn't happen. house has the sync
(reconcile subagent) and arguably the owner (builder/orchestrator) but **no gate** — nothing fails when
checkboxes are unticked and Status says Draft.

---

## 11. What house v2 should steal

Ordered by leverage. Each is tied to a known house weakness.

### S1. Make the unit of change a **directory**, and make that directory the ID
> *Fixes: ambiguous slice identity, retro filename key, mockup path, spec/plan/retro join.*

```
docs/slices/0007-dfs-oom-mlb/
├── slice.yaml          # the manifest (see S2)
├── brief.md            # WHY  (shaper)
├── spec.md             # WHAT (shaper)
├── plan.md             # HOW + tasks (shaper)
├── plan-check.md       # the GO verdict, PERSISTED (see S3)
├── mockups/            # ← the unspecified path, now specified
│   └── 01-optimizer-panel.html
├── units/
│   └── 02-cap-pool/report.md    # builder's 4-state report, PERSISTED
└── retro.md            # reconcile
```

Adopt spec-kit's `NNNN-kebab-slug` (zero-padded, monotonic, never reused). Everything else derives from it:
branch `slice/0007-dfs-oom-mlb`, retro is `retro.md` *inside* it, mockups are `mockups/*.html` *inside* it.
No naming key to define, because there are no names to key.

### S2. One `slice.yaml` manifest per slice — the machine-readable spine
> *Fixes: no frontmatter/manifest/event log; unparseable state; IDE discovery.*

```yaml
id: "0007"
slug: dfs-oom-mlb
title: "DFS optimizer MLB /dfs OOM fix"
kind: slice            # slice | adr-only | audible | spike
stage: shipped         # shaping | planned | building | gating | shipped | abandoned
created: 2026-07-20
shipped: 2026-07-28
branch: slice/0007-dfs-oom-mlb
pr: 142
adrs: [0004]
artifacts:
  brief:      { path: brief.md,      status: done }
  spec:       { path: spec.md,       status: done }
  plan:       { path: plan.md,       status: done }
  plan_check: { path: plan-check.md, status: done, verdict: GO-WITH-FIXES }
  mockups:    { path: "mockups/*.html", status: skipped, reason: "backend-only" }
  retro:      { path: retro.md,      status: done }
units:
  - id: "01"; title: "cap auto-optimizer pool"; status: merged; commit: ea0169a
  - id: "02"; title: "surface server-action errors"; status: merged; commit: 7693a2b
```

Copy OpenSpec's status vocabulary verbatim — **`done` / `ready` / `blocked` / `skipped`** — and copy
`skip_specs`' most important property: **a skip must be *declared with a reason*, and it drops out of the
progress denominator.** That single rule kills "11/13 plans 100% unchecked": either the artifact is done, or
it's explicitly skipped with a reason, and there is no third silent state.

Prefer YAML frontmatter *inside* the markdown over a sidecar wherever the metadata is per-document
(spec/plan/retro `status`), and the sidecar `slice.yaml` for the slice-level rollup. Frontmatter is the
converged standard (Kiro/Cursor/SKILL.md) and renders invisibly in every markdown viewer, including Jake's IDE.

### S3. Persist every verdict and report as a file — never conversation-only
> *Fixes: plan-check verdicts and builder 4-state reports evaporating.*

`plan-check.md` and `units/NN/report.md` with **frontmatter carrying the enum**:

```markdown
---
verdict: GO-WITH-FIXES     # GO | GO-WITH-FIXES | NO-GO
checked: 2026-07-21
fixes_required: 2
---
```

And take BMAD's warning seriously: define each enum **once**, in doctrine, as a normative list, and have the
validator (S5) reject any other value. BMAD shipped 'Ready for Review' vs 'review' bugs precisely because two
agent files each restated the vocabulary.

### S4. Split in-flight from truth, and make **shipping** the thing that updates the spec
> *Fixes: `Status: Draft` on shipped slices — the deepest weakness.*

Steal OpenSpec's archive-merge wholesale. Don't add a `Status: Shipped` field and hope. Instead:

- `docs/slices/NNNN-*/` = in-flight; `docs/slices/archive/YYYY-MM-DD-NNNN-*/` = shipped.
- A slice's spec is written as **deltas against `docs/spec/<capability>.md`** — `## ADDED Requirements`,
  `## MODIFIED Requirements` (full content), `## REMOVED Requirements` (with `**Reason**` and
  `**Migration**`), `## RENAMED Requirements`.
- The merge-gate's final step merges deltas into `docs/spec/` and moves the folder.

The status field becomes *unnecessary*, because location is status. That's strictly more robust than any
field a prose-writing agent has to remember to update. It also gives house something it currently lacks
entirely: **a current-state system spec** as opposed to a pile of per-slice design docs.

Keep the delta format's structural rules and enforce them (`#### Scenario:` exactly 4 hashes; every
requirement has ≥1 scenario; MODIFIED carries full content).

### S5. Ship a `house` CLI whose whole job is `status --json` and `validate --json`
> *Fixes: everything the IDE needs; unticked checkboxes; heading drift; dev-state allowlist enforcement.*

This is the highest-leverage single item. Minimal surface, modeled directly on OpenSpec's:

```
house status [--slice NNNN] [--json]     # derived stage, next ready artifact, unit states, checkbox %
house list [--json]                      # all slices, stage, title — the IDE home screen
house validate [--all] [--strict --json] # structural gate; exit 1 on violation
house next [--json]                      # the single next action, computed (Beads' `bd ready`)
house doctor [--json]                    # health sweep: drift, orphans, stale branches
```

`validate` is the **gate** the sync-owner-gate mechanism says is missing. Rules to enforce, each mapped to a
real house failure:

| Rule | Weakness it kills |
|---|---|
| `dev-state.md` headings ⊆ allowlist, exactly | heading drift |
| Every `slice.yaml` artifact is `done` or `skipped`+`reason` | silent gaps |
| A slice at `stage: shipped` has 0 unticked plan checkboxes (or a declared deviation) | 11/13 unchecked plans |
| A shipped slice has `retro.md` present and non-empty | retro discipline |
| Verdict/status enums ∈ the normative list | BMAD-class drift |
| Every `mockups/*` is inside the slice dir | 2 dirs × 4 naming styles |
| Every requirement has ≥1 `#### Scenario:` | spec vagueness |

Run it in the merge gate and in a git pre-push hook. **If it doesn't fail the build, it will rot.**

### S6. Make the process itself data — a `workflow.yaml` artifact schema
> *Fixes: skills restating the process in prose in three places (the source of every "unspecified" weakness).*

Steal OpenSpec's `schema.yaml` shape: artifacts with `id`, `generates` (glob), `template`, `requires` (DAG),
`instruction`. Today house-shaper, house-orchestrator and doctrine.md each narrate the artifact set in prose;
the mockup-path weakness exists because *none of them* narrated it. With one schema file:

- the CLI derives status and the next-ready artifact from it,
- the validator derives its rules from it,
- the skills *read* it instead of restating it,
- the IDE renders it as a pipeline,
- and "the mockup output path" is a line of YAML, not an omission.

This also directly serves the "rigor dial" both Kiro (Quick Spec) and OpenSpec (progressive rigor) shipped
after users complained about ceremony: variant schemas — `full` / `express` / `adr-only` / `hotfix` — declared
as data, with `kind:` in `slice.yaml` selecting one.

### S7. An append-only event log — `docs/.house/events.jsonl`
> *Fixes: no event log; audit trail; IDE live updates.*

One JSON object per line, written by the orchestrator/builder at every stage transition:

```json
{"ts":"2026-07-28T14:02:11Z","slice":"0007","unit":"02","event":"unit.merged","actor":"house-builder","commit":"7693a2b"}
{"ts":"2026-07-28T14:06:40Z","slice":"0007","event":"gate.passed","verdict":"GO","panel":["review","security"]}
{"ts":"2026-07-28T14:19:02Z","slice":"0007","event":"slice.shipped","pr":142}
```

Cheap (append-only, git-friendly, merge-conflict-light), and it's what the IDE tails to update the side pane
live without polling the filesystem. Steal Beads' `discovered-from` idea as an event type
(`work.discovered`, with `from`) — that's house's "plan deviation, surface it never absorb it" made
machine-readable and queryable.

Note Beads' own framing: the JSONL is the *interchange* format, not the source of truth. Same here — the log
is derived/append-only; `slice.yaml` + the files are truth. Rebuildable from git history if lost.

### S8. Kiro-style transclusion instead of duplication
> *Fixes: doc drift between dev-state / roadmap / spec.*

Adopt `#[[file:path]]` (or a house equivalent) so `dev-state.md` *points at* the active slice's manifest
rather than restating its title/stage/next-action. The dev-state allowlist becomes much easier to satisfy
when most of its content is a live pointer. This is the mechanical version of house's existing "one job per
doc" rule.

### S9. Steal the vocabulary, not just the structure

- **`constitution.md` / steering split**: house's doctrine.md is the constitution; consider splitting the
  *project-specific* half into `product.md` / `tech.md` / `structure.md`-style steering with
  `inclusion: always | fileMatch | manual` frontmatter. This is the 3-vendor-converged standard and it makes
  context loading legible in the IDE.
- **`[P]` parallel markers + `[US1]` story links** on plan tasks (spec-kit): lets the orchestrator dispatch
  parallel builders from the plan file itself, and lets the validator check every task traces to a
  requirement.
- **Dependency waves** (Kiro): the correct execution model for a plan whose tasks declare `requires`.
- **Antigravity's artifact vocabulary** — plan → task list → walkthrough — for the IDE side pane. The pane
  lists *typed artifacts with lifecycle positions*, not files.
- **Cline's quality bar** for any state doc, verbatim: factual / complete for a fresh session / unambiguous /
  current.

### S10. Anti-patterns to explicitly design against

1. **Don't add artifacts.** spec-kit's most-upvoted criticism is volume. house already has 7 doc types;
   v2 should *net-reduce* per-slice files by folding them into one directory, not add a manifest on top of an
   unchanged pile.
2. **Don't gate small work.** *"I just wanted to change a button color."* `kind: hotfix` must be a
   first-class, 1-artifact path.
3. **Don't aim for spec→code regeneration.** Tessl has been in closed beta 9 months. Deltas + reconciliation
   are the shippable version.
4. **Don't define an enum twice.** BMAD #1105 / #496.
5. **Don't rely on an agent remembering to tick a box.** Kiro #6826 proves the CLI-vs-IDE split: whatever
   doesn't own the write, doesn't get written. Either the builder ticks as a validated obligation, or the
   tooling ticks it.
6. **Don't put machine state in prose and hope a parser is written later.** Every tool that tried this
   (spec-kit's `**Status**: Draft`, house today) has the same stale-status bug.

---

## 12. Sources

- GitHub spec-kit — https://github.com/github/spec-kit ·
  [spec-template.md](https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md) ·
  [plan-template.md](https://github.com/github/spec-kit/blob/main/templates/plan-template.md) ·
  [tasks-template.md](https://github.com/github/spec-kit/blob/main/templates/tasks-template.md) ·
  [checklist-template.md](https://raw.githubusercontent.com/github/spec-kit/main/templates/checklist-template.md) ·
  [spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md)
- spec-kit criticism — [Discussion #1784 "illusion of work"](https://github.com/github/spec-kit/discussions/1784) ·
  [Discussion #1686 "High Level Design Concerns"](https://github.com/github/spec-kit/discussions/1686) ·
  [Discussion #1482 "Is SpecKit really maintained?"](https://github.com/github/spec-kit/discussions/1482)
- Microsoft DevBlog — https://developer.microsoft.com/blog/spec-driven-development-spec-kit/
- Den Delimarsky — https://den.dev/blog/github-spec-kit/
- Kiro — https://kiro.dev/docs/specs/ · https://kiro.dev/docs/steering/ ·
  [best practices](https://kiro.dev/docs/specs/best-practices/) · [changelog](https://kiro.dev/changelog/ide/)
- Kiro checkbox drift — https://github.com/kirodotdev/Kiro/issues/6826
- OpenSpec — https://github.com/Fission-AI/OpenSpec ·
  [schemas/spec-driven/schema.yaml](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/schema.yaml) ·
  [docs/cli.md](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md) ·
  [docs/concepts.md](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md) ·
  [docs/customization.md](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/customization.md)
- OpenSpec explained — https://codemyspec.com/blog/openspec-explained · https://codemyspec.com/blog/kiro-vs-openspec
- Beads — https://github.com/steveyegge/beads ·
  [Yegge intro](https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a) ·
  [Better Stack guide](https://betterstack.com/community/guides/ai/beads-issue-tracker-ai-agents/) ·
  [VirtusLab](https://virtuslab.com/blog/ai/beads-give-ai-memory)
- Cline memory bank — https://docs.cline.bot/best-practices/memory-bank ·
  [.clinerules/memory-bank.md](https://github.com/cline/prompts/blob/main/.clinerules/memory-bank.md)
- Cursor rules — https://cursor.com/docs/context/rules
- AGENTS.md — https://agents.md/ · https://codersera.com/blog/agents-md-vs-claude-md-vs-cursor-rules-comparison-2026/
- Claude Code skills/plugins — https://code.claude.com/docs/en/skills ·
  https://deepwiki.com/anthropics/skills/2.3-marketplace-and-plugin-system
- BMAD — [user-guide](https://github.com/cdwbrad/bmad-method/blob/main/docs/user-guide.md) ·
  [workflow map](https://docs.bmad-method.org/reference/workflow-map/) ·
  [#1105 status naming](https://github.com/bmad-code-org/BMAD-METHOD/issues/1105) ·
  [#496 status update failure](https://github.com/bmad-code-org/BMAD-METHOD/issues/496)
- Google Antigravity — https://antigravity.google/docs/artifacts · https://antigravity.google/docs/walkthrough ·
  https://antigravity.google/blog/introducing-google-antigravity
- Tessl — https://tessl.io/blog/tessl-launches-spec-driven-framework-and-registry/ ·
  https://codemyspec.com/blog/tessl-review · https://specdriven.com/landscape/tessl
- Landscape comparisons — [spec-compare research repo](https://github.com/cameronsjo/spec-compare) ·
  [MarkTechPost 9 tools](https://www.marktechpost.com/2026/05/08/9-best-ai-tools-for-spec-driven-development-in-2026-kiro-bmad-gsd-and-more-compare/) ·
  [Augment Code](https://www.augmentcode.com/tools/best-spec-driven-development-tools) ·
  [living vs static specs](https://www.augmentcode.com/guides/living-specs-vs-static-specs) ·
  [SpecOps 2026 @ SPLASH/ISSTA](https://conf.researchr.org/home/splash-issta-2026/specops-2026)
