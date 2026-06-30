# Design — Wire the remaining hygiene self-checks (Piece B)

- **Date:** 2026-06-30
- **Repo:** `sdlc-skills`
- **Status:** approved design, pre-plan
- **Part of:** the three-piece ecosystem redesign. **A (done)** → doctrine + dev-state contract + routing,
  with two self-checks wired live. **B (this spec)** → operationalize the *remaining* three hygiene checks at
  the orchestrator stages that aren't wired yet. **C** → the `house-shaper` skill.

## Why

Piece A *defined* the full hygiene checklist in `doctrine.md` and wired the two highest-frequency checks
(dev-state lint @ reconcile, per-merge teardown @ finish). The other three doctrine checks are still
content-only — the loop describes them but no stage actively runs them. That's the gap that let this session's
rot form: stale local/remote branches, a leftover stash, untracked tooling files, and the squash-merge
detection trap. Piece B makes the orchestrator run those checks.

## Constraints

- **Process-level, no script.** Same enforcement style Piece A chose — the orchestrator runs git/gh commands
  inline per the doctrine; no new workflow script, no structural lint tool.
- **Conservative auto-fix boundary.** Auto-resolve ONLY provably-safe, no-data-loss cases; SURFACE everything
  potentially destructive for the user's OK, never silent. (This policy is added to the doctrine so it's the
  canonical shared rule.)
- **Orchestrator-only.** The builder side was covered in A; this slice edits only the orchestrator (+ the
  shared doctrine policy line + human docs + version).
- **Project-agnostic, on-demand, published-site parity, no `install.sh` change** — same as Piece A.

## Deliverables (Piece B scope)

### 1. Doctrine — add the auto-fix boundary policy

In `skills/house-orchestrator/references/doctrine.md`, append a short policy paragraph to the **Hygiene
checklist** section:

> **Auto-fix boundary.** A hygiene check may auto-resolve ONLY provably-safe, no-data-loss cases — pruning a
> remote-tracking ref whose upstream is already deleted (`git fetch --prune`), or removing a worktree whose
> branch is merged and clean. Anything potentially destructive — a stash, an unmerged branch, uncommitted
> changes, deleting a local or remote branch, or an off-git artifact — is **surfaced for the user's explicit
> OK, never resolved silently.** Running unattended never downgrades this.

### 2. Orchestrator stage 2 — strengthen resume + add repo-setup readiness

In `skills/house-orchestrator/SKILL.md`, stage 2 ("Ready the repo"):

- **Strengthen the git-reality check** to run the doctrine's full Resume sweep: local + remote branches vs the
  trunk, worktrees, stashes, untracked files, open PRs, and plan-referenced artifacts that live OUTSIDE git —
  **with the squash-merge caveat** (a squash-merged branch is NOT recognized by `git branch --merged`; confirm
  merged-ness via `gh pr list --state merged` before pruning, never by reachability alone). Resolve findings
  per the doctrine's auto-fix boundary (surface destructive ones).
- **Repo-setup readiness** (the "can the repo progress the house way?" check): recommend enabling GitHub
  **auto-delete-head-branch** — a repo-config change, so it is **gated on the user's OK** (consistent with the
  existing stage-2 rule to stop for sign-off before config/branch-protection changes) — and ensure `.gitignore`
  covers IDE / tooling noise (a safe in-repo edit → apply directly).

### 3. Orchestrator stage 11 — broaden the session-end sweep

In `skills/house-orchestrator/SKILL.md`, the reconcile step/row: in addition to the dev-state lint already
wired in A, run the **broad session-end hygiene sweep** — scan for *any* stale local branches, worktrees, or
stashes and merged-but-undeleted remote branches (not only the unit that just merged), resolving per the
auto-fix boundary (surface destructive fixes).

### 4. Human docs + site + version

- `docs/process.md` — update the "Docs & hygiene doctrine" section: the line "Two of these are actively
  enforced…" becomes that **all** the hygiene checks are now wired (resume git-reality @ stage 2, repo-setup
  readiness @ stage 2, per-merge teardown @ stage 10, dev-state lint + broad sweep @ stage 11), under a
  conservative auto-fix boundary. Mirror into `docs/process.html` (hand-authored).
- `VERSION` 0.2.0 → 0.3.0.

## Non-goals (NOT this slice)

- **The `house-shaper` skill** — Piece C.
- Any **script / structural** enforcement (a hygiene-lint workflow) — explicitly rejected; stay process-level.
- **Builder** changes — its teardown obligation + doctrine citation shipped in A.
- Changes to the merge-gate / health-sweep workflows, stack gates, or model routing.
- Auto-applying destructive cleanups or repo-config changes without the user's OK (the conservative boundary
  forbids it).

## Success criteria

- The orchestrator's stage 2 runs a git-reality check that would have caught this session's tangle —
  including the squash-merge case — and the repo-setup readiness items.
- Stage 11 runs a broad hygiene sweep beyond the just-merged unit.
- The auto-fix boundary is canonical in the doctrine; destructive fixes are always surfaced, never silent.
- `process.md` + `process.html` describe all hygiene checks as wired; `VERSION` = 0.3.0.
- No new files, no script; the always-loaded surface is unchanged (doctrine stays on-demand).
