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
| Docs | **v2 onboarding docs — quickstart + process narrative** — the two human-facing docs the program never had: `docs/quickstart.md` (install once, the four-command new-project startup, seeding `.house/gates.yml`, invoking the shaper, and the adoption path for already-shaped work) and `docs/process-v2.md` (the three roles and their invariants, the records-first substrate, the gate model, where the heavy subagent work runs), plus a v1 banner on `docs/process.md`/`.html` so nobody onboards onto the retired track by accident. Slice `[0005]` — spec: [`slices/0005-v2-onboarding-docs-quickstart-process-narrative/spec.md`](slices/0005-v2-onboarding-docs-quickstart-process-narrative/spec.md); plan: [`slices/0005-v2-onboarding-docs-quickstart-process-narrative/plan.md`](slices/0005-v2-onboarding-docs-quickstart-process-narrative/plan.md) | **Shipped 2026-07-29** — [PR #10](https://github.com/argent-gnome/sdlc-skills/pull/10) merged to `main` (`cc45430`); no retro (docs-only, **patch** tier — retros are owed at slice tier and above). **3/3 tasks** in one unit, appetite 0.5 session, shaped and dispatched and shipped the same day. Plan-check **GO_WITH_FIXES**, all folds in the plan (M1 html banner uses GitHub blob URLs — `.nojekyll` serves raw, so a bare `.md` link renders as text; M2/M3 the names-containment and no-enum-chaining greps are wired into `tasks.yaml` `verify:` so the evidence gate enforces them); merge gate **GO** with two notes-not-findings; `live_check` **user-approved**, the user reading both docs as the audience proxy. As-built and its two forced deviations are in the plan. **Sequencing:** it was independent of S3b — it documented the v2 process *under its migration-window names*, deliberately name-light so [`[0004]`](#s3b-scope-change--the-proving-pair-corrected-2026-07-29)'s rename sweep grew by one table block instead of dozens of lines; that block is now swept. **What it handed the cutover, and what the cutover did not take:** both new docs are markdown-only on purpose — the `docs/index.html` card was **declined** at plan-check on the expectation that `[0004]` would inherit linking and mirroring them. `[0004]` **did not** take it (its own No-Go bars a v2 rewrite of the v1 pages), so `docs/index.html` was left unowned — recorded in [the `[0004]` build backlog](#backlog--discovered-in-the-0004-build-2026-07-29). **That hole is now owned and built: slice `[0006]`** (the Pages row below) rewrote `index.html`, gave it the two cards `[0005]` declined, and hand-rendered the `.html` mirrors these two docs shipped without — so `docs/quickstart.md` and `docs/process-v2.md` are no longer markdown-only, and neither doc's *content* was touched to get there |
| Pages | **public pages refresh — retire v1 pages, publish current docs** — the published site still served the v1 world (`process.html` banner'd but describing the retired loop, `best-practices.html`, `case-study.html`) while `index.html`'s lede and body claimed a two-skill ecosystem and the current docs rendered nowhere (`.nojekyll` serves markdown raw). Retires the three v1 pages *and their markdown sources* to `archive/docs-v1/` (archive, never erase — the `archive/skills-v1/` precedent), rewrites `index.html` around the three skills + the kernel, and adds hand-rendered mirrors `docs/quickstart.html` + `docs/process.html` (the latter deliberately taking the retired page's URL so old links land on current truth). Slice `[0006]` — spec: [`slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/spec.md`](slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/spec.md); plan: [`slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/plan.md`](slices/0006-public-pages-refresh-retire-v1-pages-publish-cur/plan.md) | **In flight 2026-07-29** — docs-only, **patch** tier, appetite 0.5 session, one unit, on branch `slice/0006-public-pages-refresh-retire-v1-pages-publish-cur` off `9b413c5`; **not merged, no PR yet.** Unit 01 is **3/3 tasks done with evidence** (`9149e9d` archive + link retargeting · `313f921` the two mirrors · `fedef01` the index rewrite), `house validate` exit 0, all 28 hrefs across the three pages resolving. Shaped the same day: spec **user-approved** (manual mirrors accepted over any generator), plan-check **GO_WITH_FIXES** with both must-fixes and all six advisories folded into the plan — **M1** is the one that shapes the diff, and it is why this row's `[0004]`/`[0005]` neighbours still name `docs/process.md`/`.html`: historical prose in shipped records is exempt by construction and was never reworded to satisfy a link check. As-built — the three deliberate additions the mirrors make beyond their markdown, the directory-target resolution, and the uncommitted link-check script — is in the plan's As-built section. Still owed before this ships: the unit's finalized result, the merge gate, and `live_check` |
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
  program-sized, needs a shaping pass, and gets its own repo — see its row above.) **Update at the `[0006]`
  mint (2026-07-29):** the other of those two — the `docs/index.html` item — is minted and built as
  `[0006]`, so this is now the **only** unminted, unblocked backlog item on the board. It is untouched by
  `[0006]`, which is docs-only and goes nowhere near the validator; still the only `--strict` red in the
  repo, and it still needs its own patch-tier slice.

### Backlog — discovered in the `[0004]` build (2026-07-29)

> **Status (2026-07-29): MINTED and BUILT as slice `[0006]`** (the Pages row in the table above) — not yet
> merged, so it is not yet closed. `[0006]` took the whole page rather than only the two owed places: the
> lede and the line-44 body claim are gone with the rewrite, and the open question ("does the page get
> quickstart/process-v2 cards?") was **answered yes** — the index now carries a card to each mirror. The
> item stays here as the durable record of what was found and where it went; it is not deleted, and the
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
