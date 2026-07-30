---
id: "0005"
kind: adr
title: "The reviewed diff must equal the merged diff; base_sha is only meaningful relative to the remote"
status: "proposed (raised at the 0007 ship reconcile, 2026-07-30)"
state: proposed
date: 2026-07-30
slices: ["0007-validate-strict-nested-fence-false-positive"]
superseded_by: null
---
# ADR 0005 — the reviewed diff must equal the merged diff; `base_sha` is only meaningful relative to the remote

**Date:** 2026-07-30 · **Status:** proposed (raised at the `[0007]` ship reconcile; the *what* is settled,
the *enforcement strength* is the open question a shaping pass must rule on)

## Context

Doctrine §5 defines the merge gate's subject in one line: *"the reviewed diff is `git diff
$(base_sha)...HEAD`, with `base_sha` recorded on the manifest at branch time."* It says nothing about where
`base_sha` must live. Read literally, any commit-ish satisfies it — and a local commit that has never been
pushed satisfies it too.

**What happened on `[0007]` (2026-07-30).** At branch time the orchestrator recorded `base_sha`
`c2f88db` — local `main` HEAD, and the shaping commit for this slice. `c2f88db` had never been pushed, so
`origin/main` was still `d299ae3`. GitHub therefore computed the squash merge base against `origin/main`:
PR #13 squashed into `85731f3` whose parent is `d299ae3`, absorbing the shaping commit that `base_sha`
treated as already-landed.

The consequence is a divergence between two diffs that the doctrine assumes are the same one:

| | range | contents |
|---|---|---|
| what the merge gate reviewed | `c2f88db...HEAD` | the code fix + its records |
| what actually landed on `main` | `d299ae3...85731f3` | the same, **plus** `c2f88db`'s shaping records |

**Benign in this instance, and verified so rather than assumed:** the extra content was `[0007]`'s own
shaping records, already covered by `spec_review` and `plan_check`, and `c2f88db` was verified
byte-identical against `origin/main` before the merge. **The general shape is not benign.** Content can
reach `main` that the reviewed diff never contained, and nothing in the loop notices — the gate record says
GO about a range that is not the range that shipped.

**Two things make the failure quiet.** First, a squash merge synthesizes a new commit against the *remote*
base, so the divergence exists only between a local field and a server-side computation and appears in no
diff anyone looks at (this is the same asymmetry doctrine §5's squash-merge caveat already warns about for
branch pruning). Second, `git diff c2f88db...HEAD` is perfectly well-formed and green; the defect is not
detectable by examining the reviewed diff at all, only by comparing `base_sha` to the remote.

**This is the second failure of the same field, in the opposite direction.** `[0004]` cut its branch at
pre-fold HEAD `9a39d76` and committed the plan-check record, the folds and the kickoff to `main`
*afterwards*, so the builder built without its own folded plan; the recorded lesson was *commit every
shaping record BEFORE cutting the branch — `base_sha` must point at the full record*. `[0007]` obeyed that
lesson exactly and still failed, because the lesson was missing a word: **push**. One field, two ways to be
wrong, and both ways are invisible until something downstream reads it.

## Decision

**Two invariants, stated so a future reader does not have to rediscover them.**

**1. The reviewed diff must equal the merged diff.** The merge gate's verdict is *about a range*. If the
range that lands differs from the range that was reviewed, the verdict is void for the difference — no
matter how benign the difference turns out to be. "It was only records" is a finding to be verified after
the fact, not a property of the design.

**2. `base_sha` is only meaningful relative to the remote default branch.** A sha that is not reachable
from `origin/<default>` is not a valid `base_sha`, because the merge that will eventually be computed
against that remote will not use it. `base_sha` is a claim about what has already landed, and "landed"
means landed *there*.

**Enforcement, in two halves — a kernel guard and an ordering rule:**

- **Kernel guard.** `house pr <id> --base-sha <sha>` verifies the sha is reachable from the remote default
  branch and refuses, or at minimum warns loudly, when it is not. Degrade gracefully where the question is
  unanswerable — no remote, no network, detached setup — rather than blocking work on a repo the check
  cannot reason about.
- **Orchestrator ordering rule.** *Push `main` before cutting the slice branch*, and *commit every `house`
  record write before any `gh pr merge` or `git reset`.* The first clause closes this ADR's defect at the
  source; the second closes its sibling, below.

**Doctrine §5's definition gains the qualifier it is missing** — `base_sha` is recorded at branch time
**from a pushed commit** — so the rule stops being obeyable by accident only.

**The second clause of the ordering rule was itself violated during this very ship**, twice, which is why
it is written down here rather than left as hygiene:

- `house pr --set` ran *after* the final commit, so the `pr_set` record was uncommitted when
  `gh pr merge --squash --delete-branch` ran; the merge succeeded remotely and only the **local** cleanup
  aborted.
- The original `work.discovered` event recording this whole finding was appended to `.house/events.jsonl`
  and not committed, and was then **destroyed** by the `git reset --hard origin/main` that reconciled
  diverged local `main`. An uncommitted append to an append-only log does not survive a hard reset. The
  event was re-emitted, and the re-emission says so in its own payload. The discarded commit remains
  reachable from the local tag **`pre-0007-squash-main`**, which is the recovery point.

## Consequences

- **The merge gate gets a precondition it did not have.** Today the gate's inputs are the diff, the spec and
  the suppression ledger; this adds *"and `base_sha` is remote-reachable."* A reviewer handed a `base_sha`
  that fails the check should treat the range as unknown rather than review it anyway — which makes this a
  fail-closed question in the doctrine §4 sense, not a lint.
- **A cheap check kills a class, not an instance.** The reachability test is one `git merge-base --is-ancestor`
  against the remote default branch. It costs nothing per slice and it is the only place in the loop where
  the local-vs-remote confusion is *observable* before the merge.
- **Enforcement strength is deliberately left open.** Refusing outright is the fail-closed instinct, but
  `house pr` is a recording command and a refusal there can strand a slice mid-merge with the PR already
  open. The ADR is `proposed` precisely because that trade-off deserves the shaping pass that implements it,
  and because the sibling ordering rule may belong in the `house-orchestrator` skill, in doctrine §5, or in
  both — that routing is not settled here.
- **The ordering rule is the expensive half to obey and the cheap half to state.** Nothing enforces "commit
  the record before the destructive git operation" — no hook fires on `git reset`. It stays a discipline,
  and this ship is the evidence for what it costs when it lapses: one destroyed OBSERVED event, recovered
  only because the loss was noticed immediately and a tag had been cut.
- **`slice.yaml`'s `adrs:` list cannot record this ADR yet.** `adrs: []` is written once at
  `house new` (`cli/lib/slices.js:76`) and no `house` command updates it, so the slice→ADR edge is
  currently registered on the **ADR** side only (this file's `slices:` frontmatter). Closing that gap needs
  a writer, which is itself a small kernel-integrity item rather than something to fix by hand — hand-editing
  `slice.yaml` would break the one-writer-per-field invariant this whole layer exists to hold.
- **Recorded here rather than in the roadmap because the *why* is the non-obvious part.** The backlog item
  can say "verify `base_sha` against the remote"; only an ADR can say why a field that reads correct, in a
  diff that is green, about a merge that succeeded, was nevertheless the wrong question — and a future
  reader who finds the guard and thinks it pedantic is exactly who this file is for.
