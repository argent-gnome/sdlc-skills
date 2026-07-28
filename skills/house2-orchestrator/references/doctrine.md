# House SDLC — doctrine v2 (judgment, not enumeration)

> Runtime reference for `house2-shaper` / `house2-orchestrator` / `house2-builder`. Read it **on-demand** —
> never preload it: at a state transition, at reconcile, at a merge, and any time you write a project doc.
> Project-agnostic. Per-repo stack lore lives in `.house/gates.yml`, not here.

## 1. The kernel contract

Three layers of state, **exactly one writer each**: DECLARED (YAML frontmatter + `slice.yaml` manifests —
the agent owning the current step), OBSERVED (`.house/events.jsonl`, append-only — the `house` CLI and its
hooks, nothing else), DERIVED (`.house/index.json` — `house index` only; delete it, rebuild it,
byte-identical). One writer per field, ever. Anything derivable is derived, never hand-written.

- **An unrecorded gate did not run.** The next step's precondition is *the record exists and says pass* —
  never "the conductor remembers." A verdict that exists only in a transcript is not a verdict.
- **Never parse transcripts as state.** Sessions die; records do not.
- **`git clone` + a text editor stays sufficient** — the anti-lock-in clause. A rule that can only be
  obeyed by running a tool is a bug in the rule.

`cli/schema/enums.yaml` is the **SOLE normative source** for states, gate names, verdicts, tiers,
transitions, and event types. Standing rule, binding on this file and on every skill that cites it:
**doctrine may point at an enum, never restate one.** Need the list? Read the schema. A copy here is a
second source of truth, and a second source of truth always drifts.

## 2. The canonical stage table

The numbered-stage schemes are dead. A state has a **name**, the name comes from `slice_states`, and the
name is the only handle. Rows below are prose about each state — never a list of them.

| state | owner | entry precondition | exit artifact | gate rung |
|---|---|---|---|---|
| `idea` | shaper | someone wrote the work down | a minted id and its slice dir | — |
| `shaping` | shaper | a minted id exists | user-approved spec, a plan, a plan-check record | — |
| `ready` | shaper, handing to the orchestrator | the kickoff brief validates | the versioned kickoff brief | ⛔ its `required_gates` rung |
| `building` | orchestrator, via dispatched builders | a dispatched unit with a brief | landed unit work + per-unit reports | — |
| `gating` | orchestrator + an independent reviewer | every unit finalized | a recorded merge-gate verdict | — |
| `live_check` | orchestrator + the user | the merge verdict passes | user-confirmed behavior in the real environment | ⛔ its `required_gates` rung |
| `shipped` | orchestrator | the merge landed | a retro (required at slice tier and above) | ⛔ its `required_gates` rung |
| `parked` | whoever pauses the work | work stops but survives | a stated resume condition | — |
| `abandoned` | whoever ends the work | work stops for good | the event log and the slice dir | — |

The gate-rung cells **point**: `house state` refuses a transition unless every gate in that state's
`required_gates` entry has a record whose verdict is in `passing_verdicts`. Read the schema for which.

**Loop-backs** (the only legal ones; every one of them is a recorded event, never a quiet correction):

- plan-check NO_GO → replan in place: a new plan and a *new* plan-check record, not a new slice.
- a spec defect found mid-build → respec: the state moves back along the legal `building → shaping` edge,
  the spec is re-reviewed, and the plan is re-checked before the work resumes.
- scope explosion → decompose: mint N new slices, each with its own id, and park or abandon the original.
- **Iteration cap 2 → hard stop, surface to the user.** Twice around any loop-back is the signal that the
  problem is upstream of the loop. A third lap is not diligence, it is thrash.

## 3. The rigor dial

**One dial**, set at intake by the shaper and stored in `slice.yaml` as `rigor:`. Its legal values are the
`tiers` enum — nothing else is a tier. The dial scales ceremony to **the cost of a wrong-but-plausible
decision**, never to file type or line count.

Lower on the dial: spec and plan may share one file, the prose retro is optional, a mockup stage is
skipped, and the merge gate is a single independent reviewer. Higher on the dial: spec and plan are
separate documents, a mockup or a spike earns its own ⛔ sign-off, a prose retro is required before the
terminal state, and the merge gate escalates from one reviewer to a panel.

**The floor: the dial never skips the merge gate, and proposing to skip it is itself a hard gate.**

**Unattended work never downgrades a gate.** `attended: false` in the kickoff brief ⇒ every hard gate
halts at `gate.requested` and waits for a human — a panel is never silently reduced to a single reviewer,
and a single reviewer is never silently reduced to the builder's own word. The same holds when the
judgment-tier model is unavailable: **halt at `gate.requested`; never downgrade the reviewer to get
moving.**

## 4. Hard gates

Every key of `gate_verdicts` is a hard-gate rung, and `passing_verdicts` says what counts as passing for
each one. Both live in the schema; neither is copied here. Fail-closed, in four rules:

- **Unsure whether a gate is hard → treat it as hard.**
- **INCONCLUSIVE is not a pass.** Too few lenses ran, the reviewer could not reach a verdict, the tests
  did not finish — all of these are "run it again," none of them are "proceed."
- **A false NO-GO is safe, a false GO is not.** The asymmetry is the whole design.
- **Running unattended never downgrades a hard gate.**

Every halt writes `house block <id> --gate <name>`, which emits `gate.requested`. A halt you only
*announced* is a halt nobody can resume from.

## 5. Merge-gate cadence

**Per-slice, not per-unit** (settled). The reviewed diff is `git diff $(base_sha)...HEAD`, with `base_sha`
recorded on the manifest at branch time. The builder's self-review stays **per-unit** and is a different
job — "does this unit do what the plan said" — never a substitute for the slice-level review.

**Reviewer independence, three axes:** *perspective* — a fresh context that did not build the code;
*architecture* — a different model family than the builder's; *context* — it reads the diff and the spec,
not the build transcript. This is why the throughput tier builds and the judgment tier reviews
(ADR-0001): Opus builds and Fable reviews precisely so the reviewer's blind spots are not the builder's.
Route builders to Fable and axis two silently disappears.

**The rubric — four lenses, every time:** cross-task seams (what broke between two green tasks) ·
spec-rule citation (each finding names the rule it violates, or it is a preference) · regression and
data-safety (what existing behavior or existing data could this destroy) · gate compliance (did every
gate this slice claims actually get recorded).

**Don't trust the report.** The reviewer re-runs the build and the tests personally. A builder's report is
a claim; the reviewer's own green run is the evidence. Every reviewer is also handed the **suppression
ledger** (`docs/health/accepted.md`) so it does not re-raise something knowingly accepted — and so that
accepting something stays a visible, revisitable act.

**Squash-merge caveat.** `git branch --merged` does **not** recognize a squash-merged branch as merged: a
squash creates a new commit that is not a descendant of the branch tip, so reachability says "unmerged"
about work that is safely in the trunk. PR state (`gh pr list --state merged`) decides merged-ness. Never
prune by reachability alone.

## 6. The doc model and the routing table

One job per doc. Slice artifacts live in `docs/slices/<id>/` — literal paths, never placeholders.
`docs/superpowers/` is retired for new work; nothing new is written there.

| Doc | Job | Owner |
|---|---|---|
| `docs/slices/<id>/spec.md` + `plan.md` | the design authority; ships IN the slice PR | shaper |
| `docs/slices/<id>/tasks.yaml` + `slice.yaml` + `gates/` | the machine-readable record | the `house` CLI |
| `docs/roadmap.md` | durable strategy: sequencing, dependencies, milestones, backlog | shaper / reconcile |
| `docs/adr/NNNN-<slug>.md` | the **why** behind a non-obvious call: context · decision · consequences | shaper / reconcile |
| `docs/dev-state.md` | operational tracker — generated by `house render dev-state` | the renderer |
| `docs/slices/<id>/retro.md` | manual interventions · decisions · plan deviations · gate friction | reconcile |
| `docs/health/` + `accepted.md` | health-sweep backlog + the suppression ledger | health-sweep |

**The dev-state allowlist is now mechanical:** hand-written content lives ONLY between the manual markers.
Everything outside them is generated and will be overwritten; the renderer refuses rather than silently
dropping content it did not expect. So the routing question is not "may I add this to dev-state" but
"where does this actually belong":

| When this happens… | …it goes here |
|---|---|
| a call was made, with a reason someone will question later | a new numbered **ADR** |
| scope, priority, or sequencing changed | **roadmap.md** |
| progress, a new next action, a blocker | a `house` writer + `house render dev-state` — never a hand-edit |
| the code diverged from its spec or plan (as-built drift) | reconcile the **spec/plan** in the slice PR |
| a cleanup or debt item is deferred | roadmap backlog or `docs/health/` |

A change that alters a spec rule or the slice's scope is a **plan deviation** — surface it, never absorb
it silently.

**Two rendering rules (settled):** `parked` renders as its own dev-state section, because paused work that
disappears from the tracker is work nobody resumes. `abandoned` renders nowhere — its history is the event
log plus the slice dir, and `house list` still shows it, so nothing is lost by not printing it.

## 7. Composition contract — take / suppress / own

**Take** (invoke them; do not reimplement them): TDD's iron law — write the failing test first, watch it
fail for the right reason, then the minimal code that passes. Brainstorming's dialogue — one question at a
time, converge before writing.

**Suppress** (they conflict with the kernel; the house loop wins): `superpowers:writing-plans`' execution
menu and its worktree assumption — topology and sequencing are the orchestrator's, set in the brief.
Brainstorming's forced terminal transition into planning — the shaper's loop decides what comes next.
`superpowers:finishing-a-development-branch` and `superpowers:executing-plans` drop out of the loops
entirely: their bookkeeping is what `house` records now are.

**Own** (nothing else knows the records exist, so nothing else can do these): dispatch, gates, reconcile.

## 8. Hygiene checklist

Stated once, here. The loop creates artifacts — a branch, a worktree, a PR — and tearing them down is an
**owned obligation of the step that finishes the work**, not a surprise at the next session's resume.

- **Per-merge teardown:** the merged branch is deleted (prefer GitHub auto-delete-head-branch, else prune
  it explicitly), its worktree is removed, and no stash is left behind.
- **Session-end sweep:** no stale local branches, worktrees, or stashes; no merged-but-undeleted remote
  branches; `house validate` green; `house render dev-state` current.
- **Repo setup, once per repo:** auto-delete-head-branch enabled; `.gitignore` covers IDE and tooling
  noise.
- **Never shape inline — that is a `house2-shaper` session.** Not a quick exception, not "while I'm here."
- **Health-sweep findings become records:** each one is a `house event work.discovered`, then lands in the
  roadmap backlog or in `docs/health/accepted.md`. A finding that stays in the transcript was never found.

What a sweep may fix on its own versus what it must surface is the **auto-fix boundary** — stated in
`house2-orchestrator` §8, because the orchestrator is who runs the sweeps.

## 9. The reconcile-subagent

Applying a decision, a plan, or an as-built change across the doc model is heavy doc read/write —
**dispatch it** so the reading dies in a subagent instead of bloating the parent. Dispatch it at every
state transition, at session end, and at every merge.

Contract, verbatim: *"Read the relevant spec / plan / ADR / README / roadmap / dev-state under
`<repoPath>`, plus `<the decision, diff, or plan>`. Update the docs so they match what is actually true,
following the routing table in doctrine §6 — a decision becomes an ADR, scope and sequencing go to the
roadmap, operational state goes through a `house` writer, as-built drift reconciles the spec or plan.
Change ONLY docs. Report exactly what you changed."*

It changes docs and nothing else, and it reports what it changed — a reconcile whose output you cannot
diff is a reconcile you cannot trust.
