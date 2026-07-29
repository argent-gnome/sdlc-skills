---
id: "0004-house-v2-s3b-proving-pair-migration-and-cutover"
kind: plan
slice: "0004-house-v2-s3b-proving-pair-migration-and-cutover"
title: "v2 cutover — implementation plan"
status: "planned 2026-07-29; plan-check GO_WITH_FIXES folded"
state: approved
---
# v2 Cutover Implementation Plan

> **For agentic workers:** four tasks, mostly `git mv` + surgical doc edits. Read
> `research/migration-cutover.md` §2 (inventory) and §3 (archive) before T1 — then **re-grep at build
> start** (A2 fold: the digest counted 34 lines/8 files; slice 0005 landed more; plan-check measured
> 40/10 — the grep, not the digest, is authoritative). The kickoff brief is the contract.

**Goal:** v1 archived out of the install path, the three v2 skills on canonical `house-*` names, live
surfaces swept, `install.sh` pruning dangling links, records closed.

**Critical coordination fact (A4 fold — build in a WORKTREE):** `~/.claude/skills/` symlinks point
INTO this repo's main working tree. Therefore the build runs in a **git worktree** on the slice
branch, and the main checkout stays on `main` untouched — the machine-global namespace only changes
when the merge lands, at live_check, with the user present running `./install.sh` immediately after.
The BUILDER NEVER runs `install.sh` against the real global dir (live_check owns it, with the user),
and never checks the slice branch out in the main working tree.

---

### Task 1: archive v1 + rename v2 — one commit, no name collisions

**Files:** `git mv skills/house-shaper archive/skills-v1/house-shaper` (same for `house-orchestrator`
incl. its `workflows/` and `doctrine.md` reference, and `house-builder`); then
`git mv skills/house2-shaper skills/house-shaper`, `git mv skills/house2-orchestrator
skills/house-orchestrator`, `git mv skills/house2-builder skills/house-builder`. Create
`archive/skills-v1/README.md`. Edit `install.sh` (drop the three trailing v1-workflow echo lines).

- [ ] **Step 1:** `mkdir -p archive/skills-v1` and the six `git mv`s above, v1 out before v2 in.
- [ ] **Step 2:** Write `archive/skills-v1/README.md` (~10 lines): what these are (the v1 house
  skills + two workflow scripts), retired 2026-07-29 at the ADR-0004 cutover (relative link
  `../../docs/adr/0004-house2-coexistence-and-advisory-hooks.md`), both workflows were orphaned
  (nothing invoked them) and re-adoption means a rewrite, re-link by hand from here if a v1 repo
  truly needs the old flow.
- [ ] **Step 3:** Remove `install.sh`'s trailing echo lines that reference v1 workflow `scriptPath`s
  (research §2d pins them at the end of the file). Touch nothing else in it yet (T3 owns the prune).
- [ ] **Step 4: Fix intra-skill path references.** In the three moved v2 skills, update every
  `house2` path/name to canonical — notably `skills/house-shaper/SKILL.md`'s doctrine pointer
  (`$HOME/.claude/skills/house-orchestrator/references/doctrine.md`) and any self-references. The
  doctrine file's CONTENT stays byte-identical except path self-references if any exist (verify with
  `grep -n house2 skills/house-orchestrator/references/doctrine.md`).
- [ ] **Step 5: Verify** — `ls skills/` shows exactly the canonical trio (+ nothing `house2`);
  `git log --follow` confirms renames (99%+ similarity); `house validate` exit 0;
  `! grep -rn 'house2' skills/ install.sh | grep -q .` → true.
- [ ] **Step 6: Commit** — `feat(cutover): archive v1 skills, rename house2-* to canonical house-*`

### Task 2: live-surface sweep

**Files:** `README.md`, `cli/README.md`, `docs/quickstart.md`, `docs/process-v2.md`,
`docs/roadmap.md`, `docs/dev-state.md` (manual block only).

- [ ] **Step 1:** Sweep each file per the research §2 inventory: every `house2` name/path becomes
  canonical. In `docs/quickstart.md`, the names table drops its migration-caption row (the names ARE
  canonical now) and the ADR-0004 link may move to normal prose (the containment rule died with the
  old names). In `docs/roadmap.md`/`docs/dev-state.md`, forward-looking lines sweep to canonical;
  lines narrating history may keep the old name ONLY inside an explicit past-tense construction
  (e.g. "shipped as `house2-*`, renamed at the cutover") — no bare live reference survives.
  **M3 fold — tokenless stale claims swept by name, since no `house2` grep can catch them:**
  `README.md:22-23` ("v1 is untouched, unarchived, and still the default until a repo migrates") and
  `README.md:52` (the "still live" How-it-works line) reword to the archived reality.
  **A7 fold:** `docs/dev-state.md:53-54`'s "coexistence window stays open until athlete-data ships"
  and the roadmap's "parked" narratives become false at ship — sweep them here (T4 re-verifies).
- [ ] **Step 2:** `house render dev-state` (generated block must survive untouched; manual block
  edited by hand is expected).
- [ ] **Step 3: Verify** — `house validate` exit 0;
  `! grep -rn 'house2' README.md cli/README.md docs/quickstart.md docs/process-v2.md | grep -q .` →
  true (these four sweep to zero); `grep -n 'house2' docs/roadmap.md docs/dev-state.md` → every
  remaining hit is inside a past-tense/renamed-at-cutover construction (eyeball each; list them in
  the unit report).
- [ ] **Step 4: Commit** — `docs(cutover): live surfaces to canonical names`

### Task 3: `install.sh` prune step

**Files:** Modify `install.sh` (the link loop area, research §2d: `for dir in "$SKILLS_SRC"/*/; do …
ln -s …`).

- [ ] **Step 1 (M1 fold — spec R-3 scope):** Before the link loop, add a prune pass over
  `$SKILLS_DST`: remove an entry ONLY if it is a symlink AND dangling AND its `readlink` target
  points under **this repo's** `$SKILLS_SRC` (`case "$(readlink "$p")" in "$SKILLS_SRC"/*) …`).
  Another tool's dangling link is not ours to delete. Echo what was pruned. Never touch a working
  link or a real directory.
- [ ] **Step 2 (A1 fold):** Sanity-test WITHOUT touching the real global dir: the destination
  override is `CLAUDE_SKILLS_DIR` (`install.sh:8` — `SKILLS_DST="${CLAUDE_SKILLS_DIR:-…}"`; exporting
  `SKILLS_DST` does nothing). Note the scratch run also executes the npm-install block under
  `set -e` — expected, let it run. Scratch dir seeded with: (a) a dangling symlink into
  `$SKILLS_SRC`, (b) a dangling symlink pointing elsewhere (must SURVIVE — M1's scope), (c) a valid
  symlink to a real v2 skill dir, (d) a real directory. Expect: only (a) pruned; links created for
  all `skills/*/`. Run twice — second run a no-op (idempotent). (A3 fold: this exact seeded test is
  the behavioral verify; script it in the worktree and paste its output in the unit report.)
- [ ] **Step 3: Verify** — `bash -n install.sh`; the seeded scratch test green twice; `house
  validate` exit 0. Do NOT run against the real `~/.claude/skills` — that is live_check's step with
  the user.
- [ ] **Step 4: Commit** — `feat(install): prune dangling skill symlinks before linking`

### Task 4: records close the loop

**Files:** `docs/process.md`, `docs/process.html`, `docs/adr/0004-house2-coexistence-and-advisory-hooks.md`,
`docs/roadmap.md` (S3b row), `docs/dev-state.md` (manual block).

- [ ] **Step 1 (M2 fold — reword the WHOLE banner, both false claims):** in `docs/process.md:4-6`
  and the matching `process.html` block (~line 40): (a) "still live for repos that have not migrated"
  → "retired at the 2026-07-29 cutover; archived at `archive/skills-v1/`"; (b) "The v2 rewrite of
  this page lands at the cutover (slice 0004, parked)" → "the v2 rewrite of this page is a future
  slice" (0004 is neither parked nor the rewrite's owner). md keeps relative links, html keeps blob
  URLs (add one for the archive README). No other line of either file changes.
- [ ] **Step 1b (A5 fold):** `docs/index.html:51` footer claims "two skills: `house-orchestrator` +
  `house-builder`" — factually wrong post-cutover (three skills, canonical names). One-line
  correction, nothing else on that page.
- [ ] **Step 2:** ADR-0004: one dated line at the end of the Decision §1 block: "*Cutover executed
  2026-07-29 (slice 0004): rename done, v1 archived at `archive/skills-v1/`, coexistence window
  closed.*" Nothing else in the ADR changes.
- [ ] **Step 3:** Roadmap S3b row → building/shipped-at-cutover truth; dev-state manual block next
  action → the live_check coordination steps (R-5 verbatim: merge → `./install.sh` → namespace
  verify → `/reload-skills`).
- [ ] **Step 4: Verify** (M2/M3 folds widen the net; note `! grep -l` also inverts a missing-file
  exit 2 — confirm the files exist first, A6):
  `house validate` exit 0;
  `! grep -l 'still live' docs/process.md docs/process.html README.md | grep -q .` → true;
  `! grep -l '0004, parked' docs/process.md docs/process.html | grep -q .` → true;
  `grep -q 'Cutover executed' docs/adr/0004-house2-coexistence-and-advisory-hooks.md` → true.
- [ ] **Step 5: Commit** — `docs(cutover): banners + ADR-0004 closure note + board truth`

---

## NOT this slice
- NOT renaming `docs/adr/0004-house2-coexistence-and-advisory-hooks.md` (the record OF the decision).
- NOT touching historical records: `docs/slices/*` specs/plans/research, `.house/events.jsonl`,
  retros, ADR bodies (beyond ADR-0004's short cutover-done note, R-4).
- NOT any change under `cli/` (the CLI has no `house2` references).
- NOT deleting v1 content — archive, never erase.
- NOT running `install.sh` against the real global skills dir — live_check owns that, with the user.

## Plan-check (2026-07-29)

Verdict **GO_WITH_FIXES** (fresh Fable reviewer; record at `gates/plan_check.yaml`). Folded:
- **M1** → prune scope narrowed to dangling links whose `readlink` target is under this repo's
  `$SKILLS_SRC` — other tools' links survive.
- **M2** → the full banner rewords, including the now-false "(slice 0004, parked)" sentence; verify
  checks both phrases.
- **M3** → README's tokenless "still live"/"unarchived, still the default" lines named in T2 and
  netted by T4's widened verify.
- **A1** → scratch override is `CLAUDE_SKILLS_DIR`; npm block runs under `set -e`, expected.
- **A2** → re-grep at build start; the digest inventory is input, not authority (40 lines/10 files at
  plan-check time).
- **A3** → the seeded four-case scratch test is the T3 behavioral verify, output pasted in the unit
  report.
- **A4** → the build runs in a git worktree; main checkout stays on `main`; the global namespace
  changes only at merge, with the user present.
- **A5** → `docs/index.html:51` footer's stale two-skills claim corrected (one line).
- **A6** → missing-file inversion noted in T4's verify.
- **A7** → dev-state/roadmap "parked / coexistence window open" narratives named in T2's sweep.

## Self-review
- Spec coverage: R-1→T1 (steps 1–3), R-2→T1 step 4 + T2, R-3→T3, R-4→T4, R-5→T4 step 3 (written
  into dev-state) + the live_check itself. No gaps.
- The one judgment area is T2's roadmap/dev-state historical-mention rule — the unit report must
  list every surviving `house2` hit with its justification, so the merge-gate reviewer re-judges
  each rather than trusting the sweep.
- Ordering: T1 first (everything else references new paths), T2/T3 independent after it, T4 last
  (records describe the finished state).
