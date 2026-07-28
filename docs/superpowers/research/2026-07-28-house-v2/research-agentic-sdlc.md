# Research digest — agentic SDLC best practice (2025–2026)

**Purpose:** input to the ground-up redesign of the "house" SDLC skill trio (house-shaper / house-orchestrator /
house-builder) into a version that is IDE-native and machine-readable by design.
**Author:** research subagent. **Date:** 2026-07-28.
**Note on output path:** the orchestrator passed a literal `undefined/` directory; written here instead.

---

## 0. TL;DR — the eight things that actually matter

1. **Verification, not generation, is the bottleneck.** Every credible 2026 source converges on this. The single
   highest-leverage design change to house is making every gate produce a *machine-checkable artifact*, not a
   conversational verdict.
2. **Persist agent state on disk, not in conversation.** This is the universal pattern across Anthropic's
   long-running-agent harness work, the Ralph loop, OpenSpec, Kiro, Antigravity, and durable-execution runtimes.
   House currently violates this at every gate.
3. **Separate "current truth" from "proposed change," and make merge an explicit archive operation.**
   OpenSpec's `specs/` vs `changes/` + archive step is the cleanest known fix for stale spec Status lines.
4. **Checkboxes only get ticked if something ticks them.** Ralph, Kiro, and Anthropic's harness all use a
   *structured* task/feature file that an agent is contractually required to update, with a hook or verifier
   enforcing it. Prose checkboxes with no enforcement are, empirically, never ticked (house: 11/13 plans).
5. **Load-bearing gates are the ones that block a state transition and emit a record.** Everything else is
   ceremony. Industry consensus on load-bearing: (a) plan approval before implementation, (b) automated
   verification (tests/build/lint) before "done," (c) an adversarial fresh-context review of the diff before
   merge, (d) human approval on irreversible actions. Ceremony: status meetings, prose retros nobody reads,
   sign-offs with no artifact, "did you follow the process?" checklists.
6. **Decompose by context boundary, not by process phase.** Anthropic explicitly warns against splitting
   planning/implementation/testing into separate agents *unless* the handoff artifact is self-contained enough
   to carry the context. House's shaper→builder split is only safe because the plan is the handoff artifact —
   which makes plan completeness a first-class quality property, not a nicety.
7. **The IDE's job is to be the observability plane.** Claude Code already emits a rich, structured event stream
   (hooks + `stream-json` + transcript JSONL). An IDE that consumes it can render the entire SDLC state without
   the skills ever having to "report" anything to it.
8. **Right-size the ceremony.** SDD's own practitioners say the overhead isn't worth it for small changes. House
   v2 needs an explicit *tier* concept (decision-only / small / slice / epic) baked into the schema, not a
   convention.

---

## 1. Anthropic's own published guidance

### 1.1 Claude Code best practices — <https://code.claude.com/docs/en/best-practices>

The doc is organized around one constraint, stated first:

> "Most best practices are based on one constraint: Claude's context window fills up fast, and performance
> degrades as it fills."

Load-bearing extracts:

**Give Claude a way to verify its work** — this section is the spine of the whole doc.

> "Claude stops when the work looks done. Without a check it can run, 'looks done' is the only signal available,
> and you become the verification loop: every mistake waits for you to notice it."

It then gives an explicit *escalation ladder of gate strength*, which is directly transplantable to house v2:

| Gate strength | Mechanism | Property |
|---|---|---|
| Weakest | Ask Claude to run the check in the same prompt | Advisory |
| ↓ | `/goal` condition — a separate evaluator re-checks after every turn | Persistent within session |
| ↓ | **Stop hook** — runs your check as a script and *blocks the turn from ending* until it passes | Deterministic |
| Strongest | **Verification subagent** — "a fresh model try to refute the result, so the agent doing the work isn't the one grading it" | Independent |

> "Have Claude show evidence rather than asserting success: the test output, the command it ran and what it
> returned, or a screenshot of the result."

**Explore → Plan → Implement → Commit.** Four phases, with plan mode enforcing read-only during explore/plan.
Crucially it also states when *not* to plan:

> "Planning is most useful when you're uncertain about the approach, when the change modifies multiple files, or
> when you're unfamiliar with the code being modified. If you could describe the diff in one sentence, skip the plan."

**Specs.** On the interview → SPEC.md → fresh session pattern:

> "The most useful specs are self-contained: they name the files and interfaces involved, state what is out of
> scope, and end with an end-to-end verification step that proves the feature works. Time spent making the spec
> precise pays off more than time spent watching the implementation."

**Hooks vs CLAUDE.md.** The key distinction for gate design:

> "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens."

**Adversarial review.** And a warning against over-gating:

> "A reviewer prompted to find gaps will usually report some, even when the work is sound, because that is what
> it was asked to do. Chasing every finding leads to over-engineering… Tell the reviewer to flag only gaps that
> affect correctness or the stated requirements, and treat the rest as optional."

**Named failure patterns** (all five map onto house risks): kitchen-sink session; correcting over and over
("after two failed corrections, `/clear` and write a better initial prompt"); over-specified CLAUDE.md; the
trust-then-verify gap ("If you can't verify it, don't ship it"); infinite exploration.

### 1.2 Effective harnesses for long-running agents — <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>

This is the most directly applicable Anthropic piece to house v2, because it is about *multi-session* work.

Architecture: an **initializer agent** (runs once, sets up environment) + a **coding agent** (makes incremental
progress every session). The initializer produces three artifacts:

- `init.sh` — environment setup script
- `claude-progress.txt` — narrative progress log
- an initial git commit as baseline

Plus the key one: a **JSON feature list** with 200+ granular requirements, each carrying a `passes` field.

> "Each new session begins with no memory of what came before."

> "It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."

Session startup protocol (a literal resume contract):

1. `pwd`
2. "Read the git logs and progress files to get up to speed"
3. "Read the features list file and choose the highest-priority feature"
4. Run `init.sh` and do a basic end-to-end verification

Work discipline: **one feature at a time**. The failure mode they were fixing was agents trying "to one-shot the
app," which "led to the model running out of context in the middle." Exit criterion per session:

> "code that would be appropriate for merging to a main branch: there are no major bugs, the code is orderly and
> well-documented."

Their own failure→solution table:

| Problem | Solution |
|---|---|
| Premature project completion | Structured feature list with passing/failing status |
| Leaving broken code | Git commits + progress notes at session end |
| Marking incomplete features done | Self-verification via end-to-end testing |
| Time spent on setup | Pre-written `init.sh` |

**This is the strongest single argument for house v2 having a machine-readable unit manifest with a `passes`/
status field per unit.** Anthropic solved "premature completion" with structured state, not with prose.

### 1.3 Multi-agent research system — <https://www.anthropic.com/engineering/multi-agent-research-system>

Orchestrator-worker. Performance: lead Opus + Sonnet subagents beat single-agent Opus by **90.2%** on their
research eval; **token usage alone explains 80% of performance variance**; multi-agent costs **~15×** the tokens
of chat.

Task-description quality is the named failure:

> "simple, short instructions like 'research the semiconductor shortage,' but found these instructions often were
> vague enough that subagents misinterpreted the task or performed the exact same searches as other agents."

Each subagent needs: specific objectives, expected output format, tool/source guidance, explicit task boundaries.

**Artifact systems over conversational returns** — the design pattern house most needs:

> "implement artifact systems where specialized agents can create outputs that persist independently. Subagents
> call tools to store their work in external systems, then pass lightweight references back to the coordinator."

Context handoff:

> agents "summarize completed work phases and store essential information in external memory before proceeding
> to new tasks"; when near limits, "spawn fresh subagents with clean contexts while maintaining continuity
> through careful handoffs."

Checkpointing rationale: the lead agent writes its research plan to memory because "if the context window
exceeds 200,000 tokens it will be truncated and it is important to retain the plan."

Production reliability: full production tracing; resume-from-failure rather than restart; rainbow deployments so
in-flight agents aren't disrupted.

Evals: start with ~20 test cases; LLM-as-judge on a rubric (factual accuracy, citation accuracy, completeness,
source quality, tool efficiency); human validation for edge cases.

### 1.4 When to use multi-agent systems — <https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them>

The cautionary counterweight. Multi-agent wins on: context protection, genuine parallelization, specialization.
Multi-agent loses because:

> "Teams invest months building elaborate multi-agent architectures only to discover that improved prompting on a
> single agent achieved equivalent results."

> "multi-agent implementations typically use 3-10x more tokens than single-agent approaches for equivalent tasks."

**Context-centric decomposition, not problem-centric.** Explicitly names as problematic: "splitting planning,
implementation, and testing into separate agents." Better: keep related work together where context clusters.

Decision checklist before going multi-agent: genuine constraints exist; decomposition follows context
boundaries; **clear verification points exist between agents**.

> "Start with the simplest approach that works, and add complexity only when evidence supports it."

⚠️ **Direct implication for house:** the shaper→orchestrator→builder split *is* a phase split. It survives the
critique only because the plan is a genuinely self-contained handoff artifact. House v2 should treat "is this
plan self-contained enough that a cold builder can execute it?" as the plan-check's *primary* question, and make
the answer machine-readable.

### 1.5 Effective context engineering — <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>

- **Context rot**: "as the number of tokens in the context window increases, the model's ability to accurately
  recall information from that context decreases."
- **Compaction** — first lever; art is in what to keep. Preserve architectural decisions and unresolved bugs;
  discard redundant tool output.
- **Structured note-taking** — "The agent regularly writes notes persisted to memory outside of the context
  window. These notes get pulled back into the context window at later times."
- **Just-in-time retrieval** — store lightweight identifiers (paths, URLs, IDs), load at runtime. This is
  precisely the argument for a *manifest of pointers* rather than a fat always-loaded doc.
- **Sub-agents** — "each subagent might explore extensively… but returns only a condensed, distilled summary of
  its work (often 1,000-2,000 tokens)."
- **Tools** should be "self-contained, robust to error, and extremely clear with respect to their intended use."

### 1.6 How Claude Code is used in practice (n≈400k sessions) — <https://www.anthropic.com/research/claude-code-expertise>

Empirical, and it validates the house division of labor:

- **"people make about 70% of the planning decisions but only 20% of the execution decisions."**
- Expert sessions: "action chains more than twice as long (12 actions) carrying five times the output (3,200
  words)" vs ~600 words for novices.
- ~4 conversational turns typical; ~10 Claude actions per user prompt, sometimes >100.
- Verified success: novice-rated sessions 15%; intermediate/expert 28–33%. Novices abandon at "several times"
  higher rates when problems appear.
- Debugging fell from 33% → 19% of sessions over seven months.

The 70/20 split is the empirical justification for house's gate placement: **gate on planning decisions, not
execution decisions.**

### 1.7 Agent teams — <https://code.claude.com/docs/en/agent-teams>

Experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), but the *state model* is the interesting part for an
IDE build:

- Team config: `~/.claude/teams/{team-name}/config.json`
- Mailboxes: `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`
- **Task list: `~/.claude/tasks/{team-name}/`** — persists across resume, never uploaded
- Team name is derived: `session-` + first 8 chars of session ID
- Tasks have three states (pending / in-progress / completed) **plus dependencies**; a pending task with
  unresolved deps cannot be claimed. Claiming uses **file locking** against races.
- Quality gates via hooks: `TeammateIdle`, `TaskCreated`, `TaskCompleted` — "Exit with code 2 to prevent
  completion and send feedback."
- Plan approval for teammates: teammate works read-only until the lead approves; rejection returns it to plan
  mode with feedback.

Sizing guidance: 3–5 teammates, **5–6 tasks per teammate**; "Three focused teammates often outperform five
scattered ones." Tasks should be "self-contained units that produce a clear deliverable."

Known limitation worth designing around: **"Task status can lag: teammates sometimes fail to mark tasks as
completed, which blocks dependent tasks."** — i.e. even Anthropic's own first-party task system suffers house's
unticked-checkbox problem when nothing enforces the transition. `TaskCompleted` hooks exist precisely for this.

### 1.8 Hooks — <https://code.claude.com/docs/en/hooks> — the IDE integration surface

This is the single most useful reference for the IDE half of the project. Every hook payload includes:

```json
{
  "session_id": "...", "prompt_id": "...",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/working/directory",
  "permission_mode": "default|plan|auto|dontAsk|acceptEdits|bypassPermissions",
  "hook_event_name": "EventName",
  "effort": { "level": "low|medium|high|xhigh|max" }
}
```

Events an SDLC IDE would consume or enforce with:

| Event | Payload highlights | Blocking? |
|---|---|---|
| `SessionStart` | `source: startup\|resume\|clear\|compact\|fork`, `model`, `agent_type`, `session_title` | can inject `additionalContext`, `initialUserMessage`, `watchPaths`, `sessionTitle` |
| `SessionEnd` | `source`, `exit_reason` | no — side effects only |
| `UserPromptSubmit` | `user_prompt`, `prompt_id` | yes (`decision: block`) |
| `PreToolUse` | `tool_name`, `tool_use_id`, `tool_input` | yes — `permissionDecision: allow\|deny\|ask\|defer`, plus `updatedInput` to rewrite args |
| `PostToolUse` / `PostToolUseFailure` | `tool_output` / `tool_error` | yes; `updatedToolOutput` can rewrite before Claude sees it |
| `PostToolBatch` | all parallel calls | yes — can stop the agentic loop before the next model call |
| `Stop` | `last_assistant_message`, `final_tool_calls` | **yes — this is the "definition of done" gate** |
| `SubagentStop` | `agent_id`, `agent_type` | yes — per-builder DoD gate |
| `TaskCreated` / `TaskCompleted` | `task_id`, `task_description`, `result` | yes — rollback creation / prevent completion |
| `TeammateIdle` | `agent_type`, `agent_id` | yes |
| `FileChanged` | `file_path`, `change_type` | no — **register paths via `watchPaths` from SessionStart** |
| `Notification` | `notification_type` (`permission_prompt`, `agent_needs_input`, …) | no |
| `PreCompact` / `PostCompact` | `manual\|auto` | PreCompact can block |

Exit-code semantics: **exit 0 = success (JSON processed), exit 2 = blocking error (stderr becomes the reason),
anything else = non-blocking error.** "Exit 1 does NOT block — use exit 2 for enforcement." Claude Code
overrides a Stop hook after 8 consecutive blocks.

Hook types: `command`, `http`, `mcp_tool`, `prompt`, `agent`. Matchers support permission-rule syntax
(`"if": "Edit(*.ts)"`).

**IDE design consequence:** the side pane never needs the skills to "tell" it anything. A `PostToolUse` matcher
on `Write|Edit` filtered to `docs/**` gives auto-open-on-create for specs/plans/mockups for free. `FileChanged`
+ `watchPaths` gives live re-render. `SessionStart`/`SessionEnd` give the session lifecycle. `Stop` gives the
gate. Everything else is derived.

Also relevant: non-interactive mode emits `--output-format stream-json` (one JSON object per line, starting with
an init event) — a second, richer event source for an embedded terminal pane, and the `transcript_path` in every
hook payload points at the session JSONL.

---

## 2. The industry's spec-driven development wave

By 2026 essentially every vendor shipped an SDD flavor: GitHub Spec Kit, AWS Kiro, OpenSpec, BMAD, Tessl, Google
Antigravity, Cursor. The recurring phrase is **"the spec is the prompt."**

### 2.1 GitHub Spec Kit — <https://github.com/github/spec-kit>

Four commands, four phases: `/specify` → `/plan` → `/tasks` → `/implement`. Specs become "the artifact that
drives code generation." GitHub reports teams using Spec Kit internally ship "with roughly an order-of-magnitude
fewer 'regenerate from scratch' cycles than ad-hoc prompting."

House already has specify/plan. It lacks a *first-class `tasks` artifact distinct from the plan prose* — which is
exactly the missing thing that would make checkboxes tickable and progress observable.

### 2.2 AWS Kiro — the closest analogue to what Jake is building

Kiro is a spec-driven agentic **IDE** where "the unit of work isn't a prompt — it's a structured specification."
Three files per spec, with explicit traceability:

- `requirements.md`
- `design.md`
- `tasks.md` — "a detailed task-level perspective and ensures traceability of tasks to the previously defined
  requirements"

Plus two mechanisms house lacks:

- **Steering files** — persistent convention docs "fed to LLM as context" alongside code, chat history, and
  prompt. (House's doctrine.md is a steering file that isn't wired in as one.)
- **Agent hooks** — "automate repetitive tasks like updating documentation when code changed… responding to file
  and workspace events." This is Kiro's answer to doc staleness: *events, not discipline*.

Sources: <https://builder.aws.com/content/3DbBI7LQgNIcs6UUj7IPPvqFHOp/aws-kiro-the-agentic-ide-that-makes-specs-the-unit-of-work>

### 2.3 OpenSpec — the best answer to house's stale-spec problem

<https://openspec.pro/workflow/> · <https://github.com/Fission-AI/OpenSpec>

The critical structural idea:

- `openspec/specs/` — **current truth**
- `openspec/changes/<change-id>/` — **proposed updates**, containing `proposal.md`, `design.md`, `tasks.md`,
  and `specs/` **deltas** organized by capability
- `openspec/changes/archive/` — where a change goes on completion

> "Archiving merges the approved updates back into specs."
> "Moves the change from `changes/` to `changes/archive/`" and "Updates the main specs in `openspec/specs/`."

Proposal format is four fixed fields: **Why / What / Scope / Success criteria**.

They also brag about *brevity* as a feature: "OpenSpec generates concise specs (~250 lines) compared to other
tools (~800 lines)."

⚠️ **This is the single highest-value pattern in this digest for house v2.** House's "spec Status: Draft on a
shipped slice" bug is structural, not a discipline failure: house keeps one document that is simultaneously the
proposal and the truth, so there is no operation whose *definition* is "make this true." OpenSpec makes merge a
directory move plus a delta application. A directory move is checkable; a Status: line edit is not.

### 2.4 SDD's own critics

Worth internalizing so v2 doesn't over-build:

- "Spec maintenance is real overhead — once you have a spec and an implementation, you now have two things that
  need to stay in sync."
- "SDD suits larger features and greenfield work; for a small bug fix, the spec overhead isn't worth it."
- "Agents don't always follow specs — even with a detailed spec, the agent occasionally ignored constraints… the
  spec improved the hit rate but did not guarantee compliance."
- A live 2026 debate: SOTA agents can now do the spec-kit steps autonomously, cheaper and faster.

The surviving justification is alignment over time, not one-shot quality: "the real challenge is keeping
requirements, design, implementation, and validation aligned so the final result still reflects the original
intent."

Sources: <https://thebcms.com/blog/spec-driven-development> · <https://developer.microsoft.com/blog/spec-driven-development-ai-native-engineering/>

---

## 3. Autonomous loop patterns

### 3.1 Ralph — <https://ghuntley.com/ralph/>

```bash
while :; do cat PROMPT.md | claude-code ; done
```

State lives entirely on disk:

- `@PROMPT.md` — the invariant instruction set replayed every iteration
- `@fix_plan.md` — "a prioritized bullet-point list of incomplete work, continuously updated after each loop"
- `@AGENT.md` — learned build/test commands
- `@specs/*` — behavioral specifications
- git history — the actual memory

> "To get good outcomes with Ralph, you need to ask Ralph to do one thing per loop. **Only one thing**."

> "The items that you want to allocate to the stack every loop are your plan ('@fix_plan.md') and your
> specifications."

Backpressure mechanisms (Huntley's word for verification): run the unit's tests after changing it; **search the
codebase before implementing** ("don't assume an item is not implemented"); capture *why* in docs as notes for
future iterations; hard anti-placeholder instruction; **fan out up to 500 subagents for search/write but only 1
for build/test** to avoid backpressure collapse.

Failure modes named: search non-determinism → duplicate implementations; context exhaustion (practical limit
"147k–152k" despite a 200k window); wrong generation implies a flawed spec, not a flawed model; "You'll wake up
to a broken codebase that doesn't compile from time to time," recovered by `git reset --hard`.

Honest scope limits:

> "There's no way in heck would I use Ralph in an existing code base."
> "Engineers are still needed… Anyone claiming that engineers are no longer required… is peddling horseshit."

**What house should steal from Ralph:** the *invariant prompt + mutable on-disk plan* separation, one-unit-per-
iteration discipline, and the "search before implementing" backpressure rule. **What it should not steal:**
unbounded eventual consistency on an existing codebase.

Related: the snarktank/ralph implementation formalizes this with `prd.json` + `progress.txt` — again, structured
state file + narrative log, side by side. <https://github.com/snarktank/ralph>

### 3.2 Durable execution / event sourcing

The mainstream-infra answer to the same problem, now being applied to agent runtimes:

> "Workflow history is an append-only event log that captures every important action during execution."
> "Event sourcing is the bridge: every state transition becomes an append-only event that can reconstruct the run."
> "The runtime records meaningful execution boundaries: the model response used for a decision, the exact tool
> input, the result receipt, **the approval decision**, the checkpointed graph state, or the completed workflow
> step. After a crash, the agent resumes from the recorded boundary rather than guessing from logs or redoing
> unsafe work."

Note "the approval decision" being explicitly listed as a recordable boundary — that is exactly house's
plan-check verdict and builder 4-state report, which currently vanish with the conversation.

Sources: <https://hatchet.run/blog/durable-execution> ·
<https://zylos.ai/research/2026-04-24-replayable-agent-runtimes-event-sourced-execution/>

---

## 4. Gates: load-bearing vs ceremony

### 4.1 The verification bottleneck

The dominant 2026 framing:

> "The bottleneck in agentic development is verification, not generation."
> "The bottleneck has moved from writing code to deciding whether code is safe to merge."

Data points: **85% of surveyed teams say code review is the new bottleneck**; Faros AI's 2026 benchmarks found
**AI-generated PRs wait 4.6× longer before a reviewer picks them up**.

> "The teams pulling ahead in 2026 are those that have invested in review infrastructure: automated first-pass
> gates, risk-based triage, explicit review SLAs, and disciplined PR sizing."

Sources: <https://thenewstack.io/merge-gate-coding-agents/> (Arjun Iyer, 2026-07-11) ·
<https://blog.codacy.com/ai-breaking-code-review-how-engineering-teams-survive-pr-bottleneck>

### 4.2 Harness engineering — <https://www.faros.ai/blog/harness-engineering>

**Agent = Model + Harness.** Five layers:

| Layer | Function |
|---|---|
| Tool orchestration | "Controls how agents select, chain, and execute tools" |
| **Verification loops** | "Automated quality assurance steps (e.g., unit tests, self-critique) evaluated during execution" |
| Context & memory | "index codebases and persist session history, ensuring agents adhere to company patterns" |
| Guardrails | "Hardcoded limits, security sandboxes, budget ceilings, and human-in-the-loop controls" |
| Observability | "Telemetry, execution tracing, and audit logs to debug failures and prove system reliability" |

Verification loops "catch hallucinations and logical flaws immediately rather than at the end of a long run."
Claim: optimizing the harness alone (same model) moved an agent from 30th to 5th on a public benchmark.

Their staged metric ladder is a good template for house v2's own health metrics:

- **Stage 1 (available today):** $ per merged PR; compute spend per active dev; time-to-merge for agent-assisted
  PRs; PR size and churn.
- **Stage 2 (needs infra):** first-pass success rate; agent-PR survival rate; defect escape rate.
- **Stage 3 (survey):** reviewer fatigue and confidence.

> "Linking agent sessions to PRs is the hardest and most valuable piece of measurement infrastructure."

**That last line is a design requirement for the IDE**: it should record `session_id ↔ unit ↔ branch ↔ PR` as a
first-class relation. Everything downstream (retro quality, first-pass success rate, gate effectiveness) depends
on it, and Claude Code hands you `session_id` in every hook payload for free.

### 4.3 Human-in-the-loop gate placement

The consistent risk-based rule:

> Approval gates for irreversible actions are essential — "anything that moves money, sends external
> communications, deletes records, or changes a customer's status deserves a synchronous approval step that
> pauses the agent until a person confirms."

Escalating patterns in practice: `PreToolUse` hooks (deterministic block) → feedback-driven blocklists →
async permission forwarding to mobile. And the honest note on cost:

> "Implementing approval callbacks, checkpoint files, audit logs, timeout handling, and gate promotion logic is
> where most teams get stuck."

House already has a good instinct here in doctrine.md's auto-fix boundary ("provably-safe, no-data-loss cases"
only; "Running unattended never downgrades this"). That principle should be *generalized* into the v2 schema as
a per-action reversibility classification, not left as prose in a hygiene checklist.

Sources: <https://www.port.io/blog/human-in-the-loop-for-ai-coding-agents> ·
<https://codeongrass.com/blog/how-to-build-human-in-the-loop-approval-gates-ai-coding-agents/>

### 4.4 DORA 2025 — the amplifier finding

<https://dora.dev/dora-report-2025/> — the first "State of AI-assisted Software Development" report. 90% of
developers use AI daily. Core finding: **AI is an amplifier** of existing organizational capability.

> "Speed without stability is just accelerated chaos."

> The greatest return comes "not from the AI tools themselves, but from a strategic focus on the quality of
> internal platforms, the clarity of workflows, and the alignment of teams."

For a solo dev this reads as: the SDLC *is* the platform. Investment in house v2's clarity and internal
consistency is exactly the leverage DORA identifies — and conversely, a fuzzy process gets fuzzier faster under
agents.

### 4.5 Verdict — load-bearing vs ceremony

Synthesizing all of the above:

**Load-bearing** (blocks a state transition AND emits a durable record):

1. **Plan approval before implementation.** Backed by: plan mode, agent-teams plan approval, Kiro, Spec Kit, the
   70/20 planning/execution split. This is house's plan-check — it is the right gate, wrongly persisted.
2. **Automated verification before "done."** Tests/build/lint/screenshot. Backed by: everything. Must be a Stop
   or SubagentStop hook, not an instruction.
3. **Adversarial fresh-context review of the diff before merge.** Backed by Claude Code best practices,
   agent-teams parallel review, the merge-gate literature. House's merge-gate review panel is correct; it needs
   a persisted findings artifact (house already has a `ReportFindings` shape to model on).
4. **Human approval on irreversible/destructive actions.** Backed by the HITL literature and house's own
   auto-fix boundary.
5. **Session-end state write.** Backed by the long-running-harness work. The next session's correctness depends
   entirely on it; this is the gate that makes resume possible.

**Ceremony** (no state transition, no artifact, or unenforced):

- Status lines maintained by hand (`Status: Draft`) — replace with derived state.
- Checkboxes with no verifier — replace with structured tasks + a completion hook.
- Retros written but never indexed or queried — keep the retro, make it queryable, or cut it.
- Prose "verdicts" that live only in a conversation — the single largest house v2 fix.
- Doc-model routing rules enforced only by an agent remembering to read doctrine.md — replace with a linter.
- Per-stage "did you do the thing?" checklists that don't gate anything.

**Gate-strength ladder to adopt explicitly (from §1.1):** advisory prompt → session-level goal condition →
deterministic hook → independent verifier subagent. House v2 should annotate every gate with which rung it sits
on, and no gate should claim to be load-bearing while sitting on rung 1.

---

## 5. Keeping AI-written docs from going stale

The problem is now measurable: **"AI agents represent 45.3% of documentation traffic across Mintlify-powered
sites"** — docs are read by agents nearly as much as by humans, so staleness is no longer a human-annoyance
problem, it is a hallucination-amplifier.

> "when docs are stale and unstructured, AI coding assistants hallucinate at scale"
> "more commits means more drift, faster"

Working mitigations found:

1. **Structural** — separate proposal from truth so merge is a defined operation (OpenSpec, §2.3). Strongest.
2. **Event-driven** — Kiro's agent hooks: update docs when code changes, on file/workspace events. No discipline
   required.
3. **CI drift detection** — "a documentation freshness score, based on the last update date, code commits, and
   broken link checks"; "running a script in CI that extracts claims from the README and checks them against the
   codebase"; schema mismatch checks between OpenAPI specs and reference docs.
4. **Scheduled reconciliation agents** — "AI agents detect documentation-code drift on schedule or push, then
   open reviewable PRs to realign docs as a continuous pipeline."
5. **Compliance audit sections** — Structured MADR's approach, below.

Sources: <https://understandingdata.com/posts/doc-drift-detection-ci/> ·
<https://www.agentpatterns.ai/workflows/continuous-documentation/> · <https://datahub.com/blog/continuous-context/>

### Structured MADR — machine-readable ADRs

<https://zircote.com/blog/2026/01/introducing-structured-madr/>

Frontmatter schema: `title`, `description`, `type`, `category`, `tags`, `status`, `technologies`, `audience`,
`created`, `updated`, `author`, `project`, `related`.

> Traditional ADRs force AI systems to "parse prose to understand decisions, metadata queries are impossible,
> and compliance tracking is manual."

Benefits claimed: programmatic filtering (`status:accepted tags:database` without full-text search); **"language
models scan metadata first, fetching full documents only for relevant choices"** (= just-in-time context, §1.5);
automated compliance tracking.

Two agent roles ship with it: an `adr-compliance` agent that "reads decision requirements from ADRs, searches
code for compliance evidence and violations" and appends dated findings to a required **audit section**; and an
`adr-author` agent that recognizes architectural discussion in conversation and proactively proposes a record.

Classical ADR lifecycle discipline still holds and is worth encoding: **"An ADR is immutable. Only its status can
change."** Statuses: proposed / accepted / deprecated / superseded, with supersession as an explicit link.

### AGENTS.md

Now the de facto cross-tool standard: formalized August 2025 (OpenAI, Google, Cursor, Factory, Sourcegraph),
stewarded by the Agentic AI Foundation under the Linux Foundation since 2025-12-09, read natively by Claude Code,
Codex, Cursor, Copilot, Gemini CLI, Windsurf, Aider, Devin, Zed, Amp, Junie. 20k+ repos.

On frontmatter: "some harnesses… already parse optional frontmatter for forward-compatibility; most agents simply
ignore it. **Don't depend on frontmatter for correctness.** Do feel free to include it."

⚠️ That caveat generalizes: frontmatter is great for *your own tooling* (the IDE, a linter) but must not be the
only place a rule lives if an agent's behavior depends on it.

---

## 6. IDE-native precedent: Google Antigravity

<https://antigravity.google/docs/artifacts> · <https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/>

The closest shipping product to what Jake is describing, and the vocabulary is worth borrowing:

- Two surfaces: **Editor View** (hands-on) and **Agent Manager** (supervise several agents at once). "replaces
  the 'AI in a sidebar' model."
- **Artifacts** — "Every significant action an agent takes produces a structured, reviewable artifact." Named
  types: implementation plans, **task lists**, **verification walkthroughs**, screenshots, browser recordings.
  - *Task List*: "structured plans the agent creates before coding, showing the sequence of steps it intends to
    follow."
  - *Walkthrough*: created after implementation — "a summary of the changes and how to test them."
- Each agent in Manager view has its own workspace, own context, own artifacts, and can use a different model.
- **Google-Docs-style commenting on artifacts**: "Select any section of an artifact, leave a comment with
  instructions or corrections, and the agent incorporates your feedback without restarting the entire task."

The last one is the sharpest UX idea in this digest: *inline comment on a plan section → targeted agent revision*
is strictly better than "paste feedback into a terminal and hope it re-reads the file." It is also trivially
implementable if plans have stable section IDs — which argues for **stable anchors/IDs on plan units**, which
house needs anyway for tickable checkboxes.

---

## 7. What house v2 should steal

Ordered by leverage. Each maps to a known weakness from the audit.

### 7.1 A single machine-readable slice manifest (fixes: no machine-readable state, ambiguous slice identity)

One file per slice, e.g. `docs/slices/<slice-id>/manifest.yaml` (or `.json`), owning:

- `id` — globally unique and *not* "Slice N". Suggest `YYYY-MM-DD-<slug>` or a short ULID + slug. The two-
  coexisting-"Slice N"-series bug dies the moment the ID is unique by construction.
- `title`, `tier` (`decision` | `small` | `slice` | `epic`) — the tier drives which artifacts are required. This
  is the explicit answer to SDD's ceremony critique (§2.4).
- `state` — a closed enum with a defined transition graph: `shaping → planned → building → in-review → merged →
  reconciled` (+ `blocked`, `abandoned`).
- `artifacts` — pointers only (JIT context, §1.5): `spec`, `plan`, `plan_check`, `mockups[]`, `retro`, `adrs[]`.
- `units[]` — each with `id`, `title`, `state`, `passes` (Anthropic's harness field, §1.2), `depends_on[]`,
  `branch`, `pr`, `session_id`.
- `gates[]` — see 7.3.
- `git` — `branch`, `pr`, `merge_commit`.

Everything else in house stays prose. The manifest is the *index*; the docs stay human.

### 7.2 Proposal/truth separation with an archive operation (fixes: stale spec Status, unticked checkboxes)

Adopt OpenSpec's shape (§2.3):

- `docs/specs/` — current truth, capability-oriented, no Status field at all (its presence *is* the status).
- `docs/slices/<slice-id>/` — the in-flight change: `proposal.md` (Why / What / Scope / Success criteria),
  `plan.md`, `plan-check.md`, `tasks.yaml`, `spec-delta/`.
- `docs/slices/archive/<slice-id>/` — post-merge.

**Merge = apply the spec delta + move the directory.** A shell one-liner can verify it; a Status line cannot.
No slice can be `merged` while its directory still sits in the active tree.

### 7.3 Persist every gate verdict as a typed record (fixes: verdicts are conversation-only)

The plan-check GO / GO-WITH-FIXES / NO-GO and the builder's 4-state report become entries in the manifest and
append-only events:

```yaml
gates:
  - kind: plan-check
    verdict: GO-WITH-FIXES
    at: 2026-07-28T14:02:11Z
    by: session_014a4Nx…
    fixes: [ "unit 3 lacks a verification step", … ]
  - kind: merge-review
    verdict: PASS
    findings: [ { file: …, line: …, severity: …, status: fixed } ]
```

Precedent: durable-execution runtimes explicitly record "the approval decision" as a resumable boundary (§3.2);
Structured MADR's audit sections (§5); Antigravity's artifacts (§6). Rule to adopt: **a gate that does not write
a record did not run.**

### 7.4 An append-only event log per project (fixes: no event log; enables the IDE home screen)

`docs/.house/events.jsonl` — one JSON object per line:
`{ ts, slice_id, unit_id, event, actor, session_id, detail }`.

Written by hooks, not by agent goodwill. Minimum event set: `slice.created`, `slice.state_changed`,
`unit.started`, `unit.completed`, `gate.recorded`, `artifact.created`, `doc.reconciled`, `session.started`,
`session.ended`.

This is what makes the IDE home screen possible (a timeline, not a diff of prose) and what makes Faros-style
metrics (§4.2) computable — most importantly `session_id ↔ unit ↔ PR`, which they call "the hardest and most
valuable piece of measurement infrastructure."

### 7.5 Make gates deterministic with hooks (fixes: unenforced everything)

Concrete mapping, all from §1.8:

| House gate | Mechanism |
|---|---|
| Builder can't finish a unit with failing tests | `SubagentStop` hook, exit 2 |
| Builder can't mark a unit done without ticking its task | `TaskCompleted` hook validating the manifest, exit 2 |
| Orchestrator can't end a session without a dev-state write | `Stop` hook checking the manifest mtime, exit 2 |
| dev-state allowlist enforcement | `PostToolUse` matcher on `Edit\|Write` for `docs/dev-state.md` → run the linter |
| Mockup path enforcement | `PreToolUse` on `Write` with `updatedInput` rewriting the path — the agent literally cannot write it elsewhere |
| Destructive hygiene actions need a human | `PreToolUse` → `permissionDecision: "ask"` |
| IDE auto-open of new artifacts | `PostToolUse` on `Write` under `docs/**` |

Note the `updatedInput` capability specifically: it turns "the mockup path is unspecified" from a documentation
problem into a non-problem. Also note the safety valve — Claude Code overrides a Stop hook after **8 consecutive
blocks**, so hooks must be able to fail open with a recorded reason.

### 7.6 A `tasks.yaml` that is the checkbox (fixes: 11/13 plans 100% unchecked)

Stop putting checkboxes in plan prose. Plan prose describes *approach*; `tasks.yaml` holds *state*, with
`id`, `title`, `state`, `depends_on`, `verify` (the command that proves it), `evidence` (what the command
printed). Precedents: Anthropic's JSON feature list with `passes` (§1.2), agent-teams' task list with
dependencies and file-locked claiming (§1.7), Kiro's `tasks.md` with requirement traceability (§2.2), Ralph's
`fix_plan.md` (§3.1), Antigravity's Task List artifact (§6).

The `verify` field is the important one — it is what turns Anthropic's "give Claude a way to verify its work"
from advice into schema.

### 7.7 A session-resume contract (fixes: reliance on prose dev-state)

Steal Anthropic's four-step startup protocol verbatim in shape (§1.2): establish cwd → read git log + event log
→ read the manifest and pick the highest-priority unclaimed unit → run the project's `verify` command to catch
undocumented breakage *before* trusting the recorded state.

That last step is the one house is missing entirely: **never trust recorded state without a cheap live check.**

### 7.8 Deterministic naming, derived not conventional (fixes: retro key undefined, dev-state heading drift, mockup paths)

Every path in the system derives from the slice ID:

```
docs/slices/<slice-id>/{proposal,plan,plan-check,retro}.md
docs/slices/<slice-id>/mockups/<unit-id>-<slug>.html
docs/slices/archive/<slice-id>/…
```

No naming *style* to choose, therefore no drift. Ship a `house lint` command (or hook) that fails on any file
under `docs/` not reachable from a manifest.

### 7.9 Right-size by tier (fixes: SDD ceremony critique)

| Tier | Required artifacts |
|---|---|
| `decision` | ADR + roadmap touch. No spec, no plan. (House already has this — formalize it as a tier.) |
| `small` | tasks.yaml + verification. No spec, no plan-check, no retro. |
| `slice` | Full: proposal + plan + plan-check + tasks + review + retro. |
| `epic` | Slice artifacts + explicit sequencing in roadmap + per-slice manifests. |

Backed by: "If you could describe the diff in one sentence, skip the plan" (§1.1); "for a small bug fix, the spec
overhead isn't worth it" (§2.4).

### 7.10 Two IDE affordances worth designing for on day one

- **Comment-on-artifact-section → targeted agent revision** (Antigravity, §6). Requires stable anchors on plan
  units — which 7.6 gives you anyway.
- **Evidence panel.** "Have Claude show evidence rather than asserting success" (§1.1). Every gate record carries
  its `evidence` (command + output + exit code). The IDE renders it. This is what makes an unattended run
  reviewable in minutes instead of re-run.

### 7.11 Things to deliberately NOT do

- Don't build agent teams into house v2 yet — experimental, no session resumption for in-process teammates,
  "task status can lag," 3–10× tokens. Subagents already give context isolation.
- Don't split more roles. Anthropic explicitly warns against phase-split agents (§1.4). Three roles is already at
  the edge of justification; the justification is the plan artifact, so invest there rather than in a fourth role.
- Don't make frontmatter load-bearing for *agent behavior* — only for tooling (§5, AGENTS.md caveat). Rules that
  must change agent behavior belong in the skill body or a hook.
- Don't adopt Ralph's unbounded loop on existing projects ("no way in heck would I use Ralph in an existing code
  base"). Adopt its file-based-state discipline only.
- Don't add gates that don't emit records. That is the definition of ceremony established in §4.5.

---

## 8. Open questions for Jake

1. **Is the manifest the source of truth, or a derived index?** Derived-from-events is more robust (rebuildable,
   no write conflicts between parallel builders) but needs a projector. A hand-maintained manifest will drift the
   same way Status lines do. Recommendation: **events are truth, manifest is a projection**, regenerated by a
   `house project` command the IDE runs on file change.
2. **YAML frontmatter in the markdown vs a sidecar manifest?** Frontmatter keeps state adjacent to prose (harder
   to forget) but makes multi-writer conflicts worse and pollutes the rendered view. Sidecar is cleaner for the
   IDE. Possibly: frontmatter for *identity* (`id`, `slice`, `kind`), sidecar/events for *state*.
3. **Does the plan-check gate survive at all**, or does it collapse into "the plan must have a `verify` for every
   unit, checked by a linter"? Much of what plan-check does today may be mechanizable, leaving a much smaller
   judgment-only gate.
4. **What is the smallest event set** that still supports the home screen, the metrics, and resume? Over-logging
   is its own maintenance burden.
5. **Where does the doctrine live** so it is actually enforced — steering file (Kiro), skill reference (today),
   or linter (recommended for the mechanizable half)?

---

## Sources

- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Orchestrate teams of Claude Code sessions (agent teams)](https://code.claude.com/docs/en/agent-teams)
- [How we built our multi-agent research system — Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Effective harnesses for long-running agents — Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Effective context engineering for AI agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [How Claude Code is used in practice — Anthropic research](https://www.anthropic.com/research/claude-code-expertise)
- [When to use multi-agent systems (and when not to) — Claude blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
- [github/spec-kit](https://github.com/github/spec-kit)
- [AWS Kiro: the agentic IDE that makes specs the unit of work](https://builder.aws.com/content/3DbBI7LQgNIcs6UUj7IPPvqFHOp/aws-kiro-the-agentic-ide-that-makes-specs-the-unit-of-work)
- [OpenSpec workflow](https://openspec.pro/workflow/) · [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [Spec-Driven Development: The Definitive 2026 Guide — BCMS](https://thebcms.com/blog/spec-driven-development)
- [Spec-Driven Development: A Spec-First Approach to AI-Native Engineering — Microsoft](https://developer.microsoft.com/blog/spec-driven-development-ai-native-engineering/)
- [Ralph — Geoffrey Huntley](https://ghuntley.com/ralph/) · [snarktank/ralph](https://github.com/snarktank/ralph)
- [How to think about durable execution — Hatchet](https://hatchet.run/blog/durable-execution)
- [Replayable agent runtimes: event-sourced execution — Zylos](https://zylos.ai/research/2026-04-24-replayable-agent-runtimes-event-sourced-execution/)
- [Your merge gate was a compromise — The New Stack](https://thenewstack.io/merge-gate-coding-agents/)
- [Harness engineering — Faros AI](https://www.faros.ai/blog/harness-engineering)
- [AI is breaking code review — Codacy](https://blog.codacy.com/ai-breaking-code-review-how-engineering-teams-survive-pr-bottleneck)
- [Human in the loop for AI coding agents — Port](https://www.port.io/blog/human-in-the-loop-for-ai-coding-agents)
- [How to build human-in-the-loop approval gates](https://codeongrass.com/blog/how-to-build-human-in-the-loop-approval-gates-ai-coding-agents/)
- [DORA 2025 State of AI-assisted Software Development](https://dora.dev/dora-report-2025/)
- [Introducing Structured MADR — zircote](https://zircote.com/blog/2026/01/introducing-structured-madr/)
- [Doc drift detection in CI](https://understandingdata.com/posts/doc-drift-detection-ci/)
- [Continuous documentation as an agent-driven practice — AgentPatterns](https://www.agentpatterns.ai/workflows/continuous-documentation/)
- [Continuous context: why AI docs decay — DataHub](https://datahub.com/blog/continuous-context/)
- [AGENTS.md field guide 2026](https://www.iuriio.com/blog/posts/2026/05/agents-md-field-guide-2026)
- [Google Antigravity — artifacts](https://antigravity.google/docs/artifacts) · [launch post](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
- [Awesome harness engineering](https://github.com/ai-boost/awesome-harness-engineering)
