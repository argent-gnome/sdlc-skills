# Retro — Piece C: the house-shaper skill (2026-06-30)

**Slice:** Piece C (the keystone) of the sdlc-skills ecosystem redesign. Shipped via **PR #3**, `main`
`79ee639`, `VERSION` 0.4.0. **Completes the three-piece redesign.**

**What shipped:** a new `skills/house-shaper/SKILL.md` (third user-run session role — research + brainstorm +
reconcile → ready-to-build work OR a recorded decision; heavy work in subagents, dialogue inline); the
**reconcile-subagent** promoted to a named doctrine pattern; the orchestrator **redirect guard** +
**front-end collapse** (stages 0–4¼ → "confirm shaper artifacts") + four blast-radius fixes; `process.md` +
`process.html` + `README` two skills → three.

## How it was built (stage ledger — fail-closed)

- **1 scope** ✓ · **2 spec** ✓ (user-reviewed) · **4 plan** ✓ · **4¼ plan-check** ✓ **(RAN for real)** ·
  **5 build** ✓ (house-builder, DONE, 6 commits) · **6 intake** ✓ · **7 merge-gate** ✓ (NO-GO → fix-up → GO) ·
  **9½ docs-audit** ✓ · **10 PR+merge** ✓ (merge-commit, branch torn down) · **11 reconcile** ✓
- **n/a:** 0 spike · 3 mockup · 8 CI (no CI repo) · 9 live/device (docs)
- **7½ health-sweep — skipped:** advisory.

## Plan deviations / what the gates caught

1. **Plan-check RAN for real here** (unlike A/B, which scaled it to light) — a deliberate rigor-dial call for
   the orchestrator-rewrite stakes. It **caught 4 must-fix dangling references** the front-end collapse would
   have orphaned (Audibles re-plan bullet, rigor-dial stage-0/mockup, Gates list spec/mockup, and the
   `process.html` role section being a 2-card CSS grid not a table). Folded before build.
2. **Merge-gate NO-GO** on a **plan-coverage gap:** Task 4 corrected the `process.md` ⛔ legend but never added
   the matching `process.html` prose edit, so the published HTML still said "the orchestrator stops for spec
   review + mockup sign-off" — the exact contradiction the slice exists to remove. Resolved via a one-line
   fix-up builder (`529eb70`), independently re-verified, then GO.

**The headline lesson:** layered rigor worked exactly as designed — **plan-check caught the *structural*
blast radius; the independent merge-gate caught the one *prose* spot that the plan, the build, and the
builder's own verifies all missed.** A vindication of the verification doctrine (don't trust the report;
spec-compliance checked independently from the build).

## Decisions this slice (see spec)

Own user-run session role · hand-off seam through plan-check (orchestrator slims to build/gate/merge) ·
conservative redirect guard · decision-only mode · reconcile-subagent promoted to doctrine · VERSION 0.4.0 ·
one slice.

## Action required (Jake)

**Re-run `./install.sh`** from the repo root to symlink the new `house-shaper` skill into `~/.claude/skills/`
(then `/reload-skills` or restart). Until then the skill exists in the repo but isn't registered.

## Redesign complete

Three pieces, all shipped the full house way (brainstorm → spec → plan → build → independent gate → reconcile),
hygiene clean throughout: **A** doctrine + dev-state contract + 2 live self-checks · **B** the remaining
hygiene self-checks · **C** the house-shaper front-end + orchestrator slim-down. The ecosystem is now three
token-lean session roles — shaper / orchestrator / builder — over a shared doctrine.
