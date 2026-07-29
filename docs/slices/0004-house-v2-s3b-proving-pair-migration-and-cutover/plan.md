---
id: "0004-house-v2-s3b-proving-pair-migration-and-cutover"
kind: plan
slice: "0004-house-v2-s3b-proving-pair-migration-and-cutover"
title: "v2 cutover — implementation plan"
status: "planned 2026-07-29"
state: draft
---
# v2 Cutover Implementation Plan

> **For agentic workers:** four tasks, mostly `git mv` + surgical doc edits. The rename inventory in
> `research/migration-cutover.md` is the authoritative list — read its §2 (inventory) and §3 (archive)
> before T1. The kickoff brief in `slice.yaml` is the contract.

**Goal:** v1 archived out of the install path, the three v2 skills on canonical `house-*` names, live
surfaces swept, `install.sh` pruning dangling links, records closed.

**Critical coordination fact (also in the kickoff stakes):** `~/.claude/skills/` symlinks point INTO
this repo's working tree. The moment T1's `git mv` lands on the branch, every `house2-*` skill
invocation on this machine dangles until the user runs `./install.sh` at live_check. Keep the
build-to-merge window short; the BUILDER NEVER runs `install.sh` (user-global state — live_check owns
it, with the user).

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

- [ ] **Step 1:** Before the link loop, add a prune pass over `$SKILLS_DST`: for each entry that is a
  symlink whose resolved target does not exist (`[ -L "$p" ] && [ ! -e "$p" ]`), `rm` it and echo
  what was pruned. Scope: dangling links only — never remove a working link or a real directory.
- [ ] **Step 2:** Sanity-test WITHOUT touching the real global dir: run the script with `SKILLS_DST`
  pointed at a scratch dir (if the script hardcodes the destination, export/override the variable it
  uses — read the script first) containing (a) a dangling symlink, (b) a valid symlink to a real v2
  skill dir, (c) a real directory. Expect: (a) pruned, (b) and (c) untouched, links created for all
  `skills/*/`. Run twice — second run is a no-op (idempotent).
- [ ] **Step 3: Verify** — `bash -n install.sh`; the scratch-dir test above green; `house validate`
  exit 0. Do NOT run against the real `~/.claude/skills` — that is live_check's step with the user.
- [ ] **Step 4: Commit** — `feat(install): prune dangling skill symlinks before linking`

### Task 4: records close the loop

**Files:** `docs/process.md`, `docs/process.html`, `docs/adr/0004-house2-coexistence-and-advisory-hooks.md`,
`docs/roadmap.md` (S3b row), `docs/dev-state.md` (manual block).

- [ ] **Step 1:** Reword both banners: "still live for repos that have not migrated" → "retired at
  the 2026-07-29 cutover; archived at `archive/skills-v1/`" — md keeps relative links, html keeps
  blob URLs (add one for the archive README). No other line of either file changes (0 deletions
  beyond the banner lines themselves being edited in place — `--numstat` shows only the banner hunk).
- [ ] **Step 2:** ADR-0004: one dated line at the end of the Decision §1 block: "*Cutover executed
  2026-07-29 (slice 0004): rename done, v1 archived at `archive/skills-v1/`, coexistence window
  closed.*" Nothing else in the ADR changes.
- [ ] **Step 3:** Roadmap S3b row → building/shipped-at-cutover truth; dev-state manual block next
  action → the live_check coordination steps (R-5 verbatim: merge → `./install.sh` → namespace
  verify → `/reload-skills`).
- [ ] **Step 4: Verify** — `house validate` exit 0; `! grep -q 'still live' docs/process.md
  docs/process.html` → true; `grep -q 'Cutover executed' docs/adr/0004-*.md` → true.
- [ ] **Step 5: Commit** — `docs(cutover): banners + ADR-0004 closure note + board truth`

---

## NOT this slice
- NOT renaming `docs/adr/0004-house2-coexistence-and-advisory-hooks.md` (the record OF the decision).
- NOT touching historical records: `docs/slices/*` specs/plans/research, `.house/events.jsonl`,
  retros, ADR bodies (beyond ADR-0004's short cutover-done note, R-4).
- NOT any change under `cli/` (the CLI has no `house2` references).
- NOT deleting v1 content — archive, never erase.
- NOT running `install.sh` against the real global skills dir — live_check owns that, with the user.

## Self-review
- Spec coverage: R-1→T1 (steps 1–3), R-2→T1 step 4 + T2, R-3→T3, R-4→T4, R-5→T4 step 3 (written
  into dev-state) + the live_check itself. No gaps.
- The one judgment area is T2's roadmap/dev-state historical-mention rule — the unit report must
  list every surviving `house2` hit with its justification, so the merge-gate reviewer re-judges
  each rather than trusting the sweep.
- Ordering: T1 first (everything else references new paths), T2/T3 independent after it, T4 last
  (records describe the finished state).
