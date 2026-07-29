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

*Verified against the release notes (fetched same day, after the outage cleared):* Fable 5 and Opus 4.8 are
**priced identically** ($10 / $50 per Mtok) — there is no cost penalty for Fable. Fable's edge is capability
(top score on Cognition's FrontierCode; "stayed focused across millions of tokens" on long-horizon agentic
work; strongest document/chart reasoning). So the routing does NOT rest on cost. Throughput roles stay on
Opus for three reasons that survive price parity: (1) **cross-architecture independence** — the merge-gate
only reviews with different-model eyes if the builders are NOT Fable; (2) **fast mode** — Opus's faster
output is real wall-clock on high-volume TDD loops and fan-out lenses; (3) **resilience** — Fable's
dual-use safeguards and newer endpoints make Opus the sturdier default for unattended volume (Anthropic
itself names Opus the fallback when Fable's safeguards restrict a query). Moving builders to Fable was
considered and declined: it would buy builder capability at the cost of (1).

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

> **Erratum (2026-07-28, recorded at S3 shaping):** house v2 doctrine §3 narrows this fallback for **hard
> gates** (every `gate_verdicts` rung): Fable unavailable ⇒ **halt at `gate.requested` and wait for a
> human** — the reviewer is never downgraded to keep moving. The opus-profile stand-in above remains
> legitimate only for advisory, non-gate roles (research digests, lenses, sweeps). Settled in the S2 spec's
> "Settled contradictions" (user-approved 2026-07-28); recorded here so this ADR no longer reads as a
> blanket fallback.

## Consequences

- Fable takes the low-volume, high-leverage calls (a handful of agents per slice); the high-volume fan-out
  (builders, lenses, sweeps) stays on Opus for independence, fast-mode wall-clock, and resilience — price
  parity makes cost a non-factor either way.
- The merge-gate regains both kinds of independence: architecture (Fable vs Opus-built code) *and*, at high
  stakes, perspective (the lens panel).
- Wired in: `house-orchestrator/SKILL.md` (routing bullet + stage-7 row), `house-shaper/SKILL.md` (routing
  note), `merge-gate-panel.js` (`model:` pins — lenses `opus`, refuters `fable`), `code-health-sweep.js`
  (`model: 'opus'` pins), `docs/process.{md,html}`. VERSION bumped to 0.5.0 (process-rule change).
