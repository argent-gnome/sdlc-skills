# Deep critique — `house-orchestrator` (the conductor)

**Scope read in full**
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/SKILL.md` (175 lines)
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/references/doctrine.md` (83 lines)
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/workflows/merge-gate-panel.js` (140 lines)
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/workflows/code-health-sweep.js` (93 lines)
- `/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/dev-state.template.md` (27 lines)

**Also read (for seam analysis)**
- `skills/house-builder/SKILL.md`, `skills/house-shaper/SKILL.md`, `docs/process.md` (same repo)
- superpowers **found** at `/Users/jake-edwards/.claude/plugins/marketplaces/superpowers-dev/skills/` — read `executing-plans`, `subagent-driven-development`, `writing-plans`, `finishing-a-development-branch` in full; skimmed the remaining 10.

**Field evidence** — surveyed 8 live `docs/dev-state.md` files, 96 retros, 40 plans, and 7 mockup dirs across `/Users/jake-edwards/projects/*`. Quantified in Appendix A.

> **Two notes on delivery.** (1) The task specified the output path `undefined/deepdive-orchestrator.md` — the literal string `undefined`, i.e. an unset variable in the dispatching script. That is itself an instance of the class of bug this redesign is about: a path convention living in a variable nobody validated. (2) Writes into the `edge-scanner` checkout were blocked by the worktree-isolation guard, so this report lives at `/Users/jake-edwards/sdlc-redesign-deepdives/deepdive-orchestrator.md`.

---

## 0. Headline

The orchestrator is a **genuinely good gate design wearing a bad state design**. Its hard gates, fail-closed defaults, subagent-isolation economics, and never-builds invariant are the load-bearing intellectual content and must survive the rewrite close to verbatim. But every one of those gates produces its verdict **into a conversation** and then throws it away. The skill is a *procedure* where it needs to be a *protocol*: the conductor is currently the only place the slice's state exists, which makes the long-lived session load-bearing infrastructure rather than a convenience — and that is the single decision the IDE redesign must reverse.

The stage numbering (`0–11` with `4¼`, `7½`, `9½`) is not the disease, but it is a reliable *symptom*: fractional numbers are what you get when an ordered enum is really an append-only changelog of process amendments. Worse, the numbers are internally inconsistent about **who owns a stage** and **what order stages actually execute in** (§2.1).

---

## 1. What it gets RIGHT — preserve these, they are the asset

These are not stylistic preferences. Several encode expensive lessons, and a rewrite that loses them regresses the process.

### 1.1 The never-builds invariant is stated as a *behavioral tripwire*, not an aspiration

`SKILL.md:14-17`:

> **Hard invariant — you never build.** … If you catch yourself about to Write/Edit a repo code file, or run a build/test to *make it pass*, you have drifted — STOP and dispatch a builder instead. (Reading code, running read-only checks, and writing `docs/` state files are fine.)

This is well-designed for an LLM: it names the *observable action* that constitutes the violation ("about to Write/Edit a repo code file", "run a build/test to make it pass") and carves the exact exception ("writing `docs/` state files are fine"). Most invariants in agent skills are stated as goals; this one is stated as a detector. **Preserve the phrasing pattern, and in the rewrite make it mechanically enforceable** (§6.3).

The economic rationale is stated once, correctly, in `process.md:20-23`: the orchestrator "never reads diffs itself — it **dispatches reviews to subagents** and only the verdict (a few hundred tokens) returns." That is the reason the conductor can be long-lived at all.

### 1.2 Fail-closed is applied consistently, in three independent places

1. **Doctrine-level:** `SKILL.md:130` — "Fail closed: unsure whether a gate is hard → treat it as hard."
2. **Panel quorum:** `merge-gate-panel.js:93-97` —
   ```js
   const quorum = Math.ceil(LENSES.length / 2)
   if (reviews.length < quorum) { … return { verdict: 'INCONCLUSIVE', … 'do NOT treat as GO' } }
   ```
   with the comment at `:91-92` explaining *why* ("an API-overload storm can kill them … never let that read as a clean GO"). A production lesson encoded in code.
3. **Refuter-level:** `merge-gate-panel.js:120-122` —
   ```js
   // Refute only on a real majority (>=2 of 3). If ALL refuters errored (no signal), KEEP the finding
   // (refuted=false) — fail-CLOSED: an unverified critical blocks. A false NO-GO is safe; a false GO is not.
   return { ...c, refuted: v.length === 0 ? false : refutes >= 2, votes: v.length }
   ```

The asymmetry argument — "a false NO-GO is safe; a false GO is not" — is exactly right and belongs in the redesign's stated principles. `SKILL.md:80` propagates it upward: "`INCONCLUSIVE` (too few lenses ran) is NOT a pass."

### 1.3 The rigor *floor* — the dial can lower ceremony but never remove the gate

`SKILL.md:152-155`:

> **Floor: the dial never SKIPS the merge-gate** … the panel runs no matter how "light" the slice looks. **Proposing to skip it is itself a hard gate.**

"Proposing to skip it is itself a hard gate" is a sophisticated anti-rationalization guard — it targets the failure mode where the agent talks itself into a shortcut. Keep the construct and generalize it: *any* proposal to reduce rigor is an event requiring human sign-off, not a judgment call.

Note also the correct axis choice at `:148-149`: "Scale ceremony to the cost of a wrong-but-plausible decision — the *stakes*, never the file type." Most rigor dials key off file type or diff size; this one doesn't.

### 1.4 Independence is decomposed into two orthogonal axes

`merge-gate-panel.js:3` (meta.description):

> Layers independence-of-PERSPECTIVE (diverse lenses) on top of independence-of-ARCHITECTURE (Fable judging Opus-built code).

Plus independence-of-context (a fresh subagent that never saw the build). Three distinct independence claims, each with a mechanism. `SKILL.md:136-137`: "Opus builds / Fable reviews is deliberate: cross-ARCHITECTURE independence — a different model catches the builder-model's blind spots." This is the most defensible part of model routing and should survive even though the specific model names will rot (`claude-fable-5` / `claude-opus-4-8`, `:133-135`).

### 1.5 "Don't trust the report" as an explicit verification doctrine

`SKILL.md:141-143`:

> **Verification doctrine** — "don't trust the report": reviewers independently re-run builds/tests; spec-compliance is checked separately from code-quality; ONE adversarial merge-gate per slice has empirically caught criticals that per-task review + CI missed.

The empirical claim is the justification for what would otherwise look like redundant review, and the retro corpus backs it: `edge-scanner/docs/retros/2026-07-07-dfs-oom-fix-retro.md` records a merge-gate that independently ran **400,000 randomized old-vs-new equivalence trials**. That is not ceremony; that is a reviewer doing work the builder didn't.

Reinforced at `SKILL.md:82` — CI green must be confirmed "via actual `gh run view --json conclusion` (not piped exit codes)". The "never trust an exit code you didn't parse" rule is a scar; keep it.

### 1.6 The known-backlog ledger prevents gate-noise accretion

`merge-gate-panel.js:17-26` — the `ledgerNote`, with a concrete incident in the comment:

```js
// A finding already accepted and ROUTED there is not a fresh should-fix — it re-surfaces on every slice that
// touches that surface (e.g. hims' field_def-seed deploy gap, routed to the auth/migrations slice, was re-flagged S3e/S4a/S4c).
```

This solves a real problem (the same deferred debt eating a should-fix slot every slice) and the carve-out is correct: "A NEW aspect of a ledger item … is still in scope" (`:25-26`). Field check: `accepted.md` exists in 6 of 8 house projects. **This is the most machine-ready artifact in the whole system; the rewrite should generalize it into the suppression model for every gate, not just the panel.**

### 1.7 The out-of-scope escape hatch

`merge-gate-panel.js:79` confines lenses to the slice's repo and diff; `:104-105` + `:138` route stray observations to `outOfScope` — "surfaced separately, NEVER blocks the merge." Right shape: a reviewer who spots something real outside its mandate needs somewhere to put it that isn't a merge blocker. What's missing is a *destination on disk* (§2.4).

### 1.8 The redirect guard, and the reason for the session split

`SKILL.md:40-47` is conservative in the right direction: "Unsure → treat it as shaping and recommend the shaper." And `house-shaper/SKILL.md:13-16` states the real rationale: the shaping transcript is *disposable*, only artifacts persist. The three-session split (`process.md:9-24`) is justified on per-message context economics — the correct justification — and it is why the system works on long projects.

### 1.9 The auto-fix boundary

`doctrine.md:70-74`:

> A hygiene check may auto-resolve ONLY provably-safe, no-data-loss cases — pruning a remote-tracking ref whose upstream is already deleted … Anything potentially destructive … is **surfaced for the user's explicit OK, never resolved silently.** Running unattended never downgrades this.

Plus the squash-merge caveat, stated with its mechanism (`SKILL.md:55-56`, `doctrine.md:66-69`): "`git branch --merged` does NOT recognize a squash-merged branch as merged (a squash creates a new commit that is not a descendant of the branch tip). Confirm merged-ness via PR state." A genuine footgun documented with its cause. Keep verbatim.

### 1.10 The stage ledger as a fail-closed completeness check

`SKILL.md:90-92`:

> **Stage ledger (fail-closed):** account for every stage as **ran** · **skipped (with an allowed reason)** · **n/a** … An unaccounted stage is a plan deviation → surface it. "I didn't get to it" is a deviation, not a skip.

The distinction between *skipped* and *didn't get to it* is what makes a process audit meaningful, and it is **actually working in the field** — 86 of 96 retros mention the merge-gate, and the ledger renders as prose like this (`edge-scanner/docs/retros/2026-07-07-dfs-oom-fix-retro.md`):

```
- **Stage 7½ health-sweep:** SKIPPED (allowed) — tiny bugfix slice; the 3 merge-gate notes carried into the open backlog instead.
- **Stage 8 CI:** n/a — no CI by design (Actions minutes out); bar = both gates re-run green by the reviewer.
- **Stage 9 live:** RAN (local prod build; deployed re-verify is Jake's post-redeploy gate).
```

**This is the single highest-value thing to make machine-readable.** It is already a three-valued enum per stage with a reason string — a data structure that happens to be typed as prose. That the agents produce it reliably in prose means they will produce it reliably as JSON.

### 1.11 The CI-red taxonomy

`house-builder/SKILL.md:70-81` (referenced by orchestrator `SKILL.md:82`) splits CI-red into **infra-only** (the job never executed — `startup_failure`, 0 steps, budget block), **code-red**, and **no-CI-configured**, each with a distinct merge bar, and states the tiebreak: "**When unsure, treat as code-red.**" A well-formed decision procedure with a fail-closed default. Preserve as-is — though it belongs in shared doctrine, not the builder skill (§2.1b).

---

## 2. Structural weaknesses

### 2.1 The stage enum is inconsistent — and yes, the fractions are a smell

**Is the numbering a smell?** Yes, but not for the aesthetic reason. Fractional stages are what an ordered enum looks like when it is really an **append-only changelog of process amendments** that must stay comparable across historical retros. `4¼` (plan-check) was inserted between "plan" and "build"; `7½` (health sweep) after the merge-gate; `9½` (docs audit) before merge. Each fraction records "we learned we needed a step here and couldn't renumber without invalidating every retro." That is a versioning problem solved with a numbering hack.

The deeper problems are the inconsistencies the numbering hides:

**(a) Stages 0–4 are never defined anywhere.** `SKILL.md:77` collapses the entire front half into one table row — "0–4¼ shape (delegated) … spike · scope · spec · mockup · plan · plan-check". That is **six activity names for five-and-a-quarter numbered stages**; you cannot map name→number. Meanwhile `house-shaper/SKILL.md:34-65` uses its *own* numbering (steps 1–9) and labels exactly one with a house stage: "**Plan-check (4¼)**" at `house-shaper/SKILL.md:56`. So shaper-step-7 ≡ stage-4¼, and nothing else in the shaper has a stage number. **The first half of a 12-stage process has no stage definitions.**

**(b) Two stages have two owners and two meanings.** `SKILL.md:78-79` assigns stage 5 = "**Dispatch** a `house-builder` subagent" and stage 6 = "**intake** — Receive the builder's report". But `process.md:36-38` assigns the same numbers to the builder's internal activity:

```
                                       ───────▶│ 5 build (TDD) · 6 self-review · stack    │
```

So "stage 5" is *dispatch* in the orchestrator and *build* in the builder; "stage 6" is *intake* vs *self-review*. And stage **8 (CI)** is claimed by both: `SKILL.md:82` ("confirm the builder's PR run is green") and `house-builder/SKILL.md:41` ("**CI (stage 8).** Get the unit's PR run green"). A stage two roles both own is a stage neither owns.

**(c) Execution order ≠ numeric order.** The builder runs its stage 8 (CI) *before* it reports, and the report is the orchestrator's stage 6. Wall clock: 5 → 8 → 6 → 7 → 7½ → 8 (again) → 9. A numbering scheme whose only job is to express sequence, and which does not express the sequence, is doing no work.

**(d) The gate list and the gate table disagree.** The table marks ⛔ at stages 0–4¼, 7, 8, 9 (`SKILL.md:77,80,82,83`). The canonical gate list at `:126-128` reads: "confirm shaper artifacts · live/device validation · CI red · any plan deviation or genuine ambiguity · any irreversible / outward-facing action." **A merge-gate NO-GO is missing from the canonical list** even though the table says "⛔ NO-GO blocks". Two sources of truth for the most important thing in the skill.

**(e) The loop's own cadence is self-contradictory.** `SKILL.md:19-22`:

> cycle through its units without waiting for the user: dispatch a builder → intake its report → **run the merge-gate** → continue to the next unit

vs `SKILL.md:142-143`: "**ONE adversarial merge-gate per slice** has empirically caught criticals…"
vs `SKILL.md:80`: the reviewer works on "the completed **slice** diff (`git diff main...HEAD`)".

Is the merge-gate per **unit** or per **slice**? `:20` says unit; `:80` and `:142` say slice. Not pedantic: it changes the cost of a slice by a factor of N and changes what `git diff main...HEAD` means.

**(f) The merge-gate's diff range contradicts the multi-session topology.** `SKILL.md:106`: "**multi-session** (web monorepo): one branch + PR per unit." If each unit gets its own PR and those merge as they go, then by slice completion `git diff main...HEAD` (`merge-gate-panel.js:16`) contains only the *last* unit — earlier units are already in `main`. The "completed slice diff" is unobtainable from the stated topology. There is no `sliceBaseRef` concept anywhere; `baseRef` defaults to `'main'` (`merge-gate-panel.js:14`) and the orchestrator is never told to pass anything else.

### 2.2 Everything the conductor decides lives only in conversation

The central defect. What is produced and then discarded:

| Decision / state | Produced at | Persisted? |
|---|---|---|
| Plan-check verdict (GO / GO-WITH-FIXES / NO-GO) + which advisories were folded | `house-shaper/SKILL.md:56-58` | **No** — hand-off is a prose sentence (`house-shaper/SKILL.md:63-64`) |
| Builder 4-state report (DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT) | `SKILL.md:79`, `:101-102` | **No** |
| Builder concerns that must be "folded forward into later units" (`SKILL.md:79`) | intake | **No** — conductor working memory only |
| Merge-gate verdict + criticals + should-fixes + nits | `SKILL.md:80`, `merge-gate-panel.js:133-140` | **No** — the workflow `return`s a JS object into the conversation |
| Panel `outOfScope` notes | `merge-gate-panel.js:104-105,138` | **No** — no destination defined anywhere |
| Health-sweep backlog | `code-health-sweep.js:91-93` | **The workflow does not write it.** `SKILL.md:81` says it goes "to `<repoPath>/docs/health/<date>-<slice>.md`" — an unspecified manual step by the conductor, with no schema |
| Which rigor-dial branch was taken (single reviewer vs panel) and why | `SKILL.md:148-155` | **No** |
| Which model profile actually ran (fable vs opus fallback) | `SKILL.md:139-140` — "note it in the retro" | Prose only, after the fact |
| Stage ledger (ran/skipped/n-a per stage) | `SKILL.md:90-92` | Prose in the retro, **after the slice ships** |
| The in-flight builder's identity | `SKILL.md:96` (background dispatch) | dev-state says "links or none" (`:172`) — a background subagent has no link |
| Audible history + resolution | `SKILL.md:111-123` | **No** |

Note especially: **both workflows are pure functions returning JSON to a chat turn.** `merge-gate-panel.js` ends at `:133` with `return { verdict, criticals, shouldFixes, nits, outOfScope, panel }`; `code-health-sweep.js` ends at `:93` with `return { backlog, rawCount, lenses, scope }`. Neither calls a write. The only durable trace is a `log()` line (`merge-gate-panel.js:131`, `code-health-sweep.js:92`) in a transcript. **The two most expensive operations in the entire process — a 4-lens panel with 3 refuters per finding, and an N-lens whole-app sweep — write nothing to disk.** Clearest single fix in the rewrite.

### 2.3 `dev-state.md` is specified three times, in three different shapes, and drifts in practice

Three specs:

1. `SKILL.md:162-175` — "**Suggested** shape": Active slice / Slated / Done. **Omits** In-flight-as-a-section, Infra/secrets, Gotchas, Process notes.
2. `dev-state.template.md:1-27` — 7 sections: Active slice / In-flight / Slated / Done / Infra-secrets / Gotchas / Process notes.
3. `doctrine.md:21-31` — "contains **exactly** these sections and nothing else": the same 7.

`SKILL.md:164` says "**Suggested** shape" while `doctrine.md:23` says "exactly these sections and nothing else." A suggestion and a hard allowlist cannot both be the contract — and the skill body, the thing actually loaded into the conductor's context every session, is the weaker of the two.

**Field reality** (8 projects, Appendix A):

- **6 of 8 dev-states contain zero `stage:` lines.** The field the resume procedure is built on (`SKILL.md:27-29`: "It tells you the active slice, **its stage**, the next action…") is absent from three quarters of live projects. The resume anchor does not anchor.
- `edge-scanner/docs/dev-state.md` is **368 lines** and its top heading is `## Active work`, not `## Active slice`.
- `web-services/docs/dev-state.md` is 184 lines with eight off-allowlist headings (`## 🚀 LIVE:`, `## Last shipped:`, `## Product state`, `## Reference docs`, `## Build-window units DONE`, …) and no `## Done` or `## In-flight`.
- Heading order varies (`hims-pilot-recert` puts Gotchas before Slated); `athlete-data` adds `## Open owner follow-ups`.

The dev-state lint (`SKILL.md:86,93`, `doctrine.md:63-64`) exists as an instruction to *remember to check*. Six of eight projects show it isn't happening. **A lint that is prose is a lint that doesn't run.**

`doctrine.md:40` gives an excellent heuristic — "*if it would still be true and worth knowing three slices from now, it is not dev-state*" — which is exactly what a validator should implement instead of an agent recalling it.

### 2.4 Undefined conventions (the ones that actually bit)

| Convention | Where referenced | What's undefined | Field result |
|---|---|---|---|
| Retro filename | `SKILL.md:86` — `docs/retros/<key>-<slice>-retro.md` | **`<key>` is never defined** | 4+ styles across 96 retros: `<date>-<topic>-retro.md` (edge-scanner) · `<project>-slice-N-retro.md` (hims, spanish-coach, dcc) · `slice-N-<topic>-retro.md` (athlete-data) · `<topic>-slice-retro.md` (web-services). Plus non-retros living in `retros/`: `2026-07-06-project-closeout.md`, `README.md`, `2026-06-27-…-note.md` |
| Mockup path | `SKILL.md:77` ("mockup"), `:85` ("any approved mockup ships IN the slice PR") | **Never specified in any of the three skills** | 2 dirs: `docs/mockups/` (5 projects) vs `docs/superpowers/mockups/` (3) |
| Slice ID | `SKILL.md:171` — `## Active slice: <id> — <title>` | **No scheme** | `Slice 1`, `bulk-slice-1`, `Track A/B/C`, `S3e`/`S4a`/`S4c`, `#27`. Two independent "Slice N" series coexist in `athlete-data` with nothing disambiguating them |
| Health-sweep output | `SKILL.md:81` — `docs/health/<date>-<slice>.md` | Schema undefined; the workflow doesn't write it | Freeform; `tennis-modelling` has an empty `docs/health/` |
| Plan checkboxes | `superpowers:writing-plans` mandates `- [ ]` steps | **No house skill says who ticks them** | 30 of 32 surveyed plans 100% unchecked; the one meaningfully-ticked house plan was ticked *retroactively* by `5477d3b docs(reconcile): tick DFS OOM-fix plan checkboxes as-built` |
| `roadmap.md` format | `doctrine.md:18-19` — "canonical name … that doc MUST exist and own this content" | **Zero format contract** — name only | unparseable |
| Spec `Status:` line | not mentioned in the orchestrator at all | no lifecycle | shipped slices still say "Draft" |

### 2.5 The workflows have specific, fixable defects

**(a) Quorum is a count, not a set.** `merge-gate-panel.js:93` — `Math.ceil(4/2) = 2`. A panel where only `correctness` and `cross-seam` return is treated as a valid GO, even on a slice escalated to the panel *because it touches user data* (`SKILL.md:80`). **The `data-safety` lens can silently not run on precisely the slice that escalated for data safety.** Quorum should be per-lens, with the escalation-triggering lens mandatory.

**(b) The documented model fallback has no implementation.** `SKILL.md:139-140` — "**Fallback:** Fable unavailable → run the opus-profile (single-Opus reviewer / Opus refuters)". But `merge-gate-panel.js:115` hard-codes `model: 'fable'` for every refuter and `:86` hard-codes `model: 'opus'` for every lens, and there is **no `modelProfile` arg** in the args contract (`:11`). When Fable is unavailable — which the retro corpus shows is *routine*: "**Fable over its monthly spend limit (again)**" (`edge-scanner/.../2026-07-07-dfs-oom-fix-retro.md`) — all three refuters error, `v.length === 0`, and `:122` keeps the finding unrefuted. Fail-closed is right in isolation, but the emergent behavior is that **a Fable outage turns the panel into an unconditional NO-GO generator** on any slice where any lens raised any critical. The fallback exists only as prose the conductor must remember, and it cannot act on it because the workflow has no knob.

**(c) The health sweep's stack taxonomy is a closed set with a silent default.** `code-health-sweep.js:64`:
```js
const LENSES = a.stack === 'web' ? WEB_LENSES : IOS_LENSES
```
Any stack that isn't the literal string `'web'` gets **SwiftUI / SwiftData / Swift-concurrency lenses** (`:51-57`). A Deno/SQL/Python/Rust project silently gets an iOS review. `edge-scanner` (TypeScript + Supabase + Deno edge functions) works only because someone remembers to pass `stack: 'web'`.

**(d) The panel never sees the plan, the plan-check, or the builder's report.** Args at `:11` are `{ project, repoPath, baseRef, headRef, sliceId, specGlobs, stack, highStakes, notes, ledgerPath }`. `SKILL.md:79` requires the conductor to "Fold any concerns forward into later units," and `house-builder/SKILL.md:32-34` makes "Commitments survive into the artifact" a builder non-negotiable — but the independent gate cannot re-verify either, because it isn't given the commitments.

**(e) Confirmed should-fixes go nowhere.** `merge-gate-panel.js:129` — `verdict = criticals.length === 0 ? 'GO' : 'NO-GO'`. Confirmed should-fixes (`:128`, `:136`) are returned and… that's it. No routing rule in `SKILL.md` or `doctrine.md` sends a confirmed should-fix to `accepted.md`, the roadmap backlog, or the next unit. The only such rule is a parenthetical in the *skip* case at `SKILL.md:81`. So findings that survived 3-refuter adversarial verification have a **weaker** persistence guarantee than findings from the advisory sweep.

**(f) Both workflows re-implement the same defensive parse.** `merge-gate-panel.js:12` and `code-health-sweep.js:12` both carry `const a = (typeof args === 'string' ? JSON.parse(args) : args) || {}`, with a comment citing the same past bug ("same class of bug fixed in merge-gate-panel.js c97ea90 / plan-check.js"). Three copies of a workaround for an untyped invocation boundary that should be a validated schema.

### 2.6 The `$HOME` / install-path coupling

`SKILL.md:35`, `:71-73`, `:80`, `:81` (and both sibling skills) hard-code `$HOME/.claude/skills/house-orchestrator/...` and instruct the agent to "resolve `$HOME` to your actual home directory when invoking, since `scriptPath` needs an absolute path" (`:71-73`), with the fallback "If you copy-installed elsewhere, use that path." The skill asks the *model* to do path resolution the runtime should do. And `SKILL.md:24` claims "This skill is self-contained: its two helper workflows live in `workflows/` beside this file" — but `:80-81` invoke them by absolute `$HOME` path, not relatively. Self-containment claimed, not achieved.

### 2.7 Redundancy: the same rules stated 2–5 times

- Per-merge teardown: `SKILL.md:85`, `SKILL.md:86`, `doctrine.md:59-61`.
- Session-end hygiene sweep: `SKILL.md:86`, `:93`, `doctrine.md:63-64`.
- dev-state lint: `SKILL.md:86`, `:93`, `doctrine.md:63-64`.
- Squash-merge caveat: `SKILL.md:55-56`, `doctrine.md:66-69`.
- "never shape inline": `SKILL.md:40-47`, `:68-69`, `:77`, `:120-123`, `:157-160` — **five times**.
- Gates: table ⛔ (`:77,80,82,83`) + list (`:126-130`) + `house-builder/SKILL.md:83-86`.

`SKILL.md:88-93` is almost entirely a prose restatement of table row 11 at `:86`. The repetition is defensible as LLM reinforcement, but it multiplies the drift surface — and the gate list at `:126-128` has *already* drifted from the table (§2.1d).

---

## 3. Where it fights or duplicates the superpowers skills it composes

Superpowers located at `/Users/jake-edwards/.claude/plugins/marketplaces/superpowers-dev/skills/` (14 skills).

### 3.1 `subagent-driven-development` is the same controller pattern at a different granularity, with different rules

`subagent-driven-development/SKILL.md` *is* a dispatch-and-review controller: fresh subagent per task, 4-state status handling, model selection, review loops. `house-orchestrator` is also a dispatch-and-review controller (per **unit**), and `house-builder/SKILL.md:22` then invokes SDD *inside* the unit (per **task**). The same skill's controller role is instantiated at two nesting levels — and the two levels disagree:

| | superpowers SDD | house-orchestrator |
|---|---|---|
| BLOCKED handling | 4 options: more context / more capable model / smaller pieces / escalate to human | "a unit BLOCKED **twice** … gets ONE re-dispatch on `model: fable` before you stop" (`SKILL.md:138-139`) |
| Model selection | by *task complexity* — "Use the least powerful model that can handle each role" | by *role* — the fable-profile (`SKILL.md:133-140`) |
| Review cadence | mandatory two-stage per task (spec then quality) with re-review loops; "**Never** … Move to next task while either review has open issues" | delegated into the builder (`house-builder/SKILL.md:26-34`); orchestrator adds a *third* review at slice end |
| DONE_WITH_CONCERNS | "If the concerns are about correctness or scope, address them **before review**" | "Fold any concerns forward into **later units**" (`SKILL.md:79`) |

The DONE_WITH_CONCERNS divergence is a genuine semantic conflict: SDD says resolve now, house says defer forward. A builder that loaded SDD and an orchestrator that loaded house will do different things with the same status string.

SDD's red flag "**Never dispatch multiple implementation subagents in parallel (conflicts)**" is compatible with house's one-unit-per-dispatch rule (`SKILL.md:78`) — but it means house's *background* dispatch (`:96`) buys only conversational responsiveness for audibles, never parallelism. Meanwhile `superpowers:dispatching-parallel-agents` exists and the orchestrator never references it, even though the panel (4 lenses) and sweep (5 lenses) are exactly its use case — the house layer reimplemented parallel dispatch in JS instead.

### 3.2 `finishing-a-development-branch` is invoked at stage 10 but its contract contradicts the house loop

`SKILL.md:85` — "10 PR + merge: `superpowers:finishing-a-development-branch`". But that skill:

- **Step 1 re-runs the full test suite locally** — after house already required CI green (`SKILL.md:82`), a merge-gate reviewer that independently re-ran build/tests (`:141-142`), and the builder's stack gates. A fourth verification.
- **Step 3 presents exactly 4 interactive options**, including "**4. Discard this work**", with "**Don't add explanation** - keep options concise."

House has *already decided* the answer (`doctrine.md:59-61`, `SKILL.md:85-86` prescribe merge + branch delete + worktree removal). So invoking it inserts a human prompt containing a destructive option into the middle of a loop that `SKILL.md:19-22` says runs "without waiting for the user." Either house shouldn't call it, or house should call it with the choice pre-bound — neither is stated.

Its cleanup also assumes a worktree exists, contradicting house's `single-session` topology (`SKILL.md:105`: "builder works in place on a branch, **no worktrees**"). Same contradiction in `doctrine.md:59-60` ("its worktree removed") — the per-merge checklist assumes worktrees unconditionally.

### 3.3 `writing-plans` owns the plan format; house silently drops half its contract

`writing-plans/SKILL.md` mandates a plan header reading:

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development … **Steps use checkbox (`- [ ]`) syntax for tracking.**

Every house plan carries that header. **No house skill assigns ownership of ticking them.** `house-builder/SKILL.md:17-46` never mentions checkboxes; `SKILL.md:86` (reconcile) never mentions them. Result: 30/32 plans 100% unchecked. The plan is the one artifact with a *native machine-readable progress format already built in*, and the house layer doesn't use it — a self-inflicted wound directly relevant to the IDE, whose side pane could render live plan progress today for free.

`writing-plans` also fixes the plan path with the note "(User preferences for plan location override this default)" — precisely the escape hatch that produced the mockup-path divergence, because house never exercised it for mockups.

### 3.4 `verification-before-completion` is re-authored, not composed

`SKILL.md:141-143`'s "don't trust the report" and `:82`'s "not piped exit codes" are the content of `superpowers:verification-before-completion` ("evidence before assertions always"). The orchestrator never references it — violating its own rule at `:157-160`: "**Compose, don't reinvent** … Yours is only: sequencing, gates, dispatch, and model routing."

### 3.5 `using-git-worktrees` is REQUIRED by both executors and overridden without acknowledgement

Both `subagent-driven-development` and `executing-plans` list it as "**REQUIRED:** Set up isolated workspace before starting." `SKILL.md:105` says single-session topology uses "no worktrees." A legitimate override — but never stated *as* an override, so a builder that loads SDD gets contradictory instructions from its two skills.

### 3.6 What it composes cleanly

The delegation of `brainstorming` / `writing-plans` / `intent-first-spec-anchored` to the shaper session is clean — the orchestrator genuinely doesn't reimplement them. `systematic-debugging` / `test-driven-development` are correctly pushed down to the builder. **The composition failures are concentrated at the *finish* and *verify* seams, not the *shape* seam.**

---

## 4. Implicit assumptions that break

### 4.1 "The session survives the slice"

The resume design (`SKILL.md:26-31`) is honest about *why* it exists ("not from a resumed transcript — that would drag the whole heavy log back into context"), but it assumes the conductor reached a **stage transition or session end** (`:164`) before dying. Break it mid-stage-5:

- A background builder subagent was dispatched (`:96`). Its identity is nowhere on disk; dev-state's "in-flight builder / PRs: <links or 'none'>" (`:172`) presumes a *link*, which a background subagent doesn't have.
- The subagent dies with the session. Its partial commits are now **indistinguishable from an abandoned branch** to the stage-2 git-reality check (`:51-58`).
- The only mitigation is `:102` — "Tell it the branch may already hold partial work" — a hint to the *next* builder, not a detection protocol.
- Git evidence from `edge-scanner` (98 commits): `docs/dev-state.md` is touched in 15 commits, all `docs(reconcile)` / `docs(shape)` / `chore` — **never at intra-slice stage transitions**. The resume anchor's real resolution is **one slice, not one stage.**

### 4.2 "Exactly one slice is in flight"

`doctrine.md:25` allows one **Active slice**; the template has one `## Active slice:` heading. But:

- `edge-scanner` ran **Track A / Track B / Track C** concurrently (four separate track retros dated 2026-07-07).
- `web-services/docs/dev-state.md:19`: `## Active slice: Nurture email polish (ADR 0008) — BUILD (slice 2 of a **3-slice serial chain**)`.
- `athlete-data` carries two independent `Slice N` series (`slice-1-ingestion-foundation` and `bulk-slice-1-foundation`).

Consequences: `git diff main...HEAD` (`merge-gate-panel.js:16`) silently mixes two slices when both branch from `main` and one merged first; the retro key can't disambiguate; "fold concerns forward" has no notion of *which* slice's later units.

### 4.3 "The human is reachable when a gate fires"

`SKILL.md:129-130`: "Running unattended never downgrades a hard gate — **notify** and halt." **There is no notification mechanism anywhere in the skill.** No channel, no file, no queue. "Notify" in a session nobody is watching is a no-op; the process stops silently mid-loop with the halt reason living in a transcript.

Worse, the gate set makes autonomy structurally impossible: **stage 9 (live/device) is a hard gate on every slice** (`:83`) requiring a human at a simulator or staging URL. So the "Autonomous loop" (`:19-22`) can cycle build→intake→merge-gate but must always halt before shipping. Fine in itself — but combined with the per-unit-vs-per-slice contradiction (§2.1e), the three statements (autonomous loop / one gate per slice / stage-9 human gate) cannot all be true.

### 4.4 "Opt-in and rigor floor are compatible"

`SKILL.md:144-146`: "the **merge-gate PANEL and the health-sweep are Workflows** and need the user's explicit 'ultracode' opt-in."
`SKILL.md:152-155`: "high stakes → escalate to the panel … the panel runs **no matter how 'light'** the slice looks."

A high-stakes slice run unattended: the floor mandates the panel; the opt-in rule makes the panel unavailable without the user. Deadlock, unaddressed. The correct resolution is probably "high-stakes + no opt-in available = halt at a gate," but since the skill never says so, the model will improvise — most likely by falling back to the single reviewer, which is exactly the floor violation the rule exists to prevent.

### 4.5 "Model names and profiles are stable"

`SKILL.md:133-135` hard-codes `claude-fable-5` / `claude-opus-4-8`; the workflows hard-code `model: 'opus'` / `model: 'fable'` in four places. The retro corpus shows the fallback firing repeatedly on *spend limits*, not availability. A profile is a policy; it's currently a set of string literals across four files.

### 4.6 "Docs are the conductor's only mutation"

`SKILL.md:17` permits "writing `docs/` state files." But stage 2 (`:59-64`) authorizes standing up CI scaffolding and editing `.gitignore` ("a safe in-repo edit — apply it"). The never-builds invariant has a documented exception for repo config, stated far from the invariant. Minor, but it's the crack that widens under pressure.

### 4.7 "A stage is atomic"

Stages 7, 7½, 9½, and 11 are each multi-step (11 = memory + docs audit + CI verify + retro + dev-state lint + hygiene sweep). Nothing records *partial* stage completion, so a death inside stage 11 leaves a retro written but dev-state stale, or vice versa — and resume can't tell which.

---

## 5. What an IDE observing this process would need — and doesn't get

The IDE wants to: list/auto-open specs, plans, mockups as sessions produce them; render roadmap + dev-state as a home screen; show live slice state; host the sessions in an embedded terminal.

**What it can observe today:** file creation under `docs/` (fs watch) and git. That's it. Everything else is inside a terminal scrollback.

### 5.1 The four things that must become emitted events

**(a) Lifecycle events (append-only log).** The IDE needs a push signal, not a poll. Minimum event set, each `{ts, project, sliceId, actor, type, payload}`:

```
slice.created · slice.stage_entered · slice.stage_exited
artifact.written {kind: spec|plan|mockup|adr|retro|health|plan-check|review, path}
gate.requested {gate, reason, blocking: true} · gate.resolved {gate, verdict, by: human|agent}
builder.dispatched {unitId, model, branch, taskRef} · builder.reported {status, concerns[], branch, pr}
review.completed {kind: plan-check|merge-gate|panel, verdict, criticals[], shouldFixes[], lensesRan[]}
audible.received {text} · audible.resolved {disposition}
deviation.surfaced {what, from}
```

`gate.requested` is what makes "notify and halt" (`SKILL.md:129-130`) real: the IDE renders a **pending-approvals inbox**, and a halt becomes visible instead of a terminal that stopped scrolling.

**(b) A slice record with machine-readable status.** The home screen currently has to parse `## Active slice: <id> — <title>` out of a 368-line prose file that in one project is titled `## Active work` instead. It needs per slice: stable `id`, `title`, `status`, `stage`, `blockedOn`, `branch`, `pr`, pointers to every artifact — plus the **stage ledger as data** (`ran|skipped|n-a` + reason), which today is prose in a retro that only exists after the slice ships.

**(c) Gate verdicts as artifacts.** The IDE literally cannot know whether a merge-gate ran, let alone what it said (§2.2). `merge-gate-panel.js:133-140` already builds a well-shaped object, and JSON Schemas sit right there in the file (`:28-51`, `:53-62`). Same for `code-health-sweep.js:91-93` + `BACKLOG_SCHEMA` (`:34-49`). **The schemas already exist; only the write is missing.**

**(d) In-flight subagent handles.** For the terminal pane to show "builder running on unit 3, 4m elapsed," a durable handle must be written *at dispatch time*, before the subagent starts.

### 5.2 What no amount of emitting fixes

- **A path contract.** The side pane cannot auto-open mockups living in two directories under four naming styles. Mockups need one path, one naming rule, and — for an embedded webview — a declared "self-contained HTML" guarantee.
- **Stable slice identity.** Tabs, history, and cross-linking need an ID that doesn't collide across two "Slice 1" series in one repo.
- **Sub-slice progress.** The plan's `- [ ]` checkboxes are the natural progress bar and are already in every plan file. Ticking them (§3.3) gives live progress with zero new format.
- **A spec lifecycle field.** `Status: Draft` on a shipped slice makes the side pane actively lie.

### 5.3 What it should *not* emit

Don't emit the conversation. The entire economic argument for the three-session split (`process.md:9-24`) is that transcripts are expensive and disposable. The IDE should observe **artifacts and events**, and treat the terminal as a view onto a process it does not need to parse.

---

## 6. If I were rewriting it from scratch — the 5 biggest changes

### 6.1 Make the state machine explicit, on disk, and named — and delete the numbers

Replace the 12-stage numbered enum with a **named state machine per slice**, persisted as a slice record (frontmatter or sidecar JSON) plus an append-only event log. Names, not numbers: `shaping → planned → building → unit_review → merge_gate → health_sweep? → ci → live_validation → docs_audit → merged → reconciled`. Fractional stages disappear, because inserting a step becomes a schema-versioned enum change rather than a renumbering. Each state declares: who owns it (conductor / builder / human), its entry precondition (an *artifact* that must exist), and its exit artifact.

This kills at once: the undefined stages 0–4 (§2.1a), dual-owner stages 5/6/8 (§2.1b), order-vs-number mismatch (§2.1c), and two-sources-of-truth gate lists (§2.1d) — because there would be one machine-readable table and the prose would render *from* it.

Keep the ledger semantics exactly (`ran` / `skipped(reason)` / `n/a`; "'I didn't get to it' is a deviation, not a skip" — `SKILL.md:90-92`), but as a field written **when the state exits**, not reconstructed in the retro afterward.

### 6.2 Every gate emits a signed verdict artifact; a gate passes iff its artifact says so

The rule becomes: **the conductor may not enter state X unless the artifact gating X exists on disk and says GO** — not "unless the conductor remembers a GO."

- `plan-check` writes `docs/slices/<id>/plan-check.json` (verdict, must-fix[], advisories[], which were folded).
- Builder writes `docs/slices/<id>/units/<n>/report.json` (4-state, concerns[], branch, pr, deviations[]).
- `merge-gate-panel.js` **writes** its return value (already built at `:133-140` against schemas at `:28-62`) to `docs/slices/<id>/merge-gate.json`, including `lensesRan` so `INCONCLUSIVE` is auditable.
- `code-health-sweep.js` writes its own backlog instead of the conductor doing it by hand (`SKILL.md:81`), using `BACKLOG_SCHEMA` (`:34-49`) as the on-disk format.
- Human gates (spec review, live/device, CI-red merge-through) write an **attestation** — who, when, what was checked. `SKILL.md:83`'s "reload the app after any UI change" and "launch against a store populated under the *previous* schema" become attestation checkboxes rather than remembered instructions.

Side effects: the resume problem largely dissolves (state is reconstructible from artifacts + git, not from a prose tracker); the IDE gets §5.1c free; confirmed should-fixes finally have a destination (§2.5e); the panel's `outOfScope` notes land somewhere.

### 6.3 Turn the conductor from a long-lived *session* into a resumable *step function*

**Is a long-lived conductor session the right shape?** No — not as the *substrate*. It is the right shape as an *optimization*.

Today the conductor holds, in conversation only: the current stage, concerns to fold forward, the rigor-dial decision, the model profile in use, audible history, and which stages ran. That is why session death is catastrophic and why two slices are unrepresentable.

Rewrite as: **read state → compute the single next action → perform exactly that action → write state + emit event → repeat.** Each iteration idempotent and crash-safe. A long-lived session then becomes a loop that skips re-reading state — a performance win, not a correctness dependency. This directly enables:

- **Event-driven operation** — "builder finished" wakes a *new* conductor invocation; no session sits idle.
- **Multiple slices in flight** (§4.2) — the driver is stateless w.r.t. which slice it advances.
- **Real "notify and halt"** (§4.3) — halting writes a `gate.requested` record; the IDE renders an approvals inbox; a human resolution wakes the driver.
- **Mid-stage crash recovery** (§4.7) — states become small enough to be atomic, or explicitly checkpoint sub-steps.

Keep the never-builds invariant and **enforce it mechanically**: the conductor process gets write access to `docs/` and nothing else. `SKILL.md:14-17` becomes a permission boundary instead of a self-monitoring instruction.

### 6.4 One project manifest + real slice identity, and pin every path convention

A single `docs/manifest.json` (or `.house/state.json`) indexing every slice — id, title, status, artifact paths, retro, health file, ADRs — is the one file the IDE watches. `dev-state.md` becomes a **rendered view** of it, generated at reconcile, which by construction cannot drift, cannot exceed its allowlist, and cannot lose its `stage:` line in 6 of 8 projects (§2.3).

Simultaneously pin the four undefined conventions (§2.4) — retro key, mockup path, slice ID scheme, health filename — as *schema-validated* fields rather than prose. Slice IDs get a namespace so `slice-1` and `bulk-slice-1` coexist unambiguously.

And **tick the plan checkboxes** (§3.3): the builder ticks a step when its verification passes. `superpowers:writing-plans` already mandates the syntax; the house layer just has to honor it. Free live progress for the IDE side pane, and the "plans 100% unchecked" audit finding evaporates.

### 6.5 Convert doctrine from prose-to-remember into rules-that-run, and give the workflows knobs

The doctrine is good content (§1.9; `doctrine.md:40`'s three-slices test is genuinely sharp) delivered in the wrong medium. A rule an agent must remember to apply at four specific moments (`SKILL.md:35-38`) is a rule that fires ~75% of the time — as the dev-state survey proves.

Replace with a `house doctor` check running as a pre-merge hook and at reconcile:
- dev-state conforms to the allowlist (heading set, order, size cap) — would have caught all 6 non-conforming projects
- every shipped slice has a retro at the canonical path with a complete stage ledger
- no spec marked `Status: Draft` referenced by a merged slice
- plan checkbox completion ≥ threshold for a `merged` slice
- git hygiene: stale branches / worktrees / stashes, with the squash-merge caveat implemented in code rather than recalled (`doctrine.md:66-69`)
- the auto-fix boundary (`doctrine.md:70-74`) becomes the tool's `--fix` policy: only provably-safe classes auto-resolve; everything else emits `gate.requested`

And fix the workflows while in there (§2.5): add a `modelProfile` arg so the documented Fable→Opus fallback (`SKILL.md:139-140`) is *executable* rather than aspirational; make quorum per-lens with the escalation-triggering lens mandatory; make the sweep's lens set data-driven per stack rather than `stack === 'web' ? … : IOS_LENSES` (`code-health-sweep.js:64`); pass the plan + folded commitments into the merge-gate so "commitments survive into the artifact" can be independently verified; and define where a confirmed should-fix goes.

**What must not change:** the hard gates and fail-closed defaults (§1.2), the rigor floor and its anti-rationalization clause (§1.3), the three independence axes (§1.4), don't-trust-the-report (§1.5), the ledger/suppression pattern (§1.6), the auto-fix boundary and squash-merge caveat (§1.9), the ran/skipped/n-a ledger semantics (§1.10), and the CI-red taxonomy (§1.11). Those are the intellectual property. Everything else is plumbing that should be replaced with plumbing a program can read.

---

## Appendix A — field evidence (8 house projects)

**dev-state conformance** (allowlist = Active slice · In-flight · Slated · Done · Infra/secrets · Gotchas · Process notes, `doctrine.md:23-31`):

| project | lines | `stage:` lines | headings conform? |
|---|---|---|---|
| athlete-data | 152 | **0** | +1 extra (`## Open owner follow-ups`) |
| cash-track-mobile | 124 | 1 | yes |
| **edge-scanner** | **368** | **0** | no — `## Active work`, no `## Active slice` |
| hims-pilot-recert | 68 | **0** | order differs; `## Done  (retros in docs/retros/)` |
| job-landing | 52 | **0** | yes |
| sdlc-skills | 36 | 1 | yes |
| tennis-modelling | 77 | **0** | yes |
| **web-services** | 184 | 2 | no — 8 off-allowlist headings, no `## Done` / `## In-flight` |

→ **6/8 have no `stage:` field at all**; 3/8 violate the heading allowlist; sizes range 36–368 lines for a doc specified as "Keep this short" (`SKILL.md:164`).

**Retro naming** (96 retros, 12 projects) — ≥4 incompatible keys plus non-retro files inside `docs/retros/`:
`2026-07-07-dfs-oom-fix-retro.md` (date key) · `hims-slice-3e-retro.md` (project+slice) · `slice-2-garmin-detail-mapping-retro.md` (slice+topic) · `homepage-pass-slice-retro.md` (topic-slice) · `2026-07-06-project-closeout.md`, `README.md`, `2026-06-27-supabase-key-modernization-note.md` (not retros at all).

**Plan checkboxes** (40 plans sampled, 8 projects): 30 fully unchecked; 2 meaningfully ticked — `athlete-data/2026-07-28-bulk-slice-3a-progress-card.md` (26/26) and `edge-scanner/2026-07-07-dfs-optimizer-oom-fix.md` (13/18, ticked retroactively by `5477d3b docs(reconcile): tick DFS OOM-fix plan checkboxes as-built`); the rest partial or zero-step.

**Mockup paths:** `docs/mockups/` — cash-track-mobile, dev-command-center, maintenance-mode, prediction-arbitrage (+dcc) · `docs/superpowers/mockups/` — athlete-data, shipsite, spanish-coach.

**Health ledger:** `docs/health/accepted.md` present in 6/8 (missing: tennis-modelling, job-landing) — the most consistently-honored convention in the system, and the only one with a machine consumer (`merge-gate-panel.js:21`, `code-health-sweep.js:15`).

**dev-state commit cadence** (`edge-scanner`, 98 commits): `docs/dev-state.md` touched in 15 commits, all at shape/reconcile boundaries, none at intra-slice stage transitions — confirming the resume anchor's real resolution is one *slice*, not one *stage*.
