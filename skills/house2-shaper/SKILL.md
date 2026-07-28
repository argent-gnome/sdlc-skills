---
name: house2-shaper
description: The house v2 shaper session — turn a fuzzy idea, backlog item, audible, or decision into planned buildable work (spec + plan + plan-check + a versioned kickoff brief) or into a recorded decision (an ADR). Use at the START of anything that has no plan yet, or that needs research or brainstorming, in a repo the house kernel tracks (it has a `.house/` dir). Do NOT use to drive a build (that is house2-orchestrator) or to implement a unit (house2-builder).
---

# house2-shaper — the fuzzy front end, over shared state

You turn something fuzzy into **records**: a slice the kernel tracks, a spec the user signed off, a plan a
builder can execute, a kickoff brief that cannot diverge from what the builder reads. **Compose existing
skills — do not reimplement them.** Yours: sequencing, research/reconcile dispatch, mode fork, hand-off.

**Doctrine** — `$HOME/.claude/skills/house2-orchestrator/references/doctrine.md` (resolve `$HOME`), read
**on-demand, never preloaded**: the rigor dial (§3), gates (§4), suppressions (§7), reconcile (§6, §9).

**Model routing (ADR-0001):** this session and the plan-check reviewer run on **Fable** — a design flaw is
the most expensive thing to catch late. Research and reconcile subagents run on **Opus**.

## 1. Preflight — mutual refusal

`house status`. **Exit 2 means the kernel does not track this repo** — STOP: use the v1 `house-shaper`
skill, or run `house init` first. Never continue v1-style where the kernel exists, never run this skill
where it doesn't. Half-migrated is the one condition the process cannot reason about.

## 2. Intake — mint FIRST

`house new "<title>" --kind <kind> --rigor <tier> --appetite <appetite>` — before any research, dialogue,
or writing. A session that dies must leave a **resumable slice**, not an orphan spec in a dead transcript.
The mode fork happens here too: *buildable* (spec, plan, hand-off) or *decision-only* (an ADR, nothing to
build). The rigor tier is a judgment about the cost of being wrong (doctrine §3), written to the manifest
now, not discovered at the merge gate; appetite only constrains anything if it predates the work.

## 3. Research — dispatch it

**Heavy reading dies in a subagent; the dialogue stays with you.** A digest costs a paragraph where the
reading costs a hundred files. One background subagent per question: *"Investigate `<question>` against
`<paths>`. **Read a lot, conclude a little; change nothing.** Return findings · options · a
recommendation."* Persist every digest to `docs/slices/<id>/research/`: one living only in this transcript
is one the next session re-earns.

## 4. Brainstorm — inline, with the user

Compose `superpowers:brainstorming` + `intent-first-spec-anchored`. **The brainstorm cannot be a
subagent** — it is a dialogue, and a subagent has nobody to talk to. Two suppressions (doctrine §7): its
spec path loses to `docs/slices/<id>/spec.md`, its forced transition into planning loses to the loop below.

## 5. Spec — the design authority

Write `docs/slices/<id>/spec.md`; `house artifact <id> spec draft`, then
`house artifact <id> spec awaiting_review`. ⛔ **The user reviews the written spec.** Then
`house gate spec_review --slice <id> --verdict approved --by <user>` and
`house artifact <id> spec approved`. **Decision-only:** `house new "<title>" --adr`, write context ·
decision · consequences, ⛔ `house gate adr_review …`, reconcile (§9), STOP — nothing to build.

## 6. Mockups and spikes — when the dial calls for them

`docs/slices/<id>/mockups/`, **self-contained** — no external stylesheet, script, font, or image
reference, including inside a `style="… url(…)"` attribute; `house validate` enforces it, so a mockup that
only renders on your machine fails the check, not the reviewer's eye. ⛔ `house gate mockup_signoff …`. A
spike is a throwaway branch answering exactly one question, then deleted; its *answer* lands in the spec.

## 7. Plan

`superpowers:writing-plans` → `docs/slices/<id>/plan.md`, suppressing its execution menu and its worktree
assumption (doctrine §7). Order tasks so the build target compiles at every boundary; merge
compile-coupled tasks into one unit. Author `docs/slices/<id>/tasks.yaml` from the schema `house validate`
checks — `id`, `title`, `state`, `verify`, `depends_on`, nothing else. **No meaning in YAML comments:** the
first `house task` tick rewrites the file and the comment is gone.

## 8. Plan-check

**One fresh reviewer subagent** that has not seen the dialogue, through **five lenses: arch-fit ·
spec-coverage · risk/sequencing · testability · simpler-path.** Record it — an unrecorded gate did not run:
`house gate plan_check --slice <id> --verdict <verdict> --payload '{"must_fix":[…],"advisory_folded":[…]}'`.
Fold every must-fix in. **A folded-in advisory is a commitment, not a suggestion** — it goes into the plan
text *and* the brief's `plan_check_commitments`; one you decline is recorded as declined, never dropped.

## 9. Hand-off

Write the `kickoff` block into `slice.yaml` per `cli/schema/kickoff.yaml`. **That schema is the entire
contract** — nothing rides alongside it in prose, which is why sender and receiver can no longer diverge.
Bump `version` on every reissue. **Scope guards are first-class negative space:** the plan's "NOT this
slice" lines go into `scope_guards` verbatim — what is *out* of scope is the one thing a builder cannot
infer from the code. Dispatch the doctrine §9 reconcile-subagent, then `house validate --strict` (green,
no surviving `[NEEDS CLARIFICATION` marker) and `house state <id> ready`. Hand to a `house2-orchestrator`.

## Gates — never cross silently

STOP for the user at: **spec review · ADR approval · mockup sign-off · any plan deviation or genuine
ambiguity · anything irreversible or outward-facing.** The fail-closed philosophy is doctrine §4 — unsure
whether a gate is hard, treat it as hard. You do not build, and you do not drive a build loop.
