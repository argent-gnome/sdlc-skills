# Retro — 0007: `validate --strict` nested-fence false positive

Written at the post-merge-gate reconcile, 2026-07-30, in `live_check` — before the ship, per the `[0003]`
lesson. **Optional at this tier:** `[0007]` is `patch` rigor, so no retro was owed. It is written anyway
because one kernel-owned record was **repaired by hand** during the build, and a manual intervention on the
OBSERVED/DECLARED layers is the one thing a patch-tier slice should never leave to a transcript. Sources:
`gates/merge_gate.yaml`, `units/01-report.md`, `.house/events.jsonl`, this plan's As-built.

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

## Carried forward

Three `work.discovered` findings, all in the roadmap's `[0007]` build backlog, none blocking: the phantom
`report` verb, `house event --payload` being documented as `--note`, and the unanchored-truncation bug —
which the gate then sharpened into a **two-call-site** fix, since the `heartbeat` branch at
`cli/lib/slices.js:235` uses a first-occurrence string replace with the same hazard shape and a quieter
failure mode (a heartbeat inserted in the wrong place, exit 0, nothing deleted).
