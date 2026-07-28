# house v2 — the SIMPLIFY proposal

**Stance:** v1 is a good gate designer's process wearing four times the process it needs. Its real failures
(unticked checkboxes, stale Status lines, evaporating verdicts, unnameable mockups) are not caused by missing
machinery — they are caused by having *so much* surface that no one mechanism owns anything. The redesign is
**subtraction plus a tiny state kernel**: cut 3 skills to 2, 12 stages to 5 states, 7 doc types to 4, ~8 gate
ceremonies to 4 gates (exactly 1 of them human per slice), 2 JS workflows to 0, and 5–7 per-slice files to a
median of 1. What remains gets the one thing v1 never had: a machine-readable spine small enough that a solo
dev will actually keep it honest, and an IDE can render it without a single heuristic.

The test applied to every v1 element: **does it block a state transition and emit a durable record?** If yes,
keep it and give it the record. If no, it is ceremony — delete it or derive it. (This is the industry-consensus
definition of a load-bearing gate; see research-agentic-sdlc §4.5.)

---

## 0. The diagnosis in one paragraph

Every deep-dive found the same disease at a different organ: the shaper mints no identity and persists no
verdict; the orchestrator's gates all verdict into a transcript; the builder's report is a sentence in a
destroyed session. v1's answer to each failure was *more process* — a second review layer, a fractional stage,
a doctrine file, a lint rule with no linter. The audit shows the fleet ignoring most of it: 30/32 plans
unchecked, 6/8 dev-states missing the field resume depends on, three shipped specs still saying DRAFT, four
retro naming schemes. **Process that agents and a solo human demonstrably do not execute is not process — it is
decoration.** v2 keeps the ~10 rules that earned their keep (they are listed verbatim in §7), deletes the rest,
and moves all state into a kernel with exactly one writer per field.

---

## 1. Artifact & state model

### 1.1 The whole tree

```
docs/
├── roadmap.md                     # the ONLY hand-authored, status-free prose doc. Strategy + backlog.
├── adr/
│   └── NNNN-<slug>.md             # decisions. Frontmatter: status. Immutable body.
├── health/
│   └── accepted.md                # the suppression ledger — kept verbatim from v1 (it worked: 6/8 adoption)
└── work/
    └── NNNN-<slug>/               # ONE directory per slice. The directory IS the identity.
        ├── slice.md               # THE artifact: pitch + plan + tasks + deviations, one file
        ├── mockup.html            # optional (tier: full, UI slices). Self-contained by contract.
        ├── spike.md               # optional (tier: full, risky slices). Digest + GO/NO-GO in frontmatter.
        ├── review.md              # the merge review verdict. Written by the reviewer subagent.
        └── retro.md               # ONLY when something deviated. A clean slice gets no retro file.
.house/
├── events.jsonl                   # append-only observed truth. ULID ids. `merge=union` in .gitattributes.
└── index.json                     # derived cache, GITIGNORED, rebuilt by `house status`. Never authored.
```

That is the complete inventory. Deleted outright from v1: `docs/dev-state.md` (becomes a **generated view** —
`house status`), `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/mockups/` and
`docs/superpowers/mockups/` (both — the mockup lives in its slice dir), `docs/retros/` as a flat tree,
`docs/health/<date>-<slice>.md` sweep dumps (findings route to `accepted.md` or the roadmap backlog),
`references/doctrine.md` as a separate always-drifting file (its surviving rules fold into the `house` skill
and the `house check` validator), and both JS workflows.

**Identity.** `NNNN` is zero-padded, monotonic, minted by `house new <slug>`, never reused (Oxide RFD /
spec-kit convention). Everything derives from it mechanically: branch `s/0007-dfs-oom-fix`, PR title prefix
`[0007]`, commit trailer `House-Slice: 0007`. Two "Slice N" series can never coexist because nobody types a
slice number by hand. ADR numbers come from the same allocator (`house new --adr`), killing the
two-sessions-both-pick-0009 race.

**Linking.** Slice → ADRs via frontmatter `adrs: [0004]`; ADR → slice via `House-Slice` trailers on the
commits that shipped it (queryable, never hand-maintained). Mockup/spike/review/retro link to the slice by
*being in its directory* — there is no naming key to define because there are no names to choose.

### 1.2 `slice.md` — one dense artifact instead of spec + plan + tasks + scattered verdicts

v1 kept a spec and a plan as separate documents that had to agree with each other *and* the code — double the
drift surface, and the audit shows both halves rotting independently. For a solo dev whose spec reader and plan
reader are the same builder agent, the split is multi-human ceremony. v2 merges them:

```markdown
---
id: 0007-dfs-oom-fix
title: DFS optimizer MLB /dfs OOM fix
state: building            # shaping | ready | building | review | done | parked | dropped
tier: slice                # slice | full        (chores don't get a slice at all — §3.1)
appetite: 1-session        # 1-session | 1-day   (nothing larger may exist — §3.2)
rigor_note: touches user data → merge review must run the data-safety lens
branch: s/0007-dfs-oom-fix
pr: 142
approved: 2026-07-21T09:14:00Z      # Jake's ONE human gate. Absent = not approved.
plan_check: GO-WITH-FIXES           # GO | GO-WITH-FIXES | NO-GO — enum defined once, in the schema
adrs: [0004]
---

## Problem        ← why (Shape Up pitch slot 1)
## Appetite       ← the declared budget and what gets cut if it's blown
## Solution       ← the WHAT and the HOW, together, with spec rules stated testably (numbered: R1, R2…)
## Rabbit holes   ← named risks; anything the plan-check flagged as must-fix lands here, folded
## No-gos         ← negative scope. This IS the "NOT this slice" scope-guard list — same field, one home.
## Tasks
- [ ] T1 Cap auto-optimizer pool to top-64 legs — verify: `npm test -- pool.test.ts`
- [ ] T2 Surface server-action errors in UI — verify: `npm test` + screenshot
## Deviations     ← append-only. Every entry: what, why, evidence. Empty section = clean slice.
```

Rules:
- **Frontmatter is the machine surface; sections are the human surface.** `house check` validates frontmatter
  against a JSON Schema and requires the six section headings — a five-minute lint that kills heading drift
  the way v1's allowlist-with-no-linter never could.
- **The five pitch slots replace the free-form spec.** Problem/Appetite/Solution/Rabbit-holes/No-gos is a
  decade-validated schema (Shape Up ch. 6), trivially checkable, and **No-gos** finally gives the scope guards
  the defined home v1 never gave them (deepdive-shaper §2.12).
- **Tasks carry a `verify:` command.** A tick is a completion claim; the builder may tick only with the verify
  command's fresh output recorded (an event with the command + exit + summary). Third marker `[!]` =
  attempted-blocked-with-reason, formalizing the pattern a human already invented in the wild
  (deepdive-builder §2.4).
- **One writer per region.** The `house` session owns frontmatter and the pitch sections; the builder owns the
  Tasks and Deviations sections *while a unit is dispatched*; nothing else writes the file. This is the
  Kiro-`[-]`-bug vaccine (research-ide-prior-art §1.1): no field ever has two writers, and no state marker
  doubles as agent-visible prose the agent will misread as an instruction.
- `state` is a **closed enum with one definition** (the schema). `parked` and `dropped` are first-class — v1
  literally could not record "we decided not to" (research-classic-process §3.3).
- Tier `full` may add a separate `spec.md` in the dir when the Solution section genuinely can't hold the rule
  set. That is the escape hatch, not the default.

### 1.3 Status vocabulary — defined once, validated always

| Object | Enum | Writer |
|---|---|---|
| slice `state` | `shaping · ready · building · review · done · parked · dropped` | `house` session (and the PR-merge hook for `→ done`) |
| `plan_check` | `GO · GO-WITH-FIXES · NO-GO` | plan-check reviewer (via `house log`) |
| `review.md` `verdict` | `GO · NO-GO · INCONCLUSIVE` | merge reviewer (INCONCLUSIVE is not a pass — kept from v1) |
| builder report `result` | `DONE · DONE_WITH_CONCERNS · BLOCKED · NEEDS_CONTEXT` | builder, with required fields per state (§2.2) |
| task marker | `[ ] · [x] · [!]` | builder, evidence-gated |
| ADR `status` | `accepted · superseded-by: NNNN` | `house` session |

BMAD shipped status-name bugs because two files each restated the vocabulary; here every enum lives in
`house`'s schema file and `house check` rejects any other value.

### 1.4 The event log and the derived index

`.house/events.jsonl` — append-only, one JSON object per line, `{id: ULID, ts, event, slice, actor,
session, payload}`. **Nine event types, no more:** `slice.created`, `slice.state`, `gate.approved`,
`builder.dispatched`, `builder.reported`, `task.verified`, `review.verdict`, `slice.merged`,
`session.{started,ended}`. Over-logging is its own maintenance burden; this set is exactly what the home
screen, resume, and the metrics need. Emitters are **hooks and the `house log` CLI, never agent recall**
(SessionStart/SessionEnd/SubagentStop hooks + a post-merge check using `gh pr list --state merged` — never
branch reachability; the squash-merge caveat survives, in code).

`.house/index.json` is a projection rebuilt by `house status`; deleting it is a no-op. Frontmatter = declared
truth, events = observed truth, index = cache; one writer per layer; nothing reads the cache to decide
something it writes back. If the CLI is ever broken, `git clone` + reading `slice.md` files still tells you
everything — the files are the contract, the CLI is a convenience.

### 1.5 The `house` CLI — five commands, deliberately no more

```
house new <slug> [--adr]        # mint id, scaffold slice.md from template, create branch
house status [--json]           # derived state of everything; --json is the IDE's home screen
house check [--strict]          # the validator: schema, enums, section headings, consistency
                                #   (state:done requires review GO + 0 unticked/unexplained tasks + PR merged)
house log <event> --slice NNNN --payload '<json>'   # the skills' one-line verdict emitter
house next                      # the single computed next action (Beads' bd ready) — replaces the
                                #   hand-written "next action:" line that went stale in 6/8 projects
```

`house check` runs as a pre-push hook and inside the merge review. **If it doesn't fail the build, it rots** —
that is the single lesson of v1's allowlist. There is no `house doctor`, no waves, no dependency graph, no
daemon, no DB: appetite-capped slices with ≤ ~10 tasks don't need graph scheduling, and Beads' Dolt engine is
exactly the machinery a solo dev should not adopt (research-sdd-tooling §4).

---

## 2. Skill / agent topology — two skills, not three

### 2.1 Why the shaper/orchestrator merge is safe now (and wasn't before)

v1 needed three skills because **conversation was the state store**, so each conversation had to stay small
and single-purpose. The seam between shaper and orchestrator is where the worst v1 bugs live: two disagreeing
stage vocabularies, a mockup gate owned by a skill that never heard the word, a rigor dial defined in a file
the shaper can't reach, a hand-off that is a prose sentence re-parsed twice (deepdive-shaper §2.1–2.3, §2.11).
Once state is on disk, session boundaries stop being architecture and become context hygiene: any fresh
session resumes from `house status` in one read. So v2 deletes the seam and keeps the hygiene as advice.

**`house`** — the one skill Jake's own session runs. It shapes, gates, dispatches, and reconciles; it **never
builds** (v1's hard invariant kept verbatim, and now *enforced*: the session's permissions deny Write/Edit
outside `docs/`, `work/`, `.house/` — a permission boundary, not a self-monitoring instruction). Its flow is
the lifecycle itself:

1. **Intake** — `house status`; if the idea is a decision with nothing to build → write the ADR
   (`house new --adr`), done. If it's a chore (§3.1) → say so and stop; chores don't enter the system.
2. **Shape** — dialogue with Jake (research subagents as in v1: one question each, read-only, digest back —
   kept verbatim; digests worth keeping get pasted into Rabbit holes, not orphaned). Write `slice.md`.
   Dispatch **one fresh plan-check reviewer** (5 lenses, kept from v1) → verdict via `house log`, must-fixes
   folded into Rabbit holes/Tasks. NO-GO loops back to shaping — the loop-back v1 never had.
3. **Gate** — ⛔ Jake reviews `slice.md` (and `mockup.html` if tier full). His approval stamps `approved:` and
   `state: ready`. **This is the only per-slice human gate.** It merges v1's spec review + mockup sign-off +
   plan handoff confirmation into one review of one artifact.
4. **Build loop** — dispatch `house-builder` per unit (autonomous, no per-unit permission asks — kept);
   intake reports; fold concerns into the next unit's kickoff.
5. **Review** — dispatch one fresh refute-biased reviewer on the slice diff → `review.md`. NO-GO blocks.
6. **Ship** — merge the PR; the merge event flips `state: done`, and `house check` confirms the invariants.
   Retro only if the Deviations section is non-empty.

The context-economics advice survives as one line in the skill: *"shaping is heavy — prefer a fresh session
for it; disk state makes that free."* It is a recommendation, not a wall, because the wall no longer protects
anything.

**`house-builder`** — implements ONE unit, unchanged in role, upgraded in interface. Everything it needs is
**in the slice directory**: kickoff = `{slice_dir, task_ids, session context}`. No more two divergent copies
of the kickoff dict — the sender and receiver read the same file, so `NEEDS_CONTEXT` finally has a precise
meaning: a named missing field or an ambiguous spec rule, reported with the field name. Its crown-jewel rules
(§7) are kept verbatim. Two new obligations, both mechanical: (a) tick tasks **as it goes**, evidence-gated,
emitting `task.verified` events — the builder is the writer of progress, the `house` session merely verifies;
(b) end by appending its report (4-state + branch/PR + deviations) as a `builder.reported` event *before* the
final message, so a dead session still leaves the record and absence-of-record is itself a fail-closed signal.

### 2.2 The 4-state report, finally specified

`DONE` requires: all assigned tasks `[x]` or `[!]`-with-reason, every verify command freshly green (events
exist), no unsurfaced deviations. `DONE_WITH_CONCERNS`: DONE + `concerns[]` (each tagged fold-forward or
accept). `BLOCKED`: which task, what was tried, branch state. `NEEDS_CONTEXT`: the named missing input. The
composed SDD implementer prompt already had this level of spec (deepdive-builder §7.1); v2 just stops being
less specified than the skill it wraps.

### 2.3 Composition — own the core, compose the leaves

v1's composition seams fought back everywhere (brainstorming's forced terminal transition breaking
decision-only mode; writing-plans' worktree assumption and trailing execution menu;
finishing-a-development-branch's interactive discard option inside an unattended loop — deepdive-shaper §3,
deepdive-builder §3.2). The simplify verdict: **stop composing third-party skills for the process spine.**
The five-slot pitch replaces brainstorming+writing-plans as the shaping output (the *dialogue technique* of
brainstorming remains good practice; the skill dependency does not). `house` owns merge directly — no
finishing-a-development-branch. The builder keeps composing what composes cleanly: TDD, systematic-debugging,
and SDD's two-stage per-task review templates (used verbatim, not paraphrased). The
`executing-plans`-or-SDD fork is deleted — one internal loop, the reviewed one.

Model routing is kept as policy (judgment on the strongest model, throughput on the cheaper one,
cross-architecture review deliberately) but the model *names* move to `.house/config.yaml` so a price change
is a config edit, not a five-file grep.

---

## 3. Stage / gate model

### 3.1 Tiers — the ceremony floor, lowered

- **chore** — "change a button color." No slice, no artifact, no gate beyond tests passing. The process's job
  is to *not exist* here. (Kiro's most-quoted complaint, designed against.)
- **slice** (default) — `slice.md` → approval → builder(s) → merge review → done. Median added files: **1**.
- **full** — adds `mockup.html` (UI) and/or `spike.md` (novel risk) to the shape step, and the reviewer runs
  with the high-stakes lenses named in `rigor_note`. Chosen at intake, recorded in frontmatter — the rigor
  dial exists **once**, in the file both sessions read, ending v1's three unreconciled dials.

### 3.2 Appetite and the circuit breaker

Every slice declares `appetite: 1-session | 1-day`. Nothing larger is representable — a bigger idea must be
decomposed into slices at shaping time (the multi-output shape v1 lacked). A unit that can't merge within its
appetite is *mis-sized by definition*: the builder stops, reports, and the choice is scope-hammer (cut to
No-gos) or `parked` — never silently extend. With agent throughput the marginal cost of "one more thing"
feels like zero; the appetite is the declared, recorded counterweight, and it is the Shape Up idea that
matters most for this user (research-classic-process §1).

### 3.3 The four gates (down from ~8 ceremonies)

| Gate | Kind | Blocks | Emits |
|---|---|---|---|
| **Pitch approval** | HARD (human) | `shaping → ready` | `gate.approved` + `approved:` stamp |
| **Unit verification** | deterministic | task tick / builder DONE | `task.verified` events (verify cmd + exit + summary); enforceable via SubagentStop hook |
| **Merge review** | agent (fail-closed) | `review → done` | `review.md` + `review.verdict`; NO-GO blocks; INCONCLUSIVE is not a pass |
| **Irreversible actions** | HARD (human) | the action, anywhere | `gate.approved` with the action named |

Rule kept from v1, now literal: **an unrecorded gate is an unpassed gate** — `house check` treats a missing
record as a block, so "fail closed: unsure → hard" becomes checkable instead of remembered.

Deleted as stages, with their survivors:
- **Merge-gate panel + 3-refuter machinery** → deleted. Peak process theater for n=1: quorum bugs, a
  hard-coded model fallback that turns an outage into a NO-GO generator, and an opt-in rule that deadlocks
  against its own rigor floor (deepdive-orchestrator §2.5, §4.4). Survivor: *one* fresh refute-biased
  reviewer, always; for `full` slices the skill may dispatch 2–3 parallel lens reviewers with
  `dispatching-parallel-agents` — plain subagents, no JS, no quorum arithmetic. The `accepted.md` ledger is
  still handed to the reviewer (the suppression pattern earned its keep).
- **Health sweep (7½)** → not a stage. Run on demand as a shaped `chore`/`slice` when Jake wants one; findings
  route to `accepted.md` or the roadmap backlog. A whole-app N-lens sweep every few slices, whose output the
  conductor hand-copies to an unschema'd file, was ceremony.
- **Docs audit (9½)** → dissolved. There is nothing to audit: status is derived, dev-state is generated, the
  spec/plan *is* the slice file the builder just reconciled. Drift detection = `house check`.
- **Live/device validation (9) as an every-slice hard gate** → demoted to tier-`full` and to Jake's own
  judgment. v1's version made the "autonomous loop" structurally impossible (deepdive-orchestrator §4.3); the
  IDE makes ad-hoc live checking cheap, and the destructive-migration proof obligations (kept, §7) cover the
  cases where skipping it can actually lose data.
- **Stage ledger** → computed. `ran/skipped/n-a` per stage falls out of the event log; the retro stops
  narrating it.
- **Retro as an every-slice obligation** → retro only when Deviations ≠ ∅. A no-news retro is a form nobody
  reads; a deviation retro is the process-improvement signal v1 was actually mining.

### 3.4 The lifecycle, drawn once

```
 idea ──chore?──▶ just do it (no slice)
   │
   ▼
 shaping ──plan-check NO-GO──▶ (loop) ──scope explodes──▶ N slices
   │ ⛔ Jake approves slice.md
   ▼
 ready ──▶ building (units × builder) ──▶ review ──NO-GO──▶ building
   │                                        │ GO
 parked/dropped (first-class, anywhere)     ▼
                                    PR merged ──hook──▶ done  (+ retro iff deviations)
```

---

## 4. IDE contract

The IDE reads **files and one JSON surface, zero heuristics**:

| Pane | Reads | Mechanism |
|---|---|---|
| Home screen | `house status --json` + `docs/roadmap.md` | run on watch events; re-derive, never accumulate |
| Slice list / side pane | `work/*/slice.md` frontmatter | watcher (chokidar `atomic` + `awaitWriteFinish`) as a *hint*; every event triggers re-read |
| Slice detail | the slice dir's files, rendered markdown | auto-open on `slice.created` / file-create under `work/` |
| Mockup pane | `work/NNNN-*/mockup.html` | sandboxed webview, locked CSP; the file's self-containment (no external fetches) is asserted by `house check` |
| Activity / timeline | tail `.house/events.jsonl` | append-only; ULID dedupe makes replays harmless |
| Approvals inbox | slices in `shaping` with plan-check recorded but no `approved:`; any `gate.approved`-pending irreversible action | pure frontmatter/event query — this is what makes "notify and halt" real |
| Terminal panes | pty sessions (own process, flow-controlled, reconnectable — VS Code's model) | `session.started` events carry `session ↔ slice` so a pane is bound to a slice, never guessed |
| Progress | task markers in `slice.md` + `task.verified` events | ticked-with-evidence, so the bar never lies (v1 would render 0/65 on a shipped plan) |

Because every id comes from a path and every enum from one schema, the IDE needs no fuzzy slug matching, no
naming-style detection, no transcript parsing (explicitly banned — Claude Code's own docs warn the format
breaks between releases). Stack per the prior-art digest: Electron, node-pty in a utility process, xterm.js;
but the contract above is IDE-agnostic — `git clone` + a text editor still shows everything, which is the
guard against building another Vibe Kanban.

**Build order:** CLI first, skills second, IDE third. The IDE visualizes a contract that must already work
from a bare terminal.

---

## 5. Migration — the ~15 projects

Lean rule: **do no work that has no next reader.** No bulk rewrite of ~40 plans, 96 retros, and 9 spec
vocabularies into v2 form — that history's readers are humans, rarely, and git already keeps it.

1. **`house init`** on a repo: creates `work/`, `.house/`, the schema, the hooks, and generates the first
   `house status`. Ten minutes, idempotent, non-destructive. Legacy `docs/superpowers/**`, `docs/retros/**`,
   `docs/mockups/**` stay exactly where they are, read-only.
2. **`house init --adopt`** additionally writes `.house/legacy.json` — a one-time index (path, guessed kind,
   guessed slice title, date) so the IDE can *list* the old corpus in an "archive" section. Index only; no
   file is moved or edited.
3. **Per-repo, on next touch.** A repo migrates when Jake next opens it for real work: finish any in-flight
   v1 slice under v1 rules, then `house init`, then every new slice is v2. Dormant repos never migrate and
   lose nothing.
4. **Two carryovers by hand, once per active repo (~15 min):** seed `docs/adr/` numbering above the existing
   max (the allocator reads the directory), and carry the current dev-state's Active/Slated content into
   `roadmap.md` + a first `work/` slice if one is genuinely in flight. `dev-state.md` is then deleted — its
   replacement is generated.
5. **The skills repo ships v2 as new skills** (`house`, `house-builder` v2); v1 skills are archived, not
   edited in place, so an unmigrated repo's old sessions keep working during the transition window.

---

## 6. Risks (owned, not hidden)

- **Merging shaper+orchestrator could re-bloat the conductor session.** Mitigation: disk state makes fresh
  sessions free; the skill actively recommends session-per-phase; research/reconcile stay in subagents.
- **One `slice.md` can get heavy on big slices.** Mitigation: appetite caps slice size by construction;
  tier-`full` allows a `spec.md` split as the escape hatch.
- **Deleting the panel trades defense-in-depth on the highest-stakes slices.** Mitigation: the single
  reviewer is fail-closed and always runs; `full` tier documents parallel lens reviewers; the empirical
  400k-trial review was a *reviewer behavior*, not a panel property, and survives.
- **The CLI is a new dependency on the critical path.** Mitigation: files are the truth and stay hand-editable;
  the CLI is ~5 thin commands over frontmatter + JSONL; degraded mode = edit frontmatter by hand and
  `house check` later.
- **Ownership windows on `slice.md`** (session owns frontmatter, builder owns Tasks) could race if a builder
  runs while the session edits. Mitigation: the session never edits a slice with a dispatched builder
  (`builder.dispatched` without `builder.reported` = locked), enforced by `house check`.
- **Fleet runs two conventions during migration.** Accepted: per-repo cutover is atomic, and the IDE renders
  legacy as a read-only archive, so the ambiguity is visual, not operational.

---

## 7. What v1 got right — kept verbatim

1. **"Hard invariant — you never build"** with its behavioral-tripwire phrasing — now also a permission
   boundary.
2. **Fail closed: unsure whether a gate is hard → treat it as hard** — plus "a false NO-GO is safe; a false
   GO is not" and "INCONCLUSIVE is NOT a pass."
3. **`NEEDS_CONTEXT` — don't guess** (it prevented a production data-loss event; now with named-field
   precision).
4. **The discriminating-test rule** — a falsifiability criterion for tests, kept word for word, now with the
   named plausible-wrong implementation recorded as evidence.
5. **The CI-red taxonomy** (infra-only / code-red / no-CI; "when unsure, treat as code-red"; `gh run view
   --json conclusion`, never piped exit codes; the anti-normalization clause).
6. **Destructive-change proof obligations** — "a fresh install / CI passing **is not proof**," migrations
   exercised against a previous-schema store, known-good-merge-commit rule.
7. **"A folded-in advisory is a commitment"** — the shaper→builder obligation chain, now checkable because
   must-fixes land as tasks/rabbit-holes with ids.
8. **The squash-merge caveat** — merged-ness from PR state, never reachability; now encoded in the merge hook.
9. **The `accepted.md` suppression ledger** — the most machine-ready, best-adopted convention in v1; kept
   as-is and handed to every reviewer.
10. **The research-subagent contract** — one question per agent, read-only, digest-shaped return, "NEVER do
    the deep reading in your own context."
11. **Cross-architecture review** (builder model ≠ reviewer model) and stakes-not-file-type as the rigor axis.
12. **The auto-fix boundary** — only provably-safe, no-data-loss auto-resolution; destructive fixes surface
    for explicit OK; "running unattended never downgrades this."

Everything else was plumbing an agent had to remember. v2 replaces remembered plumbing with five commands,
nine events, one schema, and one human gate per slice — and deletes the rest.
