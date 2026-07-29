---
id: "0003-house-v2-s3-smoke-findings-kernel-fixes"
kind: spec
slice: "0003-house-v2-s3-smoke-findings-kernel-fixes"
title: "house v2 S3 — smoke findings kernel fixes"
status: "shaped 2026-07-29; user-approved"
state: approved
---
# Spec — house v2 S3: smoke findings kernel fixes

## Problem
The S2 smoke run recorded four kernel defects as `work.discovered` (roadmap backlog): the strict
validator's marker check false-positives on prose and has no per-slice scoping (it forced a merge-gate
NO_GO and two meaning-preserving rewordings of approved documents — the record degraded to satisfy the
linter); approval state can drift between `slice.yaml` and a doc's own frontmatter undetected; `house
gate` drops `--payload` detail and `notes` from the event-log copy; and `house gate` reads `--by` while
every other command reads `--actor`, with the parser silently swallowing the unknown spelling.

## Appetite
1 session. Slice tier — bumped from patch at shaping (user decision 2026-07-29) because R-1 changes what
the shaper's handoff bar *asserts*, which is doctrine, not lint. ~50–60 lib lines, ~9 tests, one unit.

## Solution
Four fixes in two clusters. Cluster V (`cli/lib/validate.js`): a real marker matcher with `--slice`
scoping (R-1), then an approval-boundary frontmatter cross-check that inherits the scoping (R-2).
Cluster G (`cli/lib/slices.js`, one eight-line region): gate events carry a reference manifest (R-3) and
`--actor`/`--by` are unified (R-4). Then the root enabler: the dispatcher rejects unknown flags (R-5).
Docs canonicalized in the same slice (`cli/README.md`, `skills/house2-shaper/SKILL.md`).

## Rabbit Holes
- No general argument-parsing layer — the unknown-flag guard is a plain per-command known-flags table.
- No artifact-state ordering enum — R-2 checks the approval boundary only.
- No inlining of gate payload blobs into `events.jsonl` — the event references the yaml, which stays the
  detailed record.

## No-Gos
- NOT any change to v1 `house-*` skills or `merge-gate-panel.js`/`code-health-sweep.js`.
- NOT a migration of already-recorded events — history stays as written.
- NOT scoping changes to non-strict `house validate` coverage.
- NOT new subcommands or renamed flags beyond documenting `--actor` as canonical.

## Requirements

### R-1: strict marker check — well-formed, handoff-scoped, sliceable
The `--strict` marker check matches only a well-formed marker (`\[NEEDS CLARIFICATION\b[^\]]*\]`) after
stripping fenced code blocks and inline code spans; it scans only handoff artifacts (`spec.md`,
`plan.md`) — never `retro.md`, `plan-check.md`, `merge-gate.md`, or `research/`. `house validate`
accepts `--slice <id>`: checks run for that slice only, and an unknown id is an error (exit 1), never a
silent green. The shaper handoff bar becomes `house validate --strict --slice <id>`
(`skills/house2-shaper/SKILL.md` §9 updated); repo-wide `--strict` keeps covering every slice.

#### Scenario: prose quoting the marker no longer blocks
- Given a slice doc whose prose or backticked text mentions the marker without a well-formed instance
- When I run `house validate --strict`
- Then the exit code is 0

#### Scenario: a real marker in the slice's own spec still blocks
- Given `spec.md` in slice A containing a well-formed `NEEDS CLARIFICATION` marker in brackets
- When I run `house validate --strict --slice A`
- Then the exit code is 1 and the finding names slice A's spec

#### Scenario: another slice's marker cannot block a scoped handoff
- Given a real marker in slice B's `spec.md` and none in slice A's handoff artifacts
- When I run `house validate --strict --slice A`
- Then the exit code is 0 (and repo-wide `house validate --strict` still exits 1)

#### Scenario: a typo'd slice id fails closed
- When I run `house validate --strict --slice 0003-typo`
- Then the exit code is 1 with an unknown-slice error, not a green pass

### R-2: approval-boundary cross-check between manifest and frontmatter
If `slice.yaml` records an artifact (`spec`/`plan`) as `approved` or `done`, the corresponding doc's
frontmatter `state:` must also be `approved` or `done` — otherwise `house validate` errors. A missing or
unparseable frontmatter/state on a manifest-approved artifact is a warning finding (the check cannot be
evaded by deleting frontmatter). Respects `--slice` scoping.

#### Scenario: the 0002 drift is now caught
- Given `slice.yaml` with `artifacts.spec.state: approved` and a `spec.md` frontmatter `state: draft`
- When I run `house validate`
- Then the exit code is 1 and the finding names both records

### R-3: gate events reference their record instead of dropping it
`house gate` writes a `gate.recorded` event whose payload includes `gate`, `verdict`, `by`, `record`
(repo-relative path to `gates/<name>.yaml`), `detail` (the extra payload keys persisted there, if any),
and `notes` inline when given. The yaml file remains the full record; the event never inlines its blob.

#### Scenario: payload keys are discoverable from the log
- When I run `house gate merge_gate --slice X --verdict GO --payload '{"lenses":[]}' --notes "clean"`
- Then `gates/merge_gate.yaml` holds the full payload and the event's payload lists `detail: ["lenses"]`,
  `record: docs/slices/X/gates/merge_gate.yaml`, and `notes: clean`

### R-4: one actor spelling
`house gate` resolves the recorded actor as `--actor` ?? `--by` ?? `agent` (accepting the legacy `--by`
as an alias). `cli/README.md` and `skills/house2-shaper/SKILL.md` document `--actor` as the canonical
spelling everywhere.

#### Scenario: the S2 re-gate anomaly cannot recur
- When I run `house gate merge_gate --slice X --verdict GO --actor reviewer`
- Then the yaml records `by: reviewer` and the event records `actor: reviewer`

### R-5: unknown flags fail closed
Every `house` command rejects a flag it does not consume: exit 1, naming the unknown flag. Positional
arguments are unaffected.

**One exemption, deliberate (plan-check A4, reconciled into the spec as-built 2026-07-29):** `house hook`
is absent from the known-flags table, because advisory-only hooks never exit non-zero
([ADR-0004](../../adr/0004-house2-coexistence-and-advisory-hooks.md)). A command with no table entry
skips the guard entirely — that absence *is* the exemption mechanism.

#### Scenario: a misspelled flag is refused, not swallowed
- When I run `house gate merge_gate --slice X --verdict GO --actro reviewer`
- Then the exit code is 1 and stderr names `--actro`
