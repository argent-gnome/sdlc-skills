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
ship before the IDE — the contract must be true from a bare terminal on day one.

| # | Slice | Status |
|---|---|---|
| S1 | **Kernel + `house` CLI** — `schema/enums.yaml`, slice-dir scaffold, events.jsonl, `house new/init/event/gate/task/state/status/list/next/validate/index/render`. Dogfooded on this repo. Plan: [`superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md`](superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md) | **Shipped 2026-07-28** — [PR #6](https://github.com/argent-gnome/sdlc-skills/pull/6) merged to `main` (`4a6a906`); retro: [`retros/2026-07-28-house-v2-s1-kernel-cli-retro.md`](retros/2026-07-28-house-v2-s1-kernel-cli-retro.md). All 11 plan tasks shipped TDD, 43/43 tests, `house validate` exit 0, repo dogfooded (`.house/`, slice `0001` minted, dev-state generated). Merge gate **GO** with one condition (the `renderDevState` letter-gap) plus findings folded to the [S2 carry list](#s2-carry-list--fold-forward-from-s1). Two deviations (test script under Node 26; a real silent-drop bug in the plan's literal `renderDevState`, fixed) + spec drift on `slice.merged`/roadmap-lint/ADR `status:` — all recorded in the plan's As-built section |
| S2 | **Skills rewrite + doctrine v2 + hooks** — shaper/orchestrator/builder as thin actors over shared state; canonical stage table, one rigor dial, take/suppress/own composition contract; hooks wired into `.claude/settings.json` | Slated — carries from S1: see [the S2 carry list](#s2-carry-list--fold-forward-from-s1) below |
| S3 | **Migrate the proving pair** — `house init` + `house adopt` + active-slice adoption on sdlc-skills and edge-scanner | Slated |
| S4+ | **The desktop IDE** — shaped as its own slice against a contract already true on disk (workspace, side pane, webview mockups, approvals inbox, terminal panes); gets its own shaping pass and its own repo | Slated — blocked on S1–S3 |

### S2 carry list — fold-forward from S1

Everything S1 deliberately left on the floor, in one place so nothing is carried in a conversation.

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
