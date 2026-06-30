# Retro — Piece A: shared docs & hygiene doctrine (2026-06-30)

**Slice:** Piece A of the sdlc-skills ecosystem redesign. Shipped via **PR #1**, `main` `95bd854`.

**What shipped:** runtime `references/doctrine.md` (doc-model · dev-state allowlist · routing · hygiene
checklist), reshaped `dev-state.template.md` to the allowlist, orchestrator + builder citations, two live
self-checks (**dev-state lint @ stage 11**, **per-merge teardown @ stage 10**), a `process.md`/`process.html`
doctrine section, `VERSION` → 0.2.0.

## How it was built (stage ledger — fail-closed)

- **1 scope** ✓ (brainstorming) · **2 spec** ✓ (brainstorming → spec, user-reviewed gate) · **4 plan** ✓
  (writing-plans) · **5 build** ✓ (house-builder, DONE, 6 commits) · **6 intake** ✓ · **7 merge-gate** ✓
  (single refute-biased reviewer → GO, all 4 lenses re-verified) · **9½ docs-audit** ✓ (change *is* docs;
  md/html parity confirmed by builder + reviewer) · **10 PR+merge** ✓ (merge-commit, branch torn down) ·
  **11 reconcile** ✓ (this file + dev-state)
- **n/a:** 0 spike · 3 mockup (no UI) · 8 CI (no CI on this repo) · 9 live/device (docs)
- **4¼ plan-check — SKIPPED (deviation, recorded):** scaled to *light* per the rigor dial (content/mechanical,
  user-co-designed); the writing-plans self-review stood in for the independent fresh-reviewer pass.
- **7½ health-sweep — skipped:** advisory; a tiny docs slice doesn't warrant it.

## Plan deviations

1. **plan-check scaled to light** (above) — surfaced to the user at dispatch time, not silent.
2. **`process.html` markup:** builder used `<b>` (not the plan's literal `<strong>`) to match the file's
   house style — explicitly plan-sanctioned ("match existing markup conventions").

## Decisions this slice (see spec + ADRs)

- Doctrine **scope = focused** (docs + hygiene only); **enforcement = active self-checks at gates**; **A goes
  live** with two checks (lint @ s11, teardown @ s10), the rest deferred to Piece B.
- **`roadmap.md` = blessed-canonical** name for the durable-strategy doc.
- Doctrine lives under `house-orchestrator/references/`, cited by `$HOME` path (no `install.sh` change, no
  always-loaded weight).

## Gate friction / manual interventions

- None this slice — build and merge-gate both passed clean on the first pass.
- **Dogfood win:** the brand-new per-merge teardown ran immediately on its own first merge — verified 0 stale
  branches/worktrees/stashes afterward.

## Next

- **Piece B** — wire the remaining self-checks (resume git-reality strengthening + the squash-merge caveat,
  broad session-end hygiene sweep, one-time repo-setup readiness) into the loop stages.
- **Piece C** — the `house-shaper` skill (front-of-loop research/brainstorm → reconcile; dialogue inline,
  research + reconcile in subagents).
- **Token-load-count self-check idea — dropped** per Jake (he'll watch context manually and restart sessions
  himself); not carried into Piece B.
