# Wire the Remaining Hygiene Self-Checks (Piece B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the orchestrator actively run the doctrine's three not-yet-wired hygiene checks — strengthened resume git-reality (with the squash-merge caveat) + repo-setup readiness @ stage 2, and a broad session-end sweep @ stage 11 — under a conservative auto-fix boundary.

**Architecture:** Add the auto-fix boundary policy to `doctrine.md` (canonical shared rule), then wire stages 2 and 11 of `house-orchestrator/SKILL.md` to run the doctrine's checks. Update the human docs to say all hygiene checks are now wired, and bump `VERSION`.

**Tech Stack:** Markdown (doctrine + skill body + process.md), hand-authored HTML (`process.html`), `VERSION`. **No executable code, no test framework** — each "verify" is a grep/read content check, not a unit test. Do NOT write code tests.

**Repo:** `sdlc-skills` · **Branch:** `feat/hygiene-self-checks` (already created off `main`; the spec is committed there). **Spec:** `docs/superpowers/specs/2026-06-30-hygiene-self-checks-design.md`.

**Project-agnostic constraint:** keep all wording stack-neutral. **Conservative auto-fix boundary:** destructive cleanups are always surfaced for the user, never silent.

---

## File Structure

- **Modify** `skills/house-orchestrator/references/doctrine.md` — append the auto-fix boundary policy to the Hygiene checklist.
- **Modify** `skills/house-orchestrator/SKILL.md` — strengthen stage-2 git-reality + add repo-setup readiness; broaden the stage-11 sweep.
- **Modify** `docs/process.md` + `docs/process.html` — update the "actively enforced" sentence to "all wired, conservative auto-fix".
- **Modify** `VERSION` — `0.2.0` → `0.3.0`.

No new files; no script; the builder skill is untouched.

---

## Task 1: Add the auto-fix boundary to the doctrine

**Files:**
- Modify: `skills/house-orchestrator/references/doctrine.md`

- [ ] **Step 1: Append the policy to the end of the "Hygiene checklist" section**

Read the file, find the `## Hygiene checklist` section, and append this paragraph immediately after its last bullet (the **Resume** bullet that ends "…never by reachability alone."):

```markdown
- **Auto-fix boundary.** A hygiene check may auto-resolve ONLY provably-safe, no-data-loss cases — pruning a
  remote-tracking ref whose upstream is already deleted (`git fetch --prune`), or removing a worktree whose
  branch is merged and clean. Anything potentially destructive — a stash, an unmerged branch, uncommitted
  changes, deleting a local or remote branch, or an off-git artifact — is **surfaced for the user's explicit
  OK, never resolved silently.** Running unattended never downgrades this.
```

- [ ] **Step 2: Verify**

Run: `grep -c 'Auto-fix boundary' skills/house-orchestrator/references/doctrine.md`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add skills/house-orchestrator/references/doctrine.md
git commit -m "doctrine: add the conservative auto-fix boundary policy"
```

---

## Task 2: Strengthen stage 2 (resume git-reality + repo-setup readiness)

**Files:**
- Modify: `skills/house-orchestrator/SKILL.md`

> Anchor on the exact quoted text in the stage-2 "Ready the repo" step.

- [ ] **Step 1: Replace the "Git reality" bullet**

Find this exact bullet:

```markdown
   - **Git reality** — current branch vs `main`, uncommitted/stashed WIP, a branch that predates a merge, a
     stranded plan-patch, open PRs — plus plan-referenced artifacts that live OUTSIDE git (an untracked
     sibling/content repo): check the disk, not just the log. Surface any tangle and resolve it first.
```

Replace it with:

```markdown
   - **Git reality** — run the doctrine's full Resume sweep: current branch vs `main`, local + remote branches,
     worktrees, uncommitted/stashed WIP, a branch that predates a merge, a stranded plan-patch, open PRs — plus
     plan-referenced artifacts that live OUTSIDE git (an untracked sibling/content repo): check the disk, not
     just the log. **Squash-merge caveat:** `git branch --merged` does NOT recognize a squash-merged branch as
     merged — confirm merged-ness via `gh pr list --state merged` before pruning, never by reachability alone.
     Surface any tangle and resolve it per the doctrine's **auto-fix boundary** (destructive fixes need the
     user's OK).
```

- [ ] **Step 2: Augment the "Can the repo progress the house way?" bullet**

Find this exact bullet:

```markdown
   - **Can the repo progress the house way?** — the stack's CI gate set is wired and the docs scaffold exists
     (`docs/superpowers/specs|plans`, an ADR dir, `docs/retros/`, `docs/health/`). **Stand up anything missing
     first.** STOP for the user's sign-off before changing CI config or branch protection.
```

Replace it with:

```markdown
   - **Can the repo progress the house way?** — the stack's CI gate set is wired and the docs scaffold exists
     (`docs/superpowers/specs|plans`, an ADR dir, `docs/retros/`, `docs/health/`). **Stand up anything missing
     first.** STOP for the user's sign-off before changing CI config or branch protection. **Repo-setup hygiene
     readiness (doctrine):** ensure `.gitignore` covers IDE / tooling noise (a safe in-repo edit — apply it);
     and recommend enabling GitHub **auto-delete-head-branch** — a repo-config change, so gated on the user's
     OK, same as CI / branch protection.
```

- [ ] **Step 3: Verify both insertions**

Run: `grep -c -E 'Squash-merge caveat|Repo-setup hygiene readiness|auto-delete-head-branch' skills/house-orchestrator/SKILL.md`
Expected: `3` or more (squash caveat, repo-setup readiness label, auto-delete-head-branch — the last also appears at stage 10, so the count may be higher).

- [ ] **Step 4: Commit**

```bash
git add skills/house-orchestrator/SKILL.md
git commit -m "orchestrator: strengthen stage-2 git-reality + repo-setup readiness"
```

---

## Task 3: Broaden the stage-11 session-end sweep

**Files:**
- Modify: `skills/house-orchestrator/SKILL.md`

- [ ] **Step 1: Extend the stage-11 row of the stage table**

Find the stage-11 table row, which currently ends (inside the "You do" cell) with:

```markdown
**Run the dev-state lint (doctrine): scan `dev-state.md` against its allowlist and migrate any durable content out to roadmap/ADR BEFORE writing the resting state.** |
```

Insert this sentence immediately before the closing ` |` of that cell (so the cell ends with both sentences):

```markdown
 **Then the broad session-end hygiene sweep (doctrine): scan for ANY stale local branches/worktrees/stashes + merged-but-undeleted remote branches, resolving per the auto-fix boundary (surface destructive).**
```

- [ ] **Step 2: Broaden the prose reconcile line**

Find this exact line near the end of the "Reconcile (stage 11)" step:

```markdown
Per the doctrine's hygiene checklist, before writing the resting state: lint `dev-state.md` against the allowlist (migrate strays to roadmap/ADR), and confirm the just-merged unit left no stale branch, worktree, or stash.
```

Replace it with:

```markdown
Per the doctrine's hygiene checklist, before writing the resting state: lint `dev-state.md` against the allowlist (migrate strays to roadmap/ADR), and run the **broad session-end hygiene sweep** — scan for ANY stale local branches, worktrees, or stashes and merged-but-undeleted remote branches (not just the unit that merged), resolving per the auto-fix boundary (surface anything destructive for the user's OK).
```

- [ ] **Step 3: Verify**

Run: `grep -c 'broad session-end hygiene sweep' skills/house-orchestrator/SKILL.md`
Expected: `2` (the table row + the prose line; note the table uses "broad session-end hygiene sweep" and the prose uses "**broad session-end hygiene sweep**" — both contain the phrase).

- [ ] **Step 4: Commit**

```bash
git add skills/house-orchestrator/SKILL.md
git commit -m "orchestrator: broaden stage-11 session-end hygiene sweep"
```

---

## Task 4: Update the human docs (md + site)

**Files:**
- Modify: `docs/process.md`
- Modify: `docs/process.html`

- [ ] **Step 1: Update the "actively enforced" sentence in `docs/process.md`**

In the "Docs & hygiene doctrine" section, find this sentence (it ends the section):

```markdown
Two of these are actively enforced by the orchestrator: a **dev-state lint** at reconcile and **per-merge
teardown** at finish, so neither doc-bloat nor branch/worktree rot can accumulate.
```

Replace it with:

```markdown
All of these are wired into the loop — the **resume git-reality check** and **repo-setup readiness** at stage
2, **per-merge teardown** at finish, and the **dev-state lint** + **broad hygiene sweep** at reconcile — under
a conservative **auto-fix boundary**: only provably-safe cleanups happen automatically; anything destructive is
surfaced for the user, never silent. So neither doc-bloat nor branch/worktree/stash rot can accumulate.
```

- [ ] **Step 2: Mirror the change into `docs/process.html`**

Read `docs/process.html`, find the paragraph that mirrors the sentence above (it begins "Two are actively enforced by the orchestrator" and uses the file's `<b>` house style). Replace that `<p>…</p>` with:

```html
<p>All of these are wired into the loop — the <b>resume git-reality check</b> and <b>repo-setup readiness</b> at stage 2, <b>per-merge teardown</b> at finish, and the <b>dev-state lint</b> + <b>broad hygiene sweep</b> at reconcile — under a conservative <b>auto-fix boundary</b>: only provably-safe cleanups happen automatically; anything destructive is surfaced for the user, never silent.</p>
```

(Match the file's existing `<b>`/indentation conventions; if the existing paragraph uses different wording, replace the whole paragraph regardless — the new content above is authoritative.)

- [ ] **Step 3: Verify md/html parity**

Run: `grep -c 'auto-fix boundary' docs/process.md` → expected `1`.
Run: `grep -c 'auto-fix boundary' docs/process.html` → expected `1`.
Run: `grep -c 'Two of these are actively enforced\|Two are actively enforced' docs/process.md docs/process.html` → expected `0` in both (old sentence fully replaced).

- [ ] **Step 4: Commit**

```bash
git add docs/process.md docs/process.html
git commit -m "docs: all hygiene checks now wired (md + site)"
```

---

## Task 5: Bump the version

**Files:**
- Modify: `VERSION`

- [ ] **Step 1: Set the version to 0.3.0**

Replace the entire contents of `VERSION` with:

```
0.3.0
```

- [ ] **Step 2: Verify**

Run: `cat VERSION`
Expected: `0.3.0`

- [ ] **Step 3: Commit**

```bash
git add VERSION
git commit -m "chore: VERSION 0.3.0 — remaining hygiene self-checks wired"
```

---

## Final verification (after all tasks)

- [ ] **All three remaining checks are wired in the orchestrator**

Run: `grep -c -E "Squash-merge caveat|Repo-setup hygiene readiness|broad session-end hygiene sweep" skills/house-orchestrator/SKILL.md`
Expected: `4` (1 squash caveat + 1 repo-setup readiness + 2 broad-sweep occurrences).

- [ ] **The auto-fix boundary is canonical in the doctrine and referenced by the orchestrator**

Run: `grep -l 'auto-fix boundary' skills/house-orchestrator/references/doctrine.md skills/house-orchestrator/SKILL.md`
Expected: both files listed.

- [ ] **No always-loaded weight added / builder untouched**

Run: `git diff --name-only main...HEAD`
Expected: only `doctrine.md`, `SKILL.md` (orchestrator), `process.md`, `process.html`, `VERSION`, and the spec/plan files — NOT `house-builder/SKILL.md`, NOT `install.sh`, NOT any workflow script.

- [ ] **Spec coverage sanity** — every spec deliverable maps to a task: doctrine auto-fix policy (T1), stage-2 strengthening + repo-setup readiness (T2), stage-11 broad sweep (T3), human docs (T4), version (T5).
