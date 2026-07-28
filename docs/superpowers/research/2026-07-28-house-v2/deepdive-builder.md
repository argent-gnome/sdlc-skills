# Deep critique — `house-builder` (the executor)

**Subject:** `/Users/jake-edwards/projects/sdlc-skills/skills/house-builder/SKILL.md` (98 lines)
**Read in full alongside:** `/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/references/doctrine.md` (83 lines),
`/Users/jake-edwards/projects/sdlc-skills/skills/house-orchestrator/SKILL.md` (176 lines)
**Composed superpowers skills (found, read):** `/Users/jake-edwards/.claude/plugins/cache/superpowers-dev/superpowers/5.0.6/skills/` — `test-driven-development`, `subagent-driven-development` (+ its `implementer-prompt.md`), `executing-plans`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `finishing-a-development-branch`, `systematic-debugging`, `using-git-worktrees`. Agent `superpowers:code-reviewer` exists at `.../5.0.6/agents/code-reviewer.md`.
**Field evidence:** `/Users/jake-edwards/projects/edge-scanner/docs/**` (8 shipped slices, 6 plans, 8 retros).

> **Note on the output path:** the task specified `undefined/deepdive-builder.md` — a literal `undefined`, almost certainly an unsubstituted variable in the dispatching script. The working directory (`/Users/jake-edwards/projects/edge-scanner`) is additionally write-guarded for un-isolated background subagents, so this report was written to **`/Users/jake-edwards/house-sdlc-redesign/deepdive-builder.md`**. Move it to the real base dir; sibling deep-dives should be pointed at the same place.

---

## 0. One-paragraph verdict

`house-builder` is the strongest-written of the three house skills at the *policy* layer and the weakest at the *interface* layer. Its hard-won content — the CI-red taxonomy, the discriminating-test rule, the compile-at-every-task-boundary rule, the destructive-migration proof obligation — is genuinely first-rate engineering doctrine that a redesign must carry forward almost verbatim. But everything the executor *produces* is prose in a conversation that is destroyed when the subagent returns: the 4-state verdict, the gate evidence, the plan deviations, the review findings, the "how it was built" ledger, and the stage cursor. The skill also has **two divergent copies of its own kickoff contract** (one in `house-builder`, one in `house-orchestrator`), an **undefined "unit" concept** that is the root cause of the unchecked-plan-checkbox pathology, and a **closed stack-gate list** that fails *open* on any stack that isn't ios or web — i.e. on the desktop IDE Jake is about to build. It also composes two superpowers skills (`subagent-driven-development`, `executing-plans`) that each mandate behaviour (`finishing-a-development-branch`, worktree creation, human Q&A mid-task) which the house architecture reassigns elsewhere, and it does so without ever stating the override.

---

## 1. What it gets RIGHT — preserve these verbatim

These are not generic; they are the residue of real failures and they are the reason this system ships working code. Each should survive a ground-up rewrite as a *first-class, enforced* rule rather than a prose sentence.

### 1.1 Narrow authority, stated as an invariant
> `SKILL.md:8-11` — "You are a **build session**: spun up to implement ONE plan unit, then torn down. The orchestrator owns sequencing and the merge decision; **you own building the unit well and reporting honestly.**"
> `SKILL.md:83-86` — "**Gates — never cross silently.** You build; you do not decide the slice. STOP and report (don't self-resolve) at: **any plan deviation or genuine ambiguity · CI red · any irreversible / outward-facing action (publish, deploy, anything destructive).**"

This is the single most important structural idea in the skill: the executor's authority is *bounded and enumerated*, and the boundary is defined by irreversibility, not by difficulty. It mirrors the orchestrator's own "**Hard invariant — you never build**" (`house-orchestrator/SKILL.md:14-17`). Two agents, two complementary hard invariants — that's a real separation of powers, and it is exactly what makes the system auditable. Keep it.

### 1.2 Scope guards as first-class *negative* space
> `SKILL.md:10-11` — "Build EXACTLY the assigned unit — honor the 'NOT this slice' scope guards; if you find work outside them, report it, don't do it."

Most agent scaffolds specify only what to do. Specifying what *not* to do, as an input field, with a "report it, don't do it" disposition, is the mechanism that keeps scope creep out of a slice diff. Field-confirmed: every real plan carries one, e.g. `edge-scanner/docs/superpowers/plans/2026-07-07-edge-dashboard.md:9` — a nine-clause `❌`-delimited guard list including `❌ supabase config push from this repo (drops arb's PostgREST exposure)`. That guard is a *safety* constraint disguised as scope. Keep the field; in a redesign, promote the safety-flavoured guards into a separate `forbidden_actions` list that can be checked mechanically.

### 1.3 `NEEDS_CONTEXT` instead of guessing
> `SKILL.md:15` — "If any is missing or the plan is ambiguous, **report `NEEDS_CONTEXT`** — don't guess."

Field-confirmed as load-bearing: `edge-scanner/docs/retros/2026-07-07-track-b-infra-retro.md:11` — "Returned **NEEDS_CONTEXT** on the exposure step (correctly refused to run a command that would drop the sibling `arb` schema)." A builder refusing to guess prevented a production data-loss event. This mechanism earned its keep.

### 1.4 The compile-at-every-task-boundary rule
> `SKILL.md:18-20` — "Confirm what compiles at each task boundary (a shared-type signature change updates its call sites in the SAME task — never leave the app target uncompilable for a later test task)."

Non-obvious, and absent from every superpowers skill. `test-driven-development/SKILL.md` never mentions cross-task compilability; `writing-plans` doesn't either. This is a genuine gap-filler that prevents the classic "plan decomposed by layer, repo red for three tasks" failure. Keep it — and in a redesign, make it *checkable* (a per-task green-build assertion in the unit record).

### 1.5 The discriminating-test rule — the best idea in the whole system
> `SKILL.md:29-31` — "**A discriminating test per spec rule** — at least one input where the spec's rule and the nearest plausible-wrong implementation *disagree* (non-monotone / boundary / divergent). A suite that only exercises inputs where right and wrong agree is a coverage gap, not coverage."

This is a **falsifiability criterion for tests**, and it is strictly stronger than anything in `superpowers:test-driven-development`, which only demands red-before-green (`test-driven-development/SKILL.md:31-37`, "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"). Red-before-green proves the test *runs*; the discriminating-test rule proves the test *discriminates*. A test can be perfectly TDD-produced and still be worthless if every input it exercises is one where the correct and the plausible-wrong implementations agree. This idea should be extracted, named, and made a *gate with evidence* (the builder should have to name the "nearest plausible-wrong implementation" it discriminated against, per spec rule).

### 1.6 "Commitments survive into the artifact"
> `SKILL.md:32-34` — "every folded-in plan advisory got built (not re-waived), every *documented* design claim has an executing test, and the spec/plan body matches the shipped design when a mid-flight revision changed it."

This is an anti-amnesia gate: it closes the loop from plan-check advisory → shipped code → doc. It is exactly the check that would prevent the observed spec-Status rot (§2.7). It currently has no enforcement and no artifact; that's the tragedy — the *right rule* with *no mechanism*.

### 1.7 The CI-red taxonomy — the finest piece of fail-closed engineering here
> `SKILL.md:70-81` (whole section). Highlights:
> `:71` — "**CI red is a hard gate — stop.** But distinguish *why* it's red"
> `:72-74` — infra-only = "the job **never executed** (0 steps / `startup_failure` / a budget-block message — read it with `gh run view --json conclusion,status` + `gh api .../jobs`)" → re-run the entire local gate set, confirm merge content == verified HEAD, "merge through **only on the user's explicit OK**"
> `:77` — "**Code-red** = any step *ran and failed* → fix it, never merge through. **When unsure, treat as code-red.**"
> `:78-81` — no-CI-configured branch, with the branch-protection double-check via `gh api .../branches/main/protection` → 404/403
> `:41-42` — "actual `gh run view --json conclusion` (never piped exit codes)"
> `:75-76` — "Flag the root cause (e.g. 'Actions budget needs topping up') so it gets fixed, not normalized."

Every clause here is earned: a three-way taxonomy with an explicit tie-breaker toward the strict branch, a structural query instead of an exit code (piped exit codes lie through `| tee`, through `gh`'s own paging, and through shell pipelines), a "verified HEAD == merge content" check for the merge-through path, and — best of all — an explicit **anti-normalization clause**. Most systems degrade because an exception becomes routine; this one names that failure mode and blocks it. Preserve entirely. Field-confirmed in use: `edge-scanner/docs/retros/2026-07-07-dfs-oom-fix-retro.md` — "**Stage 8 CI:** n/a — no CI by design (Actions minutes out); bar = both gates re-run green by the reviewer."

### 1.8 Proof-obligation framing on destructive changes
> `SKILL.md:60-65` (ios) — "**NO DESTRUCTIVE SwiftData changes** — additive / migrations only… When any `@Model` schema changes, the migration MUST be exercised against a store populated under the *previous* schema — a fresh install / CI passing is not proof."
> `SKILL.md:66-68` (web) — "a migration that drops or rewrites data (e.g. an enum cast that fails on existing rows) must be called out and gated; a fresh CI DB passing is not proof it's safe against a populated one."
> `SKILL.md:63-65` — "The live-repro runbook's named previous-schema commit must be a **known-good merge commit, verified to build** — never a mid-refactor intermediate."

The repeated phrase "**is not proof**" is doing real work: it names the *specific* false-positive (green CI on an empty DB) rather than saying "be careful". That's the difference between a checklist and a doctrine. The known-good-merge-commit clause is the kind of detail you only write after being burned by it. Keep all of it.

### 1.9 Falsifiability trap: virtualization-robust UI discriminators
> `SKILL.md:50-53` — "a `List` virtualizes its rows (~8 realized), so a discriminator that counts **realized** rows/pills silently lies once the data outgrows the viewport. Assert against a **non-virtualized aggregate** (a header/summary count behind its own a11y id) or **re-open a detail view and read back the persisted state** — never count realized elements."

Same shape as §1.5: a named way a green test lies. This one is genuinely stack-specific lore and belongs in a per-stack policy file (§2.6), not deleted.

### 1.10 Context-hygiene discipline
> `SKILL.md:35-37` — dispatch the doc-reconcile to a subagent, "(heavy read, light write — keep it out of your context)"
> `SKILL.md:39-40` — "change nothing outside the docs"
> `SKILL.md:94-98` — "Read it **on-demand** … Don't preload it."

The system treats *context* as a managed resource with explicit budgets, and it says so at the point of each decision. This is why the orchestrator can conduct 6 units without dying. `doctrine.md:76-83` promotes the reconcile-subagent to a named shared pattern with a scoped write permission — good design. Keep both the pattern and the "change ONLY docs" capability scoping.

### 1.11 Honest self-labelling of a weak point
> `SKILL.md:25` — "**Per-task review (do not skip — it has no loud gate).**"

The skill knows which of its own rules is unenforceable and says so in-line. That's an unusually mature piece of technical writing, and it is precisely the pointer to what a redesign must fix (make it loud).

### 1.12 Deviations surfaced, never absorbed
> `SKILL.md:43-44` — "any **plan deviations** (surface, never bury)"
> `doctrine.md:52` — "A change that alters a spec rule or the slice scope is a **plan deviation** — surface it, never absorb it silently."

Consistent across both docs. This is the concept the whole 4-state contract exists to carry. Keep it — and give it a schema (§5).

---

## 2. Structural weaknesses

### 2.1 THE headline defect: the 4-state report is a *sentence*, and the session that produced it is destroyed

> `SKILL.md:43-45` — "**Report back.** End with the 4-state contract + the branch/PR + a one-line 'how it was built' (which stages ran) + any **plan deviations** … **DONE · DONE_WITH_CONCERNS · BLOCKED · NEEDS_CONTEXT.**"

Everything the builder learns dies with it except a paragraph that gets summarised into the orchestrator's context and then summarised again into a retro. Concretely, the following exist *only* in the destroyed transcript:

| Lost artifact | Referenced at | Consequence |
|---|---|---|
| The 4-state verdict itself | `SKILL.md:45` | Nothing on disk says a unit was `DONE_WITH_CONCERNS`. Only 2 of 8 shipped edge-scanner slices happen to mention a state, and only in retro prose (`retros/2026-07-07-track-b-infra-retro.md:11`, `track-c-local-retro.md:12`). |
| Per-task review findings (spec + quality) | `SKILL.md:25-27` | The two-stage review that "has no loud gate" leaves no trace at all. There is no way, post-hoc, to know whether it ran. |
| Gate evidence (test counts, build exit, lint) | `SKILL.md:47-68` | The retro asserts "`npm test` 81/81" (`dfs-oom-fix-retro.md`) — hand-transcribed, unverifiable, and only because a human wrote a good retro. |
| Discriminating-test justification | `SKILL.md:29-31` | The strongest rule in the system produces zero durable evidence that it was honoured. |
| "How it was built" stage ledger | `SKILL.md:44`, `house-orchestrator/SKILL.md:90-92` | Reconstructed by the orchestrator from the builder's prose. The orchestrator calls this "fail-closed" — it is not; it is fail-closed *against a report it cannot verify*. |
| Plan deviations | `SKILL.md:43-44` | Survive only if the orchestrator hand-copies them into the retro. |

The orchestrator's own verification doctrine — `house-orchestrator/SKILL.md:141-142`, "'don't trust the report': reviewers independently re-run builds/tests" — is an explicit acknowledgement that the builder's prose report is untrustworthy. The system's answer is to **re-run everything in a reviewer**. That's correct as defence-in-depth but wasteful as the *only* mechanism: the right fix is for the builder to emit *evidence*, and for the reviewer to spot-check it, rather than for the builder to emit *claims* that must be entirely re-derived.

Worse: `superpowers:verification-before-completion` — a skill that exists, is installed, and states exactly the missing gate ("`NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`", `verification-before-completion/SKILL.md:18-20`, and the delegation row "Agent completed → **requires** VCS diff shows changes → **not sufficient:** Agent reports 'success'", `:49`) — **is never invoked by `house-builder`.** The one composable skill whose entire subject is "your report must be backed by evidence" is missing from the executor whose sole output is a report.

### 2.2 Two divergent copies of the kickoff contract

`house-builder` declares its inputs:
> `SKILL.md:13-15` — "`{ project, repoPath, stack, topology, planPath, the unit/task, "NOT this slice" scope guards, spec path(s), model-routing note }`. If any is missing or the plan is ambiguous, **report `NEEDS_CONTEXT`**"

`house-orchestrator` declares what it sends:
> `house-orchestrator/SKILL.md:98-102` — "`{ project, repoPath, stack, topology, planPath (+ the plan content inline if it isn't committed yet), the unit/tasks in order, the 'NOT this slice' scope guards, the spec/authority paths to read first, the plan-check gotchas, the model-routing note, and the 4-state report contract }`. … Tell it the branch may already hold partial work (see Audibles)."

The sender's list has **four things the receiver's list does not**: inline plan content, *the plan-check gotchas*, the 4-state contract itself, and "the branch may already hold partial work". The receiver is told to fail-closed on "any missing" field — of a list that does not match the sender's. In practice this means the `NEEDS_CONTEXT` trigger is un-evaluable: a builder can't tell a deliberately-omitted optional from a forgotten required. Two hand-maintained copies of one schema in two files is the textbook drift generator, and it has already drifted.

**Fields absent from *both* copies, that a builder demonstrably needs:**
- `slice_id` / `unit_id` — see §2.3. Slice identity is ambiguous system-wide.
- `branch` and `base_ref` — the builder must produce a branch and a PR (§2.5) with no naming contract. Field evidence of the resulting ad-hoc-ness: `dfs-task0-spike`, `dfs-math-core`, `dfs-dashboard`, `fix/dfs-oom-mlb`, `feat/hygiene-self-checks` — five conventions across one repo's merge commits.
- `worktree_path` — §2.5.
- **Fold-forward concerns from prior units.** The orchestrator's stage 6 says "Fold any concerns forward into later units" (`house-orchestrator/SKILL.md:79`), and `SKILL.md:26` tells the builder to "fold findings forward as later-task prerequisites" — but *within* a unit only. Cross-unit fold-forward has no input field. It only works if the orchestrator remembers to paste it, from a context that may have been compacted.
- **Rigor/stakes dial.** `house-orchestrator/SKILL.md:148-155` defines a stakes dial that governs merge-gate form. The builder gets no stakes signal at all, so it cannot scale its own ceremony.
- **Attendedness.** Whether a human is reachable. This is load-bearing (§4.3) and entirely absent.
- Plan-check verdict (GO / GO-WITH-FIXES / NO-GO) — the builder is never told whether the plan it's implementing passed cleanly or passed with fixes it must honour.

### 2.3 "Unit" is undefined — and this is the root cause of the checkbox pathology

The skill says "ONE plan unit" (`SKILL.md:8`), "the unit/task" (`:14`), "the assigned unit" (`:10`), "at each task boundary" (`:19`), "this unit's docs" (`:35`), "this unit's PR" (`:41`). The orchestrator says "ONE unit — One unit per dispatch" (`house-orchestrator/SKILL.md:78`) and "the unit/tasks in order" (`:99`). So a unit is **1..N tasks**, grouped at dispatch time, by nobody's documented rule.

Real plans have no unit concept whatsoever. They are flat `### Task N` lists:
`edge-scanner/docs/superpowers/plans/2026-07-07-edge-props.md:17,35,52,65,73,80` — `Task P1 … Task P6`.
`.../2026-07-07-edge-dashboard.md` — `### Task 1 — edge.dashboard_stats() JSON RPC` etc.

The only place a unit boundary is ever recorded is a **merge commit subject**:
`Merge dfs-math-core: @edge/math DFS core (Tasks 1-5) …`
`Merge dfs-dashboard: DFS optimizer dashboard (Tasks 6-11) …`

That is the entire durable record of the system's atomic work unit: a free-text git subject line. Consequences:
- Nothing can compute "unit 3 of 5" for a progress display.
- Nothing can attribute a plan checkbox to a unit, which is *why* checkboxes go unticked (§2.4).
- Two concurrent "Slice N" series can't be told apart (the audit's finding) because neither slice nor unit has an id anywhere.
- The retro key is undefined (`edge-scanner/docs/retros/README.md` says "Filename: `<key>-<slice>-retro.md`" — and `<key>` is never defined; in practice it's a date).

### 2.4 Plan checkboxes: nobody's job, and it shows

`house-builder` never mentions checkboxes. The doc-reconcile prompt (`SKILL.md:36-40`) is about *drift* ("stale namespaces, an as-built decision the doc still contradicts, a README example that no longer runs"), not progress. The orchestrator mentions plan reconciliation only obliquely at stage 9½ ("re-read the slice's spec/plan/ADRs against the shipped code; reconcile any drift", `house-orchestrator/SKILL.md:84`).

Measured on a repo where **every one of these plans shipped**:

```
47/71  docs/superpowers/plans/2026-07-06-edge-scanner-phase0-lean.md
 0/65  docs/superpowers/plans/2026-07-06-edge-scanner-phase0.md
 0/58  docs/superpowers/plans/2026-07-07-dfs-discount-optimizer.md
13/18  docs/superpowers/plans/2026-07-07-dfs-optimizer-oom-fix.md
 0/12  docs/superpowers/plans/2026-07-07-edge-dashboard.md
 0/22  docs/superpowers/plans/2026-07-07-edge-props.md
```

The two partially-ticked files were ticked **by hand, retroactively, in a separate reconcile commit** — `47337e2`/`5477d3b` "docs(reconcile): tick DFS OOM-fix plan checkboxes as-built (Steps 1-3 done, live gate deferred)" — and once by an orchestrator at stage 9½ (`retros/2026-07-07-track-b-infra-retro.md:17`, "plan B1/B2/B3 ticked; exposure step reconciled from BLOCKED→DONE this stage"). So the mechanism *can* work; it is simply unassigned, so it fires ~1 time in 6.

Note the one genuinely excellent use of an *un*ticked box, which any redesign must not break:
`plans/2026-07-06-edge-scanner-phase0-lean.md:749` — "`- [ ] **Step 1: Init Supabase…** — *…the PostgREST EXPOSURE itself is **BLOCKED/pending a manual step** …, so this step stays UNCHECKED until exposure lands.*`"
An unchecked box carrying a reason is *more* informative than a checked one. A binary `[ ]/[x]` can't express it; the human invented `[ ] + italic reason`. Design for it (§6.5).

**Should builders tick checkboxes? Yes — but only under an evidence rule.** Ticking is a completion *claim*, and `verification-before-completion/SKILL.md:18-20` says claims need fresh evidence. So: a builder may tick a step **iff** the unit record contains the verification evidence for it; the tick and the evidence are written in the same commit; and a third state exists for "attempted, deviated/blocked, here's why". The orchestrator's 9½ then becomes a *verifier* of the builder's ticks rather than the sole (and usually absent) writer.

### 2.5 Unowned artifacts: worktree creation, branch naming, PR creation

**Worktree.** The builder is given a teardown obligation for something it was never told to create:
> `SKILL.md:96-97` — "at **teardown** (leave your unit's worktree removable and no stash behind — the orchestrator runs per-merge teardown at finish)"
> `doctrine.md:57-58` — "**Per-merge (finish):** the merged unit's branch is deleted …, **its worktree removed**, and no stash left behind."

But nothing in `house-builder` creates a worktree, and `superpowers:using-git-worktrees` — which *both* composed executors mark **REQUIRED** (`subagent-driven-development/SKILL.md:268`; `executing-plans/SKILL.md:68`) — is never invoked by name. Meanwhile the orchestrator's topology definition says single-session iOS is "**no worktrees**" (`house-orchestrator/SKILL.md:105`). So: worktree required by the composed skills, forbidden by one topology, teardown-obligated by the doctrine, created by nobody. The obligation at `SKILL.md:96` is also **unverifiable** — "leave it removable" has no check and no artifact.

**PR.** `SKILL.md:41` — "Get the unit's PR run green" presupposes a PR exists. Nothing tells the builder to open one. The orchestrator's stage 10 is "PR + merge" via `finishing-a-development-branch` (`house-orchestrator/SKILL.md:85`) — i.e. *after* the builder's stage-8 CI check. Either the builder silently opens the PR (undocumented, and it's an outward-facing action the gates at `:84-86` arguably prohibit) or step 5 is unrunnable. In practice builders open PRs; the skill just doesn't say so.

**Branch.** No naming contract anywhere. Five conventions observed in one repo (§2.2).

### 2.6 Stack gates are a closed list that fails *open*

`SKILL.md:47-68` enumerates gates for exactly two stacks: `ios` (18 lines) and `web` (3 lines). There is no default branch, no "unknown stack → NEEDS_CONTEXT", no "the repo declares its gates" escape hatch. A builder handed `stack: electron` (the desktop IDE), `stack: rust`, `stack: python` has **no gate set at all** and no instruction to stop — so it will invent gates or run none, and report `DONE`. For a system whose entire character is fail-closed, this is the one place it fails open, and it's the place Jake is about to walk into.

Two further problems with this section as written:

1. **It's project lore in a global skill.** The ios bullet is a single ~18-line run-on sentence chaining six unrelated concerns (test/lint/build commands · XCUITest virtualization · simulator serialization · destination-simulator existence · CI must *execute* not merely build the bundle · SwiftData destructive-change policy + migration proof + known-good-commit rule). It is unversioned, unattributed, untestable, and lives in `~/.claude/skills/` rather than in the repo whose reality it describes. When the ios project's simulator ceiling changes, a *global* skill must be edited.
2. **Some of it is not a gate, it's a runbook.** "capture full output to a log when diagnosing a UI-suite failure" (`:55-56`) and "derive the device from what's installed, never hardcode" (`:57`) are procedures; "NO DESTRUCTIVE SwiftData changes" (`:60`) is a policy; "`swift test` · SwiftLint · `xcodebuild`" is a gate set. Three different kinds of thing in one bullet.

The correct shape is: **policy stays in the skill** (fail-closed, evidence required, CI-red taxonomy, destructive-change proof obligation), **gate sets move to a declarative per-repo profile** the builder reads from `repoPath`, and **lore becomes annotated assertions inside that profile**.

### 2.7 The doc-reconcile pass is scoped to *drift* and misses *status*

> `SKILL.md:35-40` — "Update the docs so they match what was actually built — stale namespaces, an as-built decision the doc still contradicts, a README example that no longer runs."

Nothing in that prompt says: flip the spec's `Status:` line, tick the plan, or record the slice as shipped. Measured result on shipped slices:

```
specs/2026-07-07-edge-dashboard-design.md:3         Status: DRAFT — awaiting Jake's review
specs/2026-07-07-edge-props-design.md:3             Status: DRAFT — awaiting Jake's review
specs/2026-07-07-dfs-discount-optimizer-design.md:3 Status: DRAFT — awaiting Jake's review
```

All three shipped (retros exist for all three: `2026-07-07-dashboard-retro.md`, `2026-07-07-props-golive-retro.md`, `2026-07-07-dfs-optimizer-retro.md`). A fourth spec is stuck at "draft — … awaiting user review" (`specs/2026-07-06-edge-scanner-design.md:3`). The spec Status field therefore carries **zero** information — which for an IDE that wants to show "spec: approved / shipped" in a side pane is fatal, because it can't distinguish a genuinely-unreviewed spec from a shipped one.

Also unspecified: the mockup output path (the audit's finding — confirmed: `house-builder` mentions mockups nowhere; `house-orchestrator/SKILL.md:85` only says they "ship IN the slice PR"), and the retro filename key (`retros/README.md` — "`<key>-<slice>-retro.md`", `<key>` never defined).

### 2.8 Numbering collision and stage double-ownership

`house-builder` numbers its own procedure 1–6 (`SKILL.md:17-45`) but then reaches into the orchestrator's numbering: "**CI (stage 8)**" (`:41`), "## CI failures (stage 8)" (`:70`). So two numbering namespaces are interleaved in one 98-line file. Worse, the stages genuinely overlap:

| Work | house-builder | house-orchestrator |
|---|---|---|
| CI green check | step 5, "stage 8" (`:41-42`) | stage 8 (`SKILL.md:82`) |
| Doc reconcile vs shipped code | step 4 (`:35-40`) | stage 9½ (`SKILL.md:84`) |
| Per-task / merge review | step 3 (`:25-34`) | stage 7 merge-gate (`SKILL.md:80`) |

The CI and doc-audit duplications are defensible as defence-in-depth — but neither doc says "this is deliberately done twice, and here's what's different about the second pass". As written they read as ambiguity, and an agent resolving ambiguity by skipping ("the orchestrator will do it") is exactly the failure the "no loud gate" note at `:25` worries about.

### 2.9 The 4-state itself is under-specified

The four names appear (`SKILL.md:45`) with **no definitions, no field list, and no disambiguation rule**. Concretely undefined:
- What accompanies each state? (Compare `subagent-driven-development/implementer-prompt.md:100-112`, which *does* specify: status, what was implemented, what was tested + results, files changed, self-review findings, concerns.) **The composed skill is better specified than the house skill that wraps it.**
- `DONE_WITH_CONCERNS` vs `DONE` + a listed plan deviation: `SKILL.md:43-44` lists "plan deviations" as a *separate* report element from the state, so a builder that deviated may report either. Undefined.
- `BLOCKED` vs `NEEDS_CONTEXT`: distinguished only in the composed skill (`subagent-driven-development/SKILL.md:110-117`), never in `house-builder`.
- Partial completion: a unit of 5 tasks where 4 shipped and 1 blocked has no expressible state. `DONE_WITH_CONCERNS` overstates; `BLOCKED` understates and loses the 4 shipped tasks. Field evidence that this case is real and was handled by ad-hoc prose: `plans/2026-07-06-edge-scanner-phase0-lean.md:749` and `dev-state.md:269` ("As-built: exposure is BLOCKED/pending a manual…") — the state leaked into two unrelated documents as free text.

### 2.10 Smaller ambiguities

- **`topology` means two different things.** The orchestrator defines it as a *git* topology — "single-session (live iOS): builder works in place on a branch, no worktrees / multi-session (web monorepo): one branch + PR per unit" (`house-orchestrator/SKILL.md:104-106`). The builder reads it as a *session* topology to pick an executor skill — "`superpowers:subagent-driven-development` (single-session) or `superpowers:executing-plans` (multi-session)" (`SKILL.md:22-23`). One word, two orthogonal meanings, silently coupled.
- **`model-routing note` is an input the builder can't act on.** A subagent cannot change its own model. It's only meaningful for the sub-subagents the builder dispatches — which the skill never says.
- **`superpowers:code-reviewer` is listed among skills** (`SKILL.md:26-27`: "`superpowers:requesting-code-review` / `superpowers:receiving-code-review` + `superpowers:code-reviewer`"). It is an **agent type**, not a skill (`.../5.0.6/agents/code-reviewer.md`). The reference resolves, but conflating agent types with skills in an invocation list is the kind of thing that produces a silent no-op.
- **Cross-skill install coupling.** `SKILL.md:94-95` — the doctrine path is `$HOME/.claude/skills/house-orchestrator/references/doctrine.md`. The *shared* doctrine lives inside one of its three consumers, at a hardcoded install path. Install `house-builder` alone, or copy-install elsewhere, and the builder silently loses the entire doc model and hygiene contract. (The orchestrator at least acknowledges the path assumption for its Workflows, `house-orchestrator/SKILL.md:71-73`; the builder doesn't.)
- **No context-budget guidance.** "ONE plan unit, then torn down" (`:8`) with no sizing rule. A unit is however many tasks the orchestrator grouped (§2.3), which in the field was up to six (`Tasks 6-11`). Nothing says what to do when the context fills mid-unit.

---

## 3. Where it fights or duplicates the superpowers skills it composes

`SKILL.md:88-90` — "**Compose, don't reinvent.** TDD, the reviews, debugging, and finishing all have skills — invoke them." The intent is right. The execution has four real collisions.

### 3.1 It composes a *controller* skill as if it were an *executor* skill

`superpowers:subagent-driven-development` is not a way to implement a task — it is a way to *run a plan by dispatching implementers*:
> `subagent-driven-development/SKILL.md:8` — "Execute plan by dispatching fresh subagent per task, with two-stage review after each"
> `:104` — "Implementer subagents report one of four statuses."
> `:106-117` — the controller's handling table for DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.

So the **4-state contract originates as the SDD implementer→controller protocol**, and `house-builder` reuses the same four names for the builder→orchestrator protocol. When a builder follows `SKILL.md:22` and adopts SDD, the four states are live at **two nesting levels simultaneously** with different semantics and different recipients, and the skill never distinguishes them. A builder whose sub-implementer returns `BLOCKED` must decide whether to retry per `subagent-driven-development/SKILL.md:112-117` ("re-dispatch with a more capable model / break the task into smaller pieces / escalate to the human") or to propagate `BLOCKED` upward per `house-builder:84-86`. Both readings are supported. This is the most confusing thing in the composition.

### 3.2 Both composed executors mandate `finishing-a-development-branch` — which the orchestrator owns

> `executing-plans/SKILL.md:33-37` — "### Step 3: Complete Development … **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch"
> `subagent-driven-development/SKILL.md:63-64, 83` — final reviewer → "Use superpowers:finishing-a-development-branch"; `:271` lists it under **Required workflow skills**.

But `house-orchestrator/SKILL.md:85` assigns stage 10 "PR + merge" to `superpowers:finishing-a-development-branch` in the *orchestrator's* session. And that skill is **interactive and human-facing**:
> `finishing-a-development-branch/SKILL.md:52-63` — "Present exactly these 4 options: 1. Merge back to `<base-branch>` locally / 2. Push and create a Pull Request / 3. Keep the branch as-is / 4. Discard this work. **Which option?**"

A `house-builder` dispatched **in the background** (`house-orchestrator/SKILL.md:96-97`) has no human to ask — and `house-orchestrator/SKILL.md:112` states this outright: "The user **cannot talk to a running subagent**". So a faithfully-composing builder reaches a prompt it cannot answer, and its only non-hanging options are to answer it *itself* (option 1 = merge to main — an irreversible action the builder's own gates forbid at `SKILL.md:84-86`, and option 4 = **discard this work**) or to abandon the composed skill mid-procedure. `house-builder` never says "do NOT invoke finishing-a-development-branch; the orchestrator owns finish." That omission is a live foot-gun on both the SDD and the executing-plans path.

### 3.3 The composed skills assume an interactive human partner; a background builder has none

This assumption is pervasive in superpowers and load-bearing in every case:
- `subagent-driven-development/SKILL.md:67-69` — "Implementer subagent asks questions? → Answer questions, provide context" (a whole loop in the process graph); `:250-253` — "**If subagent asks questions:** Answer clearly and completely… Don't rush them"; `:243` red flag — "Ignore subagent questions (answer before letting them proceed)".
- `implementer-prompt.md:41-42` — "**While you work:** If you encounter something unexpected or unclear, **ask questions**. It's always OK to pause and clarify."
- `executing-plans/SKILL.md:39-47` — "**STOP executing immediately when:** Hit a blocker… **Ask for clarification rather than guessing.**"
- `test-driven-development/SKILL.md:24, 346, 371` — "Exceptions (**ask your human partner**)", "Ask your human partner", "No exceptions **without your human partner's permission**".

The nested case works (a builder *can* answer its own sub-implementers). The outer case does not: the builder cannot ask the orchestrator or Jake anything. `house-builder`'s answer is `NEEDS_CONTEXT` (`SKILL.md:15`) — which is a **terminal state that discards the entire session**, including all work in progress, all the reading it did, and all the reasoning that identified the gap. The system's only clarification channel is "die and be re-dispatched from cold". For a TDD exception, a genuinely ambiguous spec rule, or a mid-build discovery, that is enormously expensive — and it creates pressure to *not* report `NEEDS_CONTEXT`, undermining the very rule §1.3 praises.

### 3.4 Duplication: the per-task review is specified twice

`SKILL.md:25-27` prescribes "A spec-compliance reviewer THEN a code-quality reviewer" — which is verbatim what SDD already does at `subagent-driven-development/SKILL.md:8` ("two-stage review after each: spec compliance review first, then code quality review") with three ready-made prompt templates (`spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md`, `implementer-prompt.md`, listed at `:120-124`) and an explicit ordering red flag (`:247` — "**Start code quality review before spec compliance is ✅** (wrong order)"). `house-builder` reimplements the description and ignores the templates.

But on the **`executing-plans` path the reviews don't exist at all** — `executing-plans/SKILL.md:24-31` is a bare "for each task: mark in_progress, follow steps, run verifications, mark completed", with no review whatsoever. So `SKILL.md:25`'s reviews are redundant on one path and are the *only* review on the other, and the skill treats the two paths as interchangeable ("(single-session) or (multi-session)", `:22-23`). The two branches of that `or` have radically different quality floors, and nothing says so.

### 3.5 Two composable skills that should be invoked and aren't

- **`superpowers:verification-before-completion`** — the exact gate the report contract needs (§2.1). Never mentioned.
- **`superpowers:using-git-worktrees`** — REQUIRED by both composed executors, obligated at teardown by the doctrine, invoked nowhere (§2.5).

---

## 4. Implicit assumptions that break

### 4.1 The session survives to the end
Everything the builder produces is emitted in its final message. If the session dies mid-stage — context exhaustion on a 6-task unit, a crashed `xcodebuild`, a timeout, a compaction that eats the plan text — the orchestrator receives **nothing**: not the state, not which tasks landed, not which gates passed. Recovery is "read `git log` and guess", from an orchestrator context that itself may have been compacted. There is no checkpoint, no stage cursor, no heartbeat, and — critically — no distinction between "builder died" and "builder is still working". `SKILL.md:8` ("spun up… then torn down") treats the session as atomic; nothing makes it so.

### 4.2 Exactly one slice, exactly one builder, at a time
- `dev-state.md` has a single `## Active slice` and a single `## In-flight` section (`doctrine.md:24-26`; template at `house-orchestrator/SKILL.md:165-175`).
- No `slice_id` or `unit_id` anywhere (§2.3), so two concurrent units are indistinguishable in every artifact.
- The doc-reconcile subagent (`SKILL.md:35-40`) writes docs under `repoPath` with only "change nothing outside the docs" as a constraint — it is explicitly pointed at the doctrine's routing rules, which include `dev-state.md` (`doctrine.md:48`). **Two builders reconciling concurrently, or one builder reconciling while the live orchestrator writes `dev-state.md` at a stage transition, is a lost-update race with no lock, no merge strategy, and no detection.**
- Field evidence that parallel streams do happen: `edge-scanner` merge log shows `Track A / Track B / Track C-local / Track C-remote / Track P` — five named parallel tracks, plus `retros/2026-07-07-track-b-infra-retro.md` and `track-c-local-retro.md` covering overlapping periods.

### 4.3 A human is reachable
The gates at `SKILL.md:84-86` say "STOP and report" — fine, that terminates. But the infra-only CI path *requires* interactive consent from inside the builder's own procedure: `SKILL.md:74-75` — "merge through **only on the user's explicit OK** (irreversible action on `main`)". A background builder cannot obtain that OK. So the stage-8 infra-only branch is unexecutable by the agent it's written for; in practice it must be a *report-and-die* path, and the skill doesn't say so. Compounding it, `house-orchestrator/SKILL.md:129` insists "Running unattended never downgrades a hard gate — notify and halt" — with no notification mechanism named, and no `attended` input on either side.

### 4.4 The unit fits in one context
No sizing rule (§2.10). Units of 5–6 tasks are attested in the field (`Merge dfs-dashboard: … (Tasks 6-11)`). An iOS unit that runs `xcodebuild` UI suites — where the skill itself demands "**capture full output to a log** when diagnosing a UI-suite failure" (`SKILL.md:55-56`) — is a context-exhaustion machine. There is no guidance for compaction, no "checkpoint before the expensive gate", no "if you're running low, report DONE-so-far".

### 4.5 The repo is in the expected state
The builder is told "the branch may already hold partial work" (`house-orchestrator/SKILL.md:102`) — but only by the orchestrator, and it's not an input field (§2.2). Also assumed without check: `gh` is authenticated; a remote exists; a PR exists (§2.5); the doctrine file exists at the hardcoded path (§2.10); the destination simulator exists (this one *is* checked — `SKILL.md:56-57`, good).

### 4.6 Docs are the only shared mutable state
The reconcile subagent's boundary is "change nothing outside the docs" (`SKILL.md:39`) — a *file-type* boundary, not an *ownership* boundary. Under it, a builder may legitimately rewrite `roadmap.md` or `dev-state.md`, which are the orchestrator's live working state. §4.2's race follows directly.

### 4.7 The stack is one of two
§2.6. Fails open.

---

## 5. What an observing IDE needs the builder to emit — and doesn't get

Today, an IDE watching a build session can observe exactly three things: **files changing on disk**, **git refs moving**, and **terminal scrollback**. Everything semantic — what stage, what unit, what verdict, what evidence, what's blocked — is inside a transcript it cannot parse. For the workspace Jake described (side pane auto-opening specs/plans/mockups, roadmap/dev-state as home screen, embedded terminal hosting the sessions), the builder is the single biggest missing emitter, because it's the process that *changes* everything the panes display.

Concretely, the builder should write to a machine-readable location — `<repoPath>/.house/` is the natural choice (in-repo so it ships with the PR and survives the session; a directory so it's append-friendly and merge-friendly).

### 5.1 A unit record — the durable form of the 4-state report
Written **incrementally, not at the end**, so a dead session still leaves a partial record. `.house/units/<slice_id>/<unit_id>.json`:

```
schema_version, slice_id, unit_id, unit_index/unit_count, project, repo, plan_path,
plan_task_ids: ["P1","P2"], spec_paths[], scope_guards[],
model, session_id, started_at, ended_at, heartbeat_at,
branch, base_sha, head_sha, worktree_path, pr_url,
state: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT | IN_PROGRESS | ABANDONED,
state_reason, missing_inputs[]            // NEEDS_CONTEXT names the fields it lacks
tasks: [{ id, status: done|deviated|blocked|skipped, evidence_refs[], notes }]
concerns:   [{ severity, summary, fold_forward: bool, target_unit }]
deviations: [{ kind: spec_rule|scope|design, what, why, doc_updates[] }]
gates:      [{ name, cmd, exit, summary: "81/81", started_at, duration_s, log_path, verdict }]
reviews:    [{ kind: spec|quality, verdict, findings: [{severity, file, line, summary, resolution}] }]
tdd:        [{ spec_rule, red_observed_at, red_message, green_at, discriminator: "..." }]
docs_touched: [{ path, change_kind: status|drift|tick|new }]
stage_cursor: "per-task-review:task-3"
```

Two properties matter more than the exact fields: (a) **`IN_PROGRESS` + `heartbeat_at` makes death detectable** — the orchestrator and the IDE can distinguish "working" from "dead" without a transcript; (b) **absence of a record is itself a signal** — fail-closed: no record ⇒ treat as unknown/abandoned, never as DONE.

### 5.2 An append-only event log — what the IDE tails
`.house/events.ndjson`, one JSON line per transition: `unit.started`, `stage.entered{stage}`, `gate.started/finished{name,verdict,evidence}`, `test.red{rule}`, `test.green{rule}`, `review.finding{severity}`, `doc.updated{path,kind}`, `plan.task.ticked{task_id,evidence_ref}`, `deviation.raised`, `question.raised{fields}`, `unit.finished{state}`.

This is what turns the IDE from a file-watcher into a *process observer*: it can show a live "Builder — unit 3/5 · stage: per-task review · gate `xcodebuild` running (4m12s)" strip, and a timeline afterwards. It's also the durable form of the "how it was built" stage ledger that `house-orchestrator/SKILL.md:90-92` wants and currently hand-writes.

### 5.3 Gate evidence with pointers, not adjectives
Each gate result needs `cmd`, `exit`, a parsed `summary` ("81/81", "0 lint errors"), and a **`log_path`** to the captured output. The skill already knows to capture logs for UI suites (`SKILL.md:55-56`) but names no path. Give it one (`.house/logs/<unit_id>/<gate>.log`) and the IDE gets a click-through from a red gate to its output — which is 80% of what a build pane is for.

### 5.4 Artifact status transitions — the side pane's data source
The IDE's "auto-open specs/plans/mockups as sessions produce them" needs to know *when a doc changed and what kind of change it was*. That means the builder emitting `doc.updated{path, kind: created|status|drift|tick}` — and it means specs and plans carrying **frontmatter status** rather than a prose `**Status:** DRAFT` line that goes stale (§2.7). Same for the **mockup path convention**, which is currently unspecified everywhere. An IDE cannot auto-open a file whose location has four naming styles.

### 5.5 Plan progress as data
`plan.task.ticked{task_id, evidence_ref}` events + ticked checkboxes give the IDE a progress bar per plan. Today it would render 0/65 on a fully shipped plan (§2.4) — actively *misleading*, worse than no progress display at all.

### 5.6 A question channel that doesn't kill the session
`NEEDS_CONTEXT` should be an **interruptible pause with a resume token**, not a terminal state (§3.3). The builder writes `question.raised{fields[], context, resume_token}`, the IDE surfaces it to Jake as a notification in the workspace, the answer is written back, the builder resumes. This is the single highest-value IDE-native capability, because the IDE finally provides the human channel that background subagents structurally lack — it's the one thing the current architecture *cannot* do and the new one can.

### 5.7 Liveness and cancellation
The IDE hosts the terminal, so it can see the process. But it needs the builder to declare `session_id` + `pid` + `heartbeat_at` in the unit record so a killed session leaves an `ABANDONED` record rather than a permanently-`IN_PROGRESS` one, and so "stop the builder" (`house-orchestrator/SKILL.md:115-118` — the audible path) is a first-class, recorded operation rather than a task-kill with no trace.

---

## 6. If I were rewriting it from scratch — the 5 biggest changes

### 6.1 The report becomes an artifact; the prose becomes a rendering of it
Make writing the unit record (§5.1) a **stage of the procedure, not a closing sentence**, and make it incremental. The builder opens the record when it starts, updates `stage_cursor` and appends gates/events as it goes, and finalises `state` before returning. The conversational report is generated *from* the record.

Corollaries: **fail-closed on absence** — no record, or a record left `IN_PROGRESS` with a stale heartbeat, is an incident the orchestrator must handle, never a silent pass. And **invoke `superpowers:verification-before-completion` explicitly** at finalisation: `state: DONE` requires every declared gate to have a `gates[]` entry with a fresh `exit: 0` and a log — mechanically checkable, and it makes the orchestrator's "don't trust the report" doctrine (`house-orchestrator/SKILL.md:141-142`) an *audit* rather than a full re-derivation.

This single change fixes: conversation-only 4-state, conversation-only review findings, unverifiable stage ledger, unverifiable "how it was built", buried deviations, and death-detection.

### 6.2 One versioned `UnitBrief` schema, owned in exactly one place
Delete the prose input lists at `house-builder/SKILL.md:13-15` **and** `house-orchestrator/SKILL.md:98-102`; replace both with a reference to a single schema file. Required fields: `slice_id`, `unit_id`, `unit_index/count`, `project`, `repo_path`, `stack`, `git_topology`, `plan_path` + `plan_task_ids` + inline task text, `spec_paths`, `scope_guards`, `forbidden_actions`, `plan_check` (verdict + advisories that must be honoured), `fold_forward` (prior units' concerns), `branch`, `base_ref`, `worktree_path` (or `in_place`), `gate_profile` ref, `stakes`, `attended` (is a human reachable, and by what channel), `model_routing` (for the builder's *sub*-agents), `report_path`.

`NEEDS_CONTEXT` then becomes precise: **brief failed validation**, and the record names `missing_inputs[]` — so a re-dispatch is mechanical instead of a fresh negotiation. And `slice_id`/`unit_id` finally give the whole system the identity it lacks (§2.3), which unblocks per-unit records, per-unit logs, plan-task attribution, concurrent slices, and every IDE display.

Rename `topology` to disambiguate it (§2.10): `git_topology: in_place | worktree_per_unit` (who creates it, who removes it — stated), separately from `execution_style`.

### 6.3 Stack gates move out of the skill into a declarative, per-repo gate profile
Skill keeps the **policy** (it's excellent): fail-closed, evidence required, the CI-red taxonomy verbatim (`SKILL.md:70-81`), the destructive-change proof obligation, the "is not proof" framing, the discriminating-test rule. The **gate sets** move to `<repoPath>/.house/gates.yml` — declarative entries with `name`, `cmd`, `parse` (how to extract "81/81"), `required_for` (unit / merge), and annotated `assertions` for the lore (`ci_must_execute_test_bundle: true`, `ui_suites: serialize`, `ui_discriminators: non_virtualized_aggregate_only`, `schema_changes: migration_must_run_against_previous_schema_store`).

Add the missing rule: **unknown stack, or no gate profile ⇒ `NEEDS_CONTEXT`, never proceed.** That closes the one fail-open hole (§2.6) — and it's what makes the desktop-IDE project buildable by this system at all.

Bonus: a runner that executes the profile emits §5.3's structured gate results for free, and the ios lore stops being global unversioned prose.

### 6.4 State the composition contract explicitly — take, suppress, and own
Replace the vague "Compose, don't reinvent" (`SKILL.md:88-90`) with an explicit three-column contract:

- **TAKE** from `superpowers:test-driven-development`: the Iron Law and red-before-green (`test-driven-development/SKILL.md:31-37, 113-128`). **EXTEND** it with the house's discriminating-test rule, and **emit** `test.red`/`test.green` events as the evidence.
- **TAKE** from `subagent-driven-development`: the per-task two-stage review *and its three prompt templates* (`:120-124`) — stop paraphrasing them (§3.4). **SUPPRESS** its controller framing, its terminal `finishing-a-development-branch` step (`:63-64, 83`), and its mandatory worktree creation (`:268`).
- **SUPPRESS** on the `executing-plans` path: its Step 3 `finishing-a-development-branch` requirement (`executing-plans/SKILL.md:33-37`). Better: **stop offering `executing-plans` as an alternative at all** — it has no review stage (`:24-31`), so the two branches of `SKILL.md:22-23`'s "or" have incompatible quality floors. Pick one internal loop the house owns.
- **OWN** explicitly, with a named owner for each: worktree creation, branch naming, PR creation, finish/merge. Add a flat prohibition: *the builder never invokes `finishing-a-development-branch`; the orchestrator owns finish.*
- **RESOLVE** the 4-state nesting collision (§3.1): use distinct vocabularies for the sub-implementer→builder protocol and the builder→orchestrator protocol, or state the propagation rule outright ("a sub-implementer `BLOCKED` is *yours* to retry per SDD; you escalate `BLOCKED` upward only after N attempts / a plan defect").

### 6.5 The builder becomes the writer of progress; the orchestrator becomes its verifier
Today the builder writes only source + drift-fixes, and progress-writing falls to a stage-9½ audit that fires ~1 time in 6 (§2.4). Invert it:

- **Builder ticks plan checkboxes as it goes**, under the evidence rule: a tick requires a `gates[]`/`tests[]` evidence ref in the unit record, written in the same commit. Add a **third box state** to preserve the good pattern found at `plans/…phase0-lean.md:749` — `[ ]` not done · `[x]` done+evidence · `[!]` attempted, blocked/deviated, reason required. (The human already invented this with italics; formalise it.)
- **Builder flips spec/plan status transitions** as frontmatter (`status: draft|approved|building|shipped`, `shipped_in: <slice_id>`), not prose — killing the "shipped slices still say DRAFT" rot (§2.7) and giving the IDE a real status to render.
- **Builder writes into `.house/`, never into the orchestrator's live state.** Split the reconcile subagent's capability by *ownership*, not file type (§4.6): builder-owned = the unit's spec/plan/ADR/README/mockup + its own record; orchestrator-owned = `dev-state.md`, `roadmap.md`, retros. That removes the concurrent-write race (§4.2) and makes parallel slices safe.
- **Orchestrator's 9½ becomes a verifier**: assert every ticked box has evidence, every spec that shipped has status `shipped`, every declared gate has a result — and *that* is the stage ledger, computed rather than narrated.

### 6.6 (Runner-up, and the one that's IDE-specific) Make the unit re-enterable
Keep **one unit per session** as the *accountability* boundary — it is right: it bounds the diff, bounds the blast radius, gives a clean review surface, and matches one PR. But decouple "unit" from "one uninterrupted context". With a `stage_cursor` + incremental unit record (§6.1), a builder that dies at task 4 of 6 can be re-dispatched with the record as its brief and resume — rather than the current all-or-nothing where a death loses everything (§4.1). Same machinery makes the audible path (`house-orchestrator/SKILL.md:111-118` — "stop the builder… note what it committed / the branch state") a recorded, resumable operation instead of a kill plus forensics.

And size units by *gate-set runtime and context cost*, not by prose grouping: the brief should carry an explicit `expected_gates` list so the orchestrator can see that a unit ending in a 12-minute XCUITest suite is not the same size as one ending in `npm test`.

---

## 7. Appendix — the two hardest-to-see problems, restated

1. **The skill is less specified than the skill it composes.** `subagent-driven-development/implementer-prompt.md:100-112` gives its implementers a full report format — status, what was implemented, what was tested and the results, files changed, self-review findings, concerns — plus explicit definitions of when to use each of the four states (`:110-112`) and an explicit "It is always OK to stop and say 'this is too hard for me.' Bad work is worse than no work. You will not be penalized for escalating." (`:57-60`). `house-builder` has none of these. A redesign that only added the *composed* skill's own report contract would already be a material improvement — and it's free.

2. **The strongest rules in the skill are the least enforced.** Rank the content by engineering value and you get: the discriminating-test rule (`:29-31`), the commitments-survive rule (`:32-34`), the CI-red taxonomy (`:70-81`), the destructive-change proof obligation (`:60-68`). Rank it by enforcement and you get the inverse: the CI taxonomy has a hard gate; the other three are prose obligations inside a step that the skill itself admits "has no loud gate" (`:25`). The redesign's job is not to add rules — it's to give the existing best rules an artifact, an evidence requirement, and a verifier.
