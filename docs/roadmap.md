# sdlc-skills — Roadmap

> Durable strategy: sequencing, gating dependencies, milestones, deferred work. Operational state
> (what's building right now) lives in [`dev-state.md`](dev-state.md); the *why* behind a call lives in
> [`adr/`](adr/).

## What this is

This repo owns the **house SDLC** — the three skills (`house-shaper` · `house-orchestrator` ·
`house-builder`) plus the shared docs & hygiene doctrine that every other project of Jake's runs its
development loop through. The next chapter is **house v2**: a state-first kernel (`house` CLI + on-disk
records) that gives the process a machine-readable skeleton, so agents and the coming desktop IDE read the
same truth. See [ADR-0002](adr/0002-house-v2-state-first-redesign.md).

## house v2 program

Shaped 2026-07-28. Spec: [`superpowers/specs/2026-07-28-house-v2-design.md`](superpowers/specs/2026-07-28-house-v2-design.md).
Decision: [ADR-0002](adr/0002-house-v2-state-first-redesign.md). The CLI ships before the skills, and both
ship before the IDE — the contract must be true from a bare terminal on day one. The program spec §4's
**blocking** hooks and the v1→canonical skill cutover are both pushed to **S3+** per
[ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md): S2 shipped advisory hooks and the v2 skills
alongside untouched v1, under temporary `house2-*` names that were renamed to canonical at the S3b cutover.

| # | Slice | Status |
|---|---|---|
| S1 | **Kernel + `house` CLI** — `schema/enums.yaml`, slice-dir scaffold, events.jsonl, `house new/init/event/gate/task/state/status/list/next/validate/index/render`. Dogfooded on this repo. Plan: [`superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md`](superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md) | **Shipped 2026-07-28** — [PR #6](https://github.com/argent-gnome/sdlc-skills/pull/6) merged to `main` (`4a6a906`); retro: [`retros/2026-07-28-house-v2-s1-kernel-cli-retro.md`](retros/2026-07-28-house-v2-s1-kernel-cli-retro.md). All 11 plan tasks shipped TDD, 43/43 tests, `house validate` exit 0, repo dogfooded (`.house/`, slice `0001` minted, dev-state generated). Merge gate **GO** with one condition (the `renderDevState` letter-gap) plus findings folded to the [S2 carry list](#s2-carry-list--fold-forward-from-s1). Two deviations (test script under Node 26; a real silent-drop bug in the plan's literal `renderDevState`, fixed) + spec drift on `slice.merged`/roadmap-lint/ADR `status:` — all recorded in the plan's As-built section |
| S2 | **Skills rewrite + doctrine v2 + hooks** — shaper/orchestrator/builder as thin actors over shared state; canonical stage table, one rigor dial, take/suppress/own composition contract; hooks wired into `.claude/settings.json`. Slice `[0001]` — spec: [`slices/0001-house-v2-s2-skills-rewrite/spec.md`](slices/0001-house-v2-s2-skills-rewrite/spec.md); plan: [`slices/0001-house-v2-s2-skills-rewrite/plan.md`](slices/0001-house-v2-s2-skills-rewrite/plan.md) | **Shipped 2026-07-28** — [PR #8](https://github.com/argent-gnome/sdlc-skills/pull/8) merged to `main` (`5791e71`); retro: [`slices/0001-house-v2-s2-skills-rewrite/retro.md`](slices/0001-house-v2-s2-skills-rewrite/retro.md). **17/17 tasks** across 3 units (CLI enablers → doctrine v2 + three `house2-*` skills → smoke slice + closeout), suite 43→67 tests, `house validate --strict` exit 0. Merge gate **NO_GO→GO**: the NO_GO was the retro draft tripping the strict NEEDS-CLARIFICATION substring check (proving that backlog finding twice); fix `38c128a` was records-only, and the re-gate GO surfaced a fourth `work.discovered` — the `house gate` `--actor` drop, in [the smoke backlog](#backlog--discovered-in-the-0002-smoke-run-2026-07-28) below. `live_check` **user-approved**. Shaped the same day, appetite **3 sessions** held: spec user-approved (`gates/spec_review.yaml`); plan-check **GO_WITH_FIXES** (`gates/plan_check.yaml`) with all 5 must-fix + 7 advisories folded into the plan. Shaping decisions — `house2-*` coexistence, advisory-only hooks, `slice.shipped` over `slice.merged` — recorded in [ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md). **Smoke slice `[0002]` SHIPPED 2026-07-28** — `house --version` (patch tier, 1 task; spec: [`slices/0002-house-version-flag/spec.md`](slices/0002-house-version-flag/spec.md)) was driven end-to-end through the three `house2-*` skills as R-13's done bar: shaped (spec user-approved; plan-check **GO_WITH_FIXES** folded; kickoff brief v1) → built (unit 01 DONE; T1 evidence-ticked, 67/67 tests) → merge gate **GO with zero findings** (reviewer re-ran tests + validate + manual `--version` checks personally) → live_check **approved** by the user → shipped. No PR: its branch was ff-merged into the S2 branch at `2c2d16b`, so the smoke's code rides S2's merge-gate diff while its gates ran per-slice on `[0002]`'s own records. U3-T17 is done (`house validate --strict` exit 0) with a recorded deviation — unit 03 had finalized BLOCKED at the `[0002]` spec_review halt; the orchestrator ticked T17 inline once the user cleared it. Three `work.discovered` findings from the smoke → [the smoke backlog](#backlog--discovered-in-the-0002-smoke-run-2026-07-28). Carries from S1: see [the S2 carry list](#s2-carry-list--fold-forward-from-s1) below |
| S3a | **Smoke-findings kernel fixes** — close the four `work.discovered` findings from the `[0002]` smoke run before anything else rides on the kernel: strict-marker matcher that only matches well-formed markers in handoff artifacts, with `--slice` scoping that fails closed (R-1); approval-boundary cross-check between `slice.yaml` and doc frontmatter (R-2); `gate.recorded` events carry a record reference + detail keys + notes instead of dropping `--payload` (R-3); one actor spelling, `--actor` canonical with `--by` as legacy alias (R-4); and the root enabler the smoke exposed — **unknown flags fail closed** per command (R-5). Slice `[0003]` — spec: [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md); plan: [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md) | **Shipped 2026-07-29** — [PR #9](https://github.com/argent-gnome/sdlc-skills/pull/9) merged to `main` (`6778532`, 2026-07-29T01:24:12Z); retro: [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/retro.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/retro.md). **5/5 tasks** in one unit; merge gate **GO with zero findings on the first pass** (S2 needed a NO_GO lap; the difference was folding all seven plan-check items before dispatch and handing the reviewer the on-record exceptions to verify rather than re-raise); `live_check` **user-approved** — the user hand-exercised every fix. The slice-tier retro was **enforced by the validator**: the orchestrator flipped `slice.shipped` before writing it, `house validate` went red, the retro was written, green — recorded in the retro itself as a process finding. All five requirements are code: strict matcher + `--slice` scoping, approval-boundary cross-check, gate-event record reference, `--actor` canonical, per-command unknown-flag guard; suite **67 → 72 tests**, `house validate` exit 0, built verbatim to plan with **zero deviations** (as-built in the plan). One limitation recorded, not fixed: the R-1 fence-stripper is defeated by a fence quoted inside a fence, which is why `--strict` still trips on `[0003]`'s own `plan.md` — [the `[0003]` build backlog](#backlog--discovered-in-the-0003-build-2026-07-29) below. Shaped **2026-07-29**: appetite **1 session**, one unit, 5 tasks. Tier **bumped patch → slice** at shaping (user call): R-1 changes what the shaper's handoff bar *asserts*, which is doctrine, not lint. Spec **user-approved** (`gates/spec_review.yaml`); plan-check **GO_WITH_FIXES** (`gates/plan_check.yaml`, fresh Fable reviewer, five lenses) with both must-fixes (M1 frontmatter reconcile as a dispatch precondition; M2 the T4 test rewritten to `cli.test.js`'s real `run(cwd, …)` → `{out, code}` seam) and all five advisories (A1–A5) folded into the plan; kickoff brief **v1** written into `slice.yaml`. Research digest: [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/research/backlog-fixes.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/research/backlog-fixes.md) — each finding reproduced against a scratch house repo, no CLI changed. The same shaping pass recorded the [ADR-0001](adr/0001-fable-profile-model-routing.md) **erratum** (hard gates halt rather than downgrade the reviewer when Fable is unavailable), `adr_review` **approved** by the user. Branch `slice/0003-…` deleted local + remote post-merge. Next was **S3b** — its "after S3a" condition is now satisfied — but S3b was shaped, rescoped, and **parked** the same day (see the S3b row) |
| S3b | **v2 cutover (rename + v1 archive)** — owned the rename to canonical names and the v1 skill archive, and *only* that: per [ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md) a migration-window name surviving the cutover is a defect, not a convention, so the slice swept every doc/prompt/`install.sh` line that still hardcoded one. Slice `[0004]` — spec: [`slices/0004-house-v2-s3b-proving-pair-migration-and-cutover/spec.md`](slices/0004-house-v2-s3b-proving-pair-migration-and-cutover/spec.md); plan: [`slices/0004-…/plan.md`](slices/0004-house-v2-s3b-proving-pair-migration-and-cutover/plan.md). **Scope was cut at shaping** — see the status cell and [the S3b scope change](#s3b-scope-change--the-proving-pair-corrected-2026-07-29) | **Shipped 2026-07-29** — [PR #11](https://github.com/argent-gnome/sdlc-skills/pull/11) merged to `main` (`183d3ce`, 2026-07-29T19:26:48Z); retro: [`slices/0004-…/retro.md`](slices/0004-house-v2-s3b-proving-pair-migration-and-cutover/retro.md), written **before** the `shipped` flip — the lesson `[0003]`'s validator taught. Unparked the same day it was parked: the cutover condition was **ruled satisfied by the user** (athlete-data shipped its first v2 slice end-to-end; the one letter-gap — an adopted rather than fresh pre-build `plan_check` — is recorded in the slice's `deviation.raised`). **4/4 tasks** in one unit: v1 archived to [`archive/skills-v1/`](../archive/skills-v1/) (seven skill files plus two orphaned workflows, byte-identical to their pre-move content, outside the `skills/*/` install glob), the three v2 skills took the canonical `house-*` names **in the same commit** (`ff623c4`, so no commit has two claimants to one path), live surfaces swept with history preserved as written, and `install.sh` gained a **prune** for dangling links scoped to this repo's own `skills/` (`test/install-prune.sh`, four seeded cases + idempotency; the discriminating case is that *another* tool's dangling link must survive). Merge gate **GO on the first pass** across four lenses (rename-integrity · sweep-history · prune · records), the reviewer re-running everything itself — 72/72 tests, `house validate` exit 0, every task verify, plus a tampered-copy check proving the corrected T2 grep discriminating. **`live_check` *was* the cutover**, executed as a coordinated session with the user in order: merge → `./install.sh` (pruned **3** dangling `house2-*` links, linked the canonical trio) → namespace verified **3 canonical / 0 `house2` / 0 dangling** → `/reload-skills` → user confirmed. Unit 01 finalized **DEVIATION** with a full disclosure trail, all four items ruled on record before the gate: T2's planned verify was *unsatisfiable* against the protected ADR-0004 **filename** and was corrected to a discriminating form; `cli/README.md` was swept per spec R-2 over a literally-worded scope guard (orchestrator ruled the spec wins, the guard meant code); `test/install-prune.sh` is a new file the plan's `Files:` line never named; and the builder minted its own unit record. **One orchestrator error, disclosed not buried:** the dispatch chain cut the slice branch at pre-fold HEAD `9a39d76` and committed the plan-check record, the folds and the kickoff to `main` *afterwards*, so the builder built without them — the root cause of its two strangest findings. Fixed by merging `main` into the branch and reconciling four record conflicts; the lesson (*commit every shaping record BEFORE cutting the branch —* `base_sha` *must point at the full record*) is a retro follow-up owed to the orchestrator skill or doctrine §4 at the next doctrine-touching slice. Branch `slice/0004-…` and both agent worktrees torn down post-merge. Prior state: **PARKED 2026-07-29**, minted as `[0004]` and retitled *"house v2 S3b — v2 cutover (rename + v1 archive)"*; the migration half of the old scope is **gone** — this repo was already proven, and the second repo changed. Research digest that carried through the unpark: [`slices/0004-…/research/migration-cutover.md`](slices/0004-house-v2-s3b-proving-pair-migration-and-cutover/research/migration-cutover.md). Decision of record: the **2026-07-29 amendment** to [ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md) (`adr_review` approved, `gates/adr_review.yaml` under `[0004]`), now carrying its *cutover executed* note |
| Docs | **v2 onboarding docs — quickstart + process narrative** — the two human-facing docs the program never had: `docs/quickstart.md` (install once, the four-command new-project startup, seeding `.house/gates.yml`, invoking the shaper, and the adoption path for already-shaped work) and `docs/process-v2.md` (the three roles and their invariants, the records-first substrate, the gate model, where the heavy subagent work runs), plus a v1 banner on `docs/process.md`/`.html` so nobody onboards onto the retired track by accident. Slice `[0005]` — spec: [`slices/0005-v2-onboarding-docs-quickstart-process-narrative/spec.md`](slices/0005-v2-onboarding-docs-quickstart-process-narrative/spec.md); plan: [`slices/0005-v2-onboarding-docs-quickstart-process-narrative/plan.md`](slices/0005-v2-onboarding-docs-quickstart-process-narrative/plan.md) | **Shipped 2026-07-29** — [PR #10](https://github.com/argent-gnome/sdlc-skills/pull/10) merged to `main` (`cc45430`); no retro (docs-only, **patch** tier — retros are owed at slice tier and above). **3/3 tasks** in one unit, appetite 0.5 session, shaped and dispatched and shipped the same day. Plan-check **GO_WITH_FIXES**, all folds in the plan (M1 html banner uses GitHub blob URLs — `.nojekyll` serves raw, so a bare `.md` link renders as text; M2/M3 the names-containment and no-enum-chaining greps are wired into `tasks.yaml` `verify:` so the evidence gate enforces them); merge gate **GO** with two notes-not-findings; `live_check` **user-approved**, the user reading both docs as the audience proxy. As-built and its two forced deviations are in the plan. **Sequencing:** it was independent of S3b — it documented the v2 process *under its migration-window names*, deliberately name-light so [`[0004]`](#s3b-scope-change--the-proving-pair-corrected-2026-07-29)'s rename sweep grew by one table block instead of dozens of lines; that block is now swept. **What it handed the cutover, and what the cutover did not take:** both new docs are markdown-only on purpose — the `docs/index.html` card was **declined** at plan-check on the expectation that `[0004]` would inherit linking and mirroring them. `[0004]` **did not** take it (its own No-Go bars a v2 rewrite of the v1 pages), so `docs/index.html` was left unowned — recorded in [the `[0004]` build backlog](#backlog--discovered-in-the-0004-build-2026-07-29). **That hole is now owned and closed: slice `[0006]` shipped 2026-07-29** (the Pages row below) — it rewrote `index.html`, gave it the two cards `[0005]` declined, and hand-rendered the `.html` mirrors these two docs shipped without — so `docs/quickstart.md` and `docs/process-v2.md` are no longer markdown-only, and neither doc's *content* was touched to get there |
| Pages | **public pages refresh — retire v1 pages, publish current docs** — the published site still served the v1 world (`process.html` banner'd but describing the retired loop, `best-practices.html`, `case-study.html`) while `index.html`'s lede and body claimed a two-skill ecosystem and the current docs rendered nowhere (`.nojekyll` serves markdown raw). Retires the three v1 pages *and their markdown sources* to `archive/docs-v1/` (archive, never erase — the `archive/skills-v1/` precedent), rewrites `index.html` around the three skills + the kernel, and adds hand-rendered mirrors `docs/quickstart.html` + `docs/process.html` (the latter deliberately taking the retired page's URL so old links land on current truth). Slice `[0006]` — spec: [`slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/spec.md`](slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/spec.md); plan: [`slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/plan.md`](slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/plan.md) | **Shipped 2026-07-29** — [PR #12](https://github.com/argent-gnome/sdlc-skills/pull/12) merged to `main` (`3a4c17a`, 2026-07-29T23:28:01Z); retro: [`slices/0006-…/retro.md`](slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/retro.md), written **before** the `shipped` flip. **3/3 tasks** in one unit, docs-only, **patch** tier, appetite 0.5 session held. Shipped surface: the three v1 pages (md + html) archived **byte-identical** to [`archive/docs-v1/`](../archive/docs-v1/), `docs/index.html` rewritten around the three canonical skills + the kernel with a card to each mirror, and the two hand-rendered mirrors `docs/quickstart.html` + `docs/process.html` — the latter taking over the retired page's URL so old inbound links land on current truth. Merge gate **GO with zero findings** across four lenses (mirror-fidelity · link-policy · regression-archive · public-accuracy), the reviewer re-running everything itself: 14/14 anchor census, 28-href link census, 6/6 byte-identical archive verification, 72/72 tests, `house validate` exit 0, and the page's public claims cross-checked against the code they describe. `live_check` **user-approved after the merge**, against the real deploy rather than the working tree: `/`, `/quickstart.html`, `/process.html` all **200**; the retired `/best-practices.html` and `/case-study.html` **404**. **That 404 is a ruling, not an omission** — the owner decided no redirect stubs and no index signpost; the content survives in `archive/docs-v1/`, reachable from the repo rather than the site, and the reviewer independently confirmed spec R-1's no-dead-links scenario governs outbound links *from* live surfaces, not inbound URLs. Unit 01 finalized **DEVIATION** with **three text-scope disclosures, all accepted on record pre-gate**: the quickstart nav *label* (`the house SDLC` → `the v1 process` — href-only retargeting would have shipped the exact misleading-public-face defect the spec exists to prevent), README parentheticals that had become false statements about `docs/process.html` still being published, and a `home` nav link in both mirrors that neither markdown nav had. Same pattern as `[0004]`: a literal scope guard that contradicts the spec loses to the spec, and the builder is right to say so out loud. Two `work.discovered` findings → [the `[0006]` backlog](#backlog--discovered-in-the-0006-build-2026-07-29). Shaped the same day: spec **user-approved** (manual mirrors accepted over any generator), plan-check **GO_WITH_FIXES** with both must-fixes and all six advisories folded — **M1** is why this row's `[0004]`/`[0005]` neighbours still name `docs/process.md`/`.html`: historical prose in shipped records is exempt by construction and was never reworded to satisfy a link check. As-built in the plan; branch torn down post-merge |
| Fix | **`validate --strict` nested-fence false positive** — the `[0003]`-build backlog item, minted. Replaces the byte-oriented `` ```…``` `` regex pair in `cli/lib/validate.js` with **line-oriented fence tracking**, so a three-backtick run appearing mid-line inside a string literal stops being read as a fence at all; reorders stripping to fences → HTML comments → code spans; picks up `~~~` fences, which the current stripper never handled. Slice `[0007]` — spec: [`slices/0007-validate-strict-nested-fence-false-positive/spec.md`](slices/0007-validate-strict-nested-fence-false-positive/spec.md); plan: [`slices/0007-validate-strict-nested-fence-false-positive/plan.md`](slices/0007-validate-strict-nested-fence-false-positive/plan.md) | **Shipped 2026-07-30** — [PR #13](https://github.com/argent-gnome/sdlc-skills/pull/13) merged to `main` as squash `85731f3`; `main` is at `2245f09` and pushed. All four gates on record: `spec_review` **approved** (jed), `plan_check` **GO_WITH_FIXES** (Fable), `merge_gate` **GO** (`fable-reviewer`), `live_check` **approved** — the user ran `house validate --strict` himself from a bare terminal on merged `main`, no output, exit 0, which is the [ADR-0003](adr/0003-no-hosted-ci-local-verification.md) bar this slice exists to protect, confirmed by a human rather than inherited from the reviewer's run. **The repo's last `--strict` red is gone:** on merged `main`, 77/77 tests, `house validate` exit 0, `house validate --strict` exit 0, with `docs/slices/0003-…/plan.md` **byte-identical** (blob `178a1e9`) — the residual carried since the `[0003]` build is closed as a *consequence* of the fix, not by editing the document. Hygiene complete: slice branch deleted local and remote, stale tracking ref pruned, one worktree, no stashes, tree clean. **One `work.discovered` at the ship, and it is the biggest thing this slice produced that was not the fix** — the merge landed a **strict superset** of the reviewed diff, because `base_sha` pointed at a local-only commit; benign here, verified so, and a hole in the merge gate in general. Routed to [the `[0007]` ship backlog](#backlog--discovered-in-the-0007-ship-2026-07-30) with its *why* recorded as [ADR-0005](adr/0005-reviewed-diff-equals-merged-diff.md) (`proposed`). Patch tier, appetite **0.5 session** held, one unit, 3 tasks, **3/3**, unit 01 **DONE** with zero code deviations. Suite **72 → 77**, `house validate` and `--strict` both exit 0 repo-wide. Merge gate **GO** (`fable-reviewer`, four lenses, `gates/merge_gate.yaml`) with **no R-1…R-5 violation** and zero findings — the reviewer re-ran everything itself: 77/0, R-3 verified by **blob hash** (`0003/plan.md` is `178a1e9` at base `c2f88db`, at HEAD, and in the working tree — byte-identical, not merely diff-clean), spec **R-5** re-measured independently by importing the shipped `stripFences()` against the old pipeline inlined (14-artifact scan set: exactly **1** verdict change, `0003/plan.md` RED→GREEN; **zero** GREEN→RED, same result across all 79 tracked `.md` files), the R-4 tamper check reproduced, and **10** adversarial marker-hiding probes clean. Both rulings that bound the build held: `0003/plan.md` passed **unmodified**, and R-5's re-measurement was the reviewer's, not inherited from the digest. Two preference-level reviewer notes, both resolved at this reconcile and neither a finding: the plan's post-approval edits are now disclosed in [its As-built](slices/0007-validate-strict-nested-fence-false-positive/plan.md) (including the wrong `house event --note` flag, corrected in place rather than left exiting 1), and the phantom-verb attribution is corrected below. Three `work.discovered` findings from the build → [the `[0007]` build backlog](#backlog--discovered-in-the-0007-build-2026-07-29), where they now sit alongside the ship's `base_sha` finding as **one coherent kernel-integrity slice candidate**; retro (optional at patch tier, written for the manual intervention and **extended with the ship-time facts**): [`slices/0007-…/retro.md`](slices/0007-validate-strict-nested-fence-false-positive/retro.md). Shaped 2026-07-29: spec and plan **approved**; `plan_check` **GO_WITH_FIXES** (Fable) with both must-fixes and all four advisories folded, none declined; kickoff brief **v1** in `slice.yaml`. Research digest: [`slices/0007-…/research/fence-stripper.md`](slices/0007-validate-strict-nested-fence-false-positive/research/fence-stripper.md). **Nothing is active on this board now** — the next session is a `house-shaper` session on the backlog, not an orchestrator session |
| S4+ | **The desktop IDE** — shaped as its own slice against a contract already true on disk (workspace, side pane, webview mockups, approvals inbox, terminal panes); gets its own shaping pass and its own repo | **Slated — unblocked 2026-07-29.** S1, S2, S3a and S3b have all shipped, so the "blocked on S1–S3" condition is spent; this is the roadmap's next slated item and the only one of program size left here. It has **no minted slice id and no spec** — the next move on it is a `house-shaper` session, not a build |

### S3b scope change — the proving pair, corrected (2026-07-29)

Recorded here so the change of course is readable, not erased. **Authority: the 2026-07-29 amendment to
[ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md)** — where this section and the ADR ever
disagree, the ADR wins.

**What S3b used to say.** "Migrate the proving pair, then cut over" — `house init` + `house adopt` +
active-slice adoption on **sdlc-skills and edge-scanner**, with the rename and v1 archive gated on *both*
repos having driven real work through v2 end-to-end.

**What changed.**

- **edge-scanner is dead.** Its own dev-state records `PROJECT STOPPED — Phase 0 go/no-go = NO-GO
  (2026-07-22)`; `main` has been cold since 2026-07-07. It entered the proving pair by accident and has no
  future feature work to drive through v2, so it could never satisfy the cutover condition. **No migration
  work is owed to it.** Its one loose end — an unmerged locked worktree holding its NO-GO ADR — belongs to
  that repo, not to this program.
- **athlete-data replaces it as the second proving repo.** `house init` ran there **2026-07-29** (kernel
  scaffolding, ios/python `gates.yml`, `model_profile`, advisory hooks). Its first v2 slice is an
  **adoption** of already-shaped work — its Slice 3 (engine) — via a `house-shaper` session.
- **The migration half of S3b is gone.** sdlc-skills was already migrated and proven in S2/S3a (`[0002]`
  and `[0003]` both ran the full v2 loop), and athlete-data's onboarding happens *in athlete-data*, not as
  a unit of a slice in this repo. S3b keeps the cutover only.
- **There is no `house adopt` command, and there will not be one.** Greenfield repos onboard with
  `house init`; already-shaped work is adopted by a **shaper session** that imports the existing spec/plan
  into the kernel's records and records their gates — spec_review re-affirmed by the user, and a **fresh**
  v2 `plan_check` before `ready`. Adoption done that way **counts** toward the cutover condition.

**Resume condition for `[0004]` — MET, and the slice is unparked (2026-07-29).** It required both:

1. **sdlc-skills has driven real work through v2 end-to-end** — *satisfied* (`[0002]` 2026-07-28,
   `[0003]` 2026-07-29; all hard gates, user live-checks).
2. **athlete-data ships its first v2 slice end-to-end** — *satisfied the same day*: its slice
   `0001-bulk-slice-3-engine` shipped through the full v2 loop (units built, a **fresh** Fable
   `merge_gate` **GO**, owner on-device `live_check` including the first production write, PR #1
   merged).

**Ruled satisfied by the user, with one letter-gap on record.** athlete-data's pre-build `plan_check`
was the *adopted* 2026-07-28 verdict rather than a fresh v2 re-run, which the amendment's adoption
proviso asks for; its `spec_review` **was** re-affirmed fresh. The user's ruling: a shipped,
merge-gated, live-checked build is stronger plan-quality evidence than any pre-build review. The gap
is not papered over — it is a `deviation.raised` event on `[0004]` (2026-07-29T17:37:48Z,
`approved_by: jake`), so the merge gate re-judges it rather than inheriting it.

The wait is over, and `[0004]` **shipped the same day** — see its status cell in the table. The cutover is
executed: three skills on canonical `house-*` names, v1 archived at `archive/skills-v1/`, the coexistence
window closed. Nothing on this board is waiting on it.

### S2 carry list — fold-forward from S1

Everything S1 deliberately left on the floor, in one place so nothing is carried in a conversation.

> **Status (2026-07-28):** every item below is now **bound into the S2 spec/plan** as a numbered requirement
> (R-1 … R-14) in [`slices/0001-house-v2-s2-skills-rewrite/spec.md`](slices/0001-house-v2-s2-skills-rewrite/spec.md).
> The list stays here as the durable record of what was carried and why — it is not deleted when S2 ships.

**Must not be lost — the S1 merge-gate GO condition:**

- **`renderDevState` silent-drop residue** — hand content wedged BETWEEN the end of the generated block and
  `<!-- house:manual -->` is still swallowed with exit 0 (the MF6 letter-gap, inherited from the plan's
  literal code; merge-gate-verified, not theoretical). Candidate fixes: emit a closing
  `<!-- /house:generated -->` marker so the stripped region is bounded on both ends, or re-render the
  stripped region and compare before writing. The GO on S1 was conditional on this landing in S2.

**Carried from the S1 build:**

- `blocked_on` / `gate.requested` writers
- `tasks.yaml` authoring at handoff
- style-attr `url()` refs in the mockup self-containment grep
- `install.sh` wiring for the CLI
- reconcile `slice.merged` (spec §3.5) vs the shipped `slice.shipped` event before writing the merge projection
- the roadmap `[NNNN]` id lint (spec §3.5)
- `status:` slot in the ADR template (spec §3.3)

**Fold-forward findings from the S1 merge gate:**

- **`readEvents` skips torn JSONL lines silently** — S2's projections should surface a skip count. OBSERVED is
  a truth layer; thinning it without a word is exactly the class of quiet lie the kernel exists to prevent.
- **Writes are truncate-in-place** (`writeYaml`, dev-state render) — consider tmp-file + rename for atomic
  writes. Everything written is git-tracked and therefore recoverable, so this is noted, not urgent.
- **`tasks.yaml` round-trips through js-yaml**, so YAML comments die on the first `house task` tick. S2's
  shaper→builder handoff template must not carry meaning in comments.
- **`parked` / `abandoned` slices surface in no dev-state section** — S2 decides where (or whether) they render.
- **D1 portability record** — `node --test test/*.test.js` relies on POSIX shell glob expansion; on
  Windows + Node 20 the pattern would reach Node literally (Node's own `--test` globbing is 21+). Record-only:
  the no-CI, local-macOS-only setup ([ADR-0003](adr/0003-no-hosted-ci-local-verification.md)) makes it moot today.

### Backlog — discovered in the `[0002]` smoke run (2026-07-28)

Recorded as `work.discovered` events at gating (doctrine §8: a finding that stays in the transcript was
never found) — three on `[0002]` from the smoke, a fourth on `[0001]` from the S2 re-gate — routed here
per the §6 routing table. None blocked S2's merge gate.

> **Status (2026-07-29): all four are SHIPPED in slice `[0003]`** (S3a in the table above, PR #9) — bound as
> numbered requirements **R-1 … R-4** in
> [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md),
> plus **R-5** (unknown flags fail closed) added at shaping as the root cause under F4. Unit 01 landed
> all five with evidence (72 tests, `house validate` exit 0); the merge gate went **GO with zero findings
> on the first pass** and `live_check` was user-approved, so `[0003]` is shipped. The list stays here as
> the durable record of what was found and where it went; it is not deleted now that `[0003]` has shipped.

- **Validator artifact/frontmatter drift cross-check** — `house validate` does not cross-check a
  `slice.yaml` artifact record against the spec/plan frontmatter `status:`/`state:`; `[0002]`'s spec still
  read `status: shaping` / `state: draft` after the user approved it (hand-reconciled in the 0002 plan's
  as-built). Candidate `validate` ride-along. → **`[0003]` R-2** (task T2): approval-boundary cross-check —
  a manifest `approved`/`done` artifact whose doc frontmatter disagrees is an error; missing or
  unparseable frontmatter degrades to a warning, so deleting frontmatter cannot evade the check.
- **`house gate --payload` is dropped from the OBSERVED copy** — the JSON detail persists in
  `gates/<name>.yaml` but the `gate.recorded` event in `.house/events.jsonl` carries only gate + verdict;
  `house event` drops `--payload` entirely. → **`[0003]` R-3** (task T3): the event carries `record` (the
  repo-relative path to the yaml), `detail` (the extra payload keys living there), and `notes` inline.
  The yaml stays the full record — the event references it, never inlines the blob.
- **`house validate --strict` has no per-slice scoping** and matches the NEEDS-CLARIFICATION marker as a
  naive substring in every slice dir's `.md` files — any slice plan quoting the marker in prose blocks
  every *other* slice's handoff (`cli/lib/validate.js:33`). S3 candidate. → **`[0003]` R-1** (task T1):
  well-formed markers only, after stripping fences and code spans; handoff artifacts (`spec.md`,
  `plan.md`) only — never `retro.md`, whose job includes discussing markers; and `--slice <id>` scoping
  that errors on an unknown id rather than passing green. The shaper's handoff bar becomes
  `house validate --strict --slice <id>`.
- **`house gate` drops/overrides `--actor`** — the S2 re-gate GO record carries `by: agent` in both
  `gates/merge_gate.yaml` and the `gate.recorded` event even though the reviewer passed
  `--actor reviewer`, while the prior NO_GO recorded `by: reviewer`; actor-flag handling is
  inconsistent. Recorded as a fourth `work.discovered`, on `[0001]` at the re-gate (2026-07-28). →
  **`[0003]` R-4** (task T3): `--actor` ?? `--by` ?? `agent`, with `--actor` documented as canonical
  everywhere. Root cause — the dispatcher silently swallowed the unrecognized spelling — is **R-5**
  (task T4): a per-command known-flags table, exit 1 naming the unknown flag. `hook` is deliberately
  exempt from that table (advisory-only hooks never exit non-zero, [ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md)).

### Backlog — discovered in the `[0003]` build (2026-07-29)

> **Status (2026-07-30): CLOSED — SHIPPED in slice `[0007]`** — *validate --strict nested-fence false
> positive*, the Fix row in the table above. Patch tier, minted and shaped 2026-07-29, built, merge-gated
> **GO** and shipped the next day: [PR #13](https://github.com/argent-gnome/sdlc-skills/pull/13) merged to
> `main` as squash `85731f3` (`main` at `2245f09`, pushed), `live_check` **user-approved** from a bare
> terminal. Line-oriented fence tracking in `cli/lib/validate.js`, suite 72 → 77, `house validate --strict`
> **exit 0 repo-wide on `main`** with `0003/plan.md` byte-identical (blob `178a1e9`), so the residual below
> is closed as a *consequence* of the fix rather than by editing the document. **This was the repo's last
> `--strict` red; there is now none.** The item stays here as the durable record of what was found and where
> it went; the bullet below is left as written, including its "still OPEN" re-verifications, which were true
> on the dates they name.
>
> **The root cause is narrower than the bullet below states.** The outer fence is not closed early by a
> quoted *fence*: `0003/plan.md:58` is a four-space-indented line inside a JavaScript string literal
> carrying two mid-line three-backtick runs, which under CommonMark is **not a fence at all**. Only the
> byte-oriented regex pairs with it. The bullet's candidate fix — line-by-line fence state with the
> info-string/indent rules — was the right one, and is what `[0007]` specifies.
>
> **The variant nobody had written down:** line 58 carries an **even** number of runs, so parity for the
> rest of the file self-heals by accident. An **odd** count on one line would invert every fence after it,
> which fails in the marker-*hiding* direction — a silent **false negative**, a real open question sailing
> through `--strict` into a build. That, not the visible red, is the argument for fixing the tool rather
> than the document. Two further edge cases now on record: `~~~` fences are not handled by the current
> stripper at all (a marker quoted in one is a false positive *today*), and an **unclosed** fence is where
> `[0007]` deliberately departs from CommonMark — never hide, because a validator that hides markers fails
> silently. Blast radius, measured against a prototype across all 75 tracked `.md` files: exactly one file
> changes classification (`0003/plan.md`, red → green) and **zero** go green → red — which is why spec
> **R-5** makes the merge-gate reviewer re-measure independently instead of inheriting the digest.
>
> The bullet below is left as written. Its closing count — "one of **three** unminted, unblocked backlog
> items" — was true at the `[0006]` ship; minting `[0007]` took it to **two**, and `[0007]`'s build and then
> its ship each raised one more, so as of the `[0007]` ship the board carries **four**: two in
> [the `[0006]` build backlog](#backlog--discovered-in-the-0006-build-2026-07-29), one in
> [the `[0007]` build backlog](#backlog--discovered-in-the-0007-build-2026-07-29) and one in
> [the `[0007]` ship backlog](#backlog--discovered-in-the-0007-ship-2026-07-30) — **but the last two are one
> slice**, not two: see the kernel-integrity framing at the head of the `[0007]` build section.

- **The R-1 fence-stripper is defeated by a fence quoted inside a fence.** `--strict` strips fenced
  blocks with a non-greedy `` ```…``` `` pair, so a plan that quotes a triple-backtick fence *inside* a
  fenced block closes the outer fence early and re-exposes whatever follows. Concretely: `house validate
  --strict`, repo-wide and scoped to `[0003]`, reports one error on
  `slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md` — from a literal test fixture, not a real
  open question. Pre-existing (the old substring matcher flagged the same file) and **exactly what R-1
  specifies**, so it was correctly out of scope for `[0003]`. Candidate fix: track fence state
  line-by-line with the info-string/indent rules instead of a regex pair, or strip fences before code
  spans by scanning rather than matching. Until then the shaper's `--strict --slice <id>` handoff bar can
  be tripped by a plan that quotes markup — which is the same class of false-positive R-1 existed to
  kill, one level deeper. Sequenced after **S3a** ships — **S3a shipped 2026-07-29 (PR #9)**, so this is
  now eligible: either triaged into its own patch-tier slice or folded into S3b's shaping pass. It is the
  only `--strict` red in the repo. **Update 2026-07-29:** S3b's shaping pass happened and did *not* pick
  this up (that slice was rescoped to the cutover alone and parked), so the fold-in option is spent — this
  needs its own patch-tier slice when someone wants it. **Re-verified at the `[0004]` ship
  (2026-07-29):** still **OPEN** and unchanged — `house validate --strict` exits 1 with exactly one
  error, on `docs/slices/0003-…/plan.md`; plain `house validate` is exit 0. It remains the only
  `--strict` red in the repo, and — alongside the `docs/index.html` item in
  [the `[0004]` build backlog](#backlog--discovered-in-the-0004-build-2026-07-29) below — one of the two
  unminted, unblocked **backlog** items on this board. (S4+, the desktop IDE, is unminted too, but it is
  program-sized, needs a shaping pass, and gets its own repo — see its row above.) **Re-verified at the
  `[0006]` ship (2026-07-29):** still **OPEN**, unchanged, and still the **only** `--strict` red in the
  repo — `house validate --strict` exits 1 with exactly one error, on
  `docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md`; plain `house validate` is exit 0.
  `[0006]` was docs-only and went nowhere near the validator. It is no longer the *only* unminted backlog
  item, though: the other of the two named above — the `docs/index.html` item — is **closed** by `[0006]`'s
  index rewrite, and `[0006]` raised two new unminted candidates in
  [its own backlog](#backlog--discovered-in-the-0006-build-2026-07-29), so this is now one of **three**
  unminted, unblocked backlog items. It still needs its own patch-tier slice, and it remains a prerequisite
  for nothing.

### Backlog — discovered in the `[0004]` build (2026-07-29)

> **Status (2026-07-29): CLOSED — shipped in slice `[0006]`** (the Pages row in the table above, PR #12
> merged to `main`, `live_check` user-approved against the deployed site). `[0006]` took the whole page
> rather than only the two owed places: the "pair" lede and the line-44 "these two skills" body claim are
> gone with the rewrite, and the open question ("does the page get quickstart/process-v2 cards?") was
> **answered yes** — the index now carries a card to each mirror. **Verified against the shipped file at
> this reconcile:** `docs/index.html` has zero "pair"/"two skills" claims, its lede is records-first over
> three skills and the kernel, `<h2>The three skills</h2>` heads three cards, `quickstart.html` and
> `process.html` each have a card, and the footer still names the canonical trio. Live: `/` returns 200.
> The item stays here as the durable record of what was found and where it went; it is not deleted, and the
> bullet below is left as written — it describes the page as it was at the `[0004]` ship, and its line
> numbers refer to that version, not to the rewritten one.

- **`docs/index.html` is a published live surface with a false claim, and nobody owns it.** **OPEN as
  of the 2026-07-29 ship**, partially closed. The page still describes the repo as a "plugin-free
  **pair** of Claude Code skills" (lede, line 28) and refers to "these two skills" in the body (line
  44). Three skills ship, on canonical names, as of the cutover. **The footer is already fixed** —
  it reads *"three skills: `house-shaper` · `house-orchestrator` · `house-builder`"* (line 51),
  applied by the orchestrator in the docs lane as `[0004]`'s folded advisory **A5**; the lede and the
  body line were never in A5's scope. Two slices passed the rest of the page by for defensible
  reasons and left a hole between them: `[0005]` **declined** the quickstart/process-v2 cards at
  plan-check because `index.html` is v1 surface it did not own, on the expectation the cutover would
  take it; `[0004]` then scoped itself to the rename, the archive, and the live surfaces its spec
  named — `docs/index.html` is not among them, and its No-Gos bar a v2 rewrite of the v1 pages. **Net
  owed: the lede and the line-44 body claim** (two places, not three), plus a decision on whether the
  page gets quickstart/process-v2 cards. Small — a patch-tier slice, or a rider on whichever slice
  next opens that page. Surfaced in the `[0004]` plan's As-built ("Outstanding") and as a
  `work.discovered` event (2026-07-29T19:05:49Z), so the merge gate saw it rather than inherited it —
  and it was re-noted in the merge-gate `records` lens rather than silently passed.

### Backlog — discovered in the `[0006]` build (2026-07-29)

Two `work.discovered` events on `[0006]`, both **owner-raised**, both **unminted** and unblocked, routed
here per §6. Neither blocked the merge gate. (A third, lighter note from the retro is recorded but not
raised as a finding: an `index.html` signpost to `archive/docs-v1/` was deliberately left out of `[0006]`
and is available as a rider on whichever slice next opens that page.)

- **Re-baseline experiment — periodically re-test which process rules still earn their keep.**
  Program-level, **experiment** tier rather than a feature. As models improve, prescriptive process
  written for weaker ones becomes tax. The method: on a suitable slice, hand the builder **only the spec,
  the scope guards, and the acceptance checks** — no literal-code plan — leave **gates unchanged**, and let
  the **merge gate judge the result against a normal slice**. If the two are equal, plans shrink
  permanently to intent plus discriminating tests. **Scope is deliberately narrow: layer-4 prescriptive
  HOW only.** Records, user gates and adversarial review are *outcome constraints*, not compensations for
  weak capability, and are explicitly **not in question** here. **Evidence motivating it:** on 2026-07-29
  builders deviated from plan literalism **correctly** more than once — `[0004]`'s unsatisfiable T2 verify
  and its `cli/README.md` sweep, and all three of `[0006]`'s text-scope disclosures, every one accepted on
  record. **Cadence:** revisit **each model generation (~6 months)**, or sooner if a slice ships with
  **zero review catches**. Needs a shaper pass to pick its victim slice and write the comparison bar.
- **Roadmap status/intent split — this file is two documents in one.** Patch-tier slice candidate.
  Half of `docs/roadmap.md` is **derivable status narration** — ~**12k chars** across five S-row status
  cells (measured 2026-07-29: S3b 4379 · S3a 3606 · S2 2800 · S1 1060 · S4 529) restating what
  `slice.yaml`, `gates/*.yaml` and `events.jsonl` already hold. The other half is **irreplaceable
  hand-authored intent**: what each S *is*, the sequencing rationale, the backlog findings with their
  candidate fixes, the locked conventions. **The status half drifts like any copy, and the drift is
  measured, not feared** — on 2026-07-29 alone reconcilers caught four errors here: a row claiming 18 tasks
  against 17 in `tasks.yaml`, "Slated — blocked on S1–S3" after those shipped, "cutover pending merge"
  after the merge, and a backlog item asserting the `index.html` footer was unfixed after `[0004]` fixed
  it. Each fix costs an Opus reconcile-subagent pass. **Proposed fix: apply the `dev-state.md` precedent one
  level up** — intent and backlog stay hand-authored; status either becomes a generated block or, cheaper
  and needing no new renderer, is **deleted** with each row linking dev-state's generated section.
  **No new index needs building:** `house status --json`, `house list` and the `slice.yaml` manifests
  already *are* the machine index — this file is a stale projection of it. **Related hygiene rule to fold
  in:** as-built narration belongs in the **unit report only**. It is currently triplicated across unit
  report + plan As-built + retro (`[0001]`'s plan is 1619 lines partly from this); plans should be
  *annotated on divergence*, not appended to. **Second hygiene rule, added 2026-07-30 from `[0007]`'s merge
  gate:** an approved plan's **body** is corrected only where leaving it as written would mislead the next
  author, and every such correction is **disclosed in that plan's As-built** — never silently retro-edited.
  The failure the gate caught was not either edit but the *inconsistency* between them: `[0007]`'s reconcile
  retro-edited a stale test count in the plan body while refusing, on the same hygiene grounds, to fix a
  quoted command that exits 1. The As-built section exists so that neither edit has to be silent and neither
  has to be refused. Unminted; needs a shaper pass to choose generate-vs-delete.
  *(Recording this item necessarily adds prose to the very file it wants shortened — noted, and kept as
  tight as the evidence allows.)*

### Backlog — discovered in the `[0007]` build (2026-07-29)

**Three findings, carried by two `work.discovered` events** on `[0007]`, raised by the builder of unit 01
while writing its report (`2026-07-30T01:17:04Z`, refined at `2026-07-30T01:24:36Z`), routed here per §6.
Two are CLI wording; the third turned out to be **a real, if small, code bug** — an unanchored regex in
`house unit … finalize` that destroyed part of unit 01's own report before it was repaired by hand. None
blocked anything, and the merge gate verified all three routings as correct.

**These three and the `base_sha` finding from the ship are ONE candidate slice, not four items — patch tier,
theme: kernel record integrity.** Written out so a shaper does not mint them separately and does not have to
re-derive the connection. Every one of them is a place where a `house` writer or the surface documenting it
**misrepresents the record it is producing**, and every fix is small and lands in the same two files
(`cli/lib/slices.js`, `cli/bin/house.js`) plus the dispatch wording:

| # | Defect | Fix | Where |
|---|---|---|---|
| a | `house unit … finalize` truncates the report at an **unanchored** `/## Result[\s\S]*$/` — first match anywhere in the body | anchor it: `/^## Result[\s\S]*$/m` | `cli/lib/slices.js:244` |
| b | the sibling `heartbeat` branch does a **first-occurrence plain-string** `cur.replace('\n## Result', …)` — inserts at the wrong place, exit 0, nothing deleted | same anchoring discipline, its own test | `cli/lib/slices.js:235` |
| c | `house event` takes `--payload`, not `--note`; the wrong spelling exits 1 under the `[0003]` R-5 flag guard | fix the wording wherever the command is documented to be copied from | docs / dispatch surface |
| d | `house unit <slice> report <unit>` **does not exist** — `finalize` is the verb that emits `unit.report` | a `report` alias, or dispatch wording that says heartbeat-then-finalize outright | `cli/lib/slices.js:211` / dispatch prompt |
| e | `house pr --base-sha` accepts a sha **unreachable from the remote default branch**, so the reviewed diff can be narrower than the merged diff | verify reachability; refuse or warn loudly | `house pr`, [ADR-0005](adr/0005-reviewed-diff-equals-merged-diff.md) |

**(a)–(d) are cosmetic-adjacent and (e) is not** — (e) is the only one that can let unreviewed content reach
`main`, so it sets the tier if the shaper decides to split. What unifies all five is the failure *direction*:
each one produces a record that reads plausible and is wrong, which is the exact class the kernel's
one-writer-per-field design exists to prevent. Two of the five (b and e) were found by the merge-gate
reviewer and the ship rather than by the build, which is the argument for taking them together while the
context is fresh. **(a) and (b) additionally retire a rule nobody should have to know** — *a unit report must
not contain the result heading's literal text anywhere in its body.*

> **This section, not the event payloads, is the accurate record of the first finding.** `.house/events.jsonl`
> is append-only, so a payload written in error is never edited — it is superseded. The 01:17:04Z payload
> attributed the phantom `report` verb to "kickoff brief and house-builder skill"; **that attribution is
> wrong**, and the correction is in the first bullet below. The 01:24:36Z event is itself an on-record
> refinement of the same 01:17:04Z entry (it reclassifies the third nit as a code bug), so the pattern is
> already established: read the log for *what happened when*, read this section for *what is true*. Note what this is *not*: `[0007]`'s own sanctioned `work.discovered` route — spec **R-3** / plan
Task 3 Step 3, for a genuine marker newly exposed by the corrected stripper — never fired, because the
builder's own blast-radius measurement found **zero** files going green → red.

- **The builder-facing report/record surface names a verb and a flag the CLI does not have, and hides one
  behaviour it does have.** Three nits, all hit or read inside one build session, each one costing a
  builder a wrong turn. Unminted, unblocked, **patch** tier at most — a rider on whichever slice next opens
  `cli/bin/house.js` / `cli/lib/slices.js` or a `house-*` skill would close all three.
  - **`house unit <slice> report <unit>` does not exist.** Unit 01 was told to report with it; `unitCmd`
    (`cli/lib/slices.js:211`) accepts only `dispatch`, `heartbeat` and `finalize`, and it is **`finalize`**
    that emits the `unit.report` event. The unit reported with heartbeats plus `finalize` instead, so
    nothing was lost. **Where the phantom verb lives matters, and the first event payload got it wrong.**
    The 01:17:04Z payload blamed the "kickoff brief and house-builder skill"; **neither names the verb.**
    `skills/house-builder/SKILL.md` documents exactly `heartbeat` (line 37) and `finalize` (line 73) and no
    third verb, and the on-disk kickoff brief in `slice.yaml` does not mention reporting verbs at all. It
    came from the **orchestrator's per-unit dispatch prompt**, which is improvised each time and is not a
    durable artifact — which is why nothing on disk could be found to blame. Verified twice: by the
    `[0007]` merge-gate reviewer, and again at this reconcile against both files. Aiming a fix at the brief
    or the skill would therefore have changed a file that was already correct. The durable fix is either a
    `report` alias for `finalize` in the CLI, or dispatch wording that says heartbeat-then-finalize outright
    rather than leaving the verb to invention.
  - **`house event` takes `--payload`, not `--note`** (`cli/bin/house.js`'s `FLAGS` table:
    `event: ['slice','payload','actor']`). `[0007]`'s own plan quotes
    `house event work.discovered … --note` at Task 3 Step 3, which exits 1 on the unknown flag — correctly,
    under the per-command flag guard `[0003]` **R-5** added. **Latent, not live:** that route never ran on
    this slice. An approved plan is not retro-edited to fix this; the wording belongs wherever the command
    is documented for the next author to copy.
  - **`house unit … finalize` truncates the unit report at an UNANCHORED heading match** — a genuine bug,
    not just undocumented behaviour. `unitCmd` does `cur.replace(/## Result[\s\S]*$/, …)`
    (`cli/lib/slices.js:244`): the pattern is neither `^`-anchored nor `m`-flagged, so it matches the
    *first* occurrence of that literal text **anywhere in the body**, including inside a sentence or a code
    span, and deletes everything after it. **Demonstrated live on unit 01's own report:** the report
    documented this hazard in prose that spelled the heading out inline, finalize matched that sentence
    instead of the real heading, and the truncation ate the rest of the section *plus the heading it was
    meant to fill*. Repaired by hand; nothing was lost, because the write was noticed immediately.
    Two consequences worth carrying: narrative evidence must sit above the heading, **and** a unit report
    must not contain that heading's literal text anywhere in its body. The durable fix is a
    `/^## Result[\s\S]*$/m` anchor, which makes the second rule unnecessary — patch tier, a handful of
    characters, plus a test that a body mentioning the heading inline survives finalize.
    - **Addendum (`[0007]` merge gate, 2026-07-30): the fix must cover *two* call sites, not just line 244.**
      The reviewer found the sibling `heartbeat` branch **one line above**, at `cli/lib/slices.js:235`, has
      the same hazard shape: `cur.replace('\n## Result', …)` with a **plain string** first argument, which
      `String.prototype.replace` applies to the **first occurrence only** — the identical
      first-match-anywhere-in-the-body defect, arrived at through string semantics instead of a missing
      regex anchor. Its failure mode is quieter than finalize's and therefore worse: nothing is deleted, the
      heartbeat line is simply **inserted at the wrong place** — before a sentence that happens to mention
      the heading rather than before the real one — so the report silently accumulates out-of-place
      heartbeats with exit 0. It did not fire on unit 01 only because every heartbeat there landed before
      the offending prose was written. Anchoring line 244 alone would leave this one live, and would leave
      the "no literal heading text in the body" rule still load-bearing for heartbeats. Scope the fix to
      both writers, with a test per call site.

### Backlog — discovered in the `[0007]` ship (2026-07-30)

One `work.discovered` event on `[0007]`, **orchestrator-raised at the merge** (`2026-07-30T01:44:34Z`),
routed here per §6 with its *why* recorded as **[ADR-0005](adr/0005-reviewed-diff-equals-merged-diff.md)**
(`proposed`). It did not block the ship — the divergence it names was verified benign before the merge
completed — and it is **item (e)** in the kernel-integrity candidate slice framed at the head of
[the `[0007]` build backlog](#backlog--discovered-in-the-0007-build-2026-07-29) above. Read the ADR for the
invariant; read this bullet for what to build.

- **`base_sha` can point at a local-only commit, so the reviewed diff can be narrower than the merged diff —
  a hole in the merge gate.** Unminted, unblocked. **What happened:** at branch time the orchestrator
  recorded `base_sha` `c2f88db`, which was local `main` HEAD but had **never been pushed** — `origin/main`
  was still `d299ae3`. GitHub computed the squash merge base against `origin/main`, so PR #13 squashed into
  `85731f3` whose parent is `d299ae3`, **absorbing the shaping commit** that `base_sha` treated as already
  landed. **Consequence:** the merge-gate reviewer reviewed `c2f88db...HEAD`; what actually landed was
  `d299ae3...85731f3`, a **strict superset**. **Benign in this instance and verified so, not assumed** — the
  extra content was `[0007]`'s own shaping records, already covered by `spec_review` + `plan_check`, and
  `c2f88db` was checked byte-identical against `origin/main`. **The general shape is the finding:** content
  can reach `main` that the reviewed diff never contained, and no gate notices, because a squash merge
  resolves its base server-side against the remote while `base_sha` is a purely local claim. The fix has two
  halves —
  - **Kernel guard:** `house pr <id> --base-sha <sha>` verifies the sha is reachable from the remote default
    branch (one `git merge-base --is-ancestor`) and refuses, or at minimum warns loudly, when it is not;
    degrading gracefully where the question is unanswerable (no remote, no network). **Enforcement strength
    is the open question** the shaping pass must rule on — refusing is the fail-closed instinct, but
    `house pr` is a recording command and a refusal there can strand a slice with the PR already open.
  - **Orchestrator ordering rule:** *push `main` before cutting the slice branch*, and *commit every `house`
    record write before any `gh pr merge` or `git reset`.* This **subsumes the `[0004]` retro follow-up**
    already owed to the `house-orchestrator` skill or doctrine (see the S3b row: *commit every shaping
    record BEFORE cutting the branch — `base_sha` must point at the full record*). `[0007]` obeyed that
    lesson exactly and still failed, because **the missing word was `push`.** Same field, two ways to be
    wrong, both invisible until something downstream reads it — which is why the two should land together
    rather than as two separate doctrine edits.

  **The second half of that ordering rule was violated during this very ship, twice** — recorded because a
  rule whose first two counterexamples are its own author is a rule that needs the guard, not the reminder:
  - `house pr --set` ran *after* the final commit, leaving the `pr_set` record uncommitted when
    `gh pr merge --squash --delete-branch` ran. The merge succeeded remotely; only the **local** checkout
    cleanup aborted.
  - **The original `work.discovered` event recording all of this was destroyed** by the
    `git reset --hard origin/main` that reconciled diverged local `main` — an uncommitted append to an
    append-only log does not survive a hard reset. The event above is a **re-emission**, and says so in its
    own payload; the discarded commit remains reachable from the local tag **`pre-0007-squash-main`**, which
    is the recovery point. Nothing was lost, and only because the loss was noticed immediately and a tag had
    been cut first.

  **Doctrine §5 is where the definition needs the qualifier:** it defines the reviewed diff as
  `git diff $(base_sha)...HEAD` with `base_sha` *"recorded on the manifest at branch time"* and says nothing
  about the remote, so the current wording is satisfied by exactly the commit that caused this.

## Locked conventions

Settled in the v1 (Pieces A–C) redesign and still binding — they constrain S2's doctrine v2 rewrite:

- **Doctrine scope = focused** (docs + hygiene), not a general style guide.
- **Enforcement = active self-checks at the gates**, process-level prose rather than scripts (the `house` CLI
  now backs this with machine-checkable state, but the gates stay the enforcement point).
- **`roadmap.md` = the blessed-canonical name** for the durable-strategy doc.

## Deferred (recorded, not lost)

- **OpenSpec delta-specs / capability truth files** — best template in the corpus, deferred to **v2.1**: a
  large authoring-habit change, and the headline benefit (location-is-status) is bought more cheaply by the
  merge-event projection + `house archive`. Revisit when **≥3 projects have real capability overlap**. The
  slice-dir layout is deliberately forward-compatible.
- **Beads-style daemon / database** — **no.** JSONL + a rebuildable index steals the architecture without the
  machinery; a daemon would break the "`git clone` + a text editor is sufficient" clause.
- **Hill charts replacing checkboxes** — no; one optional `confidence: uphill|over-the-top|downhill` field on
  unit records instead. Evidence-gated ticks remain the ledger.
- **A fourth agent role · ACP as a durable contract · spec→code regeneration (Tessl)** — no.

Research corpus behind these calls (10 reports — 3 skill deep-dives, 4 best-practices passes, 3 competing
proposals): [`superpowers/research/2026-07-28-house-v2/`](superpowers/research/2026-07-28-house-v2/).
