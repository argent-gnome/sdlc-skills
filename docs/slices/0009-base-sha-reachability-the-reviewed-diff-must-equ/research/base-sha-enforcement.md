# Research digest — `base_sha` remote-reachability: where to enforce, and how hard

> Dispatched by the `[0008]` shaping session (2026-07-30), Opus subagent, read-only.
> Question: [ADR-0005](../../../adr/0005-reviewed-diff-equals-merged-diff.md) states the invariant
> (*the reviewed diff must equal the merged diff*) and deliberately leaves **enforcement strength** open.
> Close that open question with evidence: trace the field, argue the fork both ways, rank the candidate
> enforcement points, and test the offline / no-remote / squash-merge constraints rather than assuming them.
>
> Nothing was changed. Every exit code, sha and command below was run; the sandbox experiments ran in a
> scratch directory, never in this repo.

## Findings

### 1. `base_sha` is a write-only field: one writer, one reader, and the reader is prose

Complete census (`grep -rn base_sha`, excluding `node_modules`, `archive/`):

| site | role |
|---|---|
| `cli/lib/slices.js:76` | **mint**: `base_sha: null` in the `house new` manifest literal |
| `cli/lib/slices.js:201-208` | **the only writer**: `prCmd()` — `if (sha && sha !== true) man.base_sha = sha` then `writeYaml` + `slice.pr_set` event carrying `base_sha` in its payload |
| `cli/bin/house.js:33` | flag allowlist `pr: ['set', 'base-sha', 'actor']` (the `[0003]` R-5 guard) |
| `cli/README.md:76` | the command's documented signature |
| `cli/test/slices.test.js:271-279` | the one test: `--base-sha abc123` → `man.base_sha === 'abc123'` |
| `.house/events.jsonl` | 11 `slice.pr_set` payloads, `[0001]`…`[0007]` |
| `skills/house-orchestrator/SKILL.md:58` | **the reader** — *"Dispatch one refute-biased reviewer against `git diff <base_sha>...HEAD`"* |
| `skills/house-orchestrator/references/doctrine.md:89` | doctrine §5 — *"the reviewed diff is `git diff $(base_sha)...HEAD`, with `base_sha` recorded on the manifest at branch time"* |

**Nothing else in the kernel touches it.** Verified absences, each one load-bearing for the argument below:

- **No schema.** `cli/schema/` holds only `enums.yaml` and `kickoff.yaml`; `grep -rn base cli/schema/` → zero hits. `slice.yaml`'s shape is defined by the `mint()` literal, not by a schema. There is no `sha`-shape validation anywhere — `--base-sha abc123` is accepted verbatim, as the test proves.
- **No validator rule.** `base_sha` does not appear in `cli/lib/validate.js`. In particular the `man.state === 'shipped'` block (`validate.js:132-135`) requires a `merge_gate` record and a retro, and says nothing about the range that gate was about.
- **Not derived, not rendered.** `buildIndex()` (`cli/lib/derive.js:20-23`) projects `id, title, kind, rigor, state, blocked_on, branch, pr, units, progress, gates, tasks` — `base_sha` is **not** among them. Confirmed empirically: `node cli/bin/house.js status --json | grep -c base_sha` → **0**. `house status`, `house list`, `house next`, `.house/index.json` and `house render dev-state` cannot see the field. The merge-gate reviewer's range is obtainable **only** by reading `slice.yaml` or replaying `house log`.

So the field's whole consumption path is a sentence in a skill file. There is no mechanical consumer to fail closed today — which is the reason the `[0007]` defect was silent, and the single most important input to the ranking in §3.

### 2. The incident, re-verified against real history

Every claim in ADR-0005 reproduces:

| check | command | result |
|---|---|---|
| `c2f88db` parent | `git log -1 --format=%P c2f88db` | `d299ae3` |
| squash commit `85731f3` parent | `git log -1 --format=%P 85731f3` | **`d299ae3`** — not `c2f88db` |
| is the recorded base an ancestor of what shipped? | `git merge-base --is-ancestor c2f88db 85731f3` | **exit 1 — no** |
| is the real parent? | `git merge-base --is-ancestor d299ae3 85731f3` | exit 0 — yes |
| is the recorded base on the trunk *today*? | `git merge-base --is-ancestor c2f88db origin/main` | **exit 1 — no** |
| what base did GitHub actually use? | `gh pr view 13 --json baseRefOid` | **`d299ae3dc816…`** |

`c2f88db` is now an orphan: `git log --graph --all` shows it hanging off `d299ae3` on its own, reachable
from nothing but the tag. **The reviewed range's own base is unreachable from the trunk** — the merge-gate
record for `[0007]` names a range that a fresh clone cannot reconstruct.

**And the recovery point is weaker than the ADR implies.** `git tag -l` → `pre-0007-squash-main`, `v0.1.0`;
`git ls-remote --tags origin` → **empty**. Neither tag has ever been pushed. The only artifact preserving
the reviewed base of a shipped slice exists in exactly one working copy, unbacked, one `git gc`-plus-tag-delete
from gone. (This is a finding in its own right, not part of the enforcement question: it belongs in the
hygiene sweep, and the cheap fix is `git push --tags` — or `git push origin pre-0007-squash-main`.)

### 3. The retro-sweep: the check would have fired exactly once in the repo's whole history

`git merge-base --is-ancestor <base_sha> origin/main` for every recorded `base_sha`:

| slice | `base_sha` | exit |
|---|---|---|
| `[0002]` | `d023fc1` | 0 |
| `[0001]` | `3dceb6a` | 0 |
| `[0003]` | `474ba42` | 0 |
| `[0005]` | `182448e` | 0 |
| `[0004]` | `9a39d76` | 0 |
| `[0006]` | `9b413c5` | 0 |
| `[0007]` | `c2f88db` | **1** |

**Six clean, one hit, zero ambiguous.** Caveat stated honestly: this measures against `origin/main`
*today*, and cannot reconstruct what `origin/main` was at each branch time — so it is evidence of **no
structural false-positive rate**, not proof that each historical check would have passed at the time. It is
still the strongest available signal that the check is not noisy: the one slice it flags is the one slice
known to be defective.

### 4. `git merge-base --is-ancestor` has **three** exit codes, and the third one is the whole design

Measured:

| situation | exit |
|---|---|
| sha is an ancestor of the ref | **0** |
| sha is a valid local commit and is **not** an ancestor | **1** |
| sha not a valid local object (`deadbeef…`) | **128** (`fatal: Not a valid commit name`) |
| ref does not exist (`origin/nope`, or `origin/main` before any fetch) | **128** (`fatal: Not a valid object name`) |
| repo has no remote at all | **128** |
| **cwd is not a git repo at all** | **128** (`fatal: not a git repository`) |

A check written as `if (status !== 0) refuse` is therefore **wrong in the anti-lock-in direction**: it turns
every unanswerable question into a refusal. The three-way split (`0` = verified good, `1` = verified bad,
`128` = unanswerable) is exactly the distinction that makes graceful degradation implementable, and it maps
one-to-one onto `validate.js`'s existing `error` / `warning` levels.

### 5. Offline and no-remote: tested, and it is the constraint that kills naive Option A

Four sandbox repos, built from scratch in the scratchpad:

**(a) `git init` + `git remote add`, never cloned** — the common "I made this repo locally then added a
remote" shape:

```
git symbolic-ref refs/remotes/origin/HEAD  → fatal: ref … is not a symbolic ref   (exit 128)
git rev-parse --verify --quiet origin/main → (empty)                              (exit 1)
git merge-base --is-ancestor HEAD origin/main                                     (exit 128)
```

**`refs/remotes/origin/HEAD` is created by `git clone`, not by `git remote add`.** This repo has it
(`origin/HEAD -> origin/main`) *because it was cloned*. Any check that resolves the default branch through
`origin/HEAD` fails on a `git init` repo, and fails *again* after a GitHub default-branch rename, because
`origin/HEAD` is a cached local pointer nothing refreshes. Resolution therefore needs a fallback ladder —
`origin/HEAD` → `gh repo view --json defaultBranchRef` (verified: returns `main`) → `git remote show origin`
(network) → configured value → give up and degrade.

**(b) No remote at all** — `git remote` empty: exit 128, question unanswerable in principle. There is no
remote default branch, so there is no such thing as a wrong `base_sha`. The check must be a **no-op**, not a
failure: a repo with no remote never squash-merges against one, so the entire failure class is absent.

**(c) Stale remote-tracking ref, object present locally — the false-refusal case.** Bare remote + one clone;
commit `c2` created **and pushed**, then `refs/remotes/origin/main` rolled back to simulate a clone that has
not fetched:

```
real remote tip = c2 (git ls-remote agrees)
git merge-base --is-ancestor c2 origin/main   → exit 1   ← FALSE "not reachable" on a sha that IS pushed
git fetch && same command                      → exit 0
```

So **a stale tracking ref manufactures the exact signal the guard treats as a defect.** This is not exotic:
it is what a second clone, a machine that has been asleep, or a push made from the GitHub web UI looks like.
Without a fetch the guard has a real false-NO-GO mode.

**(d) Stale-*ahead* tracking ref after a force-push — the false-pass case.** Remote rewound with
`push --force`; the local tracking ref still holds the discarded commit:

```
git merge-base --is-ancestor <discarded> origin/main → exit 0   ← FALSE PASS
true remote main = 352f3f6…   local origin/main = 9d33695…
```

**Conclusion for §4 of the ask:** the check *needs* `git fetch` to be trustworthy in either direction, and
a fetch needs the network. But it does **not** need to *block* on the network: `git fetch` failing is just
another 128 — unanswerable — and the honest response to unanswerable is to degrade, not to refuse. The
anti-lock-in clause survives, because the rule as stated ("`base_sha` must be a pushed commit") is obeyable
with `git push` and checkable with `git merge-base`, both of which are git, not `house`. What anti-lock-in
forbids is a rule *only the tool can satisfy* — and the escape-hatch question in §7 below is where that
clause actually bites.

### 6. Two facts that constrain any implementation more than the doctrine does

**(i) The test harness has no git.** `cli/test/helpers.js:mkTmpRepo()` creates a `mkdtempSync` directory
containing only `.house/` and `docs/` — **no `git init`**. Verified: `git -C $(mktemp -d) rev-parse
--is-inside-work-tree` → exit 128, `fatal: not a git repository`. And `repoRoot()` (`cli/lib/core.js:36-44`)
keys on the presence of `.house`, never `.git`.

Consequences, both useful:
- **A house repo need not be a git repo at all.** That is a real supported shape today, not an oversight, and any guard must survive it.
- **Every one of the 77 tests runs `house pr` outside git.** A guard that refuses on 128 breaks `cli/test/slices.test.js:271` on the first run — which means the degradation path is exercised by the existing suite for free, and cannot be shipped un-degraded even by accident. (Baseline confirmed: `npm test --prefix cli` → fail 0.)

**(ii) There is precedent for the CLI shelling out to git — but only one, and it is a user-supplied command.**
`slices.js` imports `execSync` and uses it exactly once, in `taskCmd` for `--evidence-cmd`, with an explicit
`maxBuffer` and a 15-minute `timeout` and a comment explaining why both are necessary. A reachability check
would be the **first** place the kernel itself depends on git. That is a genuine (small) increase in the
kernel's dependency surface, and it argues for `execFileSync` with an argv array, a short timeout, and
`stdio: 'ignore'` — never a shell string interpolating a sha.

### 7. What "refuse" would actually do to a live slice

Reading `prCmd()` (`slices.js:198-209`) closely, three things the ADR's framing does not surface:

- **A refusal would also drop an unrelated true fact.** `--set` and `--base-sha` are one command with one `writeYaml` and one `slice.pr_set` event. `house pr <id> --set <url> --base-sha <sha>` that refuses on the sha also fails to record the **PR URL** — which was correct. Partial application is worse (the event payload emits both fields, so a half-write makes the OBSERVED record lie). So the refusal is coarser than "reject the bad field".
- **There is no second writer, so a refusal has no recovery path inside the kernel.** `base_sha` is written by `house pr` and by nothing else. The only alternative is hand-editing `slice.yaml`, which doctrine §1/§6 forbid — `slice.yaml` is CLI-owned, and this is precisely the breach the `[0007]` reconcile subagent already **refused** to commit when it left `adrs: []` empty rather than paper over the missing writer. A refusal with no flag-shaped escape is therefore a strand by construction.
- **But a refusal cannot strand the *slice*, only the *field*.** `setState()` (`slices.js:252-277`) checks `required_gates` and nothing else; `required_gates` has no entry for `gating`, and `live_check`/`shipped` require only a `merge_gate` record. `validate` permits `state: shipped` with `base_sha: null`. So a slice whose `house pr --base-sha` was refused **still ships** — it just ships with no record of what was reviewed. The refusal does not halt the loop; it silently converts a wrong claim into no claim, and no claim is *also* accepted everywhere. That is the strongest single argument that `house pr` is the wrong enforcement point: a guard there is trivially routed around by the loop it is meant to guard, and the routing-around looks like success.

### 8. The squash-merge asymmetry, applied to the checks themselves

Doctrine §5's caveat is that reachability lies about squash-merged *branches*. Does it also undermine a
reachability check on `base_sha`? **No — and the direction matters.**

The `base_sha` check asks about the **base side** (is this commit an ancestor of the trunk?), not the
**branch side** (has this branch landed?). The squash asymmetry breaks the branch-side question because the
squash commit is not a descendant of the branch tip. The base side is unaffected: `base_sha` must be an
ancestor of the base branch tip, and a squash preserves that (`d299ae3` **is** an ancestor of `85731f3`,
exit 0, verified).

Where squash *does* bite is the **post-merge** verification in option (iv). After a squash you cannot compare
commit ranges, because the merged range has no commit-level relationship to the reviewed one. You must
compare either **trees** (`git diff <base>..<tip>` vs `git diff <parent>..<squash>`) or, far more cheaply,
**ancestry of the base against the merge commit's parent** — which for `[0007]` is a single one-liner that
returns the right answer:

```
git merge-base --is-ancestor c2f88db 85731f3   → exit 1     # the recorded base is not behind what shipped
```

Equivalently, and without needing the merge commit at all: `gh pr view <n> --json baseRefOid` returns
`d299ae3` — GitHub's own answer to "what did I merge against" — and `is-ancestor c2f88db d299ae3` is exit 1.
Both catch the incident exactly. Neither is fooled by the squash.

## Options

### The enforcement fork at `house pr` (question 2)

**Option A — refuse.** Failure mode, concretely: (a) a stale tracking ref produces exit 1 on a legitimately
pushed sha (§5c) and the orchestrator is blocked from recording a **true** value; (b) a combined
`--set … --base-sha …` loses the PR URL too (§7); (c) there is no in-kernel way to set the field afterwards,
so recovery means either a `--force`-shaped flag that does not exist yet, or the forbidden hand-edit (§7);
(d) worst of all, the loop proceeds anyway with `base_sha: null` and ships, because nothing downstream
requires the field (§7). A refusal at the write point is **strict where it is cheap to route around and
absent where it would matter.**

**Option B — warn loudly.** Failure mode, concretely: `house pr` is invoked by an orchestrator agent that
reads exit status and, at best, skims stdout; the `[0007]` run is the existence proof, because that same
orchestrator ran `house pr --set` after its final commit, merged with the record uncommitted, and did not
notice until the reconcile. A stderr line in an unattended run is **not zero** enforcement — it is a durable
artifact if it lands in the event payload or a validate finding — but as *console output alone* it is
functionally zero, and pretending otherwise is the "announced a halt nobody can resume from" failure
doctrine §4 already names.

**Does doctrine §4's asymmetry settle it?** *A false NO-GO is safe, a false GO is not* — so at the **gate**,
yes, decisively: a `base_sha` that fails the check must make the merge gate NO-GO/INCONCLUSIVE, never GO.
But at `house pr` the asymmetry **does not settle it**, and this is the case the doctrine's phrasing does not
cover: `house pr` is not a gate. It is a **recording** command, and refusing to record makes the record
*absent* rather than *negative*. Absence is not the safe side — §7 shows absence sails through every
downstream check, so a refusal at the write point converts a detectable false GO into an undetectable one.
The asymmetry applies to verdicts, and `base_sha` is not a verdict; it is the verdict's subject. **The fork
as posed is a false dilemma: the right answer is to stop enforcing at the write and start enforcing at the
read.**

### Is `house pr` the right enforcement point? (question 3) — ranked

**Rank 1 — (ii) check at merge-gate time, where the range is consumed.** Implemented as a `house validate`
rule: for a slice whose `base_sha` is non-null and whose state is `gating`/`live_check`/`shipped`, assert
remote reachability — `error` on exit 1, `warning` on exit 128, silent on 0. Why it wins:
- It fires where the range is actually used, so it cannot be routed around by skipping the field — **provided it also flags `base_sha: null` in those states**, which closes the §7(d) hole in the same rule.
- It is already fail-closed by mechanism: `validate` exits 1 on any `error` (`house.js:63-68`), the merge-gate reviewer demonstrably runs it (the `[0006]` and `[0007]` gate records both cite `house validate` exit 0 as evidence), and "`house validate` green" is a doctrine §8 session-end sweep item. No new enforcement machinery is invented.
- It is **re-checkable**. A write-time check is a one-shot measurement; a validate rule re-answers the question every time anyone asks, including after `main` moves — which matters because (see Rank 3) no value written at branch time can be *guaranteed* still correct at merge time.
- The 0/1/128 taxonomy maps exactly onto validate's existing `error`/`warning` levels, so degradation is idiomatic rather than bolted on.
- Cost: one block in `validate.js`, one git call, tests that must tolerate a non-git tmp repo (§6i).

**Rank 2 — (iv) verify after the merge that the merged range equals the reviewed range.** Cheapest possible
form is one `gh pr view <n> --json baseRefOid` plus one `is-ancestor`, and it catches the incident exactly
(§8). It is strictly *after* the fact, so it cannot prevent the landing — but for **this** class after-the-fact
is worth a great deal, because the class is *silent*, and the reason `[0007]` was benign is that a human
happened to verify byte-identity by hand. A recorded post-merge assertion turns "we got lucky and someone
checked" into "the check ran and its result is in the log". Best home: part of the merge/teardown step, its
result written as a `work.discovered` or carried in the `merge_gate` record's `--payload`. It is complementary
to Rank 1, not an alternative.

**Rank 3 — (iii) derive `base_sha` from the remote instead of accepting it.**
`git merge-base origin/<default> HEAD` at branch time would have returned `d299ae3` for `[0007]` — exactly
right, and the failure class disappears because there is no longer an argument to get wrong. Genuinely
attractive, and it should be the **default** for the flag (`--base-sha` with no value, or absent, derives).
But it does not deserve rank 1, for two reasons:
- **It is still a snapshot.** `base_sha` is a claim about a merge that has not happened yet. If `main` moves between branch time and merge time — which is exactly what `[0004]` did, committing folds and kickoff to `main` after the branch was cut — a value derived at branch time is stale by merge time. Deriving removes *operator error* from the field; it does not make the field *true*. Only a check at merge time (Rank 1) or after it (Rank 2) can assert truth.
- **Doctrine §1 consequences.** DECLARED → DERIVED is not a free relabel. Doctrine §1 defines DERIVED as `.house/index.json` and pins its property: *"delete it, rebuild it, byte-identical."* A remote-derived `base_sha` **fails that property** — `git merge-base origin/main HEAD` returns something different tomorrow, and after the slice branch is deleted (doctrine §8 requires deleting it) it cannot be recomputed at all. So `base_sha` cannot join the DERIVED layer: it is a **timestamped observation**, whose natural home is OBSERVED — which is in fact where the durable copy already lives, in the `slice.pr_set` payload, with `slice.yaml` holding the current-value cache. The honest framing of (iii) is *"the CLI measures the value instead of the agent asserting it"* — the writer is still the CLI, so one-writer-per-field is untouched, and the layer does not change. The anti-lock-in cost is real but small: a human with a clone and an editor can still compute `git merge-base` themselves, but they must be able to *pass* it — so **derivation must be a default, never the only path**, and the explicit `--base-sha <sha>` must remain accepted.

**Rank 4 — (i) check at `--base-sha` write time.** Keep it, but demote it to a **warning that is also a
record**: print to stderr *and* carry the verdict in the `slice.pr_set` payload (e.g.
`base_sha_remote: "unreachable" | "reachable" | "unverified"`). That costs one field, makes the warning
survive the session that ignored it, and — because OBSERVED is append-only — makes it discoverable at the
reconcile even if every human and agent missed it live. As enforcement it is weak; as evidence it is free.

### The escape hatch, if refusal is chosen anyway

If the shaping pass overrules the ranking and wants a hard refusal at `house pr`, the kernel already has the
grammar for it: **refuse unless you say why, and record the why.** `artifactCmd` refuses `skipped` without
`--reason` (`slices.js:140`); `taskCmd` refuses `done` without evidence (`slices.js:180`). The matching shape
here is `--base-sha <sha> --unpushed-reason "<why>"`, which writes the reason into the `slice.pr_set` payload.
That preserves fail-closed behaviour, keeps the override inside the CLI (no hand-edit, no one-writer breach),
and leaves an auditable trail. It does **not** fix §7(d) — the loop can still ship with `base_sha: null` —
which is why the validate rule is needed regardless.

## Recommendation

**Enforcement strength: warn at the write, refuse at the read.** Concretely, four items, in the order a
plan should sequence them, smallest first:

1. **`house validate` gains a `base_sha` rule (the fail-closed half — this is the slice's spine).** For every slice whose state is `gating`, `live_check` or `shipped`:
   - `base_sha` is null → **error**: *"state `<s>` without a `base_sha` — no record of what was reviewed."*
   - `base_sha` set, `is-ancestor` exit 1 → **error**: *"`base_sha` `<sha>` is not reachable from `<remote-default>` — the reviewed range is not the range that merges."*
   - exit 128 (no remote, no such ref, no network, not a git repo) → **warning**: *"could not verify `base_sha` against a remote — unverified."*
   - exit 0 → silent.
   Resolve the default branch by the ladder in §5a, and **never** treat an unanswerable question as a failure. Implementation notes: `execFileSync` with an argv array (not a shell string), `stdio: 'ignore'`, a short timeout; the existing non-git tmp-repo harness (§6i) exercises the 128 path for free, and each of the three levels wants its own test with a real sandbox repo.
2. **Doctrine §5 and `house-orchestrator` §6 gain the qualifier ADR-0005 names** — `base_sha` is recorded at branch time **from a pushed commit** — and the merge-gate instruction gains the precondition: *a `base_sha` that fails the reachability check means the range is unknown; treat it as INCONCLUSIVE and re-derive, do not review it anyway.* Doctrine §4's asymmetry does settle it **here**, at the gate.
3. **`house pr --base-sha` derives by default and warns, never refuses.** Absent or valueless `--base-sha` ⇒ `git merge-base origin/<default> HEAD`; an explicit sha is still accepted; either way, an unreachable value prints to stderr **and** is recorded in the `slice.pr_set` payload as `base_sha_remote: unreachable|reachable|unverified`. No refusal: §7 shows a refusal at the write is strict where it is cheap to evade and absent where it matters, and doctrine §4's asymmetry does **not** transfer to a recording command, because a missing record is not the safe side.
4. **A post-merge assertion in the merge/teardown step.** `gh pr view <n> --json baseRefOid` + one `is-ancestor` against the recorded `base_sha`; on mismatch, emit `work.discovered` naming the delta. Two lines of orchestrator instruction, no code, and it is the only check that speaks about what actually landed.

**Cheapest honest fix, if only one thing ships (question 6):** item **1**, and specifically its exit-1 →
`error` branch. It is one block in `validate.js`, it needs no new command, no new flag and no schema change,
and it would have caught `[0007]` **before the merge** — at gate time `origin/main` was `d299ae3` and
`is-ancestor c2f88db d299ae3` is exit 1, so the reviewer's own `house validate` run (which it did perform,
and cited) would have exited 1 with a named finding instead of 0. That is the whole difference between this
incident and a caught defect.

Answering the two sub-questions directly: **no**, a warning at `house pr` time would not have been read —
the same orchestrator on the same run also merged with an uncommitted `pr_set` record and destroyed an
OBSERVED event with `git reset --hard`, which is what an unattended run's attention to console output looks
like. **Yes**, a post-merge assertion would have caught it after the fact, and for this class after-the-fact
is genuinely valuable but **not sufficient on its own** — the failure is that unreviewed content reaches
`main`, and once it is on `main` the remedy is a follow-up review, not a rollback. Detection after the fact
converts a silent hole into a visible one, which is worth having; preventing the landing is worth more, and
item 1 costs less than item 4 does.

**One thing to fix outside this slice:** push the tags (§2). `pre-0007-squash-main` is the only surviving
reference to a shipped slice's reviewed base and it exists on one machine only.
