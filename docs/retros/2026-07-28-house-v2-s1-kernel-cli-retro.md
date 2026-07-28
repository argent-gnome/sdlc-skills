# Retro — house v2 S1: kernel + `house` CLI (2026-07-28)

**Slice:** S1 of the **house v2** program ([ADR-0002](../adr/0002-house-v2-state-first-redesign.md)). Shipped
via **PR #6**, `main` `4a6a906` (merge commit), branch `feat/house-v2-s1-kernel-cli`. Plan:
[`superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md`](../superpowers/plans/2026-07-28-house-v2-s1-kernel-cli.md).

**What shipped:** the state-first kernel — `schema/enums.yaml`, the slice-dir scaffold, `events.jsonl`, and the
`house` CLI (`new/init/event/gate/task/state/status/list/next/validate/index/render`). An 11-task TDD plan,
built by **ONE Opus house-builder dispatch** in a worktree. **43/43 tests** green (the plan specified 25; the
builder added 18 defending rules the plan left undefended); `house validate` exit 0; index rebuild
byte-identical. The repo **dogfoods it**: `.house/` initialized, slice `0001-house-v2-s2-skills-rewrite`
minted, and `docs/dev-state.md` is now rendered from the index above the `<!-- house:manual -->` marker.

## How it was built (stage ledger — fail-closed)

- **0–4¼ shaping** ✓ — RAN in a prior `house-shaper` session (spec approved by the owner, plan-check
  **GO-WITH-FIXES**, [ADR-0002](../adr/0002-house-v2-state-first-redesign.md)).
- **5 build** ✓ — one Opus `house-builder` dispatch, reported **DONE_WITH_CONCERNS**.
- **6 intake** ✓ · **7 merge-gate** ✓ — a **single refute-biased Fable reviewer** per the rigor dial (normal
  stakes, no user data → no panel). Verdict **GO with one condition**.
- **7½ health-sweep — SKIPPED (allowed).** Greenfield `cli/`, just adversarially reviewed; the multi-agent
  Workflow needs the user's ultracode opt-in, which wasn't given. The merge-gate's minor findings were carried
  to the S2 carry list instead of sweeping.
- **8 CI — n/a, permanently.** [ADR-0003](../adr/0003-no-hosted-ci-local-verification.md) (no hosted CI); local
  verification ran **independently twice** — builder, then reviewer.
- **9 live-validation** ✓ — ran as a **CLI dogfood on the real repo**: builder and reviewer both exercised the
  refusal paths live through the installed binary. The owner approved the merge on that evidence.
- **9½ docs-audit** ✓ — doc-reconcile subagent fixed roadmap S1-row drift, added ADR-0003, and extended the S2
  carry list (`f7b45cf`, on the slice branch).
- **10 PR + merge** ✓ — owner-approved, merge commit, **full teardown**: worktree removed, local *and* remote
  branch deleted (remote via the newly enabled auto-delete-head-branch).
- **11 reconcile** — this PR.

## Manual interventions (owner decisions, 2026-07-28)

- **No hosted CI** — the verification bar is local (→ [ADR-0003](../adr/0003-no-hosted-ci-local-verification.md)).
  Reason: won't pay for GitHub Actions minutes.
- **auto-delete-head-branch ENABLED** on the repo, after learning it's free (the owner had believed it was paid).
- Stale `shape/house-v2-design` remote branch deleted at resume.
- Merge approval on PR #6.

## Plan deviations

Both were **surfaced by the builder, neither absorbed silently**; the merge-gate reviewer **reproduced each
independently** and adjudicated both **ACCEPTED**.

1. **D1 — test script.** The plan's `node --test test/` dies on Node 26 before running any test. Shipped
   `node --test test/*.test.js` (POSIX shell glob). Windows caveat recorded in the S2 carry list.
2. **D2 — `renderDevState` order of operations.** The plan's *literal* code silently dropped hand content
   appended after the closing manual marker — contradicting its own must-fix **MF6**. The builder ruled that
   **the MF6 commitment outranks the literal code**, reordered the leftover probe, and added tests.
3. **Disclosed extras:** `cli/.gitignore`, `.claude/worktrees/` in the root `.gitignore`, `docs/health/.gitkeep`.

## Gate friction / what the process caught

- The adversarial merge-gate found a **real residue the builder's own fix missed**: hand content wedged
  *between* the end of the generated block and the `<!-- house:manual -->` marker still drops silently
  (inherited from the plan's literal code; the region is banner-labeled and everything is git-recoverable). It
  was **refuted from a blocker down to the GO condition** — and now heads the
  [S2 carry list](../roadmap.md#s2-carry-list--fold-forward-from-s1).
- Also validated live through the binary — never trusting the builder's report: enum single-sourcing,
  one-writer-per-layer, fail-closed verdicts (including `INCONCLUSIVE`), and evidence-gated ticks.
- **Model routing held** ([ADR-0001](../adr/0001-fable-profile-model-routing.md), fable-profile): Opus built and
  doc-reconciled; Fable ran the merge-gate. One builder dispatch — no escalation rung needed.

## Fold-forward

- The **[S2 carry list](../roadmap.md#s2-carry-list--fold-forward-from-s1)** in `roadmap.md`: the GO condition +
  6 merge-gate findings + 7 earlier carried items.
- Spec **§3.5 `slice.merged` vs the shipped `slice.shipped`** enum drift must reconcile **before S2 writes the
  merge projection**.

## Next

- **S2 — skills rewrite + doctrine v2 + hooks.** Slice `0001-house-v2-s2-skills-rewrite` is minted as an idea;
  shape it in a `house-shaper` session.
