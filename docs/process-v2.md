# How the v2 process works

*[quickstart](quickstart.md) · [the v1 process](process.md) · [CLI reference](../cli/README.md)*

The records on disk **are** the process. Three roles act over those records — one turns fuzzy work into
a reviewed spec and plan, one sequences the build and holds the gates, one implements a single unit —
and none of them is allowed to trust its own memory instead of the files. Every gate between the
stages fails closed, and the two judgments that cannot honestly be handed to a machine reviewer stay
with you.

That is the whole design. The rest of this page is why each piece is shaped the way it is.

---

## The three roles

Three separate sessions, named in the [quickstart's skill-names table](quickstart.md#current-skill-names).
They are separate because context is paid for per message: a session that loads only its half of the
lifecycle is a session that stays cheap and stays focused.

**The shaper** takes something fuzzy — an idea, a backlog line, an audible mid-build — and turns it
into work that can be built: a spec you approved, a plan, an independent plan-check verdict, and a
versioned kickoff brief. Or, when the thing is really a decision rather than a piece of work, into an
ADR. It is a session you run, and it converges by dialogue: one question at a time, before it writes.

**The conductor** drives one slice from ready to merged. It resumes from the records, dispatches a
build session per plan unit, holds every gate, runs the merge review, and reconciles the docs.
Its binding constraint: **the conductor never edits product code.** The moment it does, the review
it is about to hold stops being independent — it would be reviewing itself. Sequencing and judging are
its job; building is not.

**The builder** implements exactly one unit, then is torn down. Its binding constraint is the mirror
image: **it sees only its kickoff brief** — the unit's tasks, the scope guards, the stakes, whether the
run is attended — never the conductor's transcript or the slice's whole history. That is deliberate.
A brief that has to be interpreted is a brief that will be interpreted differently at the merge review,
so a brief that is missing something is not guessed at; the builder stops and says what is missing.

The asymmetry between those two constraints is what keeps the loop honest. The conductor cannot mark
its own homework, and the builder cannot quietly widen its own scope.

---

## Records first

The substrate is three layers of files, with **exactly one writer each**:

- **Declared** — the slice directory (`docs/slices/<id>/`): its manifest, spec, plan, task list, gate
  records, and per-unit reports. Written by whichever role owns the current step.
- **Observed** — the append-only event log at `.house/events.jsonl`. Written only by the `house` CLI
  and its hooks. Nothing else appends, ever, which is what makes it evidence rather than commentary.
- **Derived** — a rebuildable cache. Delete it, rebuild it, get the same bytes. It is gitignored,
  because anything derivable is derived and never hand-written.

Two consequences follow, and they are the point of the whole arrangement.

**A session that dies loses nothing.** Any role can resume cold from the files alone — `house status`
for where things stand, `house next` for what is workable right now. This is not a theory here: during
the v2 skills build, a `/clear` killed the conductor mid-slice; the in-flight subagent finished and
wrote its records anyway, and a fresh conductor picked the slice up from those records with nothing
lost ([retro](slices/0001-house-v2-s2-skills-rewrite/retro.md)). It was an accident, not a drill.

**What you remember outside a record is already lost.** Transcripts are never parsed as state. A
verdict that exists only in a conversation is not a verdict; a halt that was only announced is a halt
nobody can resume from. If it matters, some command wrote it down.

The anti-lock-in clause holds throughout: `git clone` plus a text editor stays sufficient. The CLI
makes the contract cheap to honor and hard to fake, but a rule you can only obey by running a tool
would be a bug in the rule.

---

## Gates

A gate is a rung the work cannot climb past without a **record** saying it passed. `house state`
refuses to advance a slice when the required record is absent, and refuses again when the record exists
but its verdict is not a passing one. Four rules govern them:

- **An unrecorded gate did not run.** Not "the conductor remembers it passed" — the record, or nothing.
- **Unsure whether a gate is hard? Treat it as hard.**
- **A reviewer that could not reach a verdict has not passed the work.** Too few lenses ran, the tests
  never finished, the diff was unreadable — every one of those means run it again.
- **A false stop is cheap; a false pass is not.** That asymmetry is the entire design rationale.

Two rungs are irreducibly yours and are never self-approved by any session: **spec review** — you
agreeing the thing being built is the right thing — and the **live check**, where you exercise the
behavior in the real environment before the work is called done.

**Running unattended never downgrades a gate.** When a brief says the run is unattended, a hard gate
does not quietly reduce a review panel to one reviewer, or one reviewer to the builder's own word. It
halts and waits for a human, recording the request so the wait is visible. The same holds when the
reviewer model is simply unavailable: halt, don't downgrade.

Which gates exist, what verdicts each one accepts, and which of those verdicts actually count as
passing are **not listed here on purpose**. They live in
[`cli/schema/enums.yaml`](../cli/schema/enums.yaml), which is the sole normative source for them along
with the legal state transitions. A second copy of a list is a second source of truth, and a second
source of truth always drifts — so this page points, and never restates.

---

## Where the heavy work runs

Reading a diff is expensive; holding a verdict is cheap. So every heavy reading job runs in a
**subagent** that reads in its own context and returns only its conclusion:

| dispatched job | what it reads | what comes back |
|---|---|---|
| research | the problem space, prior art, the codebase | a digest the shaper can act on |
| plan-check | the spec and the plan, before any code exists | a verdict plus findings to fold in |
| merge review | the slice diff against the spec | a verdict plus findings, each citing a rule |
| reconcile | the affected specs, plans, ADRs, roadmap, dev-state | a list of exactly what it changed |

The conductor therefore stays light across a long slice — it never loads a diff into its own context —
and the expensive reading dies with the subagent that did it.

The merge review is also where **reviewer independence** is bought, along three axes: *perspective* —
a fresh context that did not write the code; *architecture* — a different model family than the one
that built it, so the reviewer's blind spots are not the builder's; and *context* — it reads the diff
and the spec, never the build transcript. It re-runs the build and the tests itself, because a
builder's report is a claim and the reviewer's own green run is the evidence.

The review is per slice, not per unit — the diff reviewed is the whole branch against the base commit
recorded when the branch was cut. The builder's own self-review still happens per unit, but it answers
a different question ("does this unit do what the plan said") and never substitutes for the slice-level
one.

---

## Authorities

When this page and one of these disagree, this page is wrong.

- **[The doctrine](../skills/house2-orchestrator/references/doctrine.md)** — the process law: the kernel contract, the stage table, the rigor dial, the gate rules, the doc routing table. Read on demand by the sessions themselves, never preloaded. Its path carries a migration-window skill name, so it moves at the cutover — see the [quickstart's names table](quickstart.md#current-skill-names).
- **[`cli/schema/enums.yaml`](../cli/schema/enums.yaml)** — the sole normative source for states,
  gate names, verdicts, transitions, and event types.
- **[`cli/README.md`](../cli/README.md)** — every `house` command and the rules the code enforces
  rather than merely documents.
- **[`quickstart.md`](quickstart.md)** — starting a project, seeding your gates file, adopting work
  that was shaped before the kernel existed.
