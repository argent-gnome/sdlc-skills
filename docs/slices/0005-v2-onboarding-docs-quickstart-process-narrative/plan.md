---
id: "0005-v2-onboarding-docs-quickstart-process-narrative"
kind: plan
slice: "0005-v2-onboarding-docs-quickstart-process-narrative"
title: "v2 onboarding docs — implementation plan"
status: "planned 2026-07-29; plan-check GO_WITH_FIXES folded"
state: approved
---
# v2 Onboarding Docs Implementation Plan

> **For agentic workers:** docs-only. Three tasks, each committed when its verification greps pass.
> The kickoff brief in `slice.yaml` is the contract.

**Goal:** Two human-facing docs (`docs/quickstart.md`, `docs/process-v2.md`) plus a v1 banner on
`docs/process.md`/`.html`, written name-light so the parked rename (slice 0004) sweeps one block.

**Source material (read, then write; never invent):** `cli/README.md` (command reference),
`cli/schema/enums.yaml` (the authorities to point at), `skills/house2-orchestrator/references/doctrine.md`
(process truth — cite, don't restate), `docs/adr/0004-house2-coexistence-and-advisory-hooks.md` incl. the
2026-07-29 amendment (adoption path), `.house/gates.yml` (example stanza shape), and athlete-data's
onboarding as the worked example of the four-command startup (commit `da2e2b3` in that repo — described in
`docs/dev-state.md`'s manual block; do not read the other repo).

**Voice:** plain prose for a developer who has never seen this repo. Short sections, real commands,
links to authorities. No marketing.

---

### Task 1: `docs/quickstart.md`

**Files:** Create `docs/quickstart.md`.

- [ ] **Step 1: Write the doc** with exactly these sections:
  1. **What you need once** — `./install.sh` (skills + `house` bin), `house --version` to confirm.
  2. **New project, four commands** — fenced block: `git init <name> && cd <name>`, `house init`,
     edit `.house/gates.yml`, `git add -A && git commit`. One sentence per command on what it did.
  3. **Seed your gates** — what `gates.yml` is (the per-stack proof commands a builder must run), with
     one example stanza copied in spirit from this repo's node stack (name + cmd list), and the rule:
     an absent/unknown stack fails closed as `NEEDS_CONTEXT`.
  4. **Then invoke the shaper** — one paragraph: open a session, invoke the shaper skill (names table
     below), answer its first question; every later session resumes from the records.
  5. **Adopting already-shaped work** — the ADR-0004-amendment path (link the ADR): a shaper session
     mints the slice, imports spec/plan into `docs/slices/<id>/`, records provenance, the user
     re-affirms `spec_review`, a fresh `plan_check` runs before `ready`.
  6. **Current skill names** — a 3-row table (`house2-shaper`, `house2-orchestrator`, `house2-builder`
     → shaper / conductor / builder roles). The caption sentence — *these are migration-window names;
     they become `house-*` at the parked cutover (slice 0004)* — must sit INSIDE the table (a final
     row or a cell), because the machine check below requires every `house2` hit to be on a
     pipe-containing line. This table is the file's ONLY `house2` text.
- [ ] **Step 2: Verify** (these run again as the task's evidence gate — see tasks.yaml):
  - `house validate` → exit 0
  - `! grep 'house2' docs/quickstart.md | grep -v '|' | grep -q .` → true (every `house2` hit is on a
    table line; M-fold: containment is machine-checked, not eyeballed)
- [ ] **Step 3: Commit** — `docs(quickstart): new-project startup + adoption path + names table`

### Task 2: `docs/process-v2.md`

**Files:** Create `docs/process-v2.md`.

- [ ] **Step 1: Write the doc** with exactly these sections:
  1. **One paragraph up top** — v2 in three sentences: records on disk are the process; three roles
     act over them; gates fail closed with the user holding the irreducible rungs.
  2. **The three roles** — shaper (fuzzy → spec/plan/kickoff), orchestrator (sequences, dispatches,
     holds gates — *never edits product code*), builder (one unit from one kickoff brief — *sees
     nothing but the brief*). Name them via one link to the quickstart's names table, not inline.
  3. **Records first** — slice dir, manifest, event log; a killed session resumes from records alone;
     "what you remember outside a record is already lost." Cite this repo's own /clear survival as the
     lived proof (one sentence, link dev-state's S2 row or the 0001 retro).
  4. **Gates** — hard gates fail closed; INCONCLUSIVE is not a pass; unwritten verdicts didn't happen;
     the user rungs (spec review, live check) never self-approve; unattended never downgrades. Link
     `cli/schema/enums.yaml` for which gates exist and what passes — enumerate none of them.
  5. **Where the heavy work runs** — research, plan-check, merge-gate, reconcile are subagents that
     return verdicts/digests; the session stays light; reviewer independence (fresh context, different
     model family, reads the diff not the transcript).
  6. **Authorities** — bullet links: doctrine (process law), `cli/schema/enums.yaml` (states/verdicts),
     `cli/README.md` (commands), `docs/quickstart.md` (starting out).
- [ ] **Step 2: Verify** (M2 fold — the no-enum check is now discriminating: it flags any line
  chaining ≥2 enum tokens, while tolerating the planned single mentions like INCONCLUSIVE in §4):
  - `house validate` → exit 0
  - `! grep -qE '(idea|shaping|gating|live_check|shipped|parked|abandoned)[^a-z_].*(idea|shaping|gating|live_check|shipped|parked|abandoned)' docs/process-v2.md`
    → true (no line chains two slice-state tokens; `ready`/`building` are excluded from the token set
    as ordinary English words — the doctrine link, not this doc, owns the full list)
  - `! grep -qE '(GO_WITH_FIXES|NO_GO|INCONCLUSIVE|changes_requested).*(GO_WITH_FIXES|NO_GO|INCONCLUSIVE|approved|changes_requested)' docs/process-v2.md`
    → true (no line chains two verdict tokens)
  - `! grep -v 'quickstart' docs/process-v2.md | grep -q 'house2'` → true (any `house2` mention is on
    a line linking the quickstart table)
- [ ] **Step 3: Commit** — `docs(process-v2): how the v2 system works, for humans`

### Task 3: v1 banner on `docs/process.md` + `docs/process.html`

**Files:** Modify `docs/process.md` (banner directly under the H1), `docs/process.html` (same banner as
one styled block directly after the corresponding title element, inline styles only — the page is
self-contained).

- [ ] **Step 1: Add to `process.md`** under the title line:

```markdown
> **This page describes the v1 process** — still live for repos that have not migrated. The v2
> kernel-based process is proving out now: start with [quickstart](quickstart.md), understand it via
> [process-v2](process-v2.md). The v2 rewrite of this page lands at the cutover (slice 0004, parked).
```

- [ ] **Step 2: Add the equivalent block to `process.html`** right after its `<h1>` (line ~35) — a
  single `<div>` or `<blockquote>` with inline styling consistent with the page. **M1 fold: the html
  banner must NOT link bare `.md` paths** — `docs/.nojekyll` means the Pages mirror serves raw files,
  so a `.md` link renders as plain text. Use GitHub blob URLs
  (`https://github.com/argent-gnome/sdlc-skills/blob/main/docs/quickstart.md` and
  `.../docs/process-v2.md`). The markdown file's banner keeps relative links. Change nothing else in
  either file.
- [ ] **Step 3: Add one inbound link** (folded advisory A2, partial): in root `README.md`'s "How it
  works" section, one sentence linking `docs/quickstart.md` and `docs/process-v2.md`. (The
  `docs/index.html` card is declined — that page is v1 surface; the cutover sweep owns it.)
- [ ] **Step 4: Verify** — `house validate` exit 0; before committing,
  `git diff --numstat docs/process.md docs/process.html` shows 0 deletions on both; banner-present
  checks: `grep -q 'process-v2.md' docs/process.md && grep -q 'blob/main/docs/process-v2' docs/process.html && grep -q 'quickstart' README.md`.
- [ ] **Step 5: Commit** — `docs(process): v1 banner + README inbound links to the v2 docs`

---

## NOT this slice
- NOT the rename (parked in 0004), NOT any change to skills/ or cli/.
- NOT edits to v1 docs beyond the single banner block (`process.md` + `process.html`).
- NOT best-practices/case-study updates — v1 records, left as written.
- NOT restating schema-owned enumerations in prose.

## Plan-check (2026-07-29)

Verdict **GO_WITH_FIXES** (fresh Fable reviewer; record at `gates/plan_check.yaml`). Folded:
- **M1** → html banner uses GitHub blob URLs, never bare `.md` paths (`.nojekyll` = raw serving).
- **M2** → the no-enum grep now flags lines chaining ≥2 enum tokens (single mentions tolerated;
  `ready`/`building` excluded as ordinary English).
- **M3** → the discriminating greps are chained into `tasks.yaml` `verify:`, so the evidence-gated
  task tick enforces them mechanically.
- **A1** → this section now states T3 runs last (matching `depends_on`), not "independent".
- **A2** → partially folded: root README gains one inbound sentence; the `docs/index.html` card is
  **declined** (v1 surface — the cutover sweep owns it), recorded here rather than dropped.
- **A3/A4** → all verifies use `! grep -q` forms (no `grep -c` exit-code trap); token single-mentions
  tolerated by construction.

## Self-review
- Spec coverage: R-1→T1, R-2→T2, R-3→T3; the two grep-checkable scenarios are machine-enforced via
  tasks.yaml verify chains; the two "dev understands" scenarios are the merge-gate reviewer's to judge.
- Ordering: T1 before T2 (T2 links T1's table); T3 last (matches tasks.yaml `depends_on`).
