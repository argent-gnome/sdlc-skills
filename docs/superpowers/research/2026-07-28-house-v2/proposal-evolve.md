# house v2 — the EVOLVE proposal

**Stance:** v1 is fundamentally sound. Its gate design, fail-closed doctrine, and three-session topology are
the residue of real failures and real fixes — the audit found essentially zero bad *rules* and dozens of
missing *artifacts*. The disease is one thing, stated once: **every verdict, state, and identity the process
produces lives in a conversation that is designed to die.** The cure is not a new process; it is giving the
existing process a skeleton — identity, frontmatter, one manifest, one event log, one small CLI, and hooks
that enforce what prose currently hopes for. The cheapest sound system wins, and this is it.

**What this is not:** a rewrite of the loop, a fourth agent role, a spec-regeneration engine, or a
capability-spec re-architecture (OpenSpec's delta-merge model is admired and deliberately deferred — see §7).

Corpus honored: deepdive-shaper / deepdive-orchestrator / deepdive-builder, research-sdd-tooling,
research-agentic-sdlc, research-classic-process, research-ide-prior-art, and full reads of the three v1
skills + doctrine.md.

---

## 0. The five moves (everything else is detail)

1. **Mint identity at intake.** A slice is born with a monotonic id (`0007-dfs-oom-mlb`) and a directory
   (`docs/slices/0007-dfs-oom-mlb/`). Every artifact lives inside it. Branch, PR title, and mockup paths
   derive from it. Nothing is ever named again.
2. **Three-layer state, one writer per layer** (the Beads/Kiro lesson):
   - **DECLARED** — YAML frontmatter + `slice.yaml`, written by the agent that owns the current stage.
   - **OBSERVED** — `.house/events.jsonl`, append-only, ULID-keyed, `merge=union`, written by hooks + `house event` only.
   - **DERIVED** — `.house/index.json`, gitignored, rebuilt by `house index`; the only thing the IDE reads for state.
3. **A gate that writes no record did not run.** Plan-check, builder 4-state, merge-gate, health sweep,
   stage ledger, spec review, mockup sign-off — each becomes a file with a frontmatter enum plus an event.
   The next stage's entry precondition is *the artifact exists and says GO*, not "the conductor remembers."
4. **A small `house` CLI + Claude Code hooks make the doctrine run instead of being remembered.**
   `house validate` is the linter the allowlist never had; `Stop`/`SubagentStop` hooks are the loud gate the
   per-task review never had; the PR-merge event mechanically flips state, ticks nothing by hand.
5. **The three skills survive with their rules intact and their interfaces replaced.** Shaper gains the two
   stages the system already assumed it had (spike, mockup) and the rigor dial it could never read.
   Orchestrator's long-lived session becomes an optimization, not the substrate — resumable from disk at any
   point. Builder's report becomes an incrementally-written record. Composition of superpowers skills gets
   an explicit take/suppress/own contract instead of a name-drop.

---

## 1. Artifact & state model

### 1.1 Repository layout (complete)

```
<repo>/
├── .house/
│   ├── events.jsonl            # OBSERVED — append-only, git-tracked, merge=union
│   ├── index.json              # DERIVED  — gitignored, rebuilt by `house index`
│   ├── gates.yml               # per-repo declarative gate profile (stack gates; §2.4)
│   └── config.yaml             # repo constitution: stack, default rigor, paths (rarely edited)
├── docs/
│   ├── dev-state.md            # generated top half + hand-authored bottom half (§1.6)
│   ├── roadmap.md              # hand-authored, light format contract (§1.7)
│   ├── adr/NNNN-<slug>.md      # unchanged path; frontmatter added (§1.5)
│   ├── health/
│   │   ├── accepted.md         # the suppression ledger — kept verbatim from v1
│   │   └── <slice-id>.md       # sweep backlog, written BY the workflow now
│   └── slices/
│       ├── 0007-dfs-oom-mlb/   # ← THE unit of identity. Everything about the slice is here.
│       │   ├── slice.yaml      # the manifest (§1.3)
│       │   ├── spec.md         # five-slot pitch + requirements (§1.4)
│       │   ├── plan.md         # writing-plans output + house header slots
│       │   ├── plan-check.md   # persisted verdict (§3)
│       │   ├── spike.md        # optional; frontmatter verdict GO|NO_GO|INCONCLUSIVE
│       │   ├── research/
│       │   │   └── 01-<question-slug>.md   # research digests, durable (§2.2)
│       │   ├── mockups/
│       │   │   └── 01-<slug>.html          # self-contained; sidecar 01-<slug>.meta.yaml
│       │   ├── units/
│       │   │   └── 02-report.md            # builder unit record, incremental (§2.4)
│       │   ├── merge-gate.md   # persisted panel/reviewer verdict
│       │   └── retro.md        # no filename key to define — location IS the key
│       └── legacy-index.yaml   # migration only: maps pre-v2 artifacts to synthetic ids (§6)
```

**Path rules (all placeholders in doctrine are deleted):** `docs/superpowers/specs|plans` is retired for new
work. Doctrine's `docs/<specs>/…` angle brackets are replaced with the literal table above. `roadmap.md` "or
equivalent" is retired: the canonical name is mandatory; a repo that wants a different name symlinks it.

### 1.2 Slice identity

- **Id = `NNNN-<slug>`**, zero-padded, monotonic per repo, never reused (Nygard's rule). Minted by
  `house new "<title>"` at shaper intake — the CLI scans `docs/slices/` for max+1, so there is no allocator
  file and no race in a solo repo. The id is date-free; the date lives in `slice.yaml: created`.
- **Everything derives from it**: branch `slice/0007-dfs-oom-mlb` (unit branches
  `slice/0007/unit-02-<slug>`), PR title prefix `[0007]`, merge-commit trailers `House-Slice: 0007`.
- **An id can be minted at `ideation`** (Oxide's masterstroke): a roadmap backlog item that gets a number on
  day one keeps that identity through shaping, building, shipping, or abandonment. Re-shaping an audible
  updates the same directory instead of orphaning a date-keyed twin.
- **ADRs keep their own independent NNNN series** at `docs/adr/` (they are repo-scoped decisions, not
  slice-scoped artifacts), allocated the same way (`house new --adr`), linked both directions by frontmatter.

### 1.3 `slice.yaml` — the manifest (DECLARED layer)

```yaml
schema: 2                                   # manifest schema version
id: 0007-dfs-oom-mlb
title: "DFS optimizer MLB /dfs OOM fix"
kind: slice          # slice | hotfix | decision | spike-only | docs-only
rigor: standard      # light | standard | high   ← THE dial, set once, at intake (§3.4)
stage: shipped       # closed enum, §3.1 — the ONLY stage vocabulary in the system
blocked_on: null     # null | {gate, question, since}
created: 2026-07-20
appetite: "2 sessions"                      # Shape Up: declared budget; blowing it is a surfaced deviation
branch: slice/0007-dfs-oom-mlb
base_sha: 47337e2                           # recorded at build start → slice diff is always computable (§3.3)
pr: 142
adrs: [0004]
artifacts:           # status enum: missing | draft | awaiting_review | approved | done | skipped | superseded
  spec:       { path: spec.md,       status: done }
  plan:       { path: plan.md,       status: done }
  plan_check: { path: plan-check.md, status: done, verdict: GO_WITH_FIXES }
  spike:      { status: skipped, reason: "known ground — OOM already reproduced" }
  mockups:    { status: skipped, reason: "backend-only slice" }
  merge_gate: { path: merge-gate.md, status: done, verdict: GO }
  retro:      { path: retro.md,      status: done }
units:
  - { id: "01", title: "cap auto-optimizer pool", tasks: [T1, T2, T3], state: DONE, pr: 141 }
  - { id: "02", title: "surface server-action errors", tasks: [T4, T5], state: DONE, pr: 142 }
kickoff:            # the handoff payload — the builder brief fields the shaper owns (§2.3)
  stack: web
  git_topology: worktree_per_unit           # renamed from `topology`; execution style is separate
  scope_guards:
    - "NOT this slice: supabase config push from this repo"
  spec_paths: [spec.md]
  model_routing: "builders on opus; reviews on fable"
```

**Rules stolen deliberately:**
- OpenSpec's skip rule verbatim: **a skip must be declared with a reason and drops out of the progress
  denominator.** There is no third silent state — this alone kills "11/13 plans 100% unchecked" as an
  audit category.
- Linear's name/type split: any doc may carry a free-text `status:` line for humans, but the closed `stage`
  / `state` / `verdict` enums are what tooling reads, and `house validate` rejects values outside the
  normative lists (defined ONCE, in `sdlc-skills/schema/enums.yaml` — the BMAD lesson).
- **One writer per field.** `slice.yaml` is written only by the agent that owns the current stage (shaper
  through `handoff`, orchestrator after). The IDE never writes it. Plan checkboxes are written only by the
  builder (§2.4). Events are written only by hooks/CLI. The Kiro `[-]` bug is structurally impossible.

### 1.4 Spec format

Frontmatter (`id`, `kind: spec`, `slice`, `status` free-text, `state` enum, `updated`) + Shape Up's
five-slot pitch as required headings — **Problem · Appetite · Solution · Rabbit Holes · No-Gos** — followed
by `## Requirements`, each rule as `R-N` with at least one `#### Scenario:`. `[NEEDS CLARIFICATION: …]` is
the literal, grep-able ambiguity marker; `house validate --strict` blocks handoff while any remain. No-Gos
formalizes v1's best field (the "NOT this slice" scope guards) at the spec level, where it belongs.

The spec's lifecycle after ship is mechanical: the PR-merge event flips its `state` to `shipped` via the
projection (§1.8) — no agent ever hand-edits a Status line again. The seven-vocabulary drift and
"Draft on a shipped slice" bug die here.

### 1.5 ADRs, retros, mockups

- **ADR** = Nygard's five sections + MADR frontmatter: `status: proposed|accepted|deprecated|superseded by
  ADR-NNNN`, `date`, `decided_by: jake|agent`, `slices: [0007]`, and MADR's **Confirmation** section (how a
  sweep would check the code still obeys this) — humans never fill it in; agents will, and the health sweep
  gets a free invariant list. Doctrine gains Rust's written threshold: a short list of ADR-required triggers
  and an explicit doesn't-need-one list, replacing the unbounded "on any decision".
- **Retro** = `retro.md` in the slice dir. Frontmatter carries the **stage ledger as data** —
  `ledger: {spike: {result: skipped, reason: …}, merge_gate: {result: ran}, …}` with v1's exact semantics
  (ran / skipped-with-allowed-reason / n-a; "didn't get to it" is a deviation). The prose retro remains for
  the human content (interventions, gate friction) — but it is now a rendering of a record, not the record.
- **Mockup** = `mockups/NN-<slug>.html` + sidecar `NN-<slug>.meta.yaml`
  (`kind: breadboard|sketch|mockup` — Shape Up's fidelity types; `self_contained: true`;
  `signoff: pending|approved|rejected`). `house validate` checks self-containment (no external
  fetches — grep for `http(s)://` in src/href attributes) so the IDE's sandboxed webview can render it with
  a locked-down CSP and the pane never lies.

### 1.6 dev-state.md — generated view + hand block

The top half (Active slice · In-flight · Slated · Done) is **rendered** by `house render dev-state` from the
index — it cannot drift, cannot lose its stage line, cannot exceed the allowlist, because a generator has no
discretion. The bottom half (Infra/secrets · Gotchas · Process notes) is hand-authored between
`<!-- house:manual -->` markers the generator preserves. `house validate` lints the whole file; the
"three slices from now" test finally has a linter. dev-state stops being the resume substrate (that is now
`house status`) and becomes what it always wanted to be: a human-readable dashboard that is also committed.

### 1.7 roadmap.md — light contract, still prose

Durable strategy is genuinely prose; it stays hand-authored. The contract is minimal: frontmatter
(`kind: roadmap`, `updated`), and backlog items may carry `[NNNN]` slice ids once minted (`ideation`-stage
slices live here as one-liners pointing at their future directory). `house validate` checks only that
referenced ids exist. That is the entire format contract — enough for the IDE home screen to link, not
enough to make strategy-writing a chore.

### 1.8 Events and the projection

`.house/events.jsonl` — one object per line:
`{"id":"01J9X…","ts":"…","event":"plan_check.verdict","slice":"0007-dfs-oom-mlb","unit":null,"actor":"shaper","session":"a1b2…","payload":{…}}`

- **Minimum event set:** `slice.created`, `slice.stage_entered` (carries the ledger entry for the stage
  exited), `artifact.written {kind,path}`, `gate.requested {gate,question}` / `gate.resolved
  {gate,verdict,by}`, `research.returned`, `builder.dispatched {unit,model,branch}` / `builder.reported
  {state}`, `review.completed {kind,verdict}`, `deviation.surfaced`, `work.discovered {from}` (Beads'
  `discovered-from`, machine-readable fold-forward), `audible.received/resolved`, `session.started/ended`,
  `slice.merged {pr,sha}`.
- ULID ids → idempotent replay; `.gitattributes: .house/events.jsonl merge=union`; never hand-edited;
  never derived from Claude Code transcripts (the docs' own warning).
- **Emitters:** Claude Code hooks (`SessionStart`/`SessionEnd`/`SubagentStop` → session + builder lifecycle,
  zero agent discipline required), `house event` called by the skills at gate moments (one line each in the
  stage tables), and `house merge` / a `post-merge` hook that reads **`gh pr` facts, never reachability**
  (the squash caveat, now encoded in code) and emits `slice.merged` — which is the single event that flips
  spec state, moves the dev-state entry to Done, and closes the slice. All three staleness bugs die to one
  merge-triggered projection (the GitHub-Projects lesson).
- **Belt and braces:** merge commits carry trailers `House-Slice:` / `House-Unit:` / `House-Verdict:` — a
  tamper-evident record that survives `.house/` deletion. v1 already writes `Claude-Session:` trailers;
  this extends an existing habit.
- `house index` replays frontmatter + events → `.house/index.json`. Deleting the index and rebuilding is a
  no-op by construction; watcher misses become latency bugs, not correctness bugs.

### 1.9 The `house` CLI (build it first, before the IDE)

Small, Node, lives in `sdlc-skills/cli/`, installed globally. Nine commands:
`house new [--adr]` · `house init` (scaffold .house/, hooks, .gitattributes) · `house status [--slice] --json` ·
`house list --json` · `house next --json` (Beads' `bd ready` — the computed next action; the hand-written
"next action:" line becomes a rendering of this) · `house event` · `house gate <name> --verdict <v>`
(writes the verdict artifact + event; **refuses** to record a stage transition past an unresolved NO_GO —
the machine-readable approval gate Spec Kit admits it lacks) · `house validate [--strict] --json` ·
`house index` / `house render dev-state` · `house adopt` (migration, §6).

`house validate` rules, each mapped to a killed weakness: dev-state conforms; every manifest artifact is
done-or-skipped-with-reason; a `shipped` slice has zero unticked plan tasks or a declared deviation, has
`retro.md`, and its spec state is `shipped`; enums ∈ normative lists; mockups are in-dir and
self-contained; every requirement has a Scenario; no orphan files under `docs/slices/`. Runs in the
merge-gate, in a pre-push hook, and in the orchestrator's Stop hook. **If it doesn't fail something, it
will rot** — so it fails things.

---

## 2. Skill / agent topology

**Unchanged:** three skills, three session shapes, same names. The shaper is a disposable interactive
session; the builder is a disposable dispatched session; the orchestrator is a long-lived conductor. The
economics that justify the split (heavy reading dies in subagents; only artifacts persist; per-message
context stays light) are v1's best idea and are kept verbatim. **No fourth role** — Anthropic's own guidance
warns against phase-split agents; the split survives because the plan+manifest is a self-contained handoff
artifact, so v2 invests in the artifact, not in more roles.

**Changed:** every hand-off becomes a payload; every skill writes state as it goes; doctrine's enforceable
half becomes CLI rules; the composition of superpowers skills becomes an explicit contract.

### 2.1 Shared doctrine (v2)

`doctrine.md` stays the shared prose reference (still consumed on-demand by all three) but is rewritten to
contain the things the deep dives proved are missing or misplaced, stated exactly once:
- the **canonical stage table** (§3.1) — names, owners, preconditions, exit artifacts, gate types. The
  shaper's 9 steps and the orchestrator's 0–11 numbering are both deleted; both skills reference this table.
- the **rigor dial** (moved here from the orchestrator, reconciled with intent-first's dial into one:
  judge by the cost of a wrong-but-plausible decision) and the **kind** taxonomy with per-kind artifact
  requirements (§3.4).
- the **verdict and state enums** (normative pointer to `schema/enums.yaml`).
- the **literal path table** (no placeholders, no "or equivalent").
- kept verbatim: one-job-per-doc, the routing table, the three-slices test, the hygiene checklist, the
  auto-fix boundary, the squash-merge caveat, the reconcile-subagent contract — with the reconcile
  subagent's write boundary changed from file-type to **ownership**: builder-lane docs (the slice dir) vs
  orchestrator-lane docs (dev-state, roadmap, health) — removing the concurrent-write race.
- Install-path coupling fixed: skills call `house doctrine-path` instead of hand-resolving `$HOME`.

### 2.2 house-shaper v2

Kept: session rationale, research-dispatch contract (verbatim), brainstorm-is-inline, five-lens plan-check
with "a folded-in advisory is a commitment", fail-closed gates, mode fork concept, model routing.

Changes (each fixes a named deep-dive defect):
1. **Intake mints identity**: `house new` → slice dir + `slice.yaml` at `stage: shaping`, rigor + kind +
   appetite set here, recorded in the manifest. (§2.7, §2.3 of the shaper dive.)
2. **Mode fork moves BEFORE brainstorming.** Decision-only wraps brainstorming in a declared sub-mode:
   "terminal transition to writing-plans is overridden; no spec file is produced; output is an ADR."
   Decision-only gains the ⛔ it never had: the user approves the ADR before reconcile. (§2.6, §3.1–3.2.)
3. **Spike and mockup become real stages** (rigor-triggered): `spike.md` with a frontmatter verdict;
   `mockups/` with the sign-off gate the orchestrator always believed existed. (§2.2–2.3.)
4. **Research digests persist** to `research/NN-*.md` and are handed to the plan-check reviewer along with
   the ADR corpus and roadmap — the reviewer finally gets the ground it is asked to judge against. (§2.9, §4.4.)
5. **Every gate writes**: spec review → `artifacts.spec.status: approved` + `gate.resolved` event; mockup
   sign-off same; plan-check → `plan-check.md` with
   `{verdict, lenses_run[], must_fix[{id,folded_at}], advisory_folded[], advisory_waived[{reason}]}` —
   making the builder's "commitments survive" rule checkable. Loop-backs exist: `NO_GO → replan`,
   `spec-defect → respec`, `scope-explosion → house new` per split slice (the multi-output shape), with an
   iteration cap of 2 before a hard stop. (§2.4, §2.5, §4.6.)
6. **Composition contract** (take/suppress/own, stated in the skill): brainstorming — take the dialogue and
   spec step, suppress its forced writing-plans transition and its "user preferences override paths" escape,
   pin output to the slice dir; writing-plans — take the plan body, suppress the trailing execution menu and
   the worktree assumption, and extend its header with the house slots (`slice`, scope guards, routing note,
   plan-check block — the fields that currently have no home); intent-first — composed as the lens it
   declares itself to be, its rigor dial deleted in favor of the doctrine dial. (§3.1–3.7, §2.12.)
7. **Handoff is the `kickoff` block in slice.yaml** — the orchestrator's stage-0 gate becomes
   `house status` showing `stage: planned` + validate green, not a re-read. Session death mid-shape is now
   resumable: the manifest records the stage; a spec at `awaiting_review` survives the session and shows up
   in the IDE's approvals inbox. (§2.11, §4.1, §4.3.)
8. **Repo-state awareness**: intake runs the same git-reality check the orchestrator runs (one shared
   doctrine procedure), and shaping commits go to a `shape/NNNN` branch when a builder is in flight. (§2.10.)

### 2.3 house-orchestrator v2

Kept: never-builds invariant (phrasing pattern intact — and now mechanically backed: the conductor's
session config denies Write/Edit outside `docs/` + `.house/`), autonomous loop, redirect guard, audible
handling, verification doctrine, rigor floor, independence axes, ledger/suppression, per-merge teardown,
model-routing profile with escalation rung.

Changes:
1. **Resume = `house status`,** then the git-reality check. The long-lived session becomes an optimization
   (skip re-reading state) — correctness never depends on it. Any fresh session can pick up mid-slice at
   any stage because every stage transition wrote the manifest + an event. Multiple slices in flight are
   representable (the index lists them; dev-state renders them); the WIP limit becomes a validate warning,
   not a structural impossibility. (Orchestrator dive §6.3, §4.1–4.2.)
2. **Stage table uses the canonical names** (§3.1); the ledger is written *as each stage exits* (the
   `slice.stage_entered` event carries it), and the retro's ledger is computed, not narrated.
3. **The workflows write their outputs.** `merge-gate-panel.js` writes its already-schema'd return object to
   `merge-gate.md` (+ event); `code-health-sweep.js` writes `docs/health/<slice-id>.md` itself using its own
   BACKLOG_SCHEMA. One added write-call each — the cheapest fix in the whole proposal. Plus the four knob
   fixes from the dive: `modelProfile` arg (the documented Fable→Opus fallback becomes executable, ending
   the outage-turns-panel-into-NO-GO-generator failure), per-lens quorum with the escalation-triggering lens
   mandatory, data-driven lens sets per stack (from `gates.yml`, killing the `stack==='web' ? … : IOS`
   silent default), and the plan-check commitments passed in so the gate can verify them. Confirmed
   should-fixes get a routing rule: → `accepted.md` (with the ledger's re-surface semantics) or →
   `work.discovered` event targeting a slice. (§2.2, §2.5.)
4. **Merge-gate is per-slice, on `base_sha...HEAD`** from the manifest — resolving the per-unit/per-slice
   contradiction and making the slice diff computable under multi-PR topology. Per-unit review stays inside
   the builder. (§2.1e–f.)
5. **"Notify and halt" becomes real:** halting writes `gate.requested` + `blocked_on` in the manifest; the
   IDE renders a pending-approvals inbox; `gate.resolved` (via `house gate`, from the IDE or terminal) wakes
   the next session. The unattended/high-stakes deadlock gets its stated resolution: high stakes + no panel
   opt-in available = halt at the gate, never downgrade to the single reviewer. (§4.3–4.4.)
6. **`finishing-a-development-branch` is dropped from the loop.** Stage `merge` is owned by the
   orchestrator directly (`gh pr merge` + teardown per doctrine) — the interactive 4-option menu with a
   "Discard" option has no place mid-autonomous-loop. (§3.2.)

### 2.4 house-builder v2

Kept verbatim: bounded authority, scope guards, NEEDS_CONTEXT-don't-guess, compile-at-every-boundary,
**the discriminating-test rule** (named, promoted to doctrine, with the builder required to name the
plausible-wrong implementation per spec rule in the unit record), commitments-survive, the CI-red taxonomy
(moved to doctrine — it is shared policy), destructive-change proof obligations with the "is not proof"
framing, virtualization-robust discriminators (moved to the ios `gates.yml` profile as lore-annotations),
context hygiene, deviations-surfaced-never-buried.

Changes:
1. **One versioned `KickoffBrief`** replaces the two divergent prose input lists — it *is* the `kickoff`
   block in slice.yaml plus per-dispatch fields (`unit_id`, `plan_task_ids`, `fold_forward[]` from prior
   units' `work.discovered` events, `plan_check` commitments, `branch`, `base_ref`, `stakes`, `attended`).
   `NEEDS_CONTEXT` = brief failed validation, naming `missing_inputs[]` — re-dispatch is mechanical.
   `topology` splits into `git_topology` and `execution_style`. (Builder dive §2.2, §2.10.)
2. **The unit record is a stage of the procedure, not a closing sentence.** `units/NN-report.md` opened at
   start, updated incrementally (frontmatter: `state` incl. `IN_PROGRESS`/`ABANDONED`, `heartbeat`,
   `stage_cursor`, `tasks[]` with per-task status+evidence refs, `gates[]` with cmd/exit/summary/log path,
   `deviations[]`, `concerns[]`, `tdd[]` with the discriminator named). Death is detectable; absence of a
   record is fail-closed unknown, never DONE. The conversational report is generated from the record.
   `superpowers:verification-before-completion` is invoked by name at finalization: `DONE` requires every
   declared gate to have a fresh `exit: 0` entry. The orchestrator's "don't trust the report" becomes an
   audit, not a full re-derivation. (§2.1, §6.1.)
3. **The builder is the sole writer of plan checkboxes**, under the evidence rule: a tick requires an
   evidence ref in the unit record, same commit. Three states: `[ ]` / `[x]` / `[!] reason` (formalizing
   the pattern a human already invented). The orchestrator's docs-audit stage becomes a verifier of ticks,
   and `house validate` fails a shipped slice with silent unticked tasks. One writer per field — the IDE
   renders progress, never writes it. (§2.4, §6.5; Kiro #8859.)
4. **Stack gates move to `.house/gates.yml`** — declarative entries (`name`, `cmd`, `parse`, `required_for`,
   annotated `assertions` for the lore). The skill keeps the policy; the repo declares the gates. **Unknown
   stack or missing profile ⇒ NEEDS_CONTEXT, never proceed** — closing the one fail-open hole, on exactly
   the project (the Electron IDE) Jake is about to build. (§2.6, §6.3.)
5. **Ownership boundaries stated:** builder creates its worktree (via `superpowers:using-git-worktrees`,
   invoked by name) when `git_topology: worktree_per_unit`, opens the unit PR, and never invokes
   `finishing-a-development-branch`; orchestrator owns merge and teardown. The SDD 4-state nesting collision
   gets the propagation rule: a sub-implementer's BLOCKED is the builder's to retry per SDD; the builder
   escalates upward only on a plan defect or after two attempts. `executing-plans` is dropped as an
   alternative executor (no review stage = incompatible quality floor); SDD is the one internal loop, with
   its three prompt templates used rather than paraphrased. (§2.5, §3.1–3.4, §6.4.)

---

## 3. Stage & gate model

### 3.1 The canonical stage table (names, not numbers)

Numbers (and the 4¼/7½/9½ fractions) are deleted — they were an append-only changelog of process amendments
wearing an enum's clothes. One table, in doctrine, referenced by both skills and by `schema/enums.yaml`.
Each stage: owner · entry precondition (an artifact) · exit artifact · gate.

| Stage | Owner | Exit artifact | Gate |
|---|---|---|---|
| `ideation` | roadmap/human | roadmap line + optional slice dir | — |
| `intake` | shaper | slice.yaml (kind, rigor, appetite) | — |
| `research` | shaper (subagents) | research/NN-*.md digests | — |
| `spike` (rigor-triggered) | shaper (subagent) | spike.md, verdict GO/NO_GO/INCONCLUSIVE | soft — NO_GO loops to intake/abandon |
| `brainstorm` | shaper (inline) | design converged (dialogue) | — |
| `decision` (fork) | shaper | ADR (status: proposed) | ⛔ **human** approves ADR → accepted; terminal for kind: decision |
| `spec` | shaper | spec.md (draft) | — |
| `spec_review` | **human** | spec state → approved | ⛔ **hard** — recorded or it didn't happen |
| `mockup` (rigor-triggered) | shaper | mockups/* + meta | ⛔ **human** sign-off, recorded |
| `plan` | shaper | plan.md | — |
| `plan_check` | agent (fresh reviewer) | plan-check.md {GO/GO_WITH_FIXES/NO_GO} | soft-hard hybrid: NO_GO blocks (loops), GO_WITH_FIXES must enumerate folded fixes |
| `handoff` | shaper | kickoff block; stage → planned | ⛔ validate green |
| `ready_check` | orchestrator | git-reality + gates.yml present | soft |
| `build` (unit loop) | builder | units/NN-report.md (incremental) | soft — 4-state; BLOCKED×2 escalates |
| `merge_gate` | agent (reviewer/panel) | merge-gate.md {GO/NO_GO/INCONCLUSIVE} | ⛔ NO-GO blocks; INCONCLUSIVE is not a pass; floor: never skipped |
| `health_sweep` (advisory, every few slices) | agent (workflow) | docs/health/<slice-id>.md | — never blocks |
| `ci` | builder/orchestrator | green run or authorized infra-only record | ⛔ CI-red taxonomy; merge-through needs **human** OK |
| `live_check` | **human** | attestation event (what was checked) | ⛔ hard |
| `docs_audit` | orchestrator (subagent) | tick-verification + drift fixes in PR | soft |
| `merge` | orchestrator | slice.merged event + trailers + teardown | — |
| `reconcile` | orchestrator | retro.md (ledger as data) + dev-state render + hygiene sweep | Stop-hook enforced |

Terminal states: `shipped`, `parked` (Rust's postponed), `abandoned` (Oxide) — "we decided not to" is
finally recordable without deleting the reason.

### 3.2 Gate doctrine (kept, hardened)

- **Hard (human) gates:** spec review, mockup sign-off, ADR approval, merge-gate NO-GO override, CI
  merge-through, live/device validation, anything irreversible/outward-facing, any proposal to reduce
  rigor. Fail-closed tie-breaker kept verbatim. Each hard gate = `gate.requested` event + `blocked_on` in
  the manifest → the IDE inbox; resolution = `house gate … --verdict …` from anywhere.
- **Soft (agent) gates:** plan-check, builder 4-state, per-task reviews, ready_check, docs_audit — agents
  decide, but the decision is a file + event, and `house gate` refuses forward transitions past a blocking
  verdict.
- **Deterministic (hook) gates** — the new rung, from Anthropic's own gate-strength ladder:
  `SubagentStop` blocks a builder returning without a finalized unit record; `Stop` blocks an orchestrator
  session ending without validate-green + dev-state render; pre-push runs `house validate`. Every gate in
  the table is annotated with its rung; nothing claims to be load-bearing while sitting on the advisory rung.
- **The rule of the whole section: an unrecorded gate is an unpassed gate.** (v1's stage-ledger spirit,
  promoted to the constitution.)

### 3.3 Cadence resolved

Per-unit: builder's internal per-task reviews + unit report + unit PR CI. Per-slice: ONE adversarial
merge-gate on `base_sha...HEAD` (the empirically-earned rule, now with an obtainable diff), health sweep on
its every-few-slices cadence, one retro, one ledger.

### 3.4 Rigor dial and kinds (one dial, set once, readable by all)

`rigor: light|standard|high` + `kind`, set by the shaper at intake, in the manifest. Per-kind required
artifacts (the ceremony answer to "I just wanted to change a button color"):
- `decision` → ADR only. `spike-only` → spike.md + roadmap note. `docs-only` → plan + report.
- `hotfix` → plan.md (tasks only) + unit report + merge-gate (single reviewer) + retro-ledger. No spec, no
  plan-check, no mockup.
- `slice` → the full table; `light` skips mockup/spike, `standard` = default, `high` = panel + mockup +
  spike as flagged.
**Floor kept verbatim: the dial never skips the merge-gate, and proposing to skip it is itself a hard gate.**

---

## 4. IDE contract

The IDE is an observability plane over files it never owns. `git clone` + markdown must remain sufficient —
the durable contract is the repo, not the app (the anti-Vibe-Kanban rule).

**Reads (exactly four things, zero heuristics):**
1. `.house/index.json` — all state: slice list, stages, blocked_on, unit progress, gate verdicts, next
   actions. Watched (chokidar, `awaitWriteFinish` + `atomic`); every event triggers re-read/re-derive,
   never accumulation; "reindex everything" is idempotent.
2. Raw markdown/HTML under `docs/` for rendering. Frontmatter `kind` tells the pane what it is rendering
   (spec/plan/adr/retro/mockup) — no filename heuristics, because kinds are declared and paths derive from
   ids. Mockups render in a sandboxed webview iff `self_contained: true` validated.
3. `.house/events.jsonl` tail — the live timeline strip and the session-activity feed.
4. `docs/roadmap.md` + rendered `dev-state.md` — the home screen, verbatim.

**Renders without heuristics:** home screen (slice cards: stage badge, blocked-on, progress from
done+skipped/total, appetite vs elapsed); a **pending-approvals inbox** (`gate.requested` without matching
`gate.resolved` — the flagship feature, and the mechanism that makes "notify and halt" real); per-slice view
= the directory listing typed by frontmatter, auto-opening on `artifact.written` events; plan progress bars
from checkbox parsing (read-only — the IDE never writes a checkbox); an evidence panel (gate records carry
cmd/exit/log path — click-through from a red gate to its output); a stalled-session detector (builder
heartbeat stale, or `gate.requested` 40h old).

**Terminal pane:** hosts the Claude Code sessions (Electron + xterm.js + node-pty in a dedicated utility
process, flow-controlled, reconnectable — VS Code's model, per the ide-prior-art digest). Session↔slice
binding comes from hook-emitted `session.started {session_id, slice}` events — never from parsing
transcripts. "Launch next session" is a button that runs the CLI-printed kickoff (`house next` + the
kickoff block), so the IDE can start a shaper/orchestrator/builder with a correct cold-start prompt.

**Writes:** `gate.resolved` via `house gate` (the approve button), and nothing else. One writer per field
holds.

---

## 5. What v1 got right — kept verbatim

1. Session boundary == context boundary; the shaping transcript dies, only artifacts persist (now with the
   obligation that every decision is written before the session may end).
2. The never-builds invariant, stated as a behavioral tripwire — and its mirror, the builder's bounded
   authority ("you own building the unit well and reporting honestly").
3. Fail-closed everywhere: the gate tie-breaker, panel quorum INCONCLUSIVE≠GO, refuter fail-closed keep,
   "a false NO-GO is safe; a false GO is not."
4. The rigor floor and "proposing to skip it is itself a hard gate"; stakes-not-file-type.
5. The three independence axes (perspective / architecture / context) and Opus-builds/Fable-reviews.
6. "Don't trust the report" verification doctrine; `gh run view --json conclusion`, never piped exit codes.
7. The accepted.md suppression ledger with its re-surface semantics and NEW-aspect carve-out.
8. The out-of-scope escape hatch (now with a destination).
9. The auto-fix boundary and the squash-merge caveat (now encoded in `house merge`).
10. Stage-ledger semantics: ran / skipped-with-allowed-reason / n-a; "'I didn't get to it' is a deviation."
11. The CI-red taxonomy, whole ("when unsure, treat as code-red"; anti-normalization clause).
12. The discriminating-test rule and "commitments survive into the artifact."
13. NEEDS_CONTEXT-don't-guess; "NOT this slice" scope guards as first-class negative space.
14. The research-dispatch contract (one question per agent · read-only · digest shape · never read deep in
    your own context) and brainstorm-cannot-be-a-subagent.
15. "A folded-in advisory is a commitment" — now checkable end-to-end.
16. One-job-per-doc, the routing table, the three-slices test, the reconcile-subagent pattern.
17. The redirect guard and the audible protocol.
18. Compose-don't-reinvent — upgraded from a slogan to a take/suppress/own contract.

---

## 6. Migration — the ~15 existing projects

**Principle: forward-only, no big bang, history is indexed not moved.**

1. **`house init`** in each repo (5 minutes, scriptable across all 15): creates `.house/`
   (events/config/gates.yml stub), `.gitattributes` union-merge line, installs the hooks into
   `.claude/settings.json`, creates `docs/slices/`.
2. **`house adopt`**: scans existing `docs/superpowers/specs|plans`, `docs/retros/`, `docs/mockups/`,
   `docs/adr/` and writes `docs/slices/legacy-index.yaml` — a read-only map of historical artifacts to
   synthetic ids (`L001-…`), fuzzy-joined by slug/date with a `confidence` field, hand-corrected once if
   Jake cares. Old files are **not moved** (links, git history, and muscle memory survive). `house list`
   shows legacy slices greyed; `house validate` runs warn-only on legacy paths, strict on `docs/slices/`.
3. **The active slice per project** (there are at most a handful across the fleet) is adopted for real: a
   reconcile subagent creates the slice dir, copies/moves spec+plan in, adds frontmatter, writes
   `slice.yaml` at its true stage, backfills `base_sha` from the branch point. One shaper-session's worth of
   work per active project.
4. **New work is v2-only** from day one. dev-state.md is regenerated on first orchestrator resume (hand
   sections preserved between markers); roadmap gains its frontmatter line.
5. **Dormant projects migrate lazily** — `house init` runs the first time a session touches them; until
   then they are simply pre-v2 repos and nothing breaks, because v2 never requires global state.
6. **Skills cut over atomically** (they live in one repo): v2 skills refuse to run in a repo without
   `.house/` and print the `house init` one-liner — the presence-precondition check, borrowed from Spec Kit.

Sequencing for the IDE bet: CLI + schema first (week 1) → skills v2 rewritten against it (week 2, dogfooded
on the sdlc-skills repo itself) → migrate edge-scanner + one iOS project as the proving pair → fleet `init`
→ then the Electron IDE builds against a contract that is already true on disk.

---

## 7. Deliberate non-adoptions (and why)

- **OpenSpec's capability-spec + delta-merge-on-archive** — the single best template in the corpus, and
  still deferred. It requires re-architecting every spec into per-capability truth files and teaching all
  three skills delta semantics — a large process change whose headline benefit (location-is-status) v2 gets
  more cheaply from the merge-event projection + validate. Revisit as v2.1 once ≥3 projects have real
  multi-slice capability overlap; the slice-dir layout is forward-compatible with it.
- **A Beads-style DB/daemon** — JSONL + rebuildable index steals the architecture without the machinery.
- **Agent teams / a fourth role / ACP as the durable contract** — session-scoped things must not carry
  repo-scoped truth.
- **Spec→code regeneration** (Tessl) — not 2026-viable; reconciliation is.
- **Hill charts replacing checkboxes** — genuinely attractive (the research is right that unknown-vs-solved
  beats done-vs-not), but it adds a second progress vocabulary. Compromise: the unit record gains one
  optional `confidence: uphill|over-the-top|downhill` field per unit; the IDE may render it; checkboxes
  under the evidence rule remain the progress ledger. Revisit if ticks rot again — which validate makes
  loud.
- **Renumbering/renaming for its own sake anywhere else** — every v1 name that works (skill names, doc
  names, accepted.md, retro concept) is kept, because migration cost is real and the bet is that the
  cheapest sound system wins.

---

## 8. Why evolve beats rebuild (the closing argument)

The audit's fifteen weaknesses reduce to four missing mechanisms: **identity** (slice dir + monotonic id),
**persistence** (frontmatter + verdict files + events), **derivation** (index + render + next), and
**enforcement** (validate + hooks + gate CLI). All four are additive. Not one requires changing a rule that
v1's retros show actually catching bugs — the 400k-trial merge-gate, the NEEDS_CONTEXT that prevented a
data-loss event, the CI-red taxonomy — and a ground-up rebuild puts every one of those earned rules back at
risk of transcription error. The deep dives' own conclusion, three times over, was the same sentence: *the
redesign's job is not new rules but giving the existing best rules an artifact, an evidence requirement, and
a verifier.* That is this proposal, and nothing else is.
