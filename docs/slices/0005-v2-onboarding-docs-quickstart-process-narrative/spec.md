---
id: "0005-v2-onboarding-docs-quickstart-process-narrative"
kind: spec
slice: "0005-v2-onboarding-docs-quickstart-process-narrative"
title: "v2 onboarding docs — quickstart + process narrative"
status: "shaped 2026-07-29; user-approved"
state: approved
---
# Spec — v2 onboarding docs: quickstart + process narrative

## Problem
A developer landing in this repo today cannot learn the v2 process from the docs. The root README has
install steps but no new-project startup; `docs/process.md` (and its published GitHub Pages mirror)
opens with "This is the one build process" and describes **v1**; the v2 doctrine is agent-facing and
lives under `skills/`. The startup steps and the working model exist only in conversation transcripts.

## Appetite
0.5 session, docs-only, patch tier. Two new docs plus one banner; no code, no skill changes.

## Solution
Write the two missing human-facing docs, name-light so the parked cutover's rename sweep (slice 0004)
grows by one block instead of dozens of lines, and banner the v1 process doc so nobody onboards onto
the retired track unknowingly.

## Rabbit Holes
- No restating what schemas own: states, verdicts, and transitions are pointed at
  (`cli/schema/enums.yaml`), never enumerated in prose — same point-never-restate rule the skills obey.
- No v2 rewrite of `process.md` — that stays scoped to post-cutover (its own slice, per 0004's
  research digest).
- The names table is the ONLY place `house2-*` appears in the new docs — grep-checkable.

## No-Gos
- NOT the rename (parked in 0004), NOT any change to skills/ or cli/.
- NOT edits to v1 docs beyond the single banner block (`process.md` + `process.html`).
- NOT best-practices/case-study updates — v1 records, left as written.

## Requirements

### R-1: `docs/quickstart.md` — starting and adopting projects
A short doc with: (a) **new project**: the four-command startup (`git init` → `house init` →
`.house/gates.yml` stack seed → commit) plus "invoke the shaper and answer its first question";
(b) **existing project with shaped work**: the adoption path (shaper session imports artifacts,
re-affirms spec_review, fresh plan_check — per the ADR-0004 amendment, linked); (c) a **current-names
table** listing the three skills as `house2-*` with the note that they become `house-*` at the parked
cutover — the only `house2` mentions in the file; (d) what `gates.yml` is and one example stanza.

#### Scenario: a new dev starts a project without reading transcripts
- Given a dev who has run `./install.sh` and nothing else
- When they follow `docs/quickstart.md` top to bottom
- Then they reach a kernel-tracked repo with a seeded gates file and know which skill to invoke first

#### Scenario: names appear once
- When I grep `house2` in `docs/quickstart.md`
- Then every hit is inside the current-names table block

### R-2: `docs/process-v2.md` — how the v2 system works, for humans
A narrative doc covering: the three roles (shaper shapes, orchestrator sequences and gates, builder
builds — and the invariants: orchestrator never edits code, builder gets only the kickoff brief); the
records-first design (slice dir + manifest + event log are the substrate; any session resumes from
records alone); the gate model (hard gates fail closed, user rungs — spec review, live check — never
self-approve; verdicts are records or they didn't happen); where the heavy work runs (research,
plan-check, merge-gate, reconcile as subagents) and why that keeps sessions light; and pointers to the
doctrine, the enums schema, and `cli/README.md` as the authorities. Skill names via one reference to
the quickstart's names table, not inline.

#### Scenario: the doc defers to the schema
- When I grep `docs/process-v2.md` for a list of slice states or gate verdicts
- Then none is enumerated — the prose links to `cli/schema/enums.yaml` instead

#### Scenario: a dev can predict the loop
- Given a dev who read only `docs/process-v2.md`
- When they watch a slice go idea → shipped
- Then no stage, gate halt, or subagent dispatch is a surprise

### R-3: v1 process doc banner
`docs/process.md` and `docs/process.html` each gain one banner block directly under the title: this
describes the **v1** process, still live for unmigrated repos; the v2 kernel-based process is proving
out — link to `docs/process-v2.md` and `docs/quickstart.md`. No other line of either file changes.

#### Scenario: the published page stops misleading
- When a dev opens the process page (md or the Pages mirror)
- Then the first thing after the title tells them v1 vs v2 and links them to the v2 docs
