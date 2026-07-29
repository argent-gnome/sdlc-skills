# Retro — 0004-house-v2-s3b (S3b): the v2 cutover

Written at ship, 2026-07-29 — before the `shipped` flip, because the validator taught the orchestrator
that lesson on 0003. Sources: `.house/events.jsonl`, gate records, unit 01 report, PR #11.

## What shipped

The end of the migration window: v1's seven skill files and two orphaned workflows archived
byte-identical to `archive/skills-v1/`; the three v2 skills renamed to canonical `house-*` in the same
commit; live surfaces swept with history preserved as written; `install.sh` gained a repo-scoped
dangling-link prune with a committed behavioral test; both process banners, ADR-0004's closure note,
and the board updated. Executed as a coordinated live_check with the user: merge → install →
namespace verify (3 canonical, 0 house2, 0 dangling) → reload → confirmed.

## The slice that changed shape twice

Minted as "proving-pair migration and cutover"; died as a premise within the hour when the user
revealed edge-scanner was a dead project (the research digest independently confirmed: NO-GO recorded
2026-07-22). Re-scoped by ADR-0004 amendment to cutover-only, **parked** on athlete-data shipping its
first v2 slice — which happened the same day (adopted shaping, fresh v2 merge gate, on-device
live_check, one honest platform-limitation DEVIATION). The user ruled the condition satisfied with the
plan-check letter-gap recorded rather than papered over. Park-with-banked-research beat
abandon-and-remint: the unpark shaping was half done before it started.

## What went wrong, on the record

- **The orchestrator cut the branch before committing the shaping records.** The dispatch chain ran
  `git branch` at pre-fold HEAD, then committed plan-check folds + kickoff + gate record to main. The
  builder built from a branch with no plan_check.yaml and no dispatch record — explaining both of its
  strangest findings (a "fabricating" reconciler that was actually citing main's truth, and a
  self-minted unit record). Fixed by merging main into the branch and reconciling four record
  conflicts. **Lesson, now doctrine-worthy: commit every shaping record BEFORE cutting the branch;
  base_sha must point at the full record.**
- **The orchestrator then committed a merge conflict marker** (a `tail -8` hid extra conflicts;
  `git add -A` staged one). The dev-state renderer refused to run until it was fixed — the sixth time
  today the system caught one of its own operators.
- **The builder finalized DEVIATION, not DONE, and was right every time:** T2's planned verify was
  unsatisfiable (the protected ADR-0004 filename contains the swept token — corrected to a
  discriminating form and proven to fail on reintroduction); `cli/README.md` sat inside a literally-
  worded scope guard that the spec contradicted (orchestrator ruled: spec wins, guard meant code);
  the A3 commitment implied a committed test file the plan never named.

## What worked

- **The worktree strategy** (a plan-check advisory, folded): the machine-global skill namespace never
  broke during the build — main stayed checked out on `main`, and the namespace flipped only at merge,
  with the user present. The flip itself was elegant: the old v1 links pointed at paths v2 moved into,
  so canonical names went live the instant main was pulled; the prune then removed the three dead
  `house2-*` links.
- **First-pass GO at the merge gate** despite the record turbulence — because every deviation carried
  a record the reviewer could verify instead of re-litigate, including refutation checks it ran itself.
- **Archive, never erase**: every v1 byte is still in the repo, diffable, re-linkable by hand.

## Follow-ups

- `docs/index.html` lede + line 44 still say "pair"/"two skills" — recorded `work.discovered`,
  roadmap backlog (v1 surface; only the footer was in the folded A5).
- plan.md's as-built retains a pre-merge "no plan_check record" claim, superseded by the restored
  record — disclosed in the same file; a future reconcile may annotate it.
- The branch-cut-ordering lesson belongs in the orchestrator skill or doctrine §4 at the next
  doctrine-touching slice.
- The ~15 unmigrated repos now have no installed v1 skills — by user ruling; `archive/skills-v1/`
  is the escape hatch.
