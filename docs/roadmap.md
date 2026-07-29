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
[ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md): S2 ships advisory hooks and `house2-*` skills
alongside untouched v1.

| # | Slice | Status |
|---|---|---|
| S1 | **Kernel + `house` CLI** — `schema/enums.yaml`, slice-dir scaffold, events.jsonl, `house new/init/event/gate/task/state/status/list/next/validate/index/render`. Dogfooded on this repo. Plan: [`superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md`](superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md) | **Shipped 2026-07-28** — [PR #6](https://github.com/argent-gnome/sdlc-skills/pull/6) merged to `main` (`4a6a906`); retro: [`retros/2026-07-28-house-v2-s1-kernel-cli-retro.md`](retros/2026-07-28-house-v2-s1-kernel-cli-retro.md). All 11 plan tasks shipped TDD, 43/43 tests, `house validate` exit 0, repo dogfooded (`.house/`, slice `0001` minted, dev-state generated). Merge gate **GO** with one condition (the `renderDevState` letter-gap) plus findings folded to the [S2 carry list](#s2-carry-list--fold-forward-from-s1). Two deviations (test script under Node 26; a real silent-drop bug in the plan's literal `renderDevState`, fixed) + spec drift on `slice.merged`/roadmap-lint/ADR `status:` — all recorded in the plan's As-built section |
| S2 | **Skills rewrite + doctrine v2 + hooks** — shaper/orchestrator/builder as thin actors over shared state; canonical stage table, one rigor dial, take/suppress/own composition contract; hooks wired into `.claude/settings.json`. Slice `[0001]` — spec: [`slices/0001-house-v2-s2-skills-rewrite/spec.md`](slices/0001-house-v2-s2-skills-rewrite/spec.md); plan: [`slices/0001-house-v2-s2-skills-rewrite/plan.md`](slices/0001-house-v2-s2-skills-rewrite/plan.md) | **Shipped 2026-07-28** — [PR #8](https://github.com/argent-gnome/sdlc-skills/pull/8) merged to `main` (`5791e71`); retro: [`slices/0001-house-v2-s2-skills-rewrite/retro.md`](slices/0001-house-v2-s2-skills-rewrite/retro.md). **17/17 tasks** across 3 units (CLI enablers → doctrine v2 + three `house2-*` skills → smoke slice + closeout), suite 43→67 tests, `house validate --strict` exit 0. Merge gate **NO_GO→GO**: the NO_GO was the retro draft tripping the strict NEEDS-CLARIFICATION substring check (proving that backlog finding twice); fix `38c128a` was records-only, and the re-gate GO surfaced a fourth `work.discovered` — the `house gate` `--actor` drop, in [the smoke backlog](#backlog--discovered-in-the-0002-smoke-run-2026-07-28) below. `live_check` **user-approved**. Shaped the same day, appetite **3 sessions** held: spec user-approved (`gates/spec_review.yaml`); plan-check **GO_WITH_FIXES** (`gates/plan_check.yaml`) with all 5 must-fix + 7 advisories folded into the plan. Shaping decisions — `house2-*` coexistence, advisory-only hooks, `slice.shipped` over `slice.merged` — recorded in [ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md). **Smoke slice `[0002]` SHIPPED 2026-07-28** — `house --version` (patch tier, 1 task; spec: [`slices/0002-house-version-flag/spec.md`](slices/0002-house-version-flag/spec.md)) was driven end-to-end through the three `house2-*` skills as R-13's done bar: shaped (spec user-approved; plan-check **GO_WITH_FIXES** folded; kickoff brief v1) → built (unit 01 DONE; T1 evidence-ticked, 67/67 tests) → merge gate **GO with zero findings** (reviewer re-ran tests + validate + manual `--version` checks personally) → live_check **approved** by the user → shipped. No PR: its branch was ff-merged into the S2 branch at `2c2d16b`, so the smoke's code rides S2's merge-gate diff while its gates ran per-slice on `[0002]`'s own records. U3-T17 is done (`house validate --strict` exit 0) with a recorded deviation — unit 03 had finalized BLOCKED at the `[0002]` spec_review halt; the orchestrator ticked T17 inline once the user cleared it. Three `work.discovered` findings from the smoke → [the smoke backlog](#backlog--discovered-in-the-0002-smoke-run-2026-07-28). Carries from S1: see [the S2 carry list](#s2-carry-list--fold-forward-from-s1) below |
| S3a | **Smoke-findings kernel fixes** — close the four `work.discovered` findings from the `[0002]` smoke run before anything else rides on the kernel: strict-marker matcher that only matches well-formed markers in handoff artifacts, with `--slice` scoping that fails closed (R-1); approval-boundary cross-check between `slice.yaml` and doc frontmatter (R-2); `gate.recorded` events carry a record reference + detail keys + notes instead of dropping `--payload` (R-3); one actor spelling, `--actor` canonical with `--by` as legacy alias (R-4); and the root enabler the smoke exposed — **unknown flags fail closed** per command (R-5). Slice `[0003]` — spec: [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md); plan: [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md) | **Shaped 2026-07-29 — heading to ready.** Appetite **1 session**, one unit, 5 tasks. Tier **bumped patch → slice** at shaping (user call): R-1 changes what the shaper's handoff bar *asserts*, which is doctrine, not lint. Spec **user-approved** (`gates/spec_review.yaml`); plan-check **GO_WITH_FIXES** (`gates/plan_check.yaml`, fresh Fable reviewer, five lenses) with both must-fixes (M1 frontmatter reconcile as a dispatch precondition; M2 the T4 test rewritten to `cli.test.js`'s real `run(cwd, …)` → `{out, code}` seam) and all five advisories (A1–A5) folded into the plan; kickoff brief **v1** written into `slice.yaml`. Research digest: [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/research/backlog-fixes.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/research/backlog-fixes.md) — each finding reproduced against a scratch house repo, no CLI changed. The same shaping pass recorded the [ADR-0001](adr/0001-fable-profile-model-routing.md) **erratum** (hard gates halt rather than downgrade the reviewer when Fable is unavailable), `adr_review` **approved** by the user. Next: dispatch unit 01 |
| S3b | **Migrate the proving pair, then cut over** — `house init` + `house adopt` + active-slice adoption on sdlc-skills and edge-scanner; **owns the `house2-*` → canonical rename and the v1 skill archive** once both repos have driven real work through v2 end-to-end (per [ADR-0004](adr/0004-house2-coexistence-and-advisory-hooks.md): a `house2-*` name surviving past S3 is a defect, not a convention — S3 must sweep every doc/prompt/`install.sh` line that still hardcodes one) | Slated — sequenced after S3a so the migration runs on a kernel whose validator and gate records are trustworthy |
| S4+ | **The desktop IDE** — shaped as its own slice against a contract already true on disk (workspace, side pane, webview mockups, approvals inbox, terminal panes); gets its own shaping pass and its own repo | Slated — blocked on S1–S3 |

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

> **Status (2026-07-29): triaged — all four are owned by slice `[0003]`** (S3a in the table above), bound
> as numbered requirements **R-1 … R-4** in
> [`slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md`](slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md),
> plus **R-5** (unknown flags fail closed) added at shaping as the root cause under F4. Spec
> user-approved, plan-check **GO_WITH_FIXES** folded, kickoff brief v1 written — the slice is heading to
> ready. The list stays here as the durable record of what was found and where it went; it is not deleted
> when `[0003]` ships.

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
