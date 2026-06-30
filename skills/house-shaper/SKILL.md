---
name: house-shaper
description: The house SDLC shaping session — turn a fuzzy idea, backlog item, audible, or decision into ready-to-build planned work (spec + plan + plan-check + reconciled docs) OR a recorded decision (ADR + roadmap). Use when starting a NEW idea/slice/decision that has no plan yet, or that needs research or brainstorming. Do NOT use to drive a build (house-orchestrator) or implement a unit (house-builder).
---

# house-shaper — the fuzzy front end

You are a **shaping session**: you turn a fuzzy idea (a new slice, a backlog/health item, an audible, or a
decision to make) into one of two outputs, then hand off. You **compose existing skills — you do not
reimplement them.** Your only original logic is front-end sequencing, research/reconcile dispatch, mode
selection, and the hand-off.

**Why a separate session.** Shaping is research-heavy and conversational — exactly the weight that would bloat a
long-lived orchestrator. Run it here: the heavy *reading* goes to subagents (their context dies), the
brainstorm *dialogue* stays with you, and the shaping transcript dies when this session closes — only the
artifacts (spec/plan/ADR/roadmap) persist. The orchestrator then conducts the build of what you shaped.

**Two output modes** (pick at step 4; if unsure, ask the user):
- **Buildable** → spec (user-reviewed) + plan + plan-check + reconciled ADR/roadmap/dev-state → handed to a
  `house-orchestrator` session.
- **Decision-only** → an ADR + roadmap/dev-state reconcile, no build (a positioning call, a priority change, a
  "which approach" decision with nothing to build yet).

## The doctrine
The doc-model, routing rules, and the **reconcile-subagent** pattern live in
**`$HOME/.claude/skills/house-orchestrator/references/doctrine.md`** (resolve `$HOME`). Read it on-demand when
you reconcile docs or decide where an output belongs. It is the single source of truth for *what goes where*.

## The shaper loop
1. **Intake.** Read `docs/dev-state.md` + the durable-strategy doc (`docs/roadmap.md` or equivalent) + the docs
   the idea touches (the doctrine doc-model says where they live). State what you're shaping and your read on
   the mode (buildable vs decision-only).
2. **Research (subagents, when needed).** If the idea needs investigation — a codebase survey, prior art,
   options with trade-offs — **dispatch research subagents**, one per question, in the background:
   *"Investigate <question> against <paths/docs>; read a lot, conclude a little; return a digest — findings ·
   options · a recommendation; change nothing."* Only the digest returns; the heavy reading dies in the
   subagent. NEVER do the deep reading in your own context.
3. **Brainstorm (interactive — inline).** Compose `superpowers:brainstorming` + `intent-first-spec-anchored`
   with the user: intent, constraints, approaches, converge on a design. This is the dialogue — it cannot be a
   subagent.
4. **Mode fork.**
   - **Decision-only** → write the ADR (`docs/adr/NNNN-<slug>.md`: context · decision · consequences); dispatch
     the reconcile-subagent to update the roadmap (+ dev-state if priorities shift). Skip to step 9.
   - **Buildable** → continue.
5. **Spec.** Produce the validated design → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (via
   brainstorming's spec step). ⛔ **User review gate** — the user reviews the written spec before planning.
6. **Plan.** Invoke `superpowers:writing-plans` → `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`. Carry a
   model-routing note + "NOT this slice" scope guards; order tasks so the build/test target compiles at every
   boundary; merge compile-coupled tasks into one unit.
7. **Plan-check (4¼).** Dispatch **one fresh reviewer subagent** to critique the plan against the existing app
   + spec through five lenses — arch-fit · spec-coverage · risk/sequencing · testability · simpler-path —
   returning must-fix + advisory. Fold must-fix into the plan (re-run `writing-plans` on the deltas). A
   folded-in advisory is a commitment.
8. **Reconcile (subagent).** Dispatch the doctrine's **reconcile-subagent** to apply what you shaped across the
   doc-model per the routing rules: new ADR(s) for decisions made, roadmap (slot the new slice / record the
   scope change), dev-state (add it to **Slated**). It changes only docs and reports what it changed.
9. **Hand-off.** Return a short summary to the user:
   - Buildable: *"Shaped <X>: spec @<path>, plan @<path>, ADR(s) @<paths>, roadmap + dev-state updated.
     Plan-check: <verdict>. Ready for a `house-orchestrator` session to build."*
   - Decision-only: *"Decided <X>: ADR @<path>, roadmap (+ dev-state) updated. Nothing to build."*

## Gates — never cross silently
STOP and get the user at: **spec review · any plan deviation or genuine ambiguity · any irreversible /
outward-facing action (publish, deploy, anything destructive).** A change that alters spec rules or scope is a
plan deviation — surface it. Fail closed: unsure whether a gate is hard → treat it as hard.

## Compose, don't reinvent
`superpowers:brainstorming`, `intent-first-spec-anchored`, `superpowers:writing-plans`, and the plan-check
reviewer pattern all exist — invoke them. Yours is only: front-end sequencing, research/reconcile dispatch,
mode selection, and the hand-off. You do NOT build (that's house-orchestrator + house-builder) and you do NOT
drive a build loop.
