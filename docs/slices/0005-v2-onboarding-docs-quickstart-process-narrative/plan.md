---
id: "0005-v2-onboarding-docs-quickstart-process-narrative"
kind: plan
slice: "0005-v2-onboarding-docs-quickstart-process-narrative"
title: "v2 onboarding docs — implementation plan"
status: "planned 2026-07-29"
state: draft
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
     → shaper / conductor / builder roles) with the caption: *these are migration-window names; they
     become `house-*` at the parked cutover (slice 0004).* This table is the file's ONLY `house2` text.
- [ ] **Step 2: Verify** — run and require all three:
  - `house validate` → exit 0
  - `grep -n 'house2' docs/quickstart.md` → every hit within the names-table block (±2 lines of it)
  - `grep -c '^## ' docs/quickstart.md` → 6 sections
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
- [ ] **Step 2: Verify** — all three:
  - `house validate` → exit 0
  - `grep -nE 'idea.*shaping.*ready|GO_WITH_FIXES.*NO_GO' docs/process-v2.md` → no hits (no enum
    restating)
  - `grep -c 'house2' docs/process-v2.md` → 0 or every hit a link to the quickstart table
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

- [ ] **Step 2: Add the equivalent block to `process.html`** right after its `<h1>` — a single `<div>`
  or `<blockquote>` with inline styling consistent with the page, linking `quickstart.md` and
  `process-v2.md`. Change nothing else in either file (`git diff --stat` must show only additions).
- [ ] **Step 3: Verify** — `house validate` exit 0; `git diff --stat docs/process.md docs/process.html`
  shows only insertions (0 deletions).
- [ ] **Step 4: Commit** — `docs(process): v1 banner pointing at the v2 quickstart + narrative`

---

## NOT this slice
- NOT the rename (parked in 0004), NOT any change to skills/ or cli/.
- NOT edits to v1 docs beyond the single banner block (`process.md` + `process.html`).
- NOT best-practices/case-study updates — v1 records, left as written.
- NOT restating schema-owned enumerations in prose.

## Self-review
- Spec coverage: R-1→T1, R-2→T2, R-3→T3; every scenario has a matching verify grep. No gaps.
- The names-containment and no-enum greps are the discriminating checks — they encode the spec's two
  grep-checkable scenarios verbatim.
- Ordering: T1 before T2 (T2 links T1's table); T3 independent, last for a single-diff banner check.
