# ADR 0002 — house v2: state-first redesign of the house SDLC

**Date:** 2026-07-28 · **Status:** accepted (owner call at the house-v2 design gate)

## Context

Three independent deep-dives of the v1 skills (shaper · orchestrator · builder) audited the same weaknesses
and reached the same diagnosis: unticked plan checkboxes on shipped slices, `Status: Draft` left on merged
specs, plan-check / merge-gate / builder verdicts that evaporated with the conversation that produced them,
four different retro naming schemes, a mockup path no skill ever specified, dev-state heading drift, and an
ambiguous "Slice N" identity that ran two series at once. These are not seven bugs — they are **one bug
expressed seven ways: process state lives in conversations and prose, and nothing owns the write.**

The trigger for acting now is external: Jake is building a desktop focused-AI-dev IDE (workspace per project,
side pane surfacing specs/plans/mockups live, embedded terminal hosting the Claude Code sessions). An IDE can
only render state that exists on disk in a form it can read without heuristics — and v1 has none. The owner
call was explicitly *not* to retrofit v1 into something parseable, but to redesign the process ground-up so it
is both sound engineering practice and IDE-native.

Ten research reports fed the decision (3 skill deep-dives, 4 best-practices passes over the 2025–26 corpus —
Oxide RFDs, GitHub spec-kit, OpenSpec, Kiro, Beads, Linear — and 3 competing redesign proposals: state-first,
evolve, simplify). The three proposals were written independently and **converged on the same kernel**, which
is the strongest evidence in the corpus that the kernel is right. Corpus:
[`docs/superpowers/research/2026-07-28-house-v2/`](../superpowers/research/2026-07-28-house-v2/).

## Decision

Adopt **house v2: the state-first kernel** — the process gets a machine-readable skeleton (identity, persisted
gate verdicts, derived status, enforcement) that both the agents and the coming IDE read as the same on-disk
truth, while every v1 rule that earned its place is carried forward verbatim.

**Three layers of state per repo, exactly one writer each:**

| Layer | Where | Writer | Git |
|---|---|---|---|
| **DECLARED** | YAML frontmatter on artifacts + `slice.yaml` manifests | the agent owning the current stage | tracked — truth |
| **OBSERVED** | `.house/events.jsonl` (append-only, ULID ids, `merge=union`) | the `house` CLI + Claude Code hooks only | tracked — truth |
| **DERIVED** | `.house/index.json` (rebuildable cache) | `house index` only | ignored — cache |

Constitutional rules: **an unrecorded gate is an unpassed gate** (every gate writes a verdict record + event;
the next stage's precondition is *the record exists and says pass*, never "the conductor remembers") · one
writer per field, ever · anything derivable is derived, never hand-written (delete `index.json`, rebuild,
byte-identical) · `git clone` + a text editor stays sufficient (the anti-lock-in clause) · never parse Claude
Code transcripts as state.

**Identity is minted, and the directory is the id:** `house new "<title>" --kind <kind>` allocates a
zero-padded monotonic id + slug → `docs/slices/0007-dfs-oom-fix/`, with mkdir as the allocator lock. Branch,
PR prefix, commit trailer, retro and mockup paths all derive mechanically — date is never identity. This
deletes the retro-key, mockup-path and duplicate-"Slice N" bug classes at the root rather than documenting
around them.

**Build order is load-bearing:** the `house` CLI ships before the skill rewrite, and both ship before the IDE.
The contract must be true from a bare terminal on day one.

Owner calls taken at this gate (2026-07-28), each per recommendation:

- **Keep three skills** (shaper · orchestrator · builder) — but the long-lived orchestrator session becomes an
  *optimization, not the substrate*: every iteration is read state → one action → write state + event, so any
  fresh session resumes mid-slice from `house status`.
- **Merge gate: a single refute-biased reviewer by default**, with the multi-lens panel at `high` rigor or on
  owner request. Fail-closed is unchanged — INCONCLUSIVE is not a pass.
- **Retro: the ledger is always computed** from events; the prose retro is required at `slice` tier and above,
  optional for patches.
- **Spec and plan stay separate files** (single-file form available at patch tier).
- **The CLI is written in Node**, living in `sdlc-skills/cli/` — it absorbs the existing JS workflows and
  matches the hook scripts.

## Consequences

- The v1 skills are **rewritten as thin actors over shared state in S2** — they read and write records instead
  of remembering; doctrine v2 gains the canonical stage table, one rigor dial, and an explicit
  take/suppress/own contract for composed superpowers skills. Stage numbers (0–11 with 4¼/7½/9½) are deleted
  in favor of named states.
- **Migration is per-repo opt-in and forward-only** (~15 repos): `house init` scaffolds, `house adopt`
  fuzzy-maps legacy artifacts into a read-only index without moving a file, and v2 skills refuse to run in a
  repo without `.house/` (and v1 flows refuse where it exists) — no repo ever runs half-v1/half-v2. Proving
  pair: sdlc-skills itself + edge-scanner.
- Every gate verdict, task tick and stage transition becomes an artifact with an owner, which is what makes an
  IDE progress bar unable to lie — and equally what makes sloppiness fail loudly instead of silently.
- **Deferred, recorded, not lost:** OpenSpec delta-specs → v2.1 (the slice-dir layout is forward-compatible);
  hooks wiring → S2; Beads-style daemon/DB → declined outright; hill charts → one optional `confidence` field.
- The full decision table (D1–D5) and its reasoning live in the approved spec,
  [`docs/superpowers/specs/2026-07-28-house-v2-design.md`](../superpowers/specs/2026-07-28-house-v2-design.md)
  §13; the program's sequencing lives in [`docs/roadmap.md`](../roadmap.md).
