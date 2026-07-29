# Case study: refactoring the SDLC out of a heavy plugin

This is the [best-practices](best-practices.md) theory applied to one real system. We took a
token-heavy Claude Code plugin and rebuilt its software-development lifecycle as two lean, plugin-free
local skills — keeping every bit of the process discipline while cutting the per-message cost by roughly
two-thirds.

Read the theory doc first if "tier 1 / tier 2 / tier 3" and "idle vs. per-message cost" aren't already
familiar; this doc uses that vocabulary throughout.

---

## The starting point

The lifecycle lived in a plugin called `dev-command-center`, in a single skill, `dev-orchestrator`.
It worked — but it was expensive in exactly the ways the theory predicts:

- **A monolithic skill body** that covered the entire lifecycle: scope, spec, mockup, plan, three
  separate reviews, CI, live validation, docs, PR, reconcile, *plus* a whole board/tracking subsystem.
  Measured at **~8,392 tokens.** Because it covered everything, basically every dev session triggered
  it — so that 8,392 tokens sat in tier 2 (sticky, re-sent every turn) for whole sessions.
- **Four registered agents.** Four description lines in tier 1, paid on every turn of every session,
  whether or not that session ever did a review.
- **A board + GitHub-Pages tracker**, public-board privacy rules, an onboarding scanner, a
  self-improvement auditor loop, and an autonomous-mode setup section — all carried in the skill body.

The reviews were the runtime killer. Spelling out the three reviews as full multi-agent panels meant a
single slice could spin up on the order of **25–38 review agents.** Correct, but wildly out of
proportion to the stakes of most slices.

---

## What we were actually optimizing

We did *not* set out to delete capability. The user liked the lifecycle. The goal was to keep the
discipline and move the weight off the hot path. Concretely, three moves:

1. Cut machinery the user no longer used (the board, and several one-time/auxiliary subsystems).
2. Re-implement the reviews so the *default* path is cheap and only escalates when stakes justify it.
3. Split the monolith along the seam the user already works on, so each session loads only its half.

---

## The moves

### Move 1 — Delete the board subsystem

The user had stopped tracking progress on the board, so all board/render/update machinery came out of
the skill body. This alone took it from **8,392 → 4,929 tokens** — a ~41% cut to the sticky tier-2
weight, with zero loss of process discipline because the board was never part of the discipline.

The board's one genuinely useful function — *resume after closing the session* — was replaced by a far
cheaper artifact: a per-project `docs/dev-state.md`, a short plaintext tracker the conductor updates at
stage transitions. A fresh session rebuilds its picture by reading a ~1 KB file instead of reloading a
heavy transcript. (Best practice #5.)

### Move 2 — Fold the reviews down to their cheap default

The three reviews stayed, but their *form* changed to match stakes (a "rigor dial"):

- **plan-check** (before code) → a single inline subagent that critiques the plan through five lenses.
- **merge-gate** (before merge) → a single refute-biased inline subagent returning GO/NO-GO, which
  *escalates to the full multi-lens panel only for high-stakes slices.*
- **health-sweep** (after merge) → kept as a workflow, advisory, need not run every slice.

In skill-body tokens this barely moved the needle (**4,929 → 4,882**). But the *runtime* effect was
the whole point: a normal slice went from ~25–38 review agents to about **2.** The heavy reading still
happens — it just happens in tier-3 isolated contexts that return only a verdict, and only at the
volume the slice actually warrants. (Best practices #3 and the rubric stays inline, #4.)

### Move 3 — Split the monolith into orchestrator + builder

The lifecycle has a natural seam: a long-lived **conductor** that sequences the slice and holds the
gates, and an ephemeral **executor** that implements one plan unit and is torn down. We split along it:

| | tokens | vs. original |
|---|---|---|
| original monolith | ~8,392 | — |
| **house-orchestrator** | ~2,725 | ~67% lighter |
| **house-builder** | ~1,846 | ~77% lighter |

Now a conductor session loads only orchestration; a build session loads only building. Neither pays for
the other's half. The builder is genuinely ephemeral — its heavy implementation log dies on teardown
and never reaches the long-lived conductor (best practice #6).

### Move 4 — Inline subagents instead of registered agents

The four registered agents are gone. The reviewer rubrics now live *inside* the orchestrator's body and
are dispatched as inline subagents when needed. Idle cost of the whole setup dropped from **four
always-on agent description lines** to **~196 tokens** for the two skill descriptions. Same isolation,
same independence of review — zero idle tax. (Best practice #4, and the "subagents vs. full agents"
section of the theory doc.)

### Move 5 — Cut the dead weight

Removed outright, because the user didn't use them and they only added body weight: the self-improvement
auditor loop, the autonomous/supervised-remote-mode section (Claude Code does this natively), the
onboarding scanner, and the public-board privacy rules. Kept deliberately: the "compose, don't reinvent"
guidance and the rigor dial — both small and load-bearing.

---

## The result

| | before | after |
|---|---|---|
| sticky body in a dev session | ~8,392 tok (one monolith) | ~2,725 (orchestrator) **or** ~1,846 (builder) |
| idle agent surface | 4 registered agent descriptions | ~196 tok (2 skill descriptions) |
| review agents per normal slice | ~25–38 | ~2 (escalates only when high-stakes) |
| resume mechanism | board subsystem in-body | ~1 KB `docs/dev-state.md`, read by a fresh session |
| dependencies | a plugin + marketplace + 4 agents | none — plain local skills |

The lifecycle is identical from the user's seat: same stages, same hard gates, same three reviews, same
stack gates. What changed is purely where the weight sits — moved off the always-loaded and sticky paths
and into throwaway contexts and on-demand workflows.

---

## What we deliberately did *not* do

- **We did not move agents to a remote/hosted runner to "save context."** It wouldn't have. A local
  subagent already keeps its context out of the parent; hosting changes where compute runs, not what's
  in the prompt. (See the theory doc.)
- **We did not keep it as a plugin "to be safe."** A plugin is not the problem — registration weight
  is. A lean two-skill, zero-agent plugin would have had nearly the same idle cost as the local skills.
  We went plugin-free for clean install/versioning, not for token reasons.
- **We did not over-optimize the cold artifacts.** The workflow scripts on disk and the human docs cost
  nothing until used, so we left them readable rather than minified.

---

## The transferable lesson

Every move above is one principle: **keep the always-loaded and sticky paths small; push heavy reading
into isolated contexts; resume from cheap artifacts.** The lifecycle didn't get weaker — it got cheaper,
because the cost was never in the *discipline*, it was in *where the discipline was stored.*
