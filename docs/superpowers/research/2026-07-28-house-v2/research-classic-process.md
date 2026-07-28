# Research digest — classic software-process methodology, mapped onto a solo dev + AI agents

**Date:** 2026-07-28
**Purpose:** Input to the "house v2" redesign. Jake runs a 3-skill SDLC (house-shaper / house-orchestrator /
house-builder) entirely through Claude Code agents, and is about to build a desktop IDE that reads the process
artifacts as first-class UI. The redesign goal is *sound engineering practice that is also machine-observable*.
**Method:** primary sources first (Basecamp Shape Up chapters, Oxide RFD 1, Nygard's ADR post, MADR,
trunkbaseddevelopment.com, dora.dev, rust-lang/rfcs, github/spec-kit), search summaries second.

> **Note on the output path:** the orchestrator passed a literal `undefined/` prefix for the report path. I wrote
> the digest to `/Users/jake-edwards/projects/sdlc-skills/docs/research/research-classic-process.md` — the repo
> the research is actually about — rather than creating a directory named `undefined` inside the unrelated
> `edge-scanner` repo.

---

## 0. The one-paragraph thesis

Almost every weakness in the audit (no machine-readable state, unpersisted verdicts, ambiguous slice identity,
stale Status lines, unticked checkboxes, undefined mockup paths) has already been solved — not by agile process
frameworks, but by **written-artifact cultures that put a state field in a file and made the file's location
derivable from an identifier**. Oxide's RFD process and GitHub's spec-kit are the two closest existing analogues
to what house v2 needs; Shape Up supplies the *shaping and stopping* discipline that a solo dev with infinite
agent throughput most desperately lacks; ADR/MADR supplies the decision lifecycle; Diátaxis supplies the "one job
per doc" rule the existing doctrine already half-invented; DORA supplies the empirical argument that this is not
bureaucracy. Nearly all the *ceremony* in these methods exists to synchronise multiple humans — that is the part
to delete.

---

## 1. Basecamp Shape Up

Sources: [Shape Up (full book)](https://basecamp.com/shapeup/), chapters
[3 Set Boundaries](https://basecamp.com/shapeup/1.2-chapter-03),
[4 Find the Elements](https://basecamp.com/shapeup/1.3-chapter-04),
[5 Risks and Rabbit Holes](https://basecamp.com/shapeup/1.4-chapter-05),
[6 Write the Pitch](https://basecamp.com/shapeup/1.5-chapter-06),
[8 The Betting Table](https://basecamp.com/shapeup/2.2-chapter-08),
[11 Get One Piece Done](https://basecamp.com/shapeup/3.2-chapter-11),
[13 Show Progress](https://basecamp.com/shapeup/3.4-chapter-13),
[14 Decide When to Stop](https://basecamp.com/shapeup/3.5-chapter-14).

### 1.1 Appetite — fixed time, variable scope

> "You can think of the appetite as a time budget for a standard team size."
> "Appetites start with a number and end with a design."

Two sizes only: **Small Batch** (1–2 weeks) or **Big Batch** (a full six-week cycle). The appetite is *set before
the solution exists* and then constrains it. This is the exact inverse of estimation.

**Why this bites hardest for Jake.** With agent throughput, the marginal cost of "one more thing in this slice"
feels near zero, so slices bloat until the session dies of context exhaustion. An appetite is a *declared,
recorded* upper bound that makes bloat visible. Today the house system has slices with no declared size at all —
which is why "Slice N" identity is ambiguous and why plans never get fully ticked.

### 1.2 Shaped work is rough, solved, bounded

From chapter 4, shaped work is:
- **Rough** — "detailed enough to guide building but leaving substantial room for decisions"
- **Solved** — the core approach is determined
- **Bounded** — scope is clear and fixed within the appetite

And the fidelity discipline: **breadboarding** (places / affordances / connection lines) and **fat marker
sketches**.

> "If we start with wireframes or specific visual layouts, we'll get stuck on unnecessary details and we won't be
> able to explore as broadly as we need to."
> "The reason for calling them out is we too easily skip ahead to the wrong level of fidelity."

**Direct hit on the mockup problem.** The audit says the mockup output path is unspecified (2 dirs × 4 naming
styles). The deeper problem is that *mockup* is one word for at least three different artifacts at three
fidelities. Shape Up names two of them explicitly and says which questions each answers. House v2 should type its
design artifacts (`breadboard` / `sketch` / `mockup`) rather than just picking a folder — the IDE's webview pane
then knows what it's rendering and why.

### 1.3 Rabbit holes and no-gos — de-risking *before* the bet

> "Before we consider it safe to bet on, a shaped project should be as free of holes as possible."

Techniques: walk a use case in slow motion; ask "Does this require new technical work we've never done before?";
**declare things out of bounds**; and validate technically with the appetite baked into the question — ask *"Is X
possible in 6 weeks?"*, never *"Is X possible?"*.

Chapter 5's distribution framing is the crisp argument: well-shaped work is **thin-tailed** (ships near the
appetite); an unaddressed rabbit hole makes it **fat-tailed** — "the project could take *multiple times* the
original appetite."

**Transfers directly.** This *is* what a plan-check verdict is trying to be. Today's GO / GO-WITH-FIXES / NO-GO is
a rabbit-hole check whose result evaporates into conversation. Shape Up says the un-de-risked thing must not be
bet on at all — which means the verdict is a **gate on state transition**, not an opinion.

### 1.4 The pitch — five named ingredients

> **Problem** — "The raw idea, a use case, or something we've seen that motivates us to work on this"
> **Appetite** — "How much time we want to spend and how that constrains the solution"
> **Solution** — "The core elements we came up with, presented in a form that's easy for people to immediately understand"
> **Rabbit Holes** — "Details about the solution worth calling out to avoid problems"
> **No-Gos** — "Anything specifically excluded from the concept: functionality or use cases we intentionally aren't covering"

Also: "We prefer asynchronous communication by default and escalate to real-time only when necessary."

**A five-slot schema, already validated by a decade of use.** This is a better spec template than a free-form
"spec" doc, and it is *trivially machine-checkable*: five required headings. Notably **No-Gos** has no equivalent
in the current house spec format — and negative scope is exactly what an eager agent needs most.

### 1.5 The betting table, no backlog, cool-down

> Basecamp keeps only "a few potential bets to consider." No backlog to groom.
> "If we bet six weeks, then we commit to giving the team the entire six weeks" with "no interruptions."
> Bets "cap downside risk (maximum loss is six weeks)."

Cool-down = two weeks after each cycle with **no scheduled work** — bug fixing, exploration, whatever the team
picks.

**Transfers:** the *cap on downside* and *cool-down*. **Skip:** the betting table as a meeting, the six-week
calendar, and the "no backlog" absolutism. Jake's roadmap.md is a backlog and it is doing real work — the audit's
complaint is that it has no format contract, not that it exists. A solo dev's roadmap is memory, not a queue of
promises to stakeholders; the grooming cost Shape Up rails against is a multi-human cost.

### 1.6 Hill charts — progress as *known vs unknown*, not percent-done

> "First there's the uphill phase of figuring out what our approach is and what we're going to do. Then, once we
> can see all the work involved, there's the downhill phase of execution."
> Downhill is "marked by certainty, confidence, seeing everything, and knowing what to do."
> "to-do lists actually grow as the team makes progress."
> "It's not meaningful to write '4 hours, or maybe 3 days' as the estimate."

Hill charts move the question "from what's done or not done to what's unknown and what's solved." **Scopes** are
independently-buildable slices that each get their own dot; a stuck scope usually means a badly-drawn scope.

**This is the single best idea in the whole digest for the IDE.** Jake's plan checkboxes are 100% unticked in
11/13 real plans — because checkbox-ticking is bookkeeping that produces no information the builder needs. A
per-scope uphill/downhill position is *one integer per scope*, it is the thing a home screen should show, and an
agent can actually report it honestly at the end of a unit ("I now know exactly how to finish this" vs "I still
don't know how X will work"). It also degrades gracefully: an agent that reports 0.4 twice in a row is a visible
stall signal, which unticked checkboxes never are.

### 1.7 Circuit breaker, scope hammering, baseline

> "the six-week bet has a `circuit breaker` — if the work doesn't get done, the project doesn't happen."
> "Instead of comparing up against the ideal, compare down to `baseline` — the current reality for customers."
> Scope hammering questions: "Could we ship without this?" "Is this a new problem or a pre-existing one that
> customers already live with?"
> "QA generates `discovered tasks` that are all `nice-to-haves` by default."

**Transfers:** all three, hard. The circuit breaker is the missing counterweight to agent throughput — an
appetite with no expiry is just a wish. "Compare down to baseline" is precisely the right lens for a health sweep
(is this finding worse than what users live with today?), and "discovered work is a nice-to-have by default" is
the rule that stops a merge-gate review panel from turning into an infinite scope generator.

### 1.8 Get one piece done — vertical slices

> "pick off one slice of the project to integrate. Then when that's done, the team has something tangible that
> they've proven to work."

First piece should be **core**, **small**, and **novel** — "If two parts of the project are both core and small,
prefer the thing that you've never done before." And: "First make it work, then make it beautiful."

**Transfers:** the *novel-first* ordering rule is a cheap, concrete heuristic house-shaper could apply when
sequencing plan units, and it compounds with the rabbit-hole check (novel work is where the fat tail lives).

### 1.9 Shape Up — what to skip

| Skip | Why |
|---|---|
| Six-week cycle calendar | Jake's slices are hours-to-days. Keep *appetite*, drop the fixed cadence. |
| The betting table as a meeting | One person. It's a decision, not a forum. But **record** the bet. |
| "No backlog" | roadmap.md earns its keep for a solo dev; grooming cost is a team cost. |
| Separate shaper/builder *people* | Already structurally present as shaper-skill vs builder-agent — keep the *separation of artifacts*, not of humans. |
| Cool-down as calendar time | Convert to "health sweep + retro" as an explicit post-slice state. |

---

## 2. ADR practice — Nygard, MADR, adr.github.io

Sources: [Nygard, "Documenting Architecture Decisions"](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions),
[MADR](https://adr.github.io/madr/), [adr.github.io](https://adr.github.io/),
[log4brains](https://github.com/thomvaill/log4brains).

### 2.1 The original contract

Nygard's five sections — **Title, Status, Context, Decision, Consequences**:

> Title: "short noun phrases. For example, 'ADR 1: Deployment on Ruby on Rails 3.0.10'"
> Context: "describes the forces at play, including technological, political, social, and project local"
> Decision: "stated in full sentences, with active voice. 'We will …'"
> Consequences: "describes the resulting context, after applying the decision. All consequences should be listed
> here, not just the 'positive' ones."

Two rules that matter more than the template:

> "If a decision is reversed, we will keep the old one around, but mark it as superseded. (It's still relevant to
> know that it *was* the decision, but is *no longer* the decision.)"
> "ADRs will be numbered sequentially and monotonically. Numbers will not be reused."

And the motivating argument — without records, a newcomer must either "Blindly accept the decision" (ossification)
or "Blindly change it" (destroying architectural value); teams become "afraid to change anything."

**Note the substitution that makes this urgent for house v2: every agent session is a newcomer.** Nygard's
"newcomer" problem is the *permanent, universal* condition of an agent workflow. An ADR corpus is not nice-to-have
documentation here — it is the only mechanism by which a decision survives a context window.

### 2.2 MADR — the frontmatter is the point

MADR's optional YAML frontmatter:

```yaml
---
# status: "{proposed | rejected | accepted | deprecated | … | superseded by ADR-0123}"
# date: {YYYY-MM-DD when the decision was last updated}
# decision-makers: {list everyone involved in the decision}
# consulted: {…}
# informed: {…}
---
```

Sections: Context and Problem Statement · Decision Drivers · Considered Options · Decision Outcome ·
**Consequences** · **Confirmation** (how compliance with the decision is checked) · Pros and Cons of the Options ·
More Information.

Two things to steal beyond the obvious:

1. **Supersession lives in the status string itself** (`superseded by ADR-0123`) — a machine-readable back-pointer,
   not prose. That is the whole graph, in one field.
2. **"Confirmation"** — an explicit section for *how you'd verify the code still obeys this decision*. This is the
   missing link between an ADR and a health sweep: it turns a decision into a checkable invariant. Almost nobody
   fills this in. An agent will fill it in every time, for free.

`decision-makers` / `consulted` / `informed` are RACI ceremony — drop them, or collapse to a single
`decided-by: jake | agent` field, which is genuinely interesting provenance in an agentic workflow.

### 2.3 Tooling precedent

log4brains generates a searchable static site + timeline from a directory of MADR markdown files
(`log4brains adr new`, `log4brains build`). adr-tools does the same at the CLI level, including auto-writing the
supersession link on both sides.

**The precedent that matters:** a *derived index* generated from frontmatter, never hand-maintained. Jake's IDE
side pane is exactly log4brains-with-a-native-UI. If the frontmatter is right, the index is free — and the "spec
Status: lines go stale" problem becomes impossible to have, because nothing is hand-copied.

---

## 3. Oxide RFDs — the closest existing thing to what house v2 needs

Source: [RFD 1: Requests for Discussion](https://oxide.computer/blog/rfd-1-requests-for-discussion) and the
[public RFD index](https://rfd.shared.oxide.computer/).

### 3.1 The state machine

Six states, in a real, published, decade-old-in-spirit process (Oxide inherited the ethos from IETF RFC 3 —
"Notes are encouraged to be timely rather than polished"):

| State | Meaning |
|---|---|
| `prediscussion` | placeholder; work iterating fast in the branch, not yet ready for discussion |
| `ideation` | *topic only* — a description of what the RFD will cover, indicating eventual scope |
| `discussion` | under active review via PR |
| `published` | merged after discussion converged — "just because something is in the published state does not mean that it cannot be updated and corrected" |
| `committed` | fully implemented; describes "how a system works" rather than future aspirations |
| `abandoned` | non-viable or deliberately not implemented |

### 3.2 The mechanics

- **Frontmatter is mandatory**: `authors`, `state`, `discussion` (link to the PR).
- **Numbering**: sequential, zero-padded (`0001`, `0042`).
- **Storage**: `rfd/{number}/README.md` — *a directory per RFD*, so supporting assets live with it.
- **Branch named for the RFD number**; never push directly to master.
- **Discoverability by construction**: `{num}.rfd.oxide.computer` resolves, and `/discussion` appends to it.
- The public index shows live counts per state (15 discussion / 61 published / 4 committed at time of writing) —
  *because the state is a field, the dashboard is trivial*.

### 3.3 Why this is the template for house v2

Every structural weakness in the audit is solved here, and solved the same way:

| Audit weakness | RFD's answer |
|---|---|
| No machine-readable state anywhere | `state:` in frontmatter, one enum, one place |
| Slice identity ambiguous ("two Slice N series") | zero-padded monotonic number **is** the identity; branch name and directory both derive from it |
| Spec Status goes stale after merge | `published` → `committed` is an explicit transition someone owns, and `committed` means *implemented* — exactly the state a shipped slice needs |
| Mockup path unspecified | directory-per-unit: everything about RFD 42 is in `rfd/0042/` |
| Retro filename key undefined | same — a retro is a file inside the numbered directory, not a date-string guess |

The **`ideation` state is a small masterstroke** worth calling out: it legitimises a document that contains *only
a topic*. Jake's roadmap backlog items are exactly this, and today they have nowhere to live as first-class
objects. Giving a backlog idea a number on day one — and letting it sit in `ideation` for a year — means slice
identity is stable from the moment the idea exists, not from the moment shaping starts.

Also worth stealing: **`abandoned` is a first-class terminal state.** Nothing in the current house model can
record "we decided not to do this" other than deletion, which destroys the reason.

---

## 4. Rust RFCs

Source: [rust-lang/rfcs](https://github.com/rust-lang/rfcs).

- **Scoped triggers.** RFCs are required for "any semantic or syntactic change to the language that is not a
  bugfix", removing features, "large additions to `std`". *Not* required for "additions that strictly improve
  objective, numerical quality criteria" or minor library additions. **The threshold is written down.**
- **FCP (Final Comment Period)**: a motion with a disposition (merge / close / postpone), lasting "ten calendar
  days, so that it is open for at least 5 business days."
- **Acceptance ≠ implementation.** > "Being 'active' is not a rubber stamp… still does not mean the feature will
  ultimately be merged." And: > "the fact that a given RFC has been accepted and is 'active' implies nothing about
  what priority is assigned to its implementation."
- **Tracking issues**: > "Every accepted RFC has an associated issue tracking its implementation in the Rust
  repository."
- **`postponed`** is a distinct outcome from `closed` — deferred, not rejected.

**Transfers:**
1. **A written threshold for when a decision needs a record.** The house doctrine says "on any decision," which is
   unbounded and therefore ignored under pressure. Rust's shape — a short list of triggers plus an explicit
   *doesn't need one* list — is the pattern.
2. **The accepted-doc ↔ implementation-tracker link.** Rust separates "the decision is made" from "the work is
   done" and *links them by ID*. House v2 needs the same edge: a spec/plan is not a work item; it points at one.
   This is precisely why "spec says Draft after the slice shipped" happens — one field is being asked to carry two
   different lifecycles.
3. **`postponed` as distinct from `rejected`.** Same value as Oxide's `abandoned`, one notch softer.

**Skip:** FCP timers, disposition motions, sub-team quorum — all pure multi-human synchronisation. For a solo dev
the "final comment period" collapses to a single reviewing agent's verdict, which is already what plan-check is.

---

## 5. Docs-as-code: Diátaxis, arc42, C4

Sources: [Diátaxis](https://diataxis.fr/) (and [start here](https://diataxis.fr/start-here/)),
[arc42](https://arc42.org/overview), [C4 model](https://c4model.com/),
[arc42 + C4 + docs-as-code example](https://github.com/bitsmuggler/arc42-c4-software-architecture-documentation-example).

### 5.1 Diátaxis

Four modes — **tutorial** (to learn), **how-to guide** (to solve a problem), **reference** (to look up facts),
**explanation** (to understand the why) — arising from two axes: *action vs cognition* and *acquisition vs
application* (study vs work). Created by Daniele Procida in 2020; used by Django, Canonical, Cloudflare, Gatsby.
The governing question is "what is the reader trying to do?", and the sharpest claim is that mixing modes destroys
all of them — "a tutorial that also explains the theory helps no one." Diátaxis explicitly addresses content (what
to write), style (how to write it) and architecture (how to organise it).

**What transfers:** the *method*, not the four buckets. Jake's docs are not user documentation, so tutorial/how-to
don't map. But the **one-job-per-doc principle is already the best idea in the existing doctrine** ("Doc model —
one job per doc", the dev-state allowlist, the routing table). Diátaxis validates it and adds the diagnostic
question: for each house doc, *who is the reader and what are they trying to do?* Applying that honestly:

| Doc | Reader | Trying to do |
|---|---|---|
| dev-state.md | an agent resuming cold | reconstruct current state in 10 seconds |
| roadmap.md | Jake, deciding what's next | choose the next bet |
| ADR | an agent about to change something | avoid blindly accepting or blindly changing |
| spec | a builder agent | know what "correct" means |
| plan | a builder agent | know what to do next and when to stop |
| retro | the process itself | improve the skills |

Two of those readers are *agents resuming with no memory*, which argues for a different form than prose — a
header block a machine can read, with prose below it. Diátaxis's real lesson for house v2: **the reader of most
of these documents is not a human, so stop optimising the prose and start optimising the header.**

**Skip:** the four-way taxonomy itself, and any "restructure all docs" project. Diátaxis explicitly recommends
incremental application.

### 5.2 arc42 and C4

arc42 is a 12-section template for architecture communication ("what should you document about your
architecture?") covering requirements, quality goals, decisions (§9 is literally ADRs), building-block
decomposition, runtime and deployment views. C4 is "a lightweight visual notation" at four zoom levels — Context,
Container, Component, Code — with no prescribed sections for requirements or risks. They compose: arc42 for the
sections, C4 for the diagrams, docs-as-code (AsciiDoc/Markdown + Structurizr DSL, in git, generated in CI) for the
plumbing.

**Transfers (thin but real):**
1. **A per-project stable architecture doc** — house v2 has dev-state (volatile) and roadmap (strategy) but *no
   durable "how this system is built" doc*. Every agent session rediscovers the architecture from source. A
   trimmed arc42 (quality goals · building blocks · constraints · decisions index) would be the highest-leverage
   *new* doc in the model. Do not adopt all 12 sections.
2. **C4 zoom levels as a fidelity contract for diagrams** — same insight as breadboards vs mockups: name the
   level so the tool knows what it's rendering. Mermaid renders C4-ish diagrams natively and lives in markdown, so
   the IDE gets this nearly free.

**Skip:** arc42's full section set, Structurizr DSL, and anything requiring a diagram toolchain outside the repo.

---

## 6. DORA — the empirical backstop

Sources: [Documentation quality](https://dora.dev/capabilities/documentation-quality/),
[capabilities catalog](https://dora.dev/capabilities/),
[loosely coupled architecture](https://dora.dev/devops-capabilities/process/loosely-coupled-architecture/).

### 6.1 Documentation quality is a *multiplier on every other practice*

DORA assessed docs via "eight metrics that assess documentation attributes like clarity, findability, and
reliability", and found documentation quality drives "the implementation of every single technical practice"
studied. The lift figures (with above-average vs below-average documentation):

| Practice | Lift w/ good docs | Lift w/ poor docs |
|---|---|---|
| Trunk-based development | **1,525%** | 36% |
| Continuous delivery | 656% | 63% |
| Continuous integration | 750% | 34% |
| Supply chain security | 451% | 37% |

And the caveat that matters: "Documentation needs to be actively created and maintained, which takes work."

**This is the argument that the house doc model is not overhead.** It's also a warning: the audit found the docs
*drifting* (stale statuses, unticked plans, inconsistent names) — i.e. failing on *reliability* and
*findability*, two of DORA's eight attributes. Poor-quality documentation doesn't score zero, it scores
*negative*, because it's trusted and wrong. **Generating status rather than hand-writing it is the single
highest-value change available**, on DORA's own terms.

### 6.2 Capabilities that survive translation to solo+agents

| DORA capability | Solo+agent translation |
|---|---|
| **Version control** | already there; extend it to *state* (state lives in the repo, not in a chat) |
| **Working in small batches** | = Shape Up appetite. Shorter lead times, faster feedback, "counteracting the risk of instability as AI accelerates development" — DORA's own AI framing |
| **Continuous integration** / **test automation** | the merge-gate panel is a human-shaped stand-in for CI; a solo dev with agents can afford *real* CI and should |
| **Trunk-based development** | see §7 |
| **Code maintainability** | health sweeps |
| **Loosely coupled architecture** | "teams can make large-scale changes without permission from outside… deploy independently" → for agents: **a unit of work should be completable by one agent session without touching anything another session owns.** This is the real design constraint on slice size |
| **Monitoring and observability** | the IDE. Observability of *the process*, not just the product |
| **Work in process limits** | one active slice, enforced — the current dev-state already has a single "Active slice" section; make it a schema constraint |
| **Documentation quality** | §6.1 |

**Skip:** generative organizational culture, transformational leadership, job satisfaction, well-being,
loosely-coupled *teams*, streamlining change approval, team experimentation — all measure organisational
properties that are degenerate at n=1. (Though "streamlining change approval" has a sly solo analogue: don't build
a heavyweight self-review gate that you'll route around.)

---

## 7. Trunk-based development

Source: [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/).

> "A source-control branching model, where developers collaborate on code in a single branch called 'trunk' and
> resist any pressure to create other long-lived development branches."

Two variants: **direct commits to trunk** (very small teams, speed over staged verification) and **short-lived
feature branches** (for review + CI before merge), where each branch is "the product of a single dev-workstation."
Release branches are cut just-in-time and deleted; feature flags and branch-by-abstraction handle work that
outlives a single merge.

**Transfers:**
1. **Branch lifetime is the metric, not branch existence.** House already does branch-per-unit with worktrees;
   TBD says the danger is *duration*. A unit that can't merge inside one session is mis-sized — which is a
   testable definition of "appetite exceeded" and a natural trigger for the circuit breaker.
2. **"Product of a single dev-workstation"** maps cleanly to *product of a single agent session*. That's a
   crisp, enforceable unit boundary and it aligns with DORA's loose-coupling capability.
3. **Feature flags / branch-by-abstraction** as the escape hatch when a slice genuinely can't be small. Currently
   the house system's only answer is a longer-lived branch, which is the anti-pattern.

**Skip:** release branches, release trains, the Google-scale monorepo machinery.

One sharp operational note already in the house doctrine and worth preserving loudly: `git branch --merged` does
not recognise squash-merged branches; merged-ness must come from PR state. A machine-readable state model should
*derive from `gh pr` facts*, never from reachability.

---

## 8. Definition of Done / Definition of Ready

Sources: [Scrum.org on DoD vs DoR](https://www.scrum.org/resources/blog/what-difference-between-definition-done-dod-and-definition-ready-dod),
[Scrum Alliance](https://resources.scrumalliance.org/Article/definition-vs-ready),
[QualityMinds on DoR](https://qualityminds.com/en/what-the-scrum-guide-is-not-telling-you-definition-of-ready/).

- **DoD** is intrinsic to the work item — tests, docs, acceptance criteria, releasability. The 2020 Scrum Guide
  elevated it to a formal **commitment** for the Increment (alongside Sprint Goal and Product Goal): "Done is not
  optional."
- **DoR** is extrinsic — dependencies resolved, designs done, acceptance criteria clear.
- **The DoD anti-pattern:** "When the DoD is weak, velocity looks high but the team accumulates 'undone work' that
  isn't visible in the numbers." Then someone proposes a hardening sprint — "an anti-pattern, not a solution."
- **The DoR anti-pattern:** gatekeeping and delay — "chase down the completion of a checklist before starting
  their work, which interferes with the team's ability to behave flexibly and incrementally." The Scrum Guide
  deliberately does not include a DoR.

**Transfers:**
1. **A single, project-wide, written DoD** — the strongest, cheapest idea here, and house v2 needs it because
   *"done" is currently whatever the builder agent decided at 2am*. The 4-state builder report is a de facto DoD
   evaluation that is never persisted, so undone work is invisible exactly as DORA/Scrum predict. Make the DoD a
   file (spec-kit calls it a *constitution*), and make the builder's report an **evaluation against it**.
2. **DoR, renamed and kept small.** The plan-check verdict *is* a DoR check, and for agents a DoR is far more
   valuable than for humans: an under-specified item doesn't block an agent, it makes the agent invent
   requirements. The gatekeeping anti-pattern is a *human-queueing* problem; at n=1 the queue is Jake's, so the
   cost is near zero. **Keep it, but express it as the shaper's own output contract** (the pitch's five slots +
   no unresolved `[NEEDS CLARIFICATION]`), not as a separate ceremony.
3. **"Undone work must be visible"** → discovered-but-deferred work needs a real destination with a real state
   (health backlog / `postponed` idea), never a comment in a merged PR.

**Skip:** velocity, story points, sprint commitment, hardening sprints, refinement sessions.

---

## 9. GitHub spec-kit — the AI-native prior art

Source: [github/spec-kit](https://github.com/github/spec-kit),
[spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md).

Workflow: `/speckit.constitution` → `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` →
`/speckit.taskstoissues` → `/speckit.implement`, plus `/speckit.analyze`.

Conventions worth copying wholesale:

- **Feature numbering is derived, not chosen.** `/speckit.specify` "Scans existing specs to determine the next
  feature number" (001, 002, …) and "Generates a semantic branch name from your description" → `003-chat-system`.
- **Directory per feature**: `specs/[branch-name]/` containing `spec.md`, `plan.md`, `tasks.md`, `research.md`,
  `data-model.md`, `contracts/`, `quickstart.md`. **The branch name and the directory name are the same string.**
- **`[NEEDS CLARIFICATION: specific question]`** — a literal in-document marker for ambiguity, so the agent flags
  rather than assumes. Grep-able; a gate can refuse to proceed while any remain.
- **`constitution.md`** — project principles/governance/standards, checked by every downstream command. (This is
  the DoD, made loadable.)
- **Phase gates with named articles** (Simplicity / Anti-Abstraction / Integration-First); failing a gate requires
  a documented justification in a "Complexity Tracking" section rather than silent override.
- **`/speckit.analyze`** — a read-only consistency check *across* spec, plan and tasks, catching "duplications,
  ambiguities, coverage gaps, and contradictions between artifacts before you've written any code."
- `[P]` markers for parallelisable tasks.
- Ecosystem includes drift-detection quality gates.

**Assessment.** spec-kit is roughly "house, but with the file conventions nailed down and the gates named." Jake
should not adopt it (it's heavier, and house's orchestrator/builder split is better) — but it is proof that the
specific fixes the audit calls for are *conventional in 2026*, not invention:

- derived monotonic IDs (fixes slice identity)
- branch name ≡ directory name (fixes artifact location, including mockups)
- an explicit ambiguity marker (fixes "spec was under-specified and the agent guessed")
- a cross-artifact consistency checker (fixes drift between spec/plan/code — and is a *far* better use of a
  reconcile subagent than hand-editing prose)
- a justification-required gate override (fixes "verdict was GO-WITH-FIXES and nobody recorded the fixes")

---

## 10. What house v2 should steal

Ordered by leverage. Each is traced to a source and to an audit weakness.

### Tier 1 — structural, fixes the most weaknesses per unit of change

1. **A numbered, directory-per-unit artifact layout, with the ID as the single identity.**
   *From: Oxide RFD (`rfd/0042/README.md`), spec-kit (`specs/003-chat-system/`), Nygard (monotonic, never reused).*
   Fixes: ambiguous slice identity, undefined mockup path, undefined retro filename key, drifting doc names.
   The ID is minted **when the idea first exists** (Oxide's `ideation`), not when shaping starts. Branch name,
   worktree name, directory name and PR title all derive from it mechanically. Everything about unit 0042 —
   spec, plan, plan-check, breadboard, mockup HTML, retro — is in `0042/`. There is then nothing left to
   name, and the IDE's side pane is a directory listing.

2. **YAML frontmatter with a `state` enum on every process artifact.**
   *From: Oxide RFD (`authors`/`state`/`discussion`), MADR (`status`, `date`, `superseded by ADR-0123`).*
   Fixes: no machine-readable state, stale Spec Status lines, unpersisted plan-check verdicts.
   One enum, one place, one owner per transition. Terminal states include `abandoned`/`postponed` so "we decided
   not to" is recordable. Supersession is a field, not prose.

3. **Persist the gate verdicts as artifacts, and make them gate a transition.**
   *From: Shape Up (a hole-y pitch is not bet on), Rust (FCP disposition; acceptance ≠ implementation),
   spec-kit (gate failure requires documented justification in Complexity Tracking).*
   Fixes: plan-check verdicts and the builder's 4-state report being conversation-only.
   `GO-WITH-FIXES` must name the fixes *in a file*, or it isn't a verdict. The builder's report is an evaluation
   against the DoD, written down, and it is what moves the state field.

4. **Derive every index and status view; hand-maintain nothing.**
   *From: log4brains/adr-tools, docs-as-code single-source-of-truth, DORA's reliability & findability metrics.*
   Fixes: stale statuses, drifting dev-state headings, unticked checkboxes.
   dev-state.md stops being a hand-written tracker and becomes a *rendered view* over frontmatter + `gh pr` facts.
   The allowlist becomes a schema. The IDE home screen is the same view, natively.

### Tier 2 — process discipline the solo+agent case specifically lacks

5. **Appetite + circuit breaker on every unit.**
   *From: Shape Up ch. 3 and 14; TBD branch-lifetime; DORA small batches.*
   A declared time/size budget recorded in frontmatter, and an explicit rule for what happens when it's blown
   (scope-hammer or abandon — never silently extend). Operationalise as: *a unit that can't merge within one
   agent session was mis-sized.*

6. **The five-slot pitch as the spec schema — especially No-Gos.**
   *From: Shape Up ch. 6.* Problem · Appetite · Solution · Rabbit Holes · **No-Gos**. Machine-checkable (five
   required headings), and negative scope is the single most valuable instruction you can give an eager agent.

7. **Hill-chart position per scope instead of plan checkboxes.**
   *From: Shape Up ch. 13.* One number per scope, reported honestly at the end of every unit; "unknown vs solved",
   not "done vs not done". Replaces the checkbox ritual that 11/13 real plans ignored, gives the IDE a genuinely
   good home-screen widget, and makes stalls visible.

8. **A written DoD (a "constitution") + a small, shaper-owned DoR.**
   *From: Scrum 2020 DoD-as-commitment; spec-kit constitution; DoR anti-pattern literature.*
   The DoD is a file every builder loads and reports against. The DoR is not a ceremony — it's the shaper's output
   contract: five pitch slots filled, zero unresolved `[NEEDS CLARIFICATION]`, rabbit holes named.

9. **`[NEEDS CLARIFICATION: …]` as a literal, grep-able marker.**
   *From: spec-kit.* Cheapest item on this list. Agents assume when under-specified; this gives assumption a place
   to surface and a gate a thing to block on.

### Tier 3 — worth doing, lower urgency

10. **Typed design artifacts at named fidelities.** *From: Shape Up breadboard/fat-marker; C4 zoom levels.*
    `breadboard` / `sketch` / `mockup` are different things answering different questions. Type them in frontmatter
    and the IDE webview knows what it's showing. Fixes the mockup-path problem at the *concept* level, not just
    the folder level.

11. **A durable architecture doc (trimmed arc42) per project.** *From: arc42 §1/§4/§9 + C4.*
    Currently missing entirely; every agent session rediscovers the architecture from source. Quality goals ·
    building blocks · constraints · decisions index. Four sections, not twelve.

12. **MADR's "Confirmation" section on ADRs.** *From: MADR.* How would you check the code still obeys this
    decision? Turns each ADR into an invariant the health sweep can actually test. Humans never fill this in;
    agents will.

13. **A written threshold for "does this need an ADR?"** *From: Rust RFCs' required/not-required lists.*
    "On any decision" is unbounded and therefore ignored. Name the triggers and, importantly, name the exclusions.

14. **Cross-artifact consistency check as a first-class command.** *From: spec-kit `/speckit.analyze`.*
    A read-only pass over spec ↔ plan ↔ code ↔ state finding contradictions and coverage gaps. This is what the
    reconcile subagent should *be*, rather than a prose-editing errand.

### Explicitly do not steal

Six-week cycles · betting-table meetings · "no backlog" · cool-down as calendar time · story points/velocity ·
sprint ceremonies · FCP timers and quorum · RACI fields on ADRs · full arc42 · Structurizr toolchains · release
branches/trains · DORA's organisational-culture capabilities · DoR as a queue gate.

**The through-line:** every one of these exists to synchronise multiple humans or to forecast for stakeholders.
Jake has neither problem. What he has instead is a *memory* problem — every agent is a newcomer, every session
starts cold — and the methods that solve **that** are the written-artifact cultures (RFD, ADR, RFC, spec-kit),
not the agile process frameworks.

---

## Sources

- [Shape Up — Basecamp](https://basecamp.com/shapeup/) — chapters [3](https://basecamp.com/shapeup/1.2-chapter-03), [4](https://basecamp.com/shapeup/1.3-chapter-04), [5](https://basecamp.com/shapeup/1.4-chapter-05), [6](https://basecamp.com/shapeup/1.5-chapter-06), [8](https://basecamp.com/shapeup/2.2-chapter-08), [9](https://basecamp.com/shapeup/2.3-chapter-09), [11](https://basecamp.com/shapeup/3.2-chapter-11), [13](https://basecamp.com/shapeup/3.4-chapter-13), [14](https://basecamp.com/shapeup/3.5-chapter-14)
- [Oxide: RFD 1 — Requests for Discussion](https://oxide.computer/blog/rfd-1-requests-for-discussion) · [public RFD index](https://rfd.shared.oxide.computer/) · [Oxide and Friends: RFDs, the Backbone of Oxide](https://oxide-and-friends.transistor.fm/episodes/rfds-the-backbone-of-oxide)
- [Michael Nygard — Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [MADR](https://adr.github.io/madr/) · [adr.github.io](https://adr.github.io/) · [log4brains](https://github.com/thomvaill/log4brains)
- [rust-lang/rfcs](https://github.com/rust-lang/rfcs)
- [Trunk Based Development](https://trunkbaseddevelopment.com/)
- [DORA: Documentation quality](https://dora.dev/capabilities/documentation-quality/) · [capabilities catalog](https://dora.dev/capabilities/) · [loosely coupled architecture](https://dora.dev/devops-capabilities/process/loosely-coupled-architecture/)
- [Diátaxis](https://diataxis.fr/) · [Start here](https://diataxis.fr/start-here/) · [I'd Rather Be Writing on Diátaxis](https://idratherbewriting.com/blog/what-is-diataxis-documentation-framework)
- [arc42 overview](https://arc42.org/overview) · [arc42 + C4 + docs-as-code example](https://github.com/bitsmuggler/arc42-c4-software-architecture-documentation-example)
- [Scrum.org — DoD vs DoR](https://www.scrum.org/resources/blog/what-difference-between-definition-done-dod-and-definition-ready-dod) · [Scrum Alliance](https://resources.scrumalliance.org/Article/definition-vs-ready) · [QualityMinds — what the Scrum Guide isn't telling you about DoR](https://qualityminds.com/en/what-the-scrum-guide-is-not-telling-you-definition-of-ready/)
- [github/spec-kit](https://github.com/github/spec-kit) · [spec-driven.md](https://github.com/github/spec-kit/blob/main/spec-driven.md) · [Microsoft Dev Blog walkthrough](https://developer.microsoft.com/blog/spec-driven-development-spec-kit/)
