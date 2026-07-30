# Retro — 0007: `validate --strict` nested-fence false positive

Written at the post-merge-gate reconcile, 2026-07-30, in `live_check` — before the ship, per the `[0003]`
lesson. **Optional at this tier:** `[0007]` is `patch` rigor, so no retro was owed. It is written anyway
because one kernel-owned record was **repaired by hand** during the build, and a manual intervention on the
OBSERVED/DECLARED layers is the one thing a patch-tier slice should never leave to a transcript. Sources:
`gates/merge_gate.yaml`, `units/01-report.md`, `.house/events.jsonl`, this plan's As-built.

> **Extended at the ship reconcile, 2026-07-30**, with the merge-time facts — see *"Ship-time friction"*
> below. Extended rather than rewritten: the sections above were written before the merge and are left as
> they were, because what a retro predicted before a merge is worth more unedited than tidied. The ship
> turned out to produce a **larger** finding than the build did.

## What shipped

Line-oriented fence tracking replaced the byte-oriented `` ```…``` `` regex pair in `house validate
--strict`: an exported `stripFences()` in `cli/lib/validate.js`, the strip pipeline reordered to
fences → HTML comments → code spans, `~~~` fences handled for the first time, and an unclosed fence
deliberately **not** hiding the rest of the document. Suite 72 → 77. The repo's only `--strict` red cleared
as a *consequence*, with `docs/slices/0003-…/plan.md` byte-identical at base, at HEAD, and in the working
tree — the acceptance evidence intact rather than spent. Detail lives in `units/01-report.md`; it is not
restated here.

## The manual intervention — a CLI bug ate part of the record it was writing

`house unit … finalize` rewrites everything from the result heading down via an **unanchored**
`/## Res…[\s\S]*$/` match (`cli/lib/slices.js:244`). Unit 01's report documented that very hazard in prose
that spelled the heading out inline, so finalize matched the *sentence* instead of the heading and deleted
the rest of the section plus the heading it was meant to fill. The builder repaired the report by hand and
disclosed it.

Three things worth carrying:

- **The bug was found by being bitten, not by review.** It had been latent since S1 and no lens would
  plausibly have caught it — the report is only written *by* the command, so the defect only exists while a
  report is being produced. Getting bitten inside a slice that then routes the finding is the cheap version
  of this.
- **A hand-repair of a kernel-owned file is legitimate here, and only because of what stayed true.** The
  DECLARED record (`slice.yaml`: unit 01 `finalized` / `DONE`) and the OBSERVED record (`unit.report` at
  01:23:34Z) were both written correctly; the damage was confined to prose in the report body. Nothing was
  reconstructed from memory, so the one-writer-per-field invariant was never actually broken. Had the
  manifest or the event been wrong, the answer would have been the CLI, not an editor.
- **The workaround it forced is a rule nobody should have to know:** a unit report must not contain the
  result heading's literal text anywhere in its body. That rule disappears the moment line 244 is anchored,
  which is why the fix is routed rather than remembered.

## Gate friction — the inconsistency, not either edit

The merge gate (GO, `fable-reviewer`, four lenses, zero R-1…R-5 violations) raised two preference-level
notes, both about **records discipline rather than code**, and both are now resolved in docs:

- The unit-01 reconcile retro-edited the approved plan's test-count table while **declining**, on
  approved-plan hygiene grounds, to fix the plan's `house event … --note` quotation — a command that exits 1
  under the flag guard `[0003]` added. Two defensible instincts applied in opposite directions in one pass.
  The plan's **As-built** section existed for exactly this and was empty. Resolved per doctrine §6 (as-built
  drift reconciles in the plan): the command is corrected in place, both edits are disclosed in As-built, and
  the general rule is folded into the roadmap's hygiene item.
- The 01:17:04Z `work.discovered` payload misattributed the phantom `house unit … report` verb to the
  kickoff brief and the `house-builder` skill; **neither names it** — it came from the orchestrator's
  improvised dispatch prompt. The event log is append-only, so the payload stands and the roadmap carries
  the correction explicitly, with a note telling a reader which of the two to trust for what.

Both notes share a shape worth naming: **the record was wrong in a direction that would have aimed a future
fix at an innocent file.** Neither could block a merge, and both would have cost the next author real time.

## Deviations

**None in the code.** T1–T3 built verbatim to plan, all five No-Go guards held, and spec R-3's sanctioned
deviation route — a genuine marker newly exposed by the corrected stripper — never fired, because the
blast-radius measurement found zero files going green → red in the builder's count *and* in the reviewer's
independent re-measurement. The only divergences on this slice were the two documentation edits above.

## Ship-time friction — three orderings, all the same defect

Added 2026-07-30 at the ship. The slice shipped clean —
[PR #13](https://github.com/argent-gnome/sdlc-skills/pull/13) squashed to `85731f3`, `main` at `2245f09`,
`live_check` **approved** by the user running `house validate --strict` himself from a bare terminal (no
output, exit 0), 77/77 on merged `main`, `0003/plan.md` still `178a1e9`. **The friction was entirely in the
orchestrator's ordering of git and record writes, and all three incidents are one root cause:** a `house`
record was written but not yet committed when something else — GitHub, or `git` — read the world instead.

**1. `base_sha` pointed at a local-only commit, so the merged diff was a superset of the reviewed diff.**
`base_sha` was `c2f88db`, local `main` HEAD, never pushed; `origin/main` was still `d299ae3`. GitHub computed
the squash against the remote, so `85731f3`'s parent is `d299ae3` and the merge **absorbed this slice's own
shaping commit**. The merge gate reviewed `c2f88db...HEAD`; `d299ae3...85731f3` landed. Verified benign before
the merge completed — the extra content was `[0007]` shaping records already covered by `spec_review` and
`plan_check`, and `c2f88db` was checked byte-identical against `origin/main` — but the general shape is a
hole in the merge gate, and it is now [ADR-0005](../../adr/0005-reviewed-diff-equals-merged-diff.md)
(`proposed`) plus a backlog item.

**What makes this worth a retro paragraph and not just a bug report:** `[0004]`'s retro already routed a
lesson about this exact field — *commit every shaping record BEFORE cutting the branch* — and `[0007]`
**obeyed it**. Every shaping record was committed first. The lesson was still wrong, because it was missing
the word **push**. A rule derived from one failure covered one direction of a two-directional defect, and
obeying it produced false confidence rather than safety. That is the transferable lesson: after fixing an
ordering bug, ask what *else* reads the field, not just what wrote it wrong last time.

**2. `gh pr merge --squash --delete-branch` aborted its local cleanup.** `house pr --set` ran *after* the
final commit, so the `pr_set` record was an uncommitted change when the merge ran. The merge succeeded
remotely; only the local checkout step aborted, and the branch had to be pruned by hand. Cosmetic on its own
— and the same ordering defect as (1), one layer down.

**3. The `work.discovered` event recording all of this was destroyed, and had to be re-emitted.** The
original was appended to `.house/events.jsonl` at ~01:47Z and not committed. The `git reset --hard
origin/main` that reconciled diverged local `main` then discarded it: **an uncommitted append to an
append-only log does not survive a hard reset.** The re-emission at 01:44:34Z says so in its own payload, and
the discarded commit is still reachable from the local tag **`pre-0007-squash-main`**.

Two things this one teaches, neither of which was obvious before it happened:

- **Append-only is a property of the file's *semantics*, not of its durability.** The kernel's OBSERVED layer
  is protected against editing and rewriting; it is protected against destruction only by `git`, and only
  once committed. The window between `house event` and `git commit` is the one place where OBSERVED can
  silently lose a row — which is exactly the "quiet lie" class the layer exists to prevent.
- **The tag is what made this recoverable.** Cutting `pre-0007-squash-main` before the destructive operation
  was a reflex, not a plan, and it is the entire difference between "re-emitted with a note" and
  "reconstructed from memory" — which the `[0003]` and `[0004]` retros both establish as the thing you must
  never do to a record.

## Carried forward

**Four** `work.discovered` findings now, not three — and the roadmap frames them as **one** patch-tier
candidate slice on kernel record integrity rather than four items, so a shaper does not mint them
separately. The fourth is the ship's `base_sha` finding above, with its *why* in
[ADR-0005](../../adr/0005-reviewed-diff-equals-merged-diff.md) and its fix in two halves (a `house pr`
remote-reachability guard, and an orchestrator ordering rule that subsumes the `[0004]` follow-up). It is
the only one of the four that can let unreviewed content reach `main`, so it sets that slice's tier.

**ADR-0005 is registered on this slice from the ADR side only.** Its `slices:` frontmatter names `[0007]`;
this slice's `slice.yaml` still reads `adrs: []`, because that field is written once at `house new`
(`cli/lib/slices.js:76`) and **no `house` command updates it** — so the reverse edge needs a writer, not a
hand-edit. Recorded here rather than fixed, since hand-editing `slice.yaml` would break the
one-writer-per-field invariant. It is a candidate part of the same kernel-integrity slice.

The three build findings, all in the roadmap's `[0007]` build backlog, none blocking: the phantom
`report` verb, `house event --payload` being documented as `--note`, and the unanchored-truncation bug —
which the gate then sharpened into a **two-call-site** fix, since the `heartbeat` branch at
`cli/lib/slices.js:235` uses a first-occurrence string replace with the same hazard shape and a quieter
failure mode (a heartbeat inserted in the wrong place, exit 0, nothing deleted).
