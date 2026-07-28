# Deep critique — `house-shaper` (the fuzzy front end)

**Scope of read.** Full read of:
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-shaper/SKILL.md` (77 lines — the whole skill)
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/references/doctrine.md` (83 lines)

Cross-read for contract mismatches:
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/SKILL.md`
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-builder/SKILL.md`

Composed skills located and read (they ARE findable, at the plugin marketplace path, **not** `~/.claude/skills`):
- `/Users/jake-edwards/.claude/plugins/marketplaces/superpowers-dev/skills/brainstorming/SKILL.md`
- `/Users/jake-edwards/.claude/plugins/marketplaces/superpowers-dev/skills/writing-plans/SKILL.md`
- `/Users/jake-edwards/.claude/skills/intent-first-spec-anchored/SKILL.md`

Ground-truth evidence sampled from ~20 real projects under `/Users/jake-edwards/projects/`.

---

## 0. Headline

The shaper is the **only stage in the house SDLC that creates new units of work**, and it is the only stage that **mints no identity, persists no state, and records no gate outcome**. Everything it decides — the mode fork, the spec-review verdict, the plan-check verdict, the rigor level, the scope guards — exists as prose in a transcript that the skill *explicitly celebrates destroying* (`house-shaper/SKILL.md:16`: "the shaping transcript dies when this session closes").

Separately, the shaper has **two stages that the rest of the system already depends on and that the file does not contain**: `mockup` and `spike`. Verified by grep — `house-shaper/SKILL.md` contains **zero** occurrences of `mockup`, `spike`, `rigor`, `stakes`, `worktree`, `branch`, or `commit`.

---

## 1. What it gets RIGHT — preserve these in any rewrite

### 1.1 Session boundary == context boundary (the load-bearing idea)

`house-shaper/SKILL.md:13-16`:

> **Why a separate session.** Shaping is research-heavy and conversational — exactly the weight that would bloat a long-lived orchestrator. Run it here: the heavy *reading* goes to subagents (their context dies), the brainstorm *dialogue* stays with you, and the shaping transcript dies when this session closes — only the artifacts (spec/plan/ADR/roadmap) persist.

This is the single best design decision in the whole ecosystem and a rewrite must keep it. It correctly identifies three tiers of context (throwaway-read, interactive-dialogue, durable-artifact) and assigns each a different lifetime. **It is also, unmodified, the source of every weakness in §2** — the skill states the principle "only artifacts persist" and then never audits whether the artifacts actually capture what was decided. Keep the principle; add the obligation that *every decision must be written down before the session that made it can end*.

### 1.2 Research dispatch has a real contract, not a vibe

`house-shaper/SKILL.md:38-42`:

> **dispatch research subagents**, one per question, in the background: *"Investigate <question> against <paths/docs>; read a lot, conclude a little; return a digest — findings · options · a recommendation; change nothing."* Only the digest returns; the heavy reading dies in the subagent. NEVER do the deep reading in your own context.

Four things right in one paragraph: **one question per agent** (parallelizable, no shared state — matches `superpowers:dispatching-parallel-agents`), a **read-only guarantee** ("change nothing"), a **fixed return shape** (findings · options · recommendation), and a **prohibition on the parent doing the work**. The return shape is already 80% of a machine-readable digest schema — it just isn't written to disk (§2.9).

### 1.3 Correct taxonomy of what can and cannot be delegated

`house-shaper/SKILL.md:43-45`: "**Brainstorm (interactive — inline).** … This is the dialogue — it cannot be a subagent."

Explicitly naming the one stage that is *not* delegable is better engineering than most agent frameworks manage. Preserve verbatim.

### 1.4 Fresh-reviewer plan-check with fixed lenses and a commitment rule

`house-shaper/SKILL.md:55-58`:

> Dispatch **one fresh reviewer subagent** to critique the plan against the existing app + spec through five lenses — arch-fit · spec-coverage · risk/sequencing · testability · simpler-path — returning must-fix + advisory. Fold must-fix into the plan (re-run `writing-plans` on the deltas). **A folded-in advisory is a commitment.**

- **Fresh** context = genuine independence from the author's rationalizations.
- **Five named lenses** = a checklist, not "review this."
- **"A folded-in advisory is a commitment"** is the strongest sentence in the file. It converts optional advice into an auditable obligation, and — critically — it is **actually enforced downstream**: `house-builder/SKILL.md:33-34` requires "**Commitments survive into the artifact** — every folded-in plan advisory got built (not re-waived)."

That is a real cross-session obligation chain, shaper → builder, and it is the one thing in the system that behaves like persisted state. The tragedy is that the chain is carried **in prose inside the plan document**, so the builder must find it by reading, and nothing can verify it (§2.4).

### 1.5 Fail-closed gate default

`house-shaper/SKILL.md:67-70`:

> STOP and get the user at: **spec review · any plan deviation or genuine ambiguity · any irreversible / outward-facing action**… **Fail closed: unsure whether a gate is hard → treat it as hard.**

The tie-breaker rule is what makes a gate list robust to incompleteness. Preserve. Note the shaper's list is *missing* a gate the orchestrator believes it owns (§2.2) — exactly the case the tie-breaker was designed to save, and it cannot, because the shaper has never heard of that gate.

### 1.6 A mode fork exists at all

`house-shaper/SKILL.md:23-27` and `:46-49`. Recognising that "we made a decision" is a first-class output that should NOT be forced to masquerade as a build is genuinely good process design. Most SDLC skills have no home for a decision that produces no code. The fork's *implementation* is malformed (§2.6), but the concept must survive.

### 1.7 Ruthless self-scoping ("your only original logic is…")

`house-shaper/SKILL.md:9-11` and `:72-76`:

> You **compose existing skills — you do not reimplement them.** Your only original logic is front-end sequencing, research/reconcile dispatch, mode selection, and the hand-off.

Stating the skill's own surface area twice, in the same words, is what keeps this file at 77 lines instead of 500. Preserve the discipline — but see §3: the composition is asserted, never *reconciled*, and the composed skills fight back.

### 1.8 Role-based model routing with a stated rationale

`house-shaper/SKILL.md:18-21`: shaping on Fable ("a spec flaw is the most expensive thing to catch later"), research/reconcile on Opus ("heavy read / light conclude"), the plan-check reviewer stays on Fable. Routing by *cognitive role* rather than task size, with cross-architecture independence for review, is correct and should survive verbatim.

### 1.9 Reconcile as a subagent with a routing contract

`doctrine.md:76-83` — the reconcile-subagent pattern, shared by shaper and builder, with an explicit "Change ONLY docs; report what you changed." Correct isolation of a heavy read/write job, and correct blast-radius limit.

---

## 2. Structural weaknesses

### 2.1 There are two incompatible stage numbering systems, and the authoritative one is in a different file

The shaper's own loop (`house-shaper/SKILL.md:34-65`) is **nine numbered steps**: Intake · Research · Brainstorm · Mode fork · Spec · Plan · Plan-check · Reconcile · Hand-off.

The orchestrator's stage table (`house-orchestrator/SKILL.md:77`) describes the same work as:

> | 0–4¼ shape (delegated) | **Shaping runs in a `house-shaper` session, not here** — spike · scope · spec · mockup · plan · plan-check.

So the canonical stage vocabulary — `spike · scope · spec · mockup · plan · plan-check`, numbered 0 through 4¼ — lives **only in the orchestrator**, which the shaper session never loads. The shaper's step 7 is even labelled "**Plan-check (4¼)**" (`house-shaper/SKILL.md:55`), importing a stage number from a numbering scheme that appears nowhere in its own file. `4¼` is meaningless in a 1–9 list.

Two of the orchestrator's six shaping stages — **spike** and **mockup** — have no corresponding step in the shaper. A third — **scope** — is not a step either (it is implied inside brainstorm). An IDE that wants to show "which shaping stage are we in" has to pick one of two disagreeing vocabularies, and the one with more stages is defined in the skill that *doesn't run them*.

### 2.2 The mockup stage is missing from the text — and the orchestrator explicitly delegates a mockup GATE to it

Verified by grep: `house-shaper/SKILL.md` contains **zero** occurrences of "mockup". `doctrine.md` contains **zero** occurrences of "mockup".

Yet `house-orchestrator/SKILL.md:128` states:

> (Spec review and mockup sign-off are gates in the *shaper* session, not here.)

and `house-orchestrator/SKILL.md:150-152`:

> *content / mechanical* → light (single-reviewer merge-gate; **the shaper skips the mockup**); *feature / UI* → full ceremony + **mockup sign-off in the shaper**; *risky / novel* → **the shaper adds a spike**.

and `house-orchestrator/SKILL.md:85` (stage 10) treats the mockup as a shipping artifact:

> **the spec, plan, and any approved mockup ship IN the slice PR** (the cited design authority — never "throwaway")

So the system has: a stage the shaper must run, a **hard gate** the shaper must hold, a rigor-dial rule for when to skip it, and a PR-shipping obligation — for an artifact whose **name never appears in the shaper's instructions**. The fail-closed rule at `house-shaper/SKILL.md:70` cannot rescue this: you cannot be "unsure whether a gate is hard" about a gate you have never heard of.

**The wild-state consequence is exactly what you'd predict — 2 directories × 4 naming conventions:**

| Project | Path | Naming style |
|---|---|---|
| `cash-track-mobile` | `docs/mockups/reskin-preview.html` | bare topic |
| `dev-command-center` | `docs/mockups/board-collapsible-lanes.html` | bare topic |
| `prediction-arbitrage` | `docs/mockups/2026-06-18-dashboard-mockup.html`, `…-v2.html` | date + `-mockup` + manual `-v2` versioning |
| `maintenance-mode` | `docs/mockups/slice-2-write-path.html`, `main-screen.html`, plus a **`gen.mjs` generator script** | slice-keyed, mixed with unkeyed, plus stray tooling |
| `athlete-data` | `docs/superpowers/mockups/2026-07-27-bulk-slice-2-home-ui.html` | date + slice key |
| `shipsite` | `docs/superpowers/mockups/2026-06-15-home.html` | date + topic |
| `spanish-coach` | `docs/superpowers/mockups/01-drill.html`, `06-derivation-card.html` | ordinal sequence |

For the IDE this is the worst possible finding, because the mockup is the artifact with the **most specific IDE requirement in the entire brief** ("embedded webview for self-contained HTML mockups"). The IDE needs (a) one canonical directory, (b) a slice key in the name or frontmatter, (c) a declared "self-contained, no external fetches" contract, and (d) a sign-off state. It currently has none of the four, and `maintenance-mode/docs/mockups/gen.mjs` shows the convention vacuum already got filled with per-project bespoke tooling.

Note also: `superpowers:brainstorming` **does** have a visual stage — the "Visual Companion" (`brainstorming/SKILL.md:147-165`), a *browser-based, ephemeral, consent-gated* tool. That is a different thing from a durable, committed, PR-shipped mockup, and the shaper composes brainstorming without ever distinguishing them. So "the mockup stage" is simultaneously (i) absent from the shaper, (ii) a hard gate in the orchestrator, and (iii) an ephemeral browser tool in the composed skill. Three concepts, one word.

### 2.3 The rigor dial is unreachable from the shaper

`house-orchestrator/SKILL.md:148-155` defines the rigor dial and assigns **two specific shaper behaviours** to it ("the shaper skips the mockup", "the shaper adds a spike"). The shaper is told to read exactly one shared reference:

`house-shaper/SKILL.md:29-32`:
> The doc-model, routing rules, and the **reconcile-subagent** pattern live in **`$HOME/.claude/skills/house-orchestrator/references/doctrine.md`**… It is the single source of truth for *what goes where*.

Grep confirms `doctrine.md` contains **zero** occurrences of `rigor`, `stakes`, `mockup`, or `spike`. The rigor dial lives in `house-orchestrator/SKILL.md`, which a shaper session has no reason to load (and the orchestrator's own guard at `:40-47` pushes shaping work out of that session entirely).

**Net: the two rigor-dial behaviours the system assigns to the shaper are literally unreachable from the shaper's instruction set.** This is the sharpest structural bug in the component.

Worse, there are **three different rigor dials** in the ecosystem:
1. `house-orchestrator/SKILL.md:148-155` — content/mechanical · feature/UI · risky/novel, governing merge-gate form.
2. `intent-first-spec-anchored/SKILL.md:51-56` — regulated/correctness-critical vs throwaway prototype, "judge by the cost of a wrong-but-plausible decision".
3. Nothing in `doctrine.md` — the file both other skills call "the single source of truth."

The shaper composes #2 at step 3 (`house-shaper/SKILL.md:43-44`) and is governed by #1 without being able to read it. Nobody reconciles the two vocabularies.

### 2.4 Plan-check output is promised as an artifact and never written as one

The frontmatter promises an artifact. `house-shaper/SKILL.md:3`:

> turn a fuzzy idea… into ready-to-build planned work (**spec + plan + plan-check** + reconciled docs)

`:24-25` repeats it. The orchestrator's stage-0 gate depends on it — `house-orchestrator/SKILL.md:77`: "Confirm it produced ready-to-build artifacts: spec (user-reviewed) + plan + **plan-check** + reconciled…", gated "⛔ shaper artifacts present".

But the body **never instructs anyone to write a plan-check anywhere**. Step 7 (`:55-58`) says only "returning must-fix + advisory. Fold must-fix into the plan." The verdict surfaces exactly once, in a chat sentence — `house-shaper/SKILL.md:64`:

> Plan-check: **`<verdict>`**. Ready for a `house-orchestrator` session to build.

And the verdict **enum is never defined anywhere in the skill**. Grep for `GO`, `NO-GO`, `GO-WITH-FIXES` in `house-shaper/SKILL.md`: the only hit is the literal `<verdict>` placeholder on line 64. The GO / GO-WITH-FIXES / NO-GO vocabulary is folklore transmitted by habit, not specification.

**Wild-state evidence.** Across ~40 plan files in `/Users/jake-edwards/projects/*/docs/superpowers/plans/`, only four carry a recoverable plan-check record, in four mutually incompatible vocabularies:

- `athlete-data/docs/superpowers/plans/2026-07-23-single-tenant-decommission.md:374` — `### Plan-check folded (2026-07-23, Fable reviewer — verdict GO-WITH-FIXES)`
- `athlete-data/docs/superpowers/plans/2026-07-27-bulk-slice-2-home-ui.md:19` — `**Plan-check (2026-07-27, Fable): GO-WITH-FIXES — all folded.**`
- `athlete-data/docs/superpowers/plans/2026-07-27-bulk-app-foundation.md:863` — `Fresh-reviewer verdict: **structurally sound**;` (no enum at all)
- `cash-track-mobile/docs/superpowers/plans/2026-07-01-settings-bucket-management.md:999` — `Fresh-reviewer verdict: **APPROVE-WITH-MUST-FIX**`

Four vocabularies, one free-text, positions ranging from line 15 to line 999, and ~90% of plans with no record at all. The orchestrator's ⛔ gate "confirm plan-check present" is therefore unfalsifiable: a plan with no plan-check note is indistinguishable from a plan whose plan-check said GO.

**Should plan-check output persist? Unambiguously yes** — and not as prose. It is the only cross-session obligation the system has (`house-builder/SKILL.md:33-34` must verify folded advisories were built). It needs to be structured: `{verdict, lenses_run[], must_fix[{id, text, folded_at}], advisory_folded[{id, text}], advisory_waived[{id, reason}]}`. Then "commitments survive into the artifact" becomes a *checkable* claim instead of a hope.

### 2.5 The pipeline is a straight line — no NO-GO branch, no loop-backs, no iteration cap

Step 7 (`house-shaper/SKILL.md:57-58`) says: "Fold must-fix into the plan (re-run `writing-plans` on the deltas)." That is the only outcome contemplated. There is no branch for:

- **NO-GO** — the plan-check concludes the *plan* is unsalvageable → back to step 6.
- **Spec is wrong** — a plan-check lens ("arch-fit", "simpler-path") finds the *spec* is the problem → back to step 3/5. This is the most valuable finding a plan-check can produce and there is no edge for it.
- **Scope explosion** — the plan reveals this is three slices → the shaper has no multi-output shape at all (§4.6).
- **Iteration limit** — no cap on fold→recheck cycles, no escalation when the reviewer keeps finding must-fixes.

Contrast the composed skill, which *does* model its control flow: `brainstorming/SKILL.md:36-63` is an explicit `digraph` with two revise-loops (`"User approves design?" -> "Present design sections" [label="no, revise"]`, `"User reviews spec?" -> "Write design doc" [label="changes requested"]`). The shaper — the outer, orchestrating skill — is less rigorous about its own control flow than the inner skill it composes.

### 2.6 Decision-only mode is not well-formed

`house-shaper/SKILL.md:46-48`:

> - **Decision-only** → write the ADR (`docs/adr/NNNN-<slug>.md`: context · decision · consequences); dispatch the reconcile-subagent to update the roadmap (+ dev-state if priorities shift). Skip to step 9.

Six defects:

1. **`NNNN` allocation is undefined.** Nothing says how the number is chosen, who guarantees uniqueness, or what happens when two shaping sessions — or a shaper and a builder's reconcile-subagent, which is also authorised to create ADRs (`house-builder/SKILL.md:39-40`) — both pick `0009`. The one piece of genuinely global, monotonic state in the doc model has no allocator.
2. **No ADR status or lifecycle.** `doctrine.md:13` defines an ADR as "context · decision · consequences" — no `Status: proposed|accepted|superseded`, no `Supersedes:`/`Superseded-by:`. A decision reversed three slices later leaves two contradictory ADRs with nothing marking which is live.
3. **No link forward.** A decision-only ADR that later becomes buildable work has no field connecting it to the slice that implements it. In practice this is done by hand — `athlete-data/docs/superpowers/plans/2026-07-28-bulk-slice-3a-progress-card.md:6` says "the rate-based card **ADR-0007** decided" in a prose Goal line. There is no backlink from ADR-0007.
4. **Decision-only has NO gate.** Buildable mode gets `⛔ **User review gate**` at `:51`. Decision-only writes an ADR and reconciles the roadmap with **zero** ⛔ in its path — the Gates section (`:67-70`) lists "spec review", and decision-only produces no spec, so none of the three listed gates fires. This is backwards: a positioning call or priority reshuffle is *less* reversible than a spec (there is no build stage downstream to catch it) and gets *less* ceremony.
5. **Its reconcile duplicates step 8 with a narrower, divergent contract.** Step 4 dispatches reconcile for "roadmap (+ dev-state if priorities shift)"; step 8 (`:59-61`) dispatches it for "new ADR(s) for decisions made, roadmap…, dev-state (add it to **Slated**)". Two invocations of the same subagent from the same skill with different scopes — and the decision-only one omits ADR routing entirely, because it wrote the ADR by hand, inline, in the parent context, contradicting doctrine's own rationale (`doctrine.md:76-78`) that doc-writing is "heavy doc read/write — dispatch it to a subagent so it stays out of the parent's context".
6. **"Skip to step 9" is a goto into a step written for the other mode.** Step 9 happens to have two bullets, so it works — but the control flow is a jump, not a fork with two terminal states.

### 2.7 Slice identity is never minted — by the only stage that could mint it

The shaper is where a unit of work is *born*. It never gives it a name.

`doctrine.md:25` requires one: "**Active slice** — **id** · title · stage · next action · blocked-on". Nothing in the shaper creates that id. The orchestrator's dev-state template (`house-orchestrator/SKILL.md:167`) has `## Active slice: <id> — <title>` — the same unfilled dependency.

The de-facto identity is the filename stem, `YYYY-MM-DD-<topic>`, set independently by two different composed skills (`brainstorming/SKILL.md:111` for the spec, `writing-plans/SKILL.md:18` for the plan) with no rule that the `<topic>` match. **It doesn't:**

| Project | Plan | Retro | Key relationship |
|---|---|---|---|
| `edge-scanner` | `2026-07-07-dfs-optimizer-oom-fix.md` | `2026-07-07-dfs-oom-fix-retro.md` | slug silently drifted (`dfs-optimizer-oom-fix` → `dfs-oom-fix`) |
| `athlete-data` | `2026-07-23-single-tenant-decommission.md` | `slice-4a-single-tenant-decommission-retro.md` | date-key → slice-key, different scheme |
| `dev-command-center` | `2026-06-11-slice-2-board-read-view.md` | `dev-command-center-slice-2-retro.md` | project-prefixed, dateless |
| `cash-track-mobile` | `2026-07-01-ui-reskin-mm-idiom.md` | `reskin-mm-idiom-retro.md` | dateless, truncated slug |

Four retro naming schemes across four projects. **There is no key that joins a slice's spec + plan + mockup + ADRs + retro.** An IDE side pane cannot group them; it can only fuzzy-match slugs.

Related: **date-as-identity is structurally wrong.** `edge-scanner/docs/retros/` has eight retros all stamped `2026-07-07`. `edge-scanner/docs/superpowers/plans/` holds `2026-07-06-edge-scanner-phase0.md` and `2026-07-06-edge-scanner-phase0-lean.md` — two versions of one slice distinguished only by a `-lean` suffix (0/65 and 47/71 checkboxes ticked respectively, so on disk it is genuinely ambiguous which one shipped). And the date records *when the doc was typed*, not the slice's identity — so re-shaping an audible (which `house-orchestrator/SKILL.md:115-118` explicitly routes back to a shaper session) mints a *new* date-keyed plan that orphans the original with nothing linking them.

### 2.8 The spec review gate leaves no trace on disk

`house-shaper/SKILL.md:50-51`:

> Produce the validated design → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (via brainstorming's spec step). ⛔ **User review gate** — the user reviews the written spec before planning.

The gate fires in conversation and dies with it. The skill defines **no Status field** for the spec, and neither does `doctrine.md`. The composed skill's gate (`brainstorming/SKILL.md:126-131`) is equally trace-free — it prescribes a chat message and a wait, and writes nothing.

**Result: passing the gate and never running it are indistinguishable on disk.** Seven vocabularies filled the vacuum:

```
athlete-data/…/2026-07-07-ingestion-foundation-design.md:4        Status: Approved for planning
cash-track-mobile/…/2026-05-28-slice-3-bucket-header-design.md:4  Status: Approved for implementation
cash-track-mobile/…/2026-05-19-cash-track-mobile-v1-design.md:4   Status: Approved for slice-1 implementation
cash-track-mobile/…/2026-07-01-ui-reskin-mm-idiom-design.md:4     Status: Approved (design), pending spec review → plan
edge-scanner/…/2026-07-06-edge-scanner-phase0-lean-design.md:4    Status: shaped, user-reviewed → ready for planning
maintenance-mode/…/2026-06-14-slice-1-schedule-list-design.md:4   Status: Design — pending user review
run-easy/…/2026-05-04-run-easy-design.md:4                        Status: Awaiting spec review
```

And it goes stale exactly as the prior audit found: **all nine** `maintenance-mode` specs still read `Status: Design — pending user review` / `pending spec review`, for slices that shipped weeks ago. One project does it properly — `spanish-coach/…/2026-06-09-cognate-pool-generator-design.md:4`: `Status: Implemented (Slice 5a, merged 2026-06-10) — with an as-built deviation` — which proves the field is *useful* and that keeping it fresh is currently per-project heroism, not process.

### 2.9 Research digests are thrown away

`house-shaper/SKILL.md:41-42`: "Only the digest returns; the heavy reading dies in the subagent." Correct for the *reading*. But the **digest** is never written to disk either — it enters the shaper's context, informs the spec, and dies with the session (`:16`).

Consequences: the spec records conclusions with no traceable evidence; the plan-check reviewer (step 7) is dispatched to critique "the plan against the existing app + spec" (`:56`) and is **not given the research digests**, so it can only rediscover that ground by accident; and the next slice that asks the same question pays for the research again.

The need is real and the vacuum is already filled ad-hoc: `maintenance-mode/docs/superpowers/spikes/` and `hims-pilot-recert/docs/superpowers/spikes/` exist, cited by hand from specs —
`maintenance-mode/docs/superpowers/specs/2026-06-18-data-model-restructure-a-design.md:4`:
> **Status:** Design — approved in brainstorm; pending spec review. (Stage-0 spike **GO**, `docs/superpowers/spikes/2026-06-18-data-model-migration-spike.md`.)

This is *also* the missing "spike" stage (§2.1/§2.3) reappearing as an emergent convention, with its own undefined `GO` verdict, in 2 of ~20 projects. The skill should own it.

### 2.10 The shaper writes and commits to git with no repo-state awareness

Grep confirms: `house-shaper/SKILL.md` never mentions `branch`, `worktree`, or `commit`. But the shaping session unavoidably commits — `brainstorming/SKILL.md:114` instructs "Commit the design document to git", and step 8's reconcile-subagent rewrites `roadmap.md` and `dev-state.md`.

So a shaping session can, with no check: commit a spec onto whatever branch is checked out (including a builder's live feature branch), commit onto a dirty tree, or edit `dev-state.md` while an orchestrator session is mid-write. The orchestrator has a full "Git reality" sweep for exactly this hazard class (`house-orchestrator/SKILL.md:51-58`); the shaper — which mutates the same files — has none. Intake (`:35`) tells it to *read* `dev-state.md`, whose allowlist includes "**In-flight** — builders / open PRs" (`doctrine.md:26`), but never tells it to *act* on finding a builder in flight.

Compounding this: `writing-plans/SKILL.md:16` states "**Context:** This should be run in a dedicated worktree (created by brainstorming skill)." The current `brainstorming` skill creates no worktree (no mention in its 165 lines). The shaper neither satisfies this precondition nor overrides it — it composes a skill carrying a **silently false** environmental assumption.

### 2.11 The hand-off is prose to a human, not a payload to the next session

`house-shaper/SKILL.md:62-65` produces a sentence. The next actor is a fresh `house-orchestrator` session whose stage-0 job is "Confirm it produced ready-to-build artifacts" (`house-orchestrator/SKILL.md:77`) — a confirmation it must perform by re-reading files, because there is no manifest.

The *builder's* required inputs are fully enumerated one file over — `house-builder/SKILL.md:14-16`:

> `{ project, repoPath, stack, topology, planPath, the unit/task, "NOT this slice" scope guards, spec path(s), model-routing note }`. If any is missing or the plan is ambiguous, **report `NEEDS_CONTEXT`** — don't guess.

The shaper *produces* several of these (`house-shaper/SKILL.md:53`: "Carry a model-routing note + 'NOT this slice' scope guards") but emits them only as prose inside the plan. The chain is: shaper writes fields as prose → orchestrator re-extracts them by reading → builder receives them as a dispatch dict → builder reports `NEEDS_CONTEXT` if extraction was lossy. A structured hand-off collapses three lossy hops into one.

### 2.12 The scope guards and routing note have no defined home in the plan

`house-shaper/SKILL.md:52-54` tells the shaper to "Carry a model-routing note + 'NOT this slice' scope guards" into a document produced by `writing-plans`, whose mandatory header template (`writing-plans/SKILL.md:45-61`) is:

```markdown
# [Feature Name] Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: …
**Goal:** … **Architecture:** … **Tech Stack:** …
```

There is **no slot** for scope guards, no slot for a model-routing note, no slot for a plan-check record. Three house-critical fields are instructed into a template with nowhere to put them, so they land wherever the model feels like — exactly what §2.4's evidence shows (plan-check notes at line 15, 19, 374, 863, 999).

### 2.13 Doctrine — the "single source of truth for what goes where" — uses placeholders for the two paths it is most asked about

`doctrine.md:14`:

> | `docs/<specs>/…` · `docs/<plans>/…` | Per-slice spec + plan — the design authority that ships IN the slice PR. |

Angle brackets. Meanwhile `house-shaper/SKILL.md:50` and `:52` hardcode `docs/superpowers/specs/` and `docs/superpowers/plans/`. The source of truth declines to state the truth, and the actual truth is duplicated in a skill file — and again in `brainstorming/SKILL.md:111` and `writing-plans/SKILL.md:18`, both with an override clause ("User preferences for spec location override this default"). Four files, one convention, no owner.

Same pattern for the roadmap: `house-shaper/SKILL.md:35` says "`docs/roadmap.md` **or equivalent**" and `doctrine.md:18-19` says "A project may name it differently, but that doc MUST exist" — an escape hatch with **no discovery mechanism**. An IDE cannot find "or equivalent."

### 2.14 dev-state heading drift is already live, and the shaper writes into it

The allowlist (`doctrine.md:23-31`) names seven exact sections. Reality:

- `edge-scanner/docs/dev-state.md:5` — `## Active work` (not "Active slice")
- `hims-pilot-recert/docs/dev-state.md` — 6 of 7, no `## Process notes`, different order
- `web-services/docs/dev-state.md` — **11 H2s, 7 off-allowlist**: `## 🚀 LIVE: LeadBook is public at…` (:13), `## Last shipped:…` (:111), `## Resources/Blog (live)…` (:118), `## Product state — DOGFOOD-VALIDATED end to end` (:128), `## Reference docs` (:164), `## Build-window units DONE` (:168) — durable strategy and reference material living in the operational tracker, precisely what `doctrine.md:33-40` bans
- `athlete-data/docs/dev-state.md:82` — `## Open owner follow-ups (non-blocking — from bulk-app Slice 1)`, an eighth section

The allowlist is a *lint rule with no linter*. `house-orchestrator/SKILL.md:86` at least says "Run the dev-state lint (doctrine)"; the shaper's step 8 says only "dev-state (add it to **Slated**)" — it mutates the file with no obligation to lint it.

### 2.15 Composed skills are referenced by name with no version pinning

`house-shaper/SKILL.md:73` invokes `superpowers:brainstorming`, `intent-first-spec-anchored`, `superpowers:writing-plans` — third-party skills that evolve independently and **have already broken once**: the available-skills list shows `superpowers:brainstorm` and `superpowers:write-plan` as "Deprecated - use the … skill instead" shims. The shaper's step 5 depends on `brainstorming`'s step 6 output path; if upstream changes that path (and it explicitly permits overrides), the shaper silently emits specs elsewhere and nothing notices.

---

## 3. Where it fights or duplicates the superpowers skills it composes

### 3.1 `brainstorming` hard-drives to `writing-plans` — which breaks the mode fork

`brainstorming/SKILL.md:66`:

> **The terminal state is invoking writing-plans.** Do NOT invoke frontend-design, mcp-builder, or any other implementation skill. The ONLY skill you invoke after brainstorming is writing-plans.

reinforced by its checklist step 9 (`:32`), its digraph terminal node (`:48`, `doublecircle`), and `:135-136` ("Do NOT invoke any other skill. writing-plans is the next step.").

The shaper places its **mode fork at step 4, AFTER brainstorm at step 3** (`house-shaper/SKILL.md:43-49`). So in decision-only mode the shaper must, at the exact moment brainstorming reaches its declared terminal state, refuse the transition brainstorming states three times in imperative caps. The shaper never acknowledges the conflict or grants itself an override. In practice the composed skill's louder, more repeated instruction will often win — meaning **decision-only mode has a structural tendency to leak into buildable mode.**

Fix direction: fork *before* brainstorming, and wrap it — "you are running brainstorming in decision-only mode; its terminal transition to writing-plans is overridden by the shaper."

### 3.2 `brainstorming` always writes and commits a design doc — even for decision-only

`brainstorming/SKILL.md:29` (checklist) and `:111-114`: "Write design doc — save to `docs/superpowers/specs/…-design.md` and commit". `:16-18` explicitly forbids skipping ("Every project goes through this process. A todo list, a single-function utility, a config change — all of them").

Decision-only mode wants an ADR, not a spec. Composed as written, decision-only produces **both** — a spec file in `specs/` for something that will never be built (permanently stuck at whatever Status vocabulary it picked, §2.8) plus the ADR. Nothing tells the shaper to suppress, relocate, or clean up the spec.

### 3.3 Two self-review layers and one subagent review, none aware of each other

- `brainstorming/SKILL.md:116-124` — **Spec Self-Review**: placeholder scan · internal consistency · scope check · ambiguity check, "Fix any issues inline. No need to re-review."
- `writing-plans/SKILL.md:122-132` — **Plan Self-Review**: spec coverage · placeholder scan · type consistency, "This is a checklist you run yourself — **not a subagent dispatch**."
- `house-shaper/SKILL.md:55-58` — **Plan-check**: a *fresh subagent* through five lenses, of which **spec-coverage** exactly duplicates writing-plans' self-review #1.

The shaper never mentions the two inner self-reviews. They are not harmful (self-review then fresh-review is a fine ladder) but nothing says so, nothing says the fresh reviewer may assume placeholder-scanning is done, and `writing-plans:124`'s "not a subagent dispatch" reads as a mild instruction *against* what the shaper then does. No stated division of labour.

Note also: **the spec has no fresh-eyes external review at all** — only brainstorming's inline self-review plus the human. Given `house-shaper/SKILL.md:19-20` ("a spec flaw is the most expensive thing to catch later"), the ceremony is inverted: the *plan* gets an independent adversarial reviewer, the *spec* — where the expensive flaws live — gets a self-check. Evidence the gap is felt: `edge-scanner/docs/superpowers/specs/2026-07-06-edge-scanner-design.md:3` — "folded the adversarial spec-gate findings (**3 reviewers, 5 lenses**)" — a spec-gate that exists in no skill.

### 3.4 `writing-plans`' execution handoff contradicts the house topology

`writing-plans/SKILL.md:134-153` ends by offering the user a choice between subagent-driven and inline execution and naming the required sub-skill. In the house model **that decision belongs to the orchestrator**, which owns dispatch and topology (`house-orchestrator/SKILL.md:104-106`, single-session vs multi-session). The shaper composes `writing-plans` and never suppresses its trailing prompt, so the shaping session ends by offering the user an execution menu the house process already decided elsewhere.

### 3.5 `writing-plans` assumes a worktree the pipeline never creates

`writing-plans/SKILL.md:16` — see §2.10. A stale cross-skill coupling the shaper should explicitly override.

### 3.6 `intent-first-spec-anchored` is composed as a peer but declares itself subordinate

`house-shaper/SKILL.md:43-44` composes it alongside brainstorming as an equal. The skill itself says (`intent-first/SKILL.md:28-33`): "This is a **lens**, not a workflow of its own… Priority: **user instructions > Superpowers process skills > this lens > defaults**." So brainstorming outranks it, which matters where they differ — e.g. brainstorming's "Propose 2-3 approaches" (`:82`) vs intent-first's "Don't hand implementation trivia back to the user as questions" (`:47-49`). And its rigor dial (`:51-56`) is the third, unreconciled dial (§2.3).

### 3.7 Both composed skills carry "user preferences override this default" path escapes

`brainstorming/SKILL.md:112` and `writing-plans/SKILL.md:19`. In a house-standardised system these are a liability: they are the mechanism by which output paths drift out from under `doctrine.md`, and neither the shaper nor doctrine closes them.

---

## 4. Implicit assumptions that break

### 4.1 "The shaping session runs to completion"

The whole design (`:13-16`) assumes the session lives from intake to hand-off. There is **no resumable state**. If the session dies:

- **after step 5, before 6** — a spec exists with no Status field (§2.8) and no dev-state entry (Slated is written at step 8). A new orchestrator session resuming from `dev-state.md` sees *nothing*; the spec is invisible. There is no "shaping in progress" state in the doctrine allowlist (`doctrine.md:23-31`) — the seven sections are Active slice · In-flight · Slated · Done · Infra · Gotchas · Process notes, and In-flight is defined as "builders / open PRs" (`:26`), not shaping sessions.
- **after step 6, before 7** — a plan exists that has never been plan-checked, indistinguishable from one that passed (§2.4). The orchestrator's ⛔ "shaper artifacts present" gate will pass it.
- **between 8 and 9** — dev-state says `Slated` for work the user never saw handed off.

No idempotency rule either: re-running a shaping session for the same idea produces a second date-stamped spec and plan with nothing marking the first superseded (`edge-scanner`'s `2026-07-06-edge-scanner-phase0.md` **and** `…-phase0-lean.md` are exactly this).

### 4.2 "Exactly one shaping session at a time"

Broken by three shared mutable resources with no coordination:
- **ADR numbers** (`:47`, `NNNN`) — no allocator (§2.6.1); the builder's reconcile-subagent can also mint ADRs (`house-builder/SKILL.md:39-40`).
- **`dev-state.md` Slated** (`:61`) — last-writer-wins, and an orchestrator may be writing the same file concurrently.
- **`roadmap.md`** (`:61`) — same.

Plus the slice-identity ambiguity the prior audit found (two "Slice N" series coexisting) is *created here*, at the only place slices are named — §2.7.

### 4.3 "The human is present and synchronous"

`:51` `⛔ **User review gate**` blocks indefinitely with no park behaviour. The orchestrator has a rule for this — `house-orchestrator/SKILL.md:129`: "Running unattended never downgrades a hard gate — **notify and halt**." The shaper has no equivalent, no notify mechanism, and no artifact that records "spec X has been awaiting review since <timestamp>." A human returning after two days must reconstruct where the session was from the transcript — the thing the design says will be gone.

This is the assumption the IDE brief most directly attacks: a side pane that "auto-opens specs as sessions produce them" *is* a mechanism for asynchronous review, and it needs an `awaiting_review` state that exists in no file today.

### 4.4 "The plan-check reviewer has enough context"

`:56` dispatches it to critique "the plan against the existing app + spec." It is **not** given: the research digests (§2.9 — they no longer exist), the existing ADRs (so it cannot flag "this contradicts ADR-0004"), the roadmap (so it cannot flag sequencing conflicts with slated work), the health backlog, or prior retros' gate-friction findings. Its "arch-fit" lens is asked to judge architectural fit against source material it was not handed.

### 4.5 "Research subagents are cheap and reliable"

One dispatch per question, no verification pass, no record of which digest supported which spec claim. `intent-first/SKILL.md:59-62` demands, for exact/high-stakes rules, "an independent / adversarial verification pass against the source… Never let a plausible paraphrase stand in for an exact requirement." The shaper composes that skill and never wires the requirement into its research stage.

### 4.6 "One idea → one spec → one plan → one slice"

The composed skill handles decomposition — `brainstorming/SKILL.md:73-74`: "if the request describes multiple independent subsystems… help the user decompose into sub-projects… Each sub-project gets its own spec → plan → implementation cycle." `writing-plans/SKILL.md:22-23` says the same for plans. The **shaper's loop has no such branch**: steps 5-8 are singular throughout, and step 8 writes "add **it** to Slated" (singular).

Reality already exceeds the model: `edge-scanner/docs/retros/` contains `2026-07-07-track-a-edge-math-retro.md`, `track-b-infra`, `track-c-local`, `track-c-remote-golive` — one shaped thing that became four parallel tracks, with a `track-X` naming scheme invented on the spot and used nowhere else in the fleet.

### 4.7 "Buildable ⇒ code"

The two modes are buildable and decision-only. There is no mode for: docs-only work, a research-only investigation whose output is a digest, a mockup-only exploration, or spec-only work that parks. `edge-scanner/docs/phase0-probe-findings.md` — a top-level, un-modelled doc — is what that vacuum produces.

---

## 5. What an IDE observing this process needs the shaper to emit (and doesn't)

The IDE brief: workspace per project · side pane listing/auto-opening specs/plans/mockups **as sessions produce them** · rendered markdown + embedded webview for self-contained HTML mockups · roadmap/dev-state as a home screen · embedded terminal hosting the sessions. Mapped onto today's emissions:

| IDE need | What exists today | Gap |
|---|---|---|
| **Group artifacts by slice** in the side pane | filename slugs, 4 divergent naming schemes (§2.7) | **No `slice_id` anywhere.** Must be minted at intake and stamped in every artifact's frontmatter. |
| **Auto-open a spec the moment it needs review** | a chat message inside a dead session (§2.8) | No `awaiting_review` state, no timestamp, no event. The IDE's flagship feature has no signal to bind to. |
| **Show pipeline position** (shaping · research · spec · plan-check) | prose in a transcript | No current-stage field; the two stage vocabularies disagree (§2.1). |
| **Render mockups in a webview** | 2 dirs × 4 naming schemes, no self-containment guarantee (§2.2) | Canonical path + `slice_id` + declared "no external fetches" contract + sign-off state. |
| **Show a gate is blocking, and on whom** | fail-closed prose (`:67-70`) | No blocked-on record: which gate, since when, what question, who owns it. |
| **Show plan-check result** | one prose sentence, verdict enum undefined (§2.4) | Structured `{verdict, must_fix[], advisory_folded[], advisory_waived[]}` — also what makes `house-builder:33-34`'s commitment check verifiable. |
| **Home screen = roadmap + dev-state** | roadmap has a blessed name and **zero format contract** (`doctrine.md:12,18-19`); dev-state has an allowlist with no linter (§2.14) | Roadmap needs a schema; dev-state needs machine-checkable sections. |
| **Launch the next session from the terminal pane** | a prose sentence (`:62-65`) | The kickoff payload `house-builder:14-16` already enumerates, emitted as data. |
| **Show provenance** — why is this in the spec? | digests die with the session (§2.9) | Research digests as durable artifacts, linked from spec claims. |
| **Notice a stalled session** | nothing | Append-only event log with timestamps: a session that emitted `spec.review.requested` 40h ago and nothing since is a visible stall. |

**Minimum emission set** — two mechanisms: frontmatter on every artifact, and an append-only JSONL event log per repo (`docs/.house/events.jsonl` or equivalent).

*Frontmatter (every spec/plan/mockup/ADR/research/retro):*
```yaml
slice_id: es-014            # stable, non-date, minted at intake
kind: spec | plan | mockup | adr | research | retro
status: draft | awaiting_review | approved | superseded | shipped
mode: buildable | decision-only
rigor: light | standard | high
supersedes: es-014-spec-v1  # optional
```

*Events (append-only, timestamped, session-attributed):*
```
shaping.started {slice_id, repo, idea}
research.dispatched {question} / research.returned {digest_path}
mode.selected {mode, rationale}
spec.written {path} / spec.review.requested {path} / spec.review.resolved {approved|changes}
mockup.written {path} / mockup.signoff.requested / mockup.signoff.resolved
plan.written {path}
plancheck.completed {verdict, must_fix_count, advisory_folded[], advisory_waived[]}
reconcile.applied {docs_changed[]}
handoff.ready {kickoff_payload}
```

The `.requested`/`.resolved` pairs are what let the IDE badge a blocked slice, and what let a session that died mid-gate be *resumed* rather than restarted.

---

## 6. If I were rewriting it from scratch — the 5 biggest changes

### 6.1 Mint slice identity at intake, and make a per-slice manifest the primary artifact

Step 1 currently reads and reports. It should also **create**: a stable `slice_id` (repo-scoped, monotonic, date-free — `es-014`, not `2026-07-07-dfs-oom-fix`) and a manifest at a canonical path. Every subsequent artifact carries `slice_id` in frontmatter; the manifest is the join key the side pane groups on, the thing the orchestrator's stage-0 gate inspects, and the thing that survives a dead session. Date stays in filenames for human sorting; it stops being identity. This single change fixes §2.7, most of §4.1/§4.2, and half the IDE table.

### 6.2 Make the pipeline an explicit state machine with persisted current state and real loop-backs

Replace the 9-step list with named states and typed transitions — including the ones that don't exist today: `plancheck: NO_GO → replan`, `plancheck: spec-defect → respec`, `scope-explosion → decompose into N slices`, plus an iteration cap and an escalation. Persist the current state in the manifest at every transition, so a session that dies at `spec.awaiting_review` resumes there instead of restarting. Borrow the rigour of `brainstorming/SKILL.md:36-63`'s digraph — the outer orchestrating skill should not have a *less* explicit control flow than the skill it wraps.

### 6.3 Persist every gate outcome as data; ban prose-only verdicts

Define the verdict enums **once, in doctrine** (spec review: `approved | changes_requested`; mockup sign-off: same; plan-check: `GO | GO_WITH_FIXES | NO_GO`) and require them written to frontmatter + the event log before the pipeline may advance:
- Spec gets a `status` field with a defined lifecycle *including post-merge* (`shipped`, `superseded`) — killing the 7-vocabulary drift and the "still says Draft after shipping" problem in one move.
- Plan-check emits a structured block with `must_fix[]` and `advisory_folded[]` as **enumerated, id'd commitments**, finally making `house-builder/SKILL.md:33-34`'s "commitments survive into the artifact" checkable instead of aspirational.
- Rule: **an unrecorded gate is an unpassed gate.** Same spirit as the orchestrator's stage ledger (`house-orchestrator/SKILL.md:90-92`: "account for every stage as ran · skipped (with an allowed reason) · n/a… An unaccounted stage is a plan deviation"), which the shaper conspicuously lacks.

### 6.4 Add the two missing stages the rest of the system already assumes, and move the rigor dial into doctrine

- **Stage 0 — spike** (optional, rigor-triggered): timeboxed feasibility probe → durable digest at a canonical path with a `GO | NO_GO | INCONCLUSIVE` verdict. The convention already exists in the wild (`maintenance-mode/docs/superpowers/spikes/`, `hims-pilot-recert/docs/superpowers/spikes/`); adopt it.
- **Stage 3½ — mockup** (rigor-triggered for UI slices): **one** canonical path, `slice_id` in frontmatter, a declared self-contained-HTML contract (no external fetches — the IDE renders it in a sandboxed webview), and a ⛔ sign-off gate whose outcome is persisted. This closes the gate the orchestrator already believes the shaper holds (`house-orchestrator/SKILL.md:128`).
- **Move the rigor dial into `doctrine.md`** and have the shaper *set* it explicitly at intake (`rigor: light|standard|high`, recorded in the manifest), rather than the orchestrator prescribing shaper behaviour in a file the shaper never reads (§2.3). Reconcile it with `intent-first`'s dial so there is one, not three. The orchestrator then *reads* the dial the shaper set — which also stops the merge-gate escalation decision (`house-orchestrator/SKILL.md:151-155`) depending on a re-derivation.

Also promote **research digests to durable artifacts** (§2.9) — same canonical-path treatment, linked from the spec claims they support, and handed to the plan-check reviewer.

### 6.5 Fix the composition boundary: wrap the composed skills, don't just name them

Today the shaper *names* three skills and inherits every one of their assumptions unexamined — brainstorming's forced transition to writing-plans (which structurally breaks decision-only, §3.1), its unconditional spec-write-and-commit (§3.2), writing-plans' worktree precondition (§2.10) and trailing execution menu (§3.4), and both skills' "user preferences override this path" escapes (§3.7).

A rewrite should, for each composed skill, state explicitly: **what it is invoked for · what of its behaviour is overridden · where its outputs must land · what the shaper does with its terminal transition.** Concretely: fork the mode **before** brainstorming (not after); invoke brainstorming in a declared sub-mode for decision-only; override its terminal transition and writing-plans' handoff prompt; pin output paths to doctrine and close the override escapes; and give `writing-plans` a house header template with real slots for `slice_id`, scope guards, model-routing note, and the plan-check block (§2.12).

**Bonus 6th (small, high value): make the hand-off a payload.** Emit the kickoff object `house-builder/SKILL.md:14-16` already specifies, as data in the manifest. The IDE launches the next session from it; the orchestrator's stage-0 gate becomes a field check instead of a re-read; and the lossy shaper-prose → orchestrator-reread → builder-dict chain collapses to one hop.

---

## Appendix — the sharpest single-line references

| Claim | File:line |
|---|---|
| Transcript is designed to die; only artifacts persist | `house-shaper/SKILL.md:16` |
| Research contract, read-only, digest-shaped | `house-shaper/SKILL.md:39-42` |
| Brainstorm cannot be a subagent | `house-shaper/SKILL.md:44-45` |
| Decision-only: write ADR `NNNN`, no gate, "Skip to step 9" | `house-shaper/SKILL.md:46-48` |
| Spec ⛔ gate with no persisted outcome | `house-shaper/SKILL.md:50-51` |
| Scope guards + routing note with no home in the plan template | `house-shaper/SKILL.md:52-54` |
| Plan-check: 5 lenses, "A folded-in advisory is a commitment" | `house-shaper/SKILL.md:55-58` |
| Verdict exists only as `<verdict>` in a chat sentence | `house-shaper/SKILL.md:64` |
| Fail-closed gate default | `house-shaper/SKILL.md:70` |
| Canonical shaping stages incl. spike + mockup — in the wrong file | `house-orchestrator/SKILL.md:77` |
| Mockup sign-off declared a shaper gate | `house-orchestrator/SKILL.md:128` |
| Rigor dial prescribing shaper behaviour, unreachable by the shaper | `house-orchestrator/SKILL.md:148-155` |
| Builder must verify folded advisories were built | `house-builder/SKILL.md:33-34` |
| Builder's required input dict (the un-emitted hand-off payload) | `house-builder/SKILL.md:14-16` |
| Doc-model uses `<placeholders>` for spec/plan paths | `doctrine.md:14` |
| Roadmap "may be named differently" — no discovery mechanism | `doctrine.md:18-19` |
| dev-state allowlist (a lint rule with no linter) | `doctrine.md:23-31` |
| Brainstorming's forced terminal transition | `brainstorming/SKILL.md:66` |
| Brainstorming always writes + commits a spec | `brainstorming/SKILL.md:29,111-114` |
| Writing-plans assumes a worktree nothing creates | `writing-plans/SKILL.md:16` |
| Writing-plans' header template — no house slots | `writing-plans/SKILL.md:45-61` |
| Writing-plans' trailing execution menu (orchestrator's decision) | `writing-plans/SKILL.md:134-153` |
| intent-first declares itself subordinate, not a peer | `intent-first-spec-anchored/SKILL.md:28-33` |
