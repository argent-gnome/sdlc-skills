# Token-lean Claude Code: skills, subagents, and context

A practitioner's guide to *why* a Claude Code setup gets expensive and *how* to make it
cheap without losing capability. This is the general theory; the companion
**[case-study.md](case-study.md)** shows it applied to the house SDLC skills.

The short version: **context is paid for per message, not per session.** Anything loaded into a
session's context is re-sent on every single turn for the rest of that session. So the cost of a
capability is not "how big is it" but "how often is it re-sent while idle." The whole craft is moving
weight out of the always-loaded path and into places that are paid for only when actually used.

---

## Why this matters

A large language model is stateless. It does not "remember" your conversation between turns. To
continue a conversation, the entire context — system prompt, tool definitions, every prior message,
every loaded skill body — is re-sent to the model on *every* turn.

That has a sharp consequence:

> A 3,000-token skill body that stays loaded for a 60-message session is not a 3,000-token cost.
> It is re-sent ~60 times. The thing you load once is paid for continuously.

So the expensive question is never "how big is this file." It is **"how long does it stay in the
context, and how many turns pay for it."** A big file used once and discarded is cheap. A small file
that is always present is, over a long session, surprisingly expensive.

This reframes the entire optimization. You are not trying to write smaller things. You are trying to
keep the *always-loaded path* small, and push everything else into contexts that are short-lived or
loaded on demand.

---

## How context works in an agent session

Think of an agent session's context as having three tiers, ordered by how much they cost you.

### Tier 1 — Always loaded, every turn (the expensive path)

This is what's in context on turn 1 and still in context on turn 100:

- The system prompt and environment preamble.
- **Every tool definition** the session can call.
- **Every skill and agent *description*** that's registered — the one-line `name` + `description`
  metadata, not the body. Claude needs these to know what it *could* invoke.
- The running conversation transcript (which only grows).

Everything here is "idle cost": you pay for it whether or not you use it, on every turn. A registered
skill you never invoke still costs its description line on all 100 turns.

### Tier 2 — Loaded on demand, then sticky (the per-message path)

When you *invoke* a skill, its full body is loaded into the context — and it **stays** loaded for the
rest of the session. That's the design: the skill is now guiding the session, so its instructions need
to be present each turn.

This is the tier that quietly dominates cost. A skill body is paid for not once, but on *every turn
from invocation to session end.* A monolithic 8,000-token skill invoked early in a long session is the
single most expensive thing in most setups.

### Tier 3 — Isolated, returns only a result (the nearly-free path)

A subagent runs in its **own separate context window.** It reads files, runs tools, thinks at
length — and none of that lands in your session. Only its final output (often a few hundred tokens)
comes back. The 50,000 tokens of diffs it read to produce a GO/NO-GO verdict die with its context.

This is the lever. Heavy *reading and reasoning* belongs in tier 3, where it's paid for once in a
throwaway context, not in tier 2, where it's re-sent every turn.

---

## The plugin trap

Plugins are not inherently heavy. But the way plugins are usually built makes them heavy, and the
mechanism is worth understanding because it's the same mechanism for everything else.

A plugin can ship two kinds of things:

1. **Skills** — each contributes a description line to tier 1 (idle), and its body to tier 2 *only if
   invoked.*
2. **Registered agents** — each contributes a description line to tier 1 (idle), *always*, because the
   model has to know the agent exists to delegate to it.

So a plugin with one lean skill and zero agents is nearly free at idle: one description line. A plugin
with a monolithic skill and four registered agents pays:

- Four agent description lines, **every turn, forever**, used or not.
- The full skill body on every turn **once anything triggers it** — and a monolithic skill that covers
  the whole lifecycle gets triggered in basically every session.

The lesson is not "plugins are bad." It's that **registration is the cost.** Anything that must
announce itself in tier 1 so the model knows it exists is an idle tax. The number of registered
surfaces — agents especially — is what you're actually paying for at idle, and a fat skill body is
what you pay for per-turn once it's live.

---

## Subagents vs. loaded ("full") agents

This distinction trips people up, so state it plainly:

**A registered agent and an ad-hoc subagent are the same execution mechanism.** Both run in an
isolated context and return only their output. Neither one keeps its working context in your session.
The *only* difference is registration:

| | Idle cost (tier 1) | Where its instructions live |
|---|---|---|
| **Registered agent** | one always-on description line | in the agent definition |
| **Inline subagent** (dispatched with a prompt) | **zero** | in the body of whatever skill dispatches it |

So if you have a review rubric that should run as an isolated reviewer, you have a choice. Register it
as an agent and pay a description line on every turn forever — or keep the rubric *inside the
dispatching skill's body* and spawn an inline subagent with that prompt when needed. The second option
has **zero idle cost.** The rubric is only in context when the skill that owns it is already loaded.

A corollary that surprises people: **moving an agent to a remote/hosted runner does not reduce your
context load.** Remote execution solves *compute offload* — running work on someone else's machine.
But a local subagent already keeps its context out of your session. The parent-context savings are
already fully captured by the subagent being a subagent. Hosting changes *where the CPU runs*, not
*what's in your prompt.*

---

## The best practices

Distilled from the above. These are ordered roughly by leverage.

**1. Minimize the always-loaded surface, not the total amount of capability.**
Count your tier-1 lines: tool defs, skill descriptions, agent descriptions. That number is multiplied
by every turn of every session. Capability that lives in tier 2 or tier 3 is comparatively free.

**2. Split a monolith along the seam you actually work on.**
A single skill that covers a whole lifecycle taxes every session for parts it isn't using. If your work
naturally divides into roles (conduct vs. execute, plan vs. build), make one skill per role. Each
session then loads only its half.

**3. Put heavy reading in subagents; keep only verdicts in the parent.**
Reviews, audits, diff analysis, log trawls — anything that reads a lot to conclude a little — belongs
in an isolated context. The parent should receive the conclusion (GO/NO-GO, a ranked list, a verdict),
never the raw material.

**4. Prefer inline subagents over registered agents for rubric-style work.**
If a reviewer's instructions can live in the body of the skill that dispatches it, you avoid the idle
description tax entirely. Register an agent only when it must be invokable *independently* of any
particular skill.

**5. Make long-lived sessions resumable from a cheap artifact, not a fat transcript.**
A conductor session you keep reopening shouldn't rebuild its picture by reloading a giant history.
Have it write a short plaintext state file and rebuild from that. A fresh session reading a 1-KB status
file is far cheaper than dragging a 100-message transcript forward.

**6. Make ephemeral sessions actually ephemeral.**
The heavy implementation log of a build session is its biggest cost. If that session is spun up to do
one unit of work and then torn down, the log dies with it and never contaminates the long-lived
conductor.

**7. Don't optimize what isn't on the hot path.**
A big doc read once is cheap. A workflow script on disk costs nothing until it runs. Spend your effort
on the always-loaded tier and the sticky tier-2 bodies — that's where the multiplier lives.

---

## A quick mental model

When you're about to add a capability, ask in order:

1. **Does it need to announce itself at idle?** If not, don't register it — dispatch it inline.
2. **Does it read a lot to conclude a little?** If so, it's a subagent, not inline skill text.
3. **Will it stay loaded once triggered?** If so, is it carrying weight that only *some* sessions need?
   Split it.
4. **Is this a long-lived session?** Then give it a cheap resume artifact so reopening is free.

Get those four right and a setup that felt heavy becomes lean without losing a single capability — which
is exactly what the [case study](case-study.md) walks through.
