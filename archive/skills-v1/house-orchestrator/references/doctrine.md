# House SDLC — docs & hygiene doctrine

> Runtime reference. Read this **on-demand** (it is NOT always-loaded) when you: write or update any project
> doc, run the reconcile stage, finish/merge a unit, or resume a project. Cited by house-orchestrator and
> house-builder. Project-agnostic — examples are illustrative, the rules are stack-neutral.

## Doc model — one job per doc

| Doc | Job | Owning stage |
|---|---|---|
| `docs/dev-state.md` | Operational tracker: where we are / what's next. The thing you rebuild from on resume. | every stage transition + session end |
| `docs/roadmap.md` *(or equivalent)* | Durable spine: sequencing, gating dependencies, milestones, future expansions. | shaper / reconcile |
| `docs/adr/NNNN-<slug>.md` | Decision records: *why* a non-obvious call was made (context · decision · consequences). | shaper / reconcile, on any decision |
| `docs/<specs>/…` · `docs/<plans>/…` | Per-slice spec + plan — the design authority that ships IN the slice PR. | brainstorm / plan |
| `docs/retros/…` | Per-slice retro: manual interventions · decisions · plan deviations · gate friction. | reconcile (stage 11) |
| `docs/health/…` + `accepted.md` | Health-sweep backlog + the suppression ledger. | health-sweep |

`roadmap.md` is the canonical name for the durable-strategy doc. A project may name it differently, but that
doc MUST exist and own this content — it does not live in `dev-state.md`.

## dev-state contract — the allowlist

`dev-state.md` is operational ONLY. It contains exactly these sections and nothing else:

- **Active slice** — id · title · stage · next action · blocked-on
- **In-flight** — builders / open PRs (links or "none")
- **Slated** — next up (one line each)
- **Done** — shipped slices, each a one-line pointer to its retro
- **Infra / secrets** — live pointers an agent needs to work (project/resource IDs, env-var *names* — never secret values)
- **Gotchas** — sharp edges that bite an agent mid-task
- **Process notes** — project-specific workflow conventions

**Banned from dev-state — route it out:**

- Durable roadmap / sequencing / milestones → `roadmap.md`
- A decision + its rationale → a new ADR
- Strategy / positioning / vision → `roadmap.md` (or an ADR if it is a decision)
- Anything that is not *current operational state*

**The test:** *if it would still be true and worth knowing three slices from now, it is not dev-state.*

## Routing — where new information goes

| When this happens… | …it goes here |
|---|---|
| A decision is made (chose X over Y, with a reason) | a new numbered **ADR** (`docs/adr/`) |
| Scope / priority / sequencing changes | **roadmap.md** |
| Progress, a new next-action, a blocker | **dev-state.md** |
| Code diverged from the spec/plan (as-built drift) | reconcile the **spec/plan** in the slice PR |
| A cleanup / debt item is deferred | **roadmap** backlog or `docs/health/` |

A change that alters a spec rule or the slice scope is a **plan deviation** — surface it, never absorb it silently.

## Hygiene checklist — git & doc cleanliness

The loop creates artifacts (a worktree + branch + PR per unit). Tearing them down is an OWNED obligation at the
stage that finishes the work — not something discovered at the next session's resume.

- **Per-merge (finish):** the merged unit's branch is deleted (prefer GitHub *auto-delete-head-branch*; else
  prune it explicitly), its worktree removed, and no stash left behind.
- **Repo-setup (one-time, on a new house repo):** enable auto-delete-head-branch; ensure `.gitignore` covers
  IDE / tooling noise (editor dirs, local-skills lockfiles, OS files).
- **Session-end / reconcile:** `dev-state.md` passes the allowlist (migrate any strays out); no stale local
  branches, worktrees, or stashes; no merged-but-undeleted remote branches.
- **Resume:** run the git-reality check — local/remote branches vs the trunk, worktrees, stashes, untracked
  files, open PRs, and plan-referenced artifacts that live OUTSIDE git. **Squash-merge caveat:**
  `git branch --merged` does NOT recognize a squash-merged branch as merged (a squash creates a new commit that
  is not a descendant of the branch tip). Confirm merged-ness via PR state (`gh pr list --state merged`) before
  pruning — never by reachability alone.
- **Auto-fix boundary.** A hygiene check may auto-resolve ONLY provably-safe, no-data-loss cases — pruning a
  remote-tracking ref whose upstream is already deleted (`git fetch --prune`), or removing a worktree whose
  branch is merged and clean. Anything potentially destructive — a stash, an unmerged branch, uncommitted
  changes, deleting a local or remote branch, or an off-git artifact — is **surfaced for the user's explicit
  OK, never resolved silently.** Running unattended never downgrades this.

## Reconcile-subagent — the shared doc-update pattern

Applying a decision, a plan, or an as-built change across the doc-model is **heavy doc read/write** — dispatch
it to a subagent so it stays out of the parent's context. Contract: *"Read the relevant
spec/plan/ADR/README/roadmap/dev-state under `<repoPath>` plus `<the decision / diff / plan>`. Update the docs
so they match, following the routing rules above — a decision → a new ADR, scope/sequencing → roadmap,
operational state → dev-state, as-built drift → the spec/plan. Change ONLY docs; report what you changed."* Two
instances already exist: the **builder's** per-unit doc-reconcile, and the **shaper's** post-decision reconcile.
