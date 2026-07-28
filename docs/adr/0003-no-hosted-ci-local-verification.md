# ADR 0003 — no hosted CI; the verification bar is local

**Date:** 2026-07-28 · **Status:** accepted (owner call, 2026-07-28)

## Context

The house process has a stage-8 "CI green" check inherited from the generic loop, and the doctrine's hygiene
checklist assumes a repo may have hosted checks gating a PR. This repo has none: there is no
`.github/workflows` directory and no GitHub Actions run has ever gated a house PR here.

That is not an oversight. GitHub Actions minutes run out on this account, and the owner will not pay for
them — so any workflow wired up would be green until the quota lapsed and then a permanently-red or
permanently-skipped check that the process would learn to ignore. A gate that is sometimes unavailable is
worse than no gate: it trains everyone to wave it through.

The verification the check was standing in for already happens, twice, and it happens *harder* than a
workflow would. The house v2 S1 slice made this concrete — the `house` CLI ships with `cd cli && npm test`
and `house validate`, both runnable from a bare terminal in under a second, and the adversarial merge-gate
reviewer at the S1 gate re-ran both itself rather than reading the builder's claim that they passed. That
re-run is the load-bearing part: it is an independent execution by a different agent, which is exactly the
property hosted CI is bought for.

## Decision

**No hosted CI on this repo.** Do not create `.github/workflows`; do not wire GitHub Actions, or any other
hosted runner, into the house loop here.

The verification bar is **local, and unchanged in rigor**. Forward motion past the build stage requires both:

- `cd cli && npm test` — green
- `house validate` — exit 0

Enforced by the house process itself, in two passes:

1. **The builder runs them** as part of its unit self-review and reports the result.
2. **The adversarial merge-gate reviewer independently re-runs them** and reads the actual output —
   **never trusting the builder's report.** This is the enforcement; the builder's run is a fast-fail
   convenience, not evidence.

This is the same fail-closed shape as every other house gate: an unrecorded (or unverified) pass is not a
pass. See [ADR-0002](0002-house-v2-state-first-redesign.md).

## Consequences

- The stage-8 **"CI green" check is permanently n/a on this repo.** It is not skipped or deferred — the
  merge-gate's independent local re-run *is* the bar it names. A gate report here should say "n/a — local
  verification per ADR-0003", not "CI green".
- The merge-gate reviewer's re-run becomes load-bearing rather than belt-and-braces. A reviewer that accepts
  the builder's word for a green suite has removed the only enforcement point, and that is a merge-gate
  defect, not a shortcut.
- Verification stays fast and offline: a full pass is two commands and no network, which is what keeps the
  "`git clone` + a text editor is sufficient" clause of ADR-0002 true for the *checks* as well as the state.
- Portability of the local commands matters more without a pinned runner to normalize the environment —
  e.g. `node --test test/*.test.js` relies on POSIX shell glob expansion. Recorded on the roadmap's S2 carry
  list; moot while the only environment is local macOS.
- **Any future CI wiring needs a new decision** (an ADR superseding this one), including the funding call it
  implies. Nobody adds a workflow file as an incidental part of another slice.
