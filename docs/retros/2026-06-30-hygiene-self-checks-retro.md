# Retro — Piece B: wire the remaining hygiene self-checks (2026-06-30)

**Slice:** Piece B of the sdlc-skills ecosystem redesign. Shipped via **PR #2**, `main` `40a4166`.

**What shipped:** the doctrine's **auto-fix boundary** policy (conservative — destructive cleanups surfaced,
never silent); orchestrator **stage 2** strengthened resume git-reality (local+remote branches, worktrees,
**squash-merge caveat**) + **repo-setup readiness** (`.gitignore` coverage applied, `auto-delete-head-branch`
recommended-and-gated); orchestrator **stage 11** broad session-end hygiene sweep; `process.md`/`process.html`
updated to "all hygiene checks wired"; `VERSION` → 0.3.0.

## How it was built (stage ledger — fail-closed)

- **1 scope** ✓ · **2 spec** ✓ (user-reviewed gate) · **4 plan** ✓ · **5 build** ✓ (house-builder,
  DONE_WITH_CONCERNS, 5 commits) · **6 intake** ✓ · **7 merge-gate** ✓ (single refute-biased reviewer → GO,
  4 lenses re-verified) · **9½ docs-audit** ✓ · **10 PR+merge** ✓ (merge-commit, branch torn down) ·
  **11 reconcile** ✓
- **n/a:** 0 spike · 3 mockup · 8 CI (no CI repo) · 9 live/device (docs)
- **4¼ plan-check — SKIPPED (deviation, recorded):** scaled to light per the rigor dial (content/mechanical,
  user-co-designed); writing-plans self-review stood in.
- **7½ health-sweep — skipped:** advisory; small slice.

## Plan deviations / accepted cosmetics

1. **plan-check scaled to light** (above).
2. **Builder reported DONE_WITH_CONCERNS** over two cosmetic bugs in the *plan's own* Final-verification greps
   (a line-wrapped "Repo-setup hygiene readiness" label; a case-sensitive grep vs the capitalized "Auto-fix
   boundary." label). The builder correctly **refused to mangle the authoritative plan content to satisfy
   buggy greps** and surfaced it. The merge-gate verified the actual content is present and correct. **Accepted
   as-is** per the user (cosmetic, in a historical plan doc, no effect on shipped skill behavior) rather than
   spending a fix-up cycle.
3. **`process.md` label nuance** — "per-merge teardown at finish" vs the stage table's "stage 10 (PR + merge)";
   the merge-gate confirmed these name the *same point*. Accepted (not wrong).

## Decisions this slice

- **Auto-fix boundary = conservative** (canonical in the doctrine): auto-resolve only provably-safe,
  no-data-loss cases; surface everything destructive for the user's OK.
- Repo-setup readiness: `.gitignore` coverage = safe in-repo edit (apply); `auto-delete-head-branch` =
  repo-config change (recommend + gate on user OK).
- Enforcement stays process-level/prose, orchestrator-only (no script, builder untouched).

## Gate friction / notable

- Smooth build + first-pass GO. The DONE_WITH_CONCERNS was a *plan-quality* flag, not a build defect — the
  builder's honesty (don't bend authoritative content to pass a buggy check) worked as intended.
- **Dogfood:** the per-merge teardown ran clean again; the broad-sweep + squash-merge-caveat behavior we just
  shipped is now the orchestrator's own resume/reconcile discipline.

## Next

- **Piece C** — the `house-shaper` skill: front-of-loop research/brainstorm → reconcile (dialogue inline;
  research + reconcile dispatched to subagents). Last piece of the redesign.
