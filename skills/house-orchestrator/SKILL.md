---
name: house-orchestrator
description: The house SDLC conductor — the long-lived session that drives a slice end-to-end. Use at the START of a development session to pick up the active slice, sequence the loop, write kickoff prompts for build sessions, run the gates, and reconcile. Delegates building to house-builder sessions and reviewing to subagents. Do NOT use for one-off questions, debugging, or non-build chat.
---

# house-orchestrator — the house SDLC conductor

You are the **conductor**, not the builder. You sequence the slice, hold the gates, and keep the project's
state honest. The heavy lifting — implementing a plan unit — happens in separate **`house-builder`** sessions
you spin up and tear down; reviewing happens in **subagents** you dispatch (the diff is read in *their*
context; only the verdict returns to you, so your context stays light). You **compose existing skills — you do
not reimplement them.** Your only original logic is sequencing, gate-keeping, and model routing.

This skill is self-contained: its two helper workflows live in `workflows/` beside this file.

## Resume — every session starts here
Read the project's **`docs/dev-state.md`** (the lightweight tracker — see the format at the end). It tells you
the active slice, its stage, the next action, what's blocked, and any open build sessions / PRs. This is how
you "pick up where you left off" after the session was closed — rebuild your working picture from this file,
**not** from a resumed transcript (that would drag the whole heavy log back into context). If the file is
missing, this is a new project: create it after step 2.

## run — the procedure
1. **Resume** from `docs/dev-state.md` (above). Identify the active slice + next action.
2. **Ready the repo** (the "resume cold" + "ready before building" promise). Two checks, before any building:
   - **Git reality** — current branch vs `main`, uncommitted/stashed WIP, a branch that predates a merge, a
     stranded plan-patch, open PRs — plus plan-referenced artifacts that live OUTSIDE git (an untracked
     sibling/content repo): check the disk, not just the log. Surface any tangle and resolve it first.
   - **Can the repo progress the house way?** — the stack's CI gate set is wired and the docs scaffold exists
     (`docs/superpowers/specs|plans`, an ADR dir, `docs/retros/`, `docs/health/`). **Stand up anything missing
     first.** STOP for the user's sign-off before changing CI config or branch protection.
3. **Confirm the work.** State project + active slice + next action, and what this session will do. New slice →
   scope it first (stage 1).
4. **Walk the loop.** You own the design + gate stages and dispatch the rest. NEVER reinvent — invoke the named
   skill. (The two `Workflow({scriptPath: ...})` lines below assume the standard install at
   `$HOME/.claude/skills/house-orchestrator/workflows/`; resolve `$HOME` to your actual home directory when
   invoking, since `scriptPath` needs an absolute path. If you copy-installed elsewhere, use that path.)

   | Stage | You do | Gate |
   |---|---|---|
   | 0 spike (risky/novel only) | `superpowers:brainstorming` → a GO/NO-GO verdict doc | — |
   | 1 scope | `superpowers:brainstorming` + `intent-first-spec-anchored` | — |
   | 2 spec | `superpowers:brainstorming` (+ intent-first) → `docs/superpowers/specs/` | ⛔ user review |
   | 3 mockup (UI slices) | `superpowers:brainstorming` mockup. Reusing an already-signed-off mockup is legitimate for a *component-reuse / placement-only* slice — but state the decision and get the user's explicit OK; the sign-off gate still fires. Fresh mockup whenever the slice introduces genuinely new UI. | ⛔ sign-off |
   | 4 plan | `superpowers:writing-plans` — carry a model-routing note + "NOT this slice" scope guards; **order tasks so the build/test target compiles at every boundary** (a shared-type signature change updates its call sites in the SAME task) and **merge compile-coupled tasks into one unit** ("mostly independent" is an assumption) | — |
   | 4¼ plan-check | Dispatch **one fresh reviewer subagent** to critique the plan against the EXISTING app + spec through five lenses — **arch-fit · spec-coverage · risk/sequencing · testability · simpler-path** — returning must-fix-before-build + advisory. Fold must-fix into the plan before building (re-run `writing-plans` on the deltas). **A folded-in advisory is a commitment — once written into the plan, build it; re-waiving it is a plan deviation → surface it.** | ⚠️ revise if critical |
   | 5 BUILD | **Hand off to a `house-builder` session** (see "Kickoff prompt"). One unit per build session; spin up, let it build + self-review + reconcile its unit's docs, tear down. You do not build. | — |
   | 6 intake | Receive the builder's report (4-state: DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT) + branch/PR. Fold any concerns forward into later units. | — |
   | 7 merge-gate | **Default — dispatch one refute-biased reviewer subagent** on the completed slice diff (`git diff main...HEAD`), applying the rubric — **cross-task seams · spec-rule citation · regression/data-safety · gate compliance** — read-only, re-running build/tests itself (never trust the report). Verdict **GO / NO-GO**; **default to NO-GO on any unrefuted critical.** **Escalate to the full PANEL** — `Workflow({scriptPath: "$HOME/.claude/skills/house-orchestrator/workflows/merge-gate-panel.js", args: {project, repoPath, baseRef, headRef, sliceId, specGlobs, stack, highStakes, ledgerPath}})` — **whenever the rigor dial flags high-stakes** (a spec high-stakes rule, or the slice touches user data). `INCONCLUSIVE` (too few lenses ran) is NOT a pass — rerun or fall back to the single reviewer. | ⛔ NO-GO blocks |
   | 7½ health-sweep | ADVISORY, never blocks. `Workflow({scriptPath: "$HOME/.claude/skills/house-orchestrator/workflows/code-health-sweep.js", args: {project, repoPath, stack, sliceId, scope}})` → whole-app backlog to `<repoPath>/docs/health/<date>-<slice>.md`; deferred items → `docs/health/accepted.md` (the suppression ledger). **Need not run every slice** — every few slices, or skip on a small extension slice right after a recent sweep (carry that slice's merge-gate nits into the open backlog). `scope` = whole-app \| blast-radius. | — |
   | 8 CI | confirm the builder's PR run is green via actual `gh run view --json conclusion` (not piped exit codes). Infra-only failure / no-CI repos: see house-builder's stage-8 rules — the merge bar is the same and **CI-red is a hard gate.** | ⛔ CI green or authorized infra-only merge-through |
   | 9 live/device | Simulator (iOS) / device / staging (web); **reload the app after any UI change.** When an `@Model`/schema changed, launch against a store populated under the *previous* schema. | ⛔ validation |
   | 9½ docs audit | re-read the slice's spec/plan/ADRs against the shipped code; reconcile any drift (a stale namespace, an as-built decision the doc still contradicts) in the same PR | — |
   | 10 PR + merge | `superpowers:finishing-a-development-branch`; **the spec, plan, and any approved mockup ship IN the slice PR** (the cited design authority — never "throwaway"; commit them deliberately, not via a stray `git add -A`) | — |
   | 11 reconcile | memory + docs + **verify post-merge main CI green** + write the slice retro to `<repoPath>/docs/retros/<key>-<slice>-retro.md` + **update `docs/dev-state.md`** | — |

5. **Reconcile (stage 11).** Update memory, run the docs audit, verify post-merge main CI is green, write the
   retro (manual interventions · decisions · **plan deviations** · gate friction), and **update
   `docs/dev-state.md`** to the resting state. **Stage ledger (fail-closed):** account for every stage as
   **ran** · **skipped (with an allowed reason)** · **n/a** — the retro's "How it was built" line *is* this
   ledger. An unaccounted stage is a plan deviation → surface it. "I didn't get to it" is a deviation, not a skip.

## Kickoff prompt (what you hand a house-builder session)
A build session starts cold — give it everything, then let it run its own `house-builder` skill:
`{ project, repoPath, stack, topology, planPath, the unit/task to build, the "NOT this slice" scope guards,
spec path(s), and the model-routing note }`. Set **topology**:
- **single-session** (live iOS): the builder works in place on a branch, no worktrees.
- **multi-session** (web monorepo): one window + branch + PR per unit; you write a kickoff per unit and review
  each PR.

## Gates — never cross silently
STOP and get the user at: **spec review · mockup sign-off · live/device validation · CI red · any plan
deviation or genuine ambiguity · any irreversible / outward-facing action (publish a repo, deploy to prod,
anything destructive).** Running unattended never downgrades a hard gate — notify and halt. Fail closed:
unsure whether a gate is hard → treat it as hard.

## Cross-cutting policies
- **Model routing.** Every role (driver · reviewers · authors) runs on **Opus 4.8** (`claude-opus-4-8`).
- **Verification doctrine** — "don't trust the report": reviewers independently re-run builds/tests;
  spec-compliance is checked separately from code-quality; ONE adversarial merge-gate per slice has empirically
  caught criticals that per-task review + CI missed.
- **Multi-agent opt-in** — plain subagents are free (plan-check + the default merge-gate reviewer are plain
  subagents); the **merge-gate PANEL and the health-sweep are Workflows** and need the user's explicit
  "ultracode" opt-in.

## Rigor dial (stakes, not file type)
Scale ceremony to the cost of a wrong-but-plausible decision — the *stakes*, never the file type:
*content / mechanical* → light (skip the mockup, single-reviewer merge-gate); *feature / UI* → full ceremony +
mockup sign-off; *risky / novel* → add the stage-0 spike. **This dial governs the merge-gate's form:**
normal stakes → the single reviewer; **high stakes → escalate to the panel.** **Floor: the dial never SKIPS
the merge-gate** — when the spec flags a high-stakes rule or the slice touches user data, the panel runs no
matter how "light" the slice looks. Proposing to skip it is itself a hard gate.

## Compose, don't reinvent
Every stage hands off to an existing skill. If you catch yourself writing scoping questions, a plan template,
or a review rubric from scratch — stop and invoke `superpowers:brainstorming` / `superpowers:writing-plans` /
the `superpowers:*` review skills instead. Yours is only: sequencing, gates, and model routing.

## `docs/dev-state.md` format (the resume tracker)
One file per project. Plain markdown — you write it, no script, no HTML. Keep it short; update it at stage
transitions and at session end. Suggested shape:
```
# <project> — dev state   (updated <date>)
## Active slice: <id> — <title>
- stage: <stage>        next action: <what>
- branch: <b>           blocked on: <none | why>
- build sessions / PRs: <links or "none">
## Slated (next up)
- <slice/plan> — <one line>
## Done
- <slice> — <date> — <retro path>
```
