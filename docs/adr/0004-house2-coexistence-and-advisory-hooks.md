---
id: "0004"
kind: adr
title: "v2 skills ship as house2-* alongside v1; cutover at S3; hooks advisory-first"
status: "accepted (owner call at the house-v2 S2 shaping gate, 2026-07-28)"
state: accepted
date: 2026-07-28
slices: ["0001-house-v2-s2-skills-rewrite"]
superseded_by: null
---
# ADR 0004 — v2 skills ship as `house2-*` alongside v1; cutover at S3; hooks advisory-first

**Date:** 2026-07-28 · **Status:** accepted (owner call at the house-v2 S2 shaping gate)

## Context

house v2 S1 shipped the kernel — the `house` CLI, `slice.yaml` manifests, `.house/events.jsonl`, and a
generated `dev-state.md` ([ADR-0002](0002-house-v2-state-first-redesign.md)). S2 is the other half: rewrite
the three skills as thin actors over that state, add doctrine v2, and wire the hooks the program spec
deferred to this slice. Shaping S2 surfaced three calls the S2 spec could record but not settle on its own,
because each one changes something that outlives the slice.

**Skill names are global, not per-repo.** `install.sh` symlinks each `skills/<name>` into
`~/.claude/skills/<name>`. There is exactly one namespace, shared by every repo on the machine — so
rewriting `house-shaper` in place would swap the process out from under ~15 repos the moment the file is
saved, with no staging period and no way to run a v1 repo and a v2 repo side by side. The v2 skills also
refuse to run without `.house/`, and v1 flows refuse where it exists (ADR-0002's no-half-migration rule),
which means the *migration* is per-repo but the *skill files* are not.

**The program spec's hooks section describes blocking enforcement that the installed harness cannot
deliver yet.** Program spec §4 specifies `SubagentStop` blocking a builder that returns without a finalized
unit record, and `Stop` blocking a conductor session that ends without validate-green. Verified against the
harness actually installed here: `Stop` fires at the end of **every assistant turn**, not at session end —
a blocking `Stop` would interrupt every turn of every session in every repo. And `SubagentStop` fires for
*any* subagent, with no field distinguishing a house builder from a research or reconcile subagent, because
builders are dispatched as plain subagents rather than as a declared `.claude/agents/` type. A blocking
`SubagentStop` would therefore block research fan-out on a missing unit record it was never going to write.
Shipping a blocking hook against that harness buys enforcement of nothing and breaks unrelated work.

**A shipped enum and the program spec disagree on one event name.** Program spec §3.5 calls the merge
projection's trigger `slice.merged`; S1 shipped `slice.shipped` in `cli/schema/enums.yaml`, and S1's
as-built notes recorded the drift rather than resolving it. S2 is the slice that gives that event a
producer, so it must be one name.

## Decision

**1. v2 skills ship under distinct names, alongside untouched v1.** S2 creates
`skills/house2-shaper`, `skills/house2-orchestrator`, and `skills/house2-builder` from scratch. The v1
`house-shaper` / `house-orchestrator` / `house-builder` are **not edited** — not renamed, not deprecated in
place, not archived. Both sets install and coexist in `~/.claude/skills/`; which process a session runs is
chosen by which skill it invokes.

**The rename to canonical names + v1 archival happen at S3 cutover**, after the proving pair (this repo +
edge-scanner) has been migrated and the v2 loop has driven real work end-to-end. S3 owns the rename, the
archive, and the `install.sh` consequences of both.

> **Amendment (2026-07-29, recorded at S3b shaping, adr_review under slice
> `0004-house-v2-s3b-proving-pair-migration-and-cutover`):** the proving pair named above is corrected —
> **edge-scanner is dead** (its own dev-state records "PROJECT STOPPED — Phase 0 go/no-go = NO-GO,
> 2026-07-22"; it entered the pair by accident) and can never drive work through v2. The second proving
> repo is **athlete-data**. The cutover condition becomes: *sdlc-skills has driven real work through v2
> end-to-end* (satisfied — slices `0002` and `0003` shipped 2026-07-28/29 through the full v2 loop)
> *AND athlete-data ships its first slice through the v2 kernel end-to-end* (all hard gates, user
> live-check). **Adoption of already-shaped work counts** toward that condition, provided the spec and
> plan enter the kernel's records with their gates recorded — spec_review re-affirmed by the user, and a
> fresh v2 plan_check run before `ready`. The cutover slice (`0004`) is **parked** on that second
> condition, holding the rename inventory and archive mechanics in its research digest. No migration
> work is owed to edge-scanner; its only loose end (an unmerged worktree holding its NO-GO ADR) belongs
> to that repo, not to this program. The roadmap's stricter per-repo phrasing is reconciled to this
> amendment — this ADR is the authority.

*Cutover executed 2026-07-29 (slice `0004`): rename done, v1 archived at `archive/skills-v1/`,
coexistence window closed.*

**2. Hooks ship advisory-only in S2.** One `house hook <event>` subcommand (stdin JSON → stdout JSON),
wired by `house init` as a *merged* block into `.claude/settings.json`:

| Hook | S2 behavior |
|---|---|
| `SessionStart` | emit `session.started`; inject `house status` + `house next` as additionalContext |
| `SessionEnd` | emit `session.ended` (async) |
| `PreToolUse` (Edit/Write/MultiEdit) | permission **ask** — never deny — on writes under `.house/` and `docs/slices/*/gates/`, with a reason naming the right `house` command |
| `SubagentStop` | **advisory** additionalContext naming any dispatched unit with no finalized report |

Every hook path exits 0 outside a house repo or when `house` is missing, recording a `hook.degraded` event
when it swallows a real error. `Stop` is not wired at all in S2.

This is an **explicit, recorded deviation from program spec §4's blocking language** — not a slip, and not
an abandonment. **Blocking is an S3+ increment**, and its precondition is naming builders as a declared
`.claude/agents/` type so `SubagentStop` can tell a builder from any other subagent. Until that lands there
is nothing sound to block on.

**3. `slice.merged` loses to `slice.shipped`.** The shipped enum in `cli/schema/enums.yaml` wins; program
spec §3.5 is recorded as an **erratum**. S2 gives `slice.shipped` its producer (terminal `house state`
transitions). The program spec is not rewritten — the erratum note plus this ADR are the record.

## Consequences

- **Nothing breaks on install day.** Running `./install.sh` after S2 adds three new skills and changes zero
  existing ones, so the ~15 repos still on v1 keep working unchanged while S2 and S3 land. The cost is a
  real period of duplication — two skill sets, two doctrine files — which is the price of a staged cutover
  and is bounded by S3.
- **`house2-*` names are deliberately temporary.** They are a migration affordance, not a taxonomy. S3 must
  do the rename; a `house2-*` name surviving past S3 is a defect, not a convention. Any doc, prompt, or
  `install.sh` line that hardcodes a `house2-*` path is S3's problem to sweep.
- **S2's hooks are observation, not enforcement.** The S2 gates stay the enforcement point, exactly as the
  roadmap's locked conventions say — a hook that only advises cannot be the reason a rule holds. In
  exchange, S2 ships a slice's worth of *observed* hook behavior (which events actually fire, how often,
  with what payload) to design blocking against in S3+, instead of designing it against the spec's
  assumptions. `hook.degraded` is what keeps "fail open" from meaning "fail silent."
- **The blocking increment carries a named precondition**, so it cannot be picked up casually: no
  builder-as-agent-type, no blocking `SubagentStop`. Same for `Stop` — its per-turn firing must be
  re-verified against whatever harness is installed at the time, never assumed from §4.
- **One event name, one producer.** `slice.shipped` is the name in code, in enums, and in every projection;
  `slice.merged` appears nowhere but the program spec's erratum note. This closes the S1-recorded drift
  rather than carrying it into a third slice, and it sets the tiebreak precedent: **a shipped enum beats
  prose in an earlier spec** — the spec gets the erratum, the enum keeps its name.
- **Any future CI-style blocking enforcement is still gated on the local bar** ([ADR-0003](0003-no-hosted-ci-local-verification.md)):
  hooks that block would run `house validate` locally, not in a hosted runner.
