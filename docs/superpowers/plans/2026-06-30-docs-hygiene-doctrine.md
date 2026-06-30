# Docs & Hygiene Doctrine (Piece A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-agnostic runtime "docs & hygiene doctrine" the house skills cite on-demand, codify the dev-state allowlist, and wire two self-checks live (dev-state lint @ reconcile, per-merge teardown @ finish) — so doc-bloat and git-rot can no longer form.

**Architecture:** A new `skills/house-orchestrator/references/doctrine.md` holds the doc-model, dev-state allowlist, routing rules, and hygiene checklist. The orchestrator and builder SKILL bodies gain a one-line pointer + trigger moments (read it on-demand, never always-loaded), reusing the `$HOME/.claude/skills/house-orchestrator/...` absolute-path pattern the workflow scripts already use. The orchestrator additionally wires the dev-state lint into stage 11 and per-merge teardown into stage 10. Human docs (`process.md` + hand-authored `process.html`) and `VERSION` are updated to match.

**Tech Stack:** Markdown (skill bodies + doctrine + plans), hand-authored HTML (the GitHub Pages site — no generator), git/gh for hygiene. **No executable code; no test framework.** Each "verify" step is a content/consistency check (grep/read), not a unit test — do NOT write code tests for these markdown changes.

**Repo:** `sdlc-skills` · **Branch:** `feat/docs-hygiene-doctrine` (already created; the spec is committed there). **Spec:** `docs/superpowers/specs/2026-06-30-docs-hygiene-doctrine-design.md`.

**Project-agnostic constraint:** the doctrine ships to iOS and web users. Keep all wording stack-neutral; any web/LeadBook reference is illustrative only.

---

## File Structure

- **Create** `skills/house-orchestrator/references/doctrine.md` — the runtime doctrine (doc-model · dev-state allowlist · routing · hygiene checklist). One responsibility: the shared rules.
- **Modify** `skills/house-orchestrator/dev-state.template.md` — re-shape to the allowlisted sections so the template models the contract.
- **Modify** `skills/house-orchestrator/SKILL.md` — add the doctrine pointer + trigger moments; wire dev-state lint into stage 11 and per-merge teardown into stage 10.
- **Modify** `skills/house-builder/SKILL.md` — add the doctrine pointer + trigger moments (doc-reconcile, worktree teardown).
- **Modify** `docs/process.md` + `docs/process.html` — add a human-facing "Docs & hygiene doctrine" section (md + mirrored html).
- **Check/Modify** `docs/index.html`, `README.md` — only if they enumerate the doc-model/sections.
- **Modify** `VERSION` — `0.1.0` → `0.2.0`.

---

## Task 1: Author the doctrine reference

**Files:**
- Create: `skills/house-orchestrator/references/doctrine.md`

- [ ] **Step 1: Create the file with this exact content**

````markdown
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
````

- [ ] **Step 2: Verify the file exists and has all four core sections**

Run: `grep -E '^## (Doc model|dev-state contract|Routing|Hygiene checklist)' skills/house-orchestrator/references/doctrine.md`
Expected: four matching lines (Doc model, dev-state contract, Routing, Hygiene checklist).

- [ ] **Step 3: Commit**

```bash
git add skills/house-orchestrator/references/doctrine.md
git commit -m "doctrine: add shared docs & hygiene runtime reference"
```

---

## Task 2: Re-shape the dev-state template to the allowlist

**Files:**
- Modify: `skills/house-orchestrator/dev-state.template.md`

- [ ] **Step 1: Replace the file's entire content with this exact template**

```markdown
# <project> — dev state   (updated <date>)

> Operational tracker only (the doctrine's dev-state allowlist). Durable strategy → `roadmap.md`;
> the *why* behind decisions → `docs/adr/`. Keep this short; update at stage transitions and session end.

## Active slice: <id> — <title>
- stage: <stage>            next action: <what>
- branch: <branch>          blocked on: <none | why>

## In-flight
- builders / PRs: <links or "none">

## Slated (next up)
- <slice / plan> — <one line>

## Done
- <slice> — <date> — <retro path>

## Infra / secrets
- <live pointers an agent needs: resource IDs, env-var names — never secret values>

## Gotchas
- <sharp edges that bite mid-task>

## Process notes
- <project-specific workflow conventions>
```

- [ ] **Step 2: Verify the template's sections match the allowlist exactly**

Run: `grep -E '^## ' skills/house-orchestrator/dev-state.template.md`
Expected: `Active slice`, `In-flight`, `Slated (next up)`, `Done`, `Infra / secrets`, `Gotchas`, `Process notes` — and nothing implying roadmap/decisions.

- [ ] **Step 3: Commit**

```bash
git add skills/house-orchestrator/dev-state.template.md
git commit -m "doctrine: re-shape dev-state template to the allowlist"
```

---

## Task 3: Wire the doctrine + two self-checks into the orchestrator

**Files:**
- Modify: `skills/house-orchestrator/SKILL.md`

> Read the file first; anchor on the quoted text. These are additive edits — keep all surrounding content.

- [ ] **Step 1: Add the doctrine pointer near the top, right after the "Resume — every session starts here" section**

Insert this paragraph immediately after that section's existing body (before "## run — the procedure"):

```markdown
## Doctrine — the docs & hygiene rules
The doc-model, the dev-state allowlist, the routing rules, and the git/doc hygiene checklist live in
**`$HOME/.claude/skills/house-orchestrator/references/doctrine.md`** (resolve `$HOME`). Read it **on-demand**
at these moments — never preload it: **resume** (git-reality check), **finish** (per-merge teardown),
**reconcile** (dev-state lint + session-end hygiene), and any time you write a project doc. It is the single
source of truth for *what goes where*; this skill only points at it.
```

- [ ] **Step 2: Wire per-merge teardown into the stage-10 row of the stage table**

In the stage table, find the `| 10 PR + merge |` row. Append to its "You do" cell:

```markdown
**Then per-merge teardown (doctrine hygiene): delete the merged branch (prefer auto-delete-head-branch, else prune), remove the unit's worktree, verify no stray stash.**
```

- [ ] **Step 3: Wire the dev-state lint into the stage-11 row of the stage table**

In the stage table, find the `| 11 reconcile |` row. Append to its "You do" cell:

```markdown
**Run the dev-state lint (doctrine): scan `dev-state.md` against its allowlist and migrate any durable content out to roadmap/ADR BEFORE writing the resting state.**
```

- [ ] **Step 4: Reinforce both in the prose "Reconcile (stage 11)" step**

Find the numbered step `5. **Reconcile (stage 11).**` Append to its end (before the Stage ledger sentence, or as a new sentence):

```markdown
Per the doctrine's hygiene checklist, before writing the resting state: lint `dev-state.md` against the allowlist (migrate strays to roadmap/ADR), and confirm the just-merged unit left no stale branch, worktree, or stash.
```

- [ ] **Step 5: Verify all four insertions landed**

Run: `grep -c -E 'references/doctrine\.md|per-merge teardown|dev-state lint' skills/house-orchestrator/SKILL.md`
Expected: `3` or more matches.
Run: `grep -n 'doctrine' skills/house-orchestrator/SKILL.md`
Expected: at least the new pointer section + the stage-10/11 + reconcile references.

- [ ] **Step 6: Commit**

```bash
git add skills/house-orchestrator/SKILL.md
git commit -m "orchestrator: cite doctrine; wire dev-state lint (s11) + per-merge teardown (s10)"
```

---

## Task 4: Cite the doctrine in the builder

**Files:**
- Modify: `skills/house-builder/SKILL.md`

- [ ] **Step 1: Add a doctrine pointer to the "Compose, don't reinvent" closing section**

Append this paragraph to the end of `skills/house-builder/SKILL.md`:

```markdown
## Doctrine — docs & hygiene
The doc-model, routing rules, and hygiene checklist live in
**`$HOME/.claude/skills/house-orchestrator/references/doctrine.md`** (resolve `$HOME`). Read it **on-demand**
when you run the **doc-reconcile** step (so updated docs follow the routing rules) and at **teardown** (leave
your unit's worktree removable and no stash behind — the orchestrator runs per-merge teardown at finish). Don't
preload it.
```

- [ ] **Step 2: Tie the doc-reconcile step to the routing rules**

Find the step `4. **Reconcile this unit's docs.**` Append to the end of its dispatched subagent instruction (inside or right after the quoted prompt):

```markdown
Follow the doctrine's routing rules — a decision belongs in an ADR, durable strategy in roadmap, not in dev-state.
```

- [ ] **Step 3: Verify**

Run: `grep -c 'references/doctrine.md' skills/house-builder/SKILL.md`
Expected: `1` or more.

- [ ] **Step 4: Commit**

```bash
git add skills/house-builder/SKILL.md
git commit -m "builder: cite doctrine at doc-reconcile + teardown"
```

---

## Task 5: Update the human docs + published site

**Files:**
- Modify: `docs/process.md`
- Modify: `docs/process.html`
- Check: `docs/index.html`, `README.md`

- [ ] **Step 1: Add a doctrine section to `docs/process.md`**

Insert this section immediately before the existing `## What was deliberately dropped (vs the old plugin)` section:

```markdown
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
```

- [ ] **Step 2: Mirror the same section into `docs/process.html`**

Read `docs/process.html` to match its existing markup conventions (the `<h2>`, `<table>`, `<code>`, `.pill` classes). Insert an equivalent block immediately before the HTML section that corresponds to "What was deliberately dropped". Use this markup, adjusting only to match the file's existing indentation/wrappers:

```html
<h2>Docs &amp; hygiene doctrine</h2>
<p>The skills share one runtime reference — <code>references/doctrine.md</code> in the orchestrator — read on-demand (never preloaded) at resume, finish, reconcile, and any doc write. It defines four things:</p>
<ul>
  <li><strong>Doc model</strong> — one job per doc: <code>dev-state.md</code> (operational tracker), <code>roadmap.md</code> (durable spine), <code>docs/adr/</code> (decision records — <em>why</em>), specs/plans (per-slice design authority), retros, <code>docs/health/</code>.</li>
  <li><strong>dev-state allowlist</strong> — <code>dev-state.md</code> is operational only; durable strategy and decisions are banned and route to roadmap/ADR. The test: <em>if it's still true three slices from now, it isn't dev-state.</em></li>
  <li><strong>Routing</strong> — a decision → an ADR; a scope change → roadmap; progress → dev-state; as-built drift → reconcile the spec/plan in the slice PR.</li>
  <li><strong>Hygiene</strong> — per-merge the branch/worktree/stash are torn down; resume runs a git-reality check (squash-merge caveat: <code>git branch --merged</code> misses squash-merged branches — confirm via PR state).</li>
</ul>
<p>Two are actively enforced by the orchestrator: a <strong>dev-state lint</strong> at reconcile and <strong>per-merge teardown</strong> at finish.</p>
```

- [ ] **Step 3: Check index/README for stale doc-model enumerations**

Run: `grep -niE 'dev-state|doc-model|two skills|three' docs/index.html README.md`
For each hit, read the surrounding context: if it lists the docs/sections in a way the doctrine changes, update it for consistency; otherwise leave it. (Likely no change needed — these describe the two-skill split, which is unchanged.)

- [ ] **Step 4: Verify the md/html parity**

Run: `grep -c 'Docs & hygiene doctrine' docs/process.md` → expected `1`.
Run: `grep -c 'Docs &amp; hygiene doctrine' docs/process.html` → expected `1`.

- [ ] **Step 5: Commit**

```bash
git add docs/process.md docs/process.html docs/index.html README.md
git commit -m "docs: explain the docs & hygiene doctrine (md + site)"
```

---

## Task 6: Bump the version

**Files:**
- Modify: `VERSION`

- [ ] **Step 1: Set the version to 0.2.0**

Replace the entire contents of `VERSION` with:

```
0.2.0
```

- [ ] **Step 2: Verify**

Run: `cat VERSION`
Expected: `0.2.0`

- [ ] **Step 3: Commit**

```bash
git add VERSION
git commit -m "chore: VERSION 0.2.0 — docs & hygiene doctrine contract change"
```

---

## Final verification (after all tasks)

- [ ] **Doctrine reachable by the cited path**

Run: `ls -l "$HOME/.claude/skills/house-orchestrator/references/doctrine.md"`
Expected: the file resolves (the install is symlinked, so the repo file is live). If it does NOT resolve, the install may be copy-mode — re-run `./install.sh` from the repo root.

- [ ] **No always-loaded weight added**

Confirm the doctrine is referenced by path in both SKILL bodies but its *content* is not pasted into them:
Run: `grep -c 'Doc model — one job per doc' skills/house-orchestrator/SKILL.md skills/house-builder/SKILL.md`
Expected: `0` in both (the heading lives only in `doctrine.md`).

- [ ] **Spec coverage sanity** — every spec deliverable maps to a task: doctrine file (T1), dev-state template (T2), skill citations + the two live self-checks (T3, T4), human docs + site + version (T5, T6).
