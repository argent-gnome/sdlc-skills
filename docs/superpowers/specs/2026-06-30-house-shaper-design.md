# Design — the house-shaper skill (Piece C)

- **Date:** 2026-06-30
- **Repo:** `sdlc-skills`
- **Status:** approved design, pre-plan
- **Part of:** the three-piece ecosystem redesign. **A (done)** doctrine + dev-state contract + routing.
  **B (done)** the remaining hygiene self-checks. **C (this spec)** a new `house-shaper` skill for the
  front-of-loop, plus the orchestrator changes that delegate shaping to it.

## Why

The orchestrator currently does the fuzzy front end (stages 0–4¼: scope/spec/mockup/plan/plan-check) by
composing brainstorming *inline*. That piles the research and brainstorm transcript into the long-lived
conductor's context — the exact bloat the whole token thesis warns against — and there's no defined process for
the research → decide → reconcile flow. This session repeatedly hit it: a decision (Meta-ads ADR) and three
slices of shaping all ran in-conductor.

Piece C extracts shaping into its own **session role** (mirroring the conductor/builder split), with heavy
research + reconcile in subagents and the interactive brainstorm inline. The orchestrator slims to a pure
build/gate/merge conductor and gains a guard that redirects shaping-shaped requests to a shaper session.

## Decisions (locked in brainstorming)

1. **Own user-run session role** — a third session type alongside orchestrator + builder.
2. **Hand-off seam = through plan-check** — a buildable shaper session produces spec + plan + plan-check +
   reconciled docs (ready-to-build); the orchestrator's front end collapses to "confirm a shaper produced this."
3. **Redirect guard = conservative** — the orchestrator punts to a shaper session ONLY on clear shaping (new
   brainstorming/research, new scoping, a new plan, a non-trivial decision, a roadmap change); clarifications,
   status checks, and gate calls stay inline.
4. **Decision-only mode** — the shaper also handles pure decisions (→ ADR + roadmap/dev-state reconcile, no
   build).
5. **VERSION → 0.4.0**; **reconcile-subagent promoted to a named doctrine pattern**; **one slice** (the skill +
   the orchestrator rewrite are coupled).

## Constraints

- **Token-lean.** The shaper is its own session (its transcript dies on close); research + reconcile run in
  subagents (heavy reading isolated); the brainstorm dialogue is inline (unavoidably interactive). Idle cost =
  one tier-1 description line (the third registered skill) — justified as a distinct role.
- **Compose, don't reinvent** — `superpowers:brainstorming`, `intent-first-spec-anchored`, `writing-plans`,
  and the plan-check reviewer pattern already exist. The shaper's only original logic: front-end sequencing,
  research/reconcile dispatch, mode selection, and the hand-off.
- **Project-agnostic**, published artifact (version + docs/site + install), no breaking change to the build
  loop (orchestrator stages 5–11 unchanged).

## Deliverables (Piece C scope)

### 1. New skill — `skills/house-shaper/SKILL.md`

A user-run shaping session. Frontmatter `name: house-shaper` + a description scoped to "shape a fuzzy idea /
backlog item / audible / decision into ready-to-build planned work or a recorded decision; do NOT use to drive
a build (orchestrator) or build a unit (builder)." Body covers:

- **Two output modes:** *buildable* (spec→plan→plan-check→reconcile→hand-off) and *decision-only* (ADR +
  reconcile, no build).
- **The shaper loop:** (1) intake — read dev-state + roadmap + relevant docs per the doctrine doc-model;
  (2) research — dispatch research subagents when investigation is needed (each returns a digest);
  (3) brainstorm — compose `superpowers:brainstorming` + `intent-first-spec-anchored` interactively;
  (4) mode fork; (5) spec → `docs/superpowers/specs/` ⛔ user review; (6) plan → `docs/superpowers/plans/`
  via `writing-plans` (model-routing + "NOT this slice" guards, compile-coupled ordering); (7) plan-check —
  one fresh reviewer subagent, five lenses, fold must-fix; (8) reconcile — dispatch the doctrine's
  reconcile-subagent to apply decisions/plan across ADR/roadmap/dev-state; (9) hand-off summary.
- **Research-subagent pattern** (lives in this skill body): "investigate <question> against <paths/docs>;
  return a digest — findings, options, a recommendation; read a lot, conclude a little; change nothing."
- **Gates** it honors: spec review ⛔, any irreversible/outward action ⛔, plan deviation — same fail-closed
  discipline as the other two skills.
- **Hand-off contract:** what it returns to the user (artifact paths + "ready for an orchestrator session" or
  "decision recorded").

### 2. Doctrine — promote the reconcile-subagent pattern

In `skills/house-orchestrator/references/doctrine.md`, add a named **Reconcile-subagent** pattern (shared by
builder + shaper): "dispatch a subagent to apply a decision/plan/as-built change across the doc-model per the
routing rules — new ADR(s) for decisions, roadmap for scope/sequencing, dev-state for operational state;
change ONLY docs; report what changed." Note that the builder's per-unit doc-reconcile and the shaper's
post-decision reconcile are both instances of it. (The doctrine already lists "shaper / reconcile" as a doc
owner from Piece A — no change needed there.)

### 3. Orchestrator — redirect guard + front-end collapse

In `skills/house-orchestrator/SKILL.md`:

- **Redirect guard** (new section): if a request would start new brainstorming/research, new scoping, a new
  plan, or a non-trivial decision / roadmap change, **recommend a `house-shaper` session** (state what to
  explore; resume the orchestrator when its spec/plan/ADR/roadmap artifacts land) rather than shaping inline.
  Conservative: clarifications, status checks, and gate calls stay inline.
- **Front-end collapse:** the loop-table stages **0–4¼** change from "do brainstorming/spec/mockup/plan/
  plan-check inline" to **"confirm a shaper session produced the ready-to-build artifacts (spec + plan +
  plan-check + reconciled docs); if absent, recommend a shaper session — never shape inline."** The build loop
  (stages 5–11) is unchanged. Update the prose "Confirm the work" step (currently "New slice → scope it
  first… No plan yet? author a plan first…") to point at a shaper session instead.

### 4. Human docs + site + install + version

- `docs/process.md` — "Why two skills" → **three**; update the role table (add house-shaper: shaper / fuzzy
  front end / its own session) and the loop diagram (a shaper phase feeding the orchestrator). Mirror into
  `docs/process.html` (hand-authored).
- `README.md` — update the skill list / install note to include `house-shaper`.
- `install.sh` needs no edit (it already iterates `skills/*/`), but the **install must be re-run** to symlink
  the new skill — call this out in the plan and the PR.
- `VERSION` 0.3.0 → 0.4.0.

## Non-goals (NOT this slice)

- Changing the **build loop** (orchestrator stages 5–11) or the builder skill.
- A **registered agent** for shaping — it's a user-run session/skill, not a tier-1 agent (idle-cost
  discipline).
- Auto-launching a shaper session from the orchestrator (it can't — shaping is interactive with the user; the
  guard *recommends*, the user starts it).
- Any new workflow script; the merge-gate/health-sweep/stack-gates/model-routing are untouched.

## Success criteria

- A `house-shaper` skill exists that a user can run to take an idea from fuzzy → ready-to-build (spec + plan +
  plan-check + reconciled docs) OR → a recorded decision, with research + reconcile in subagents and the
  brainstorm inline.
- The orchestrator no longer shapes inline: its front-end stages confirm shaper output, and the redirect guard
  catches shaping-shaped requests (conservatively).
- The reconcile-subagent is a named, shared doctrine pattern cited by both builder and shaper.
- `process.md` + `process.html` + `README` describe a coherent three-skill ecosystem; `VERSION` = 0.4.0.
- Idle cost grows by exactly one skill description line; no always-loaded body weight added.
