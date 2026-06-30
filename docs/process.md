# The house SDLC — how it works

*the house SDLC · [best practices](best-practices.md) · [case study](case-study.md)*

This is the one build process, run the same way every time, by two cooperating Claude Code skills. It's a
plugin-free, token-lean successor to the old `dev-command-center` plugin: same lifecycle discipline, a fraction
of the context cost.

## Why two skills

Every message in a session re-sends the whole context, so a loaded skill body is a tax paid *per message*. A
single monolithic SDLC skill makes every session — orchestrator and builder alike — pay for the whole
lifecycle. Splitting along the seam you already work on means each session loads only its half:

| | role | loads | lives |
|---|---|---|---|
| **house-orchestrator** | conductor | sequencing, gates, kickoff prompts, review dispatch, reconcile | one long-lived session, resumable |
| **house-builder** | executor | build one unit: TDD, stack gates, self-review, doc reconcile | ephemeral — spun up, then torn down |

The builder sessions are disposable: their heavy implementation log dies on teardown. The orchestrator stays
light because it never reads diffs itself — it **dispatches reviews to subagents** and only the verdict
(a few hundred tokens) returns.

## The loop

```
        ┌──────────────────────────── house-orchestrator ────────────────────────────┐
resume → ready repo → 1 scope → 2 spec ⛔ → 3 mockup ⛔ → 4 plan → 4¼ plan-check (subagent)
                                                                          │
                              hand off a unit  ┌───────── house-builder (per unit) ─────────┐
                                       ───────▶│ 5 build (TDD) · 6 self-review · stack    │
                                               │ gates · doc-reconcile (subagent) · 8 CI  │
                              report back  ◀────│ → report: DONE / CONCERNS / BLOCKED      │
                                       │       └──────────────────────────────────────────┘
        7 merge-gate (subagent; PANEL if high-stakes) ⛔ → 7½ health-sweep (workflow, advisory)
        → 9 live/device ⛔ → 9½ docs audit → 10 PR+merge → 11 reconcile + update dev-state.md
        └────────────────────────────────────────────────────────────────────────────────┘
```

⛔ = a hard gate: the orchestrator stops and gets the user (spec review, mockup sign-off, live validation,
CI red, any plan deviation, any irreversible/outward-facing action). These never auto-clear, even unattended.

## The three reviews

- **plan-check (4¼)** — before any code, one fresh subagent critiques the *plan* against the existing app +
  spec through five lenses (arch-fit · spec-coverage · risk/sequencing · testability · simpler-path). The
  cheapest place to catch a design flaw — it's still a doc edit.
- **merge-gate (7)** — before merge, an independent refute-biased subagent reviews the finished diff against a
  four-point rubric (cross-task seams · spec-rule citation · regression/data-safety · gate compliance) and
  returns **GO / NO-GO**. The *rigor dial* decides its form: normal stakes → this single reviewer; high stakes
  (a spec high-stakes rule, or user-data touch) → escalate to the **panel** workflow (4 lenses → 3-refuter
  verification). The dial never *skips* the merge-gate.
- **health-sweep (7½)** — after the merge-gate GO, an advisory whole-app workflow sweeps for debt and emits a
  ranked backlog. Never blocks a merge; need not run every slice.

Reviews are **subagents/workflows**, never inline — the heavy reading happens in their throwaway context, and
independence (fresh eyes that never saw the build) is the whole point of the merge-gate.

## Resume

The orchestrator is closeable and reopenable. It rebuilds its working picture from a per-project
**`docs/dev-state.md`** — a short plaintext tracker (active slice, stage, next action, blocked-on, open PRs,
slated, done) it updates at stage transitions and session end. You resume by starting a *fresh* session that
reads this file — not by reloading a heavy transcript.

## Stack gates (enforced by the builder)

- **iOS** — `swift test` · SwiftLint · `xcodebuild` · XCUITest (virtualization-robust discriminators;
  serialized UI suites; the destination simulator must exist; CI must *execute* the test bundle); **no
  destructive SwiftData changes** — `@Model` migrations exercised against a previous-schema store.
- **web** — tests · typecheck · lint · build; **no silently-destructive migrations** (a fresh CI DB passing is
  not proof against a populated one).

## Docs & hygiene doctrine

The skills share one runtime reference — `references/doctrine.md` in the orchestrator — read on-demand (never
preloaded) at resume, finish, reconcile, and any doc write. It defines four things:

- **Doc model** — one job per doc: `dev-state.md` (operational tracker), `roadmap.md` (durable spine),
  `docs/adr/` (decision records — *why*), specs/plans (per-slice design authority), retros, `docs/health/`.
- **dev-state allowlist** — `dev-state.md` is operational only (active slice, in-flight, slated, done, infra
  pointers, gotchas, process notes). Durable strategy and decisions are *banned* — they route to roadmap/ADR.
  The test: *if it's still true three slices from now, it isn't dev-state.*
- **Routing** — a decision → an ADR; a scope change → roadmap; progress → dev-state; as-built drift → reconcile
  the spec/plan in the slice PR.
- **Hygiene** — per-merge the branch/worktree/stash are torn down; resume runs a git-reality check (with the
  squash-merge caveat: `git branch --merged` misses squash-merged branches — confirm via PR state).

Two of these are actively enforced by the orchestrator: a **dev-state lint** at reconcile and **per-merge
teardown** at finish, so neither doc-bloat nor branch/worktree rot can accumulate.

## What was deliberately dropped (vs the old plugin)

The board + GitHub-Pages tracker, the public-board privacy rules, the onboarding scanner, the self-improvement
auditor loop, the autonomous-mode setup section, and the plugin/marketplace/versioning machinery — all removed
or replaced by the lightweight `dev-state.md`. The lifecycle discipline stayed; the token weight didn't.
