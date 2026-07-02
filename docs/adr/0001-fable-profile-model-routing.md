# ADR 0001 — fable-profile model routing (Fable 5 returns)

**Date:** 2026-07-01 · **Status:** accepted

## Context

Fable 5 (`claude-fable-5`) is generally available again. It is Anthropic's Mythos-class tier — above Opus in
capability, the most intelligent GA model — but without fast mode, and priced/paced for judgment rather than
volume. Opus 4.8 (`claude-opus-4-8`) is the cheaper, faster, fast-mode-capable workhorse.

This ecosystem has history here: the original merge-gate was a **single Fable reviewer** — one strong model of
a *different architecture* reviewing Opus-built code, so the reviewer's blind spots didn't coincide with the
builder's. When Fable became unavailable, the **opus-profile** was introduced: the multi-lens panel
(`merge-gate-panel.js`), substituting independence-of-perspective (4 lenses + 3 refuters, all Opus) for the
lost independence-of-architecture. It worked, but at ~13+ agents per high-stakes gate, and every role
("driver · reviewers · authors") was pinned to Opus 4.8.

*Caveat:* release-notes verification of exact Fable pricing/latency was blocked on decision day (Anthropic API
outage took down the fetch path). The routing rests on tier positioning — Fable above Opus in capability,
Opus above Fable in throughput/cost — not on specific price points. If the notes later show a surprising
delta, revisit the aggressiveness, not the shape.

## Decision

Route by **where a wrong-but-plausible judgment is expensive** (→ Fable 5) vs **where throughput dominates**
(→ Opus 4.8) — the **fable-profile**:

| Role | Model | Rationale |
|---|---|---|
| house-shaper session (brainstorm · spec) | Fable 5 | design flaws are the most expensive to catch later |
| plan-check reviewer (4¼) | Fable 5 | one agent on one doc; proven load-bearing (Piece C retro) |
| merge-gate single reviewer (7) | Fable 5 | restores cross-architecture review of Opus-built code |
| merge-gate panel (high stakes) | Opus lenses + **Fable refuters** | cheap breadth for coverage; Fable where the verdict is decided |
| escalation rung (unit BLOCKED ×2 / debug stall) | Fable 5 | one smart retry before stopping for the user |
| house-orchestrator session | Opus 4.8 | conversational sequencing; long-lived so per-message cost dominates; judgment already delegated (per Jake — explicitly not Fable) |
| house-builder dispatches | Opus 4.8 | mechanical TDD throughput; also what *makes* the Fable review cross-architecture |
| health-sweep lenses + synthesis, research digests, doc-reconcile | Opus 4.8 | advisory / read-heavy fan-out; volume dominates |

**Fallback:** Fable unavailable → the opus-profile stands in (single-Opus reviewer; `model: 'opus'` refuters),
noted in the slice retro. Fail-closed rules (INCONCLUSIVE panel, unverified criticals block) are unchanged.

## Consequences

- Fable spend concentrates on low-volume, high-leverage calls (a handful of agents per slice); the high-volume
  fan-out (builders, lenses, sweeps) stays on Opus.
- The merge-gate regains both kinds of independence: architecture (Fable vs Opus-built code) *and*, at high
  stakes, perspective (the lens panel).
- Wired in: `house-orchestrator/SKILL.md` (routing bullet + stage-7 row), `house-shaper/SKILL.md` (routing
  note), `merge-gate-panel.js` (`model:` pins — lenses `opus`, refuters `fable`), `code-health-sweep.js`
  (`model: 'opus'` pins), `docs/process.{md,html}`. VERSION bumped to 0.5.0 (process-rule change).
