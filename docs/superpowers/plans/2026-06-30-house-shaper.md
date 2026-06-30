# The house-shaper Skill (Piece C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third user-run session role — `house-shaper` (the fuzzy front end: research + brainstorm + reconcile → ready-to-build work or a recorded decision) — and slim the orchestrator to a pure build/gate/merge conductor with a conservative redirect guard.

**Architecture:** New `skills/house-shaper/SKILL.md`. Promote the reconcile-subagent to a named doctrine pattern. Rewrite the orchestrator's front end (redirect guard + collapse stages 0–4¼ into "confirm shaper output"). Update the human docs/site/README from two skills → three. Bump `VERSION`.

**Tech Stack:** Markdown (skills + doctrine + process.md) + hand-authored HTML (`process.html`) + `VERSION`/README. **No executable code, no test framework** — each "verify" is a grep/read check, not a unit test. Do NOT write code tests.

**Repo:** `sdlc-skills` · **Branch:** `feat/house-shaper` (created off `main`; spec committed there). **Spec:** `docs/superpowers/specs/2026-06-30-house-shaper-design.md`.

**Task order matters:** create the shaper skill (T1) and the doctrine pattern (T2) BEFORE the orchestrator references them (T3), so no edit points at something that doesn't exist yet. **Project-agnostic** throughout.

---

## File Structure

- **Create** `skills/house-shaper/SKILL.md` — the new shaping-session skill.
- **Modify** `skills/house-orchestrator/references/doctrine.md` — add the Reconcile-subagent shared pattern.
- **Modify** `skills/house-orchestrator/SKILL.md` — redirect guard + front-end collapse.
- **Modify** `docs/process.md` + `docs/process.html` — two skills → three (intro, table, loop diagram).
- **Modify** `README.md` — add `house-shaper`.
- **Modify** `VERSION` — `0.3.0` → `0.4.0`.

---

## Task 1: Create the house-shaper skill

**Files:**
- Create: `skills/house-shaper/SKILL.md`

- [ ] **Step 1: Create the file with this exact content**

````markdown
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
````

- [ ] **Step 2: Verify the skill registers and is well-formed**

Run: `grep -E '^name: house-shaper$' skills/house-shaper/SKILL.md` → expected 1 match.
Run: `grep -cE '^## ' skills/house-shaper/SKILL.md` → expected 4 (The doctrine, The shaper loop, Gates, Compose).

- [ ] **Step 3: Commit**

```bash
git add skills/house-shaper/SKILL.md
git commit -m "house-shaper: new shaping-session skill (fuzzy front end)"
```

---

## Task 2: Promote the reconcile-subagent to a doctrine pattern

**Files:**
- Modify: `skills/house-orchestrator/references/doctrine.md`

- [ ] **Step 1: Append a new section at the END of the file**

After the last line (the Hygiene checklist's auto-fix boundary bullet ending "…Running unattended never downgrades this."), append:

```markdown

## Reconcile-subagent — the shared doc-update pattern

Applying a decision, a plan, or an as-built change across the doc-model is **heavy doc read/write** — dispatch
it to a subagent so it stays out of the parent's context. Contract: *"Read the relevant
spec/plan/ADR/README/roadmap/dev-state under `<repoPath>` plus `<the decision / diff / plan>`. Update the docs
so they match, following the routing rules above — a decision → a new ADR, scope/sequencing → roadmap,
operational state → dev-state, as-built drift → the spec/plan. Change ONLY docs; report what you changed."* Two
instances already exist: the **builder's** per-unit doc-reconcile, and the **shaper's** post-decision reconcile.
```

- [ ] **Step 2: Verify**

Run: `grep -c 'Reconcile-subagent — the shared doc-update pattern' skills/house-orchestrator/references/doctrine.md`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add skills/house-orchestrator/references/doctrine.md
git commit -m "doctrine: promote the reconcile-subagent to a named shared pattern"
```

---

## Task 3: Slim the orchestrator (redirect guard + front-end collapse)

**Files:**
- Modify: `skills/house-orchestrator/SKILL.md`

> Anchor on the exact quoted text. Keep all surrounding content.

- [ ] **Step 1: Insert the redirect-guard section**

Find the end of the `## Doctrine — the docs & hygiene rules` section (the line ending "…this skill only points at it."). Immediately after it (before `## run — the procedure`), insert:

```markdown

## Shaping happens elsewhere — the redirect guard
You conduct the build of *already-shaped* work. You do NOT brainstorm, research, scope, author plans, or make
non-trivial decisions in this session — that is **`house-shaper`** (its own session), and doing it here is the
context bloat the split exists to prevent. **Redirect guard (conservative):** if a request would start new
brainstorming/research, new scoping, a new plan, or a non-trivial decision / roadmap change, DON'T do it inline
— **recommend a `house-shaper` session** (name what to explore) and resume here when its spec/plan/ADR/roadmap
artifacts land. Quick clarifications, status checks, and gate calls you answer inline. Unsure → treat it as
shaping and recommend the shaper.
```

- [ ] **Step 2: Rewrite the "Confirm the work" step**

Find this exact step:

```markdown
3. **Confirm the work.** State project + active slice + next action, and what this session will do. New slice →
   scope it first (stage 1). **No plan yet?** Backlog offshoots, health-sweep / `accepted.md` items, or an
   audible are NOT buildable as-is — author a plan first (stage 4; dispatch the plan-authoring to a subagent
   when it's non-trivial, so the research stays out of your context), run plan-check (4¼), THEN dispatch a
   builder. Never hand a builder un-planned work.
```

Replace it with:

```markdown
3. **Confirm the work.** State project + active slice + next action, and what this session will do. **No
   ready-to-build plan yet?** A new slice, a backlog/health offshoot, an `accepted.md` item, an audible, or a
   decision is **shaping work, not buildable as-is** — recommend a **`house-shaper`** session to produce the
   spec + plan + plan-check (+ reconciled docs), then resume here to build. Never shape or author a plan
   inline; never hand a builder un-planned work.
```

- [ ] **Step 3: Update the "Walk the loop" sentence**

Find:

```markdown
4. **Walk the loop.** You own the design + gate stages and dispatch the rest. NEVER reinvent — invoke the named
   skill.
```

Replace with:

```markdown
4. **Walk the loop.** Shaping (stages 0–4¼) is delegated to a `house-shaper` session; you own the gate +
   build-dispatch stages and dispatch the rest. NEVER reinvent — invoke the named skill.
```

- [ ] **Step 4: Collapse the front-end stage rows in the table**

Find these six consecutive table rows (stages 0 through 4¼):

```markdown
   | 0 spike (risky/novel only) | `superpowers:brainstorming` → a GO/NO-GO verdict doc | — |
   | 1 scope | `superpowers:brainstorming` + `intent-first-spec-anchored` | — |
   | 2 spec | `superpowers:brainstorming` (+ intent-first) → `docs/superpowers/specs/` | ⛔ user review |
   | 3 mockup (UI slices) | `superpowers:brainstorming` mockup. Reusing an already-signed-off mockup is legitimate for a *component-reuse / placement-only* slice — but state the decision and get the user's explicit OK; the sign-off gate still fires. Fresh mockup whenever the slice introduces genuinely new UI. | ⛔ sign-off |
   | 4 plan | `superpowers:writing-plans` — carry a model-routing note + "NOT this slice" scope guards; **order tasks so the build/test target compiles at every boundary** (a shared-type signature change updates its call sites in the SAME task) and **merge compile-coupled tasks into one unit** ("mostly independent" is an assumption) | — |
   | 4¼ plan-check | Dispatch **one fresh reviewer subagent** to critique the plan against the EXISTING app + spec through five lenses — **arch-fit · spec-coverage · risk/sequencing · testability · simpler-path** — returning must-fix-before-build + advisory. Fold must-fix into the plan before building (re-run `writing-plans` on the deltas). **A folded-in advisory is a commitment — once written into the plan, build it; re-waiving it is a plan deviation → surface it.** | ⚠️ revise if critical |
```

Replace all six with this single row:

```markdown
   | 0–4¼ shape (delegated) | **Shaping runs in a `house-shaper` session, not here** — spike · scope · spec · mockup · plan · plan-check. Confirm it produced ready-to-build artifacts: spec (user-reviewed) + plan + plan-check + reconciled ADR/roadmap/dev-state. Absent (new slice · backlog/health item · audible needing re-plan · a decision)? **Recommend a `house-shaper` session; resume when its artifacts land** — never shape inline. | ⛔ shaper artifacts present |
```

- [ ] **Step 5: Update the Audibles re-entry line to point at the shaper**

Find:

```markdown
An audible always re-enters the loop at scope/plan/build — it is never an excuse to edit code in *your*
session. A change that alters spec rules or scope is a plan deviation: surface it, don't absorb it silently.
```

Replace with:

```markdown
An audible that changes scope or the plan re-enters via a **`house-shaper` session** (re-shape, then resume the
build); a within-plan tweak folds forward into the next unit. It is never an excuse to shape or edit code in
*your* session. A change that alters spec rules or scope is a plan deviation: surface it, don't absorb it
silently.
```

- [ ] **Step 6: Verify all five edits**

Run: `grep -c 'redirect guard\|house-shaper\|0–4¼ shape' skills/house-orchestrator/SKILL.md` → expected `4` or more.
Run: `grep -c -E '^   \| 1 scope \||^   \| 4¼ plan-check \|' skills/house-orchestrator/SKILL.md` → expected `0` (the old front-end rows are gone).
Run: `grep -c 'shaper artifacts present' skills/house-orchestrator/SKILL.md` → expected `1`.

- [ ] **Step 7: Commit**

```bash
git add skills/house-orchestrator/SKILL.md
git commit -m "orchestrator: redirect guard + collapse the front end to a house-shaper handoff"
```

---

## Task 4: Update the human docs (two skills → three)

**Files:**
- Modify: `docs/process.md`
- Modify: `docs/process.html`

- [ ] **Step 1: `process.md` — the intro count**

Find: `This is the one build process, run the same way every time, by two cooperating Claude Code skills.`
Replace `two cooperating Claude Code skills` with `three cooperating Claude Code skills`.

- [ ] **Step 2: `process.md` — the "Why two skills" heading + intro**

Find the heading `## Why two skills` and replace with `## Why three skills`.

Find: `single monolithic SDLC skill makes every session — orchestrator and builder alike — pay for the whole`
Replace `orchestrator and builder alike` with `shaper, orchestrator, and builder alike`.

- [ ] **Step 3: `process.md` — add the house-shaper row to the role table**

Find the table row:

```markdown
| **house-orchestrator** | conductor | sequencing, gates, kickoff prompts, review dispatch, reconcile | one long-lived session, resumable |
```

Insert this new row immediately BEFORE it (the shaper is the front end):

```markdown
| **house-shaper** | shaper | the fuzzy front end: research, brainstorm, spec, plan, plan-check, reconcile | a user-run shaping session, torn down |
```

- [ ] **Step 4: `process.md` — replace the loop diagram**

Find the fenced code block under `## The loop` (it starts with the line containing "house-orchestrator" inside a box and ends before the closing fence). Replace the ENTIRE diagram (between the ``` fences) with:

```
        ┌──────────────── house-shaper (per idea, its own session) ───────────────┐
 idea → │ intake → research (subagents) → brainstorm ⛔spec → plan → plan-check     │
        │ (subagent) → reconcile (subagent) → hand off ready-to-build work (or ADR) │
        └────────────────────────────────────┬─────────────────────────────────────┘
                                              ▼  (a new orchestrator session picks it up)
        ┌──────────────────────────── house-orchestrator ────────────────────────────┐
resume → ready repo → confirm shaper artifacts ⛔ → 5 dispatch a builder
                              hand off a unit  ┌───────── house-builder (per unit) ─────────┐
                                       ───────▶│ 5 build (TDD) · 6 self-review · stack    │
                                               │ gates · doc-reconcile (subagent) · 8 CI  │
                              report back  ◀────│ → report: DONE / CONCERNS / BLOCKED      │
                                       │       └──────────────────────────────────────────┘
        7 merge-gate (subagent; PANEL if high-stakes) ⛔ → 7½ health-sweep (workflow, advisory)
        → 9 live/device ⛔ → 9½ docs audit → 10 PR+merge → 11 reconcile + update dev-state.md
        └────────────────────────────────────────────────────────────────────────────────┘
```

- [ ] **Step 5: Mirror all of the above into `docs/process.html`**

Read `docs/process.html`. Find and update, matching the file's hand-authored conventions (`<b>` house style, the existing `<table>`/cards, the loop `<pre>`):
- the "two cooperating … skills" count → "three";
- the "Why two skills" heading → "Why three skills" (and the "orchestrator and builder alike" phrase → "shaper, orchestrator, and builder alike");
- add a **house-shaper** row to the role table (before the house-orchestrator row): role = shaper, loads = "the fuzzy front end: research, brainstorm, spec, plan, plan-check, reconcile", lives = "a user-run shaping session, torn down";
- replace the loop `<pre>` diagram with an HTML-escaped version of the new diagram from Step 4 (preserve the box-drawing characters; escape `<`/`>`/`&` as needed).

- [ ] **Step 6: Verify md/html parity**

Run: `grep -c 'house-shaper' docs/process.md docs/process.html` → expected ≥1 in each.
Run: `grep -c 'Why three skills' docs/process.md docs/process.html` → expected 1 in each.
Run: `grep -c 'Why two skills' docs/process.md docs/process.html` → expected 0 in both.

- [ ] **Step 7: Commit**

```bash
git add docs/process.md docs/process.html
git commit -m "docs: three-skill ecosystem — add house-shaper (md + site)"
```

---

## Task 5: Update the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the "Two skills" intro**

Find: `Two skills, split along the way you actually work:`
Replace with: `Three skills, split along the way you actually work:`

- [ ] **Step 2: Add the house-shaper bullet**

Find the `house-orchestrator` bullet (begins `- **\`house-orchestrator\`**`). Insert this bullet immediately BEFORE it:

```markdown
- **`house-shaper`** — a user-run shaping session for the fuzzy front end: research, brainstorm, spec, plan,
  plan-check, and doc reconcile. Turns an idea into ready-to-build work (or a recorded decision), then hands
  off to the orchestrator.
```

- [ ] **Step 3: Fix the trailing "two skills" reference**

Find: `the move-by-move refactor of the old \`dev-command-center\` plugin into these two skills, with the`
Replace `into these two skills` with `into these three skills`.

- [ ] **Step 4: Verify**

Run: `grep -c 'house-shaper' README.md` → expected ≥1.
Run: `grep -c 'Three skills' README.md` → expected 1.
Run: `grep -c 'Two skills\|these two skills' README.md` → expected 0.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "readme: document house-shaper (three skills)"
```

---

## Task 6: Bump the version

**Files:**
- Modify: `VERSION`

- [ ] **Step 1: Set the version to 0.4.0**

Replace the entire contents of `VERSION` with:

```
0.4.0
```

- [ ] **Step 2: Verify**

Run: `cat VERSION` → expected `0.4.0`

- [ ] **Step 3: Commit**

```bash
git add VERSION
git commit -m "chore: VERSION 0.4.0 — house-shaper skill (three-skill ecosystem)"
```

---

## Final verification (after all tasks)

- [ ] **The new skill exists, registers, and is reachable at its install path**

Run: `grep -E '^name: house-shaper$' skills/house-shaper/SKILL.md` → 1 match.
(After the user re-runs `./install.sh`, `~/.claude/skills/house-shaper` will resolve. The plan does not run install; flag it in the report so the user re-runs it.)

- [ ] **Orchestrator no longer shapes inline**

Run: `grep -c -E '^   \| 1 scope \|' skills/house-orchestrator/SKILL.md` → `0` (old front-end rows gone).
Run: `grep -c 'redirect guard' skills/house-orchestrator/SKILL.md` → ≥1.

- [ ] **Reconcile-subagent is canonical in the doctrine and cited by the shaper**

Run: `grep -l 'reconcile-subagent\|Reconcile-subagent' skills/house-orchestrator/references/doctrine.md skills/house-shaper/SKILL.md` → both listed.

- [ ] **Scope clean / no always-loaded body weight**

Run: `git diff --name-only main...HEAD` → only `skills/house-shaper/SKILL.md`, `skills/house-orchestrator/SKILL.md`, `skills/house-orchestrator/references/doctrine.md`, `docs/process.md`, `docs/process.html`, `README.md`, `VERSION`, + the spec/plan. NOT `house-builder/SKILL.md`, NOT `install.sh`, NOT any workflow script.
Run: `grep -riE 'leadbook|getleadbook|round rock' skills/house-shaper/SKILL.md skills/house-orchestrator/SKILL.md skills/house-orchestrator/references/doctrine.md` → empty (project-agnostic).

- [ ] **Spec coverage** — new skill (T1), reconcile doctrine pattern (T2), orchestrator redirect+collapse (T3), process md/html (T4), README (T5), version (T6). All mapped.
