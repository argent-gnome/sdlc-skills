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

---

## As-built — Unit 01 (reconciled 2026-07-29, branch `slice/0004-house-v2-s3b-proving-pair-migration-and-cutover`)

T1–T4 all `done` with evidence in `tasks.yaml` (each verify chain run as written, exit 0); `house
validate` exit **0**. Commits off `base_sha` `9a39d76`: `ff623c4` (T1) · `8a49e1b` (T2) · `4c61fca`
(T3) · `4a4e411` (T4). Shipped surface: `archive/skills-v1/` (three v1 skills, the v1 doctrine and
`dev-state.template.md`, the two orphaned workflow scripts, plus a new `README.md`); the three v2
skills on canonical `house-*` names; `README.md` · `cli/README.md` · `docs/quickstart.md` ·
`docs/process-v2.md` · `docs/roadmap.md` · `docs/dev-state.md` swept; `install.sh` +21/−3 (prune step
in, v1-workflow echoes out); new `test/install-prune.sh`; `docs/process.md`/`.html` banners reworded;
one dated cutover note in ADR-0004.

**Read this section against the *approved* plan, not the copy above.** The slice branch was cut from
`9a39d76`, which is the **pre-plan-check** draft of this file. The plan-check ran after that commit
and landed on `main` as `cbacd82` — verdict **GO_WITH_FIXES**, record at `gates/plan_check.yaml`
(on `main`), with M1–M3 and A1–A7 folded into `plan.md` and into `tasks.yaml`'s T4 `verify:`. The
builder worked from the kickoff brief, which carried those folds, so the *work* is the folded plan's
work; only this file lags. Nothing below re-litigates a fold — the folded plan is the authority, and
the branch copy of `plan.md` is stale by construction.

### Deviations from the plan as written

- **(a) T2's verify as planned was UNSATISFIABLE and was corrected, not weakened.** T2 Step 3 asked
  for `! grep -rn 'house2' README.md cli/README.md docs/quickstart.md docs/process-v2.md | grep -q .`
  — zero `house2` hits across those four files. That can never be true: the **filename** of the
  decision record, `docs/adr/0004-house2-coexistence-and-advisory-hooks.md`, contains the string
  `house2`, all four files legitimately link it, and renaming that file is an explicit No-Go in both
  the spec and this plan. The shipped check strips **only that one protected token** and then greps:
  `! sed 's/0004-house2-coexistence-and-advisory-hooks//g' README.md cli/README.md docs/quickstart.md
  docs/process-v2.md | grep -q house2`. Proven **discriminating**, not merely satisfiable: it passes
  on the swept tree and **fails** on a copy of the tree with a `house2-shaper` reference reintroduced.
  This is the containment defect the spec's own Problem statement names. Recorded as
  `deviation.raised` at 18:47:21Z; spec R-2's scenario is reconciled to the same wording.

- **(b) T3's verify as planned was a word-presence check; the behavioral test is now the verify.**
  `tasks.yaml`'s T3 read `bash -n install.sh && grep -q 'prune' install.sh && house validate` — which
  a comment containing the word "prune" satisfies. Plan-check **A3** committed the four-case scratch
  test to *be* the verify, so it was scripted as **`test/install-prune.sh`** and wired in:
  `bash -n install.sh && bash test/install-prune.sh && house validate`. `test/install-prune.sh` is a
  **new file the plan's T3 `Files:` line did not anticipate** (it named only "Modify `install.sh`") —
  an addition to the slice's shipped surface, recorded here rather than absorbed. The test is
  hermetic (`CLAUDE_SKILLS_DIR` → a `mktemp -d`; the real `~/.claude/skills` is never touched) and
  seeds four cases plus an idempotency re-run: (a) a dangling link into this repo's `skills/` must be
  pruned, (b) a dangling link pointing **elsewhere** must survive, (c) a valid link must survive
  resolving, (d) a real directory must be untouched. **(b) is the discriminating case** — the test
  was confirmed to **FAIL** against a "prune every dangling link" implementation, which passes (a),
  (c) and (d) while silently deleting another tool's links. That is M1's scope made executable.

- **(c) T4's verify was strengthened beyond the plan text, per M2 and M3.** The plan's T4 Step 4
  checked only `! grep -q 'still live' docs/process.md docs/process.html`. The shipped verify is
  `! grep -in 'still live\|unarchived\|parked\|not done yet' README.md docs/process.md
  docs/process.html` — it adds **`README.md`** (M3: `README.md`'s "still live" and "untouched,
  unarchived, and still the default" lines carry no `house2` token, so no rename grep could ever
  force them) and it adds the **"parked"** and "not done yet" phrases (M2: the banners also claimed
  "The v2 rewrite of this page lands at the cutover (slice 0004, parked)", false the moment the slice
  unparked). Case-insensitive, and it fails closed on any of the four phrases. Strictly a widening.

### The `git log --follow` expectation in T1 Step 5 does not hold, and cannot

T1 Step 5 asked that `git log --follow` "confirm renames (99%+ similarity)". **Git cannot pair these
renames**, and no implementation choice would have changed that: v1 moved *out* of
`skills/house-<role>/SKILL.md` and v2 moved *in* to the same paths **in one commit** (`ff623c4`, which
the plan required precisely so no commit has two claimants to one name). Rename detection sees each
canonical path as *modified*, not renamed, so `git log --follow skills/house-shaper/SKILL.md` and
`git log --follow archive/skills-v1/house-shaper/SKILL.md` both walk back into the **v1** history —
the v2 skills' true ancestry through `skills/house2-*` is not recoverable by `--follow`.

Content integrity was therefore proven **directly against base `9a39d76`** instead of by trusting
rename similarity: every moved file was diffed against its pre-move content, and the two invariants
that matter both hold — the **archived v1 files are byte-identical** to their pre-move content
(nothing was edited on the way into `archive/`), and the **v2 files are identical modulo the
`house2-` → `house-` substitution** (the doctrine's text is unchanged; only path self-references
moved). That evidence is on the T1 commit message. The verify that *did* run and pass is the one in
`tasks.yaml`: `house validate && ! grep -rn 'house2' skills/ install.sh | grep -q .`

### Outstanding — surfaced, not absorbed

- **`docs/index.html` carries a stale "two skills" claim, and this slice did not own it.** Its lede
  (line 28) says "plugin-free **pair** of Claude Code skills", line 44 says "these two skills", and
  the footer reads *"two skills: `house-orchestrator` + `house-builder`"*. Three skills ship, on
  canonical names, as of this cutover — so a **published live surface now carries a false claim**.
  It is out of scope here on the letter of the spec: R-2's live-surface list does not name it, no
  task touched it, no verify covers it, and the No-Gos bar a v2 rewrite of the v1 pages. Surfaced
  rather than fixed, so the merge gate routes it deliberately instead of a doc reconcile absorbing
  scope no gate reviewed. Recorded as a `work.discovered` event and in the roadmap backlog.

  *(Provenance note: an earlier draft of this section asserted that this fix had been folded into
  the approved plan as advisory "A5 / T4 Step 1b" and was lost when the branch was cut. That is
  **not** supported by the records — the plan at base `9a39d76` contains no Step 1b and no A5, and
  this slice has no `plan_check.yaml` gate record at all. The claim was removed rather than
  inherited. The finding itself is real and independently verifiable by reading the file.)*
