---
id: "0008-kernel-record-integrity-writers-that-misrepresen"
kind: spec
slice: "0008-kernel-record-integrity-writers-that-misrepresen"
title: "kernel record integrity — writers that misrepresent their records"
status: "shaped 2026-07-30; user-approved 2026-07-30; R-2 revised after plan-check and re-approved 2026-07-30"
state: approved
---
# Spec — kernel record integrity — writers that misrepresent their records

> Research digest: [`research/record-writer-anatomy.md`](research/record-writer-anatomy.md) — every defect
> below was reproduced against the code, not inferred. Backlog origin: the `[0007]` build and ship, roadmap
> → the kernel-record-integrity framing table (a)–(e), plus one item recorded only in `.house/events.jsonl`.
> Sibling slice: [`0009`](../0009-base-sha-reachability-the-reviewed-diff-must-equ/) owns `base_sha`
> reachability, which was item (e) here until the split.

## Problem

Six defects in the kernel's record-writing surface share one failure direction: **each produces a record
that reads plausible and is wrong.** That is the exact class the one-writer-per-field design exists to
prevent, and it is happening inside the writers themselves.

Two are live bugs that fired during the `[0007]` build:

- `house unit … finalize` truncates the unit report at an **unanchored** `/## Result[\s\S]*$/`
  (`cli/lib/slices.js:243-245`) — first match anywhere in the body. It fired on `[0007]`'s own report:
  prose that spelled the heading inline was matched instead of the real heading, and the section it was
  meant to fill was destroyed. Exit 0, `unit.report` emitted, manifest says `DONE`.
- The sibling `heartbeat` branch (`:235`) does a **first-occurrence plain-string**
  `cur.replace('\n## Result', …)`. Its failure is quieter: nothing is deleted, the heartbeat is inserted in
  the wrong place, exit 0. It did not fire on `[0007]` only because every heartbeat was written before the
  offending prose existed.

A third was found while specifying the first two: both writers pass a **template literal as the replacement
argument** to `.replace`, so `$&`, `` $` ``, `$'` and `$1` inside a `--note` are interpreted as replacement
patterns rather than inserted as text.

Three more are surface defects that cost a builder real time on `[0007]`:

- `house event` accepts `--payload` (JSON-parsed) and not `--note`; the wrong spelling exits 1. The kernel
  has **three** free-text spellings — `--note` on six commands, `--notes` on `gate`, `--payload` on `event`
  — and the guard that rejects a wrong one does not say what the right one is.
- `house unit <slice> report <unit>` does not exist; `finalize` emits `unit.report`. Worse, the action is
  validated **after** the unit lookup, so the typo reports `no such unit: undefined` — naming the wrong
  thing entirely.
- `slice.yaml`'s `adrs:` field has **no writer and no kernel reader**. It is `adrs: []` in the mint literal
  (`:76`) and nothing else in the kernel touches it. `--adr` on `house new` selects the ADR-*minting* branch
  and returns early, so it never reaches a slice manifest. ADR-0005 cites slice `[0007]`; `[0007]` cannot
  cite it back.

**The `adrs:` case is not a dead field — it is a live breach.**
`docs/slices/0001-house-v2-s2-skills-rewrite/slice.yaml:13-14` carries a hand-populated value, and the ADR
it names (`docs/adr/0004-house2-coexistence-and-advisory-hooks.md`) **exists**. The content is true; only the
provenance is wrong. A CLI-owned field was written by hand — a doctrine §1 violation already on `main`,
invisible to `house validate` because there is no manifest key allowlist. That is why deletion is not the
cheap option it appears to be: deleting would discard a correct fact and require hand-editing eight
CLI-owned manifests to do it.

**Why this matters more than the line count suggests.** These writers produce the OBSERVED and DECLARED
layers that every downstream decision reads. A gate verdict, a unit result, a slice-to-ADR edge — if the
writer misrepresents them, nothing downstream can tell. And the repo has already paid for this lesson once:
the MF6 letter-gap taught that regex-stripping a hand-authored document silently drops content, and the
response was `cli/lib/derive.js:84-112`, which replaced the regex with a positional parse that names and
refuses. `unitCmd` is the same problem one file over, unlearned.

## Appetite

**1 session.** Six defects, one primary file (`cli/lib/slices.js`), plus a one-line guard message in
`cli/bin/house.js` and one dispatch-wording fix. The research measured the blast radius as zero: **all nine
shipped unit reports behave identically** under the current, anchored, and last-match regimes, so the
stronger fix costs nothing in regression risk.

If it does not fit, the cut line is R-6 and R-7 — the two surface defects — never the three writer bugs.

## Solution

**One locator, two callers.** Introduce a `findSection(text, heading)` **locator** — it returns positions, it
does not perform the replacement. Both writers then slice against those positions themselves. This is the
root-cause fix: R-1, R-2 and R-3 are three symptoms of using `.replace` as a document-editing primitive, and
a locator has no replacement-pattern semantics to be injected through.

Three deliberate corrections to what the roadmap prescribed, each backed by a reproduction in the digest:

1. **Last-match, not `/^## Result[\s\S]*$/m`.** Anchoring fixes the mid-sentence case but still destroys the
   body on a line-start quotation in prose, and still destroys it on a heading inside a fence. Only taking
   the **last** match is robust — and only last-match actually retires the rule the roadmap says it wants
   retired.
2. **~~`heartbeat` anchors on `## Heartbeats`, not on `## Result`.~~ WITHDRAWN at plan-check (2026-07-30).**
   This override was wrong, and the research digest's original instinct — *the same anchoring discipline* —
   was closer to right. Both writers share **one** occurrence rule: the **last exact whole-line match** on
   `## Result`. `finalize` replaces from it; `heartbeat` inserts before it. That single rule is robust for
   both, for one reason: notes only ever land *above* the structural heading, so the last exact match is
   always the structural one. Anchoring `heartbeat` on its own heading instead forces an end-scan that any
   note body can truncate — see R-2's revision note.
3. **R-7 gets an ordering hoist, not a `report` alias.** An alias would be a second name for the
   `unit.report` writer, which is the opposite of one-writer-per-field. Validate the action before the unit
   lookup so the error names the real mistake.

**Red tests first, without exception.** Both real bugs are invisible to the current 77-test suite: the single
`unit:` test (`cli/test/slices.test.js:246-269`) asserts the heartbeat note appears *anywhere* in the file
and never asserts that pre-Result content survives finalize. It passes while R-1's bug destroys and R-2's
misplaces. A fix with no failing test in front of it is exactly the unevidenced claim this slice exists to
eliminate.

**Sequencing note for the roadmap:** this slice should land **before** `[0009]`, because the `adrs:` writer
is what lets `[0009]` register ADR-0005 on its own manifest through a writer instead of by hand.

## Rabbit Holes

- **Generalizing `findSection` into a markdown sectioning library.** It needs to find one heading in one
  known-shape generated document. Two callers, one file, no export beyond what the tests need.
- **Fixing the three-spelling family by renaming flags.** Unifying `--note` / `--notes` / `--payload` is a
  breaking change to every skill file and to doctrine. The in-scope fix is the *guard message*, which makes a
  wrong spelling self-correcting without changing any accepted flag.
- **Adding a manifest key allowlist to `house validate`.** Tempting while fixing R-5, since an allowlist is
  what would have caught `[0001]`'s hand-edit. It is a different defect class — an absent check rather than a
  lying writer — and it belongs in the backlog.
- **Rewriting the unit-report format to use machine markers** the way `renderDevState` does. Structurally
  immune and genuinely better, but it is a format migration for nine existing reports and it is not a
  1-session change.

## No-Gos

- **`base_sha` reachability is not this slice.** It is `[0009]`, with ADR-0005 as its design authority. Do not
  add a reachability check, do not touch `prCmd`, and do not modify `docs/adr/0005-*`.
- **Do not hand-edit any `slice.yaml`.** That is the breach being fixed. `[0001]`'s existing value is
  re-recorded *through the new writer* — never edited in place.
- **Do not change the unit-report template's headings** (`## Heartbeats`, `## Result`). Nine shipped reports
  depend on them, and the locator is what adapts to the document, not the reverse.
- **Do not add a `report` alias** to `unitCmd`, and do not add any second name for an existing writer.
- **Do not edit `.house/events.jsonl`.** It is append-only; a payload written in error is superseded by a
  later record, never rewritten. The 01:17:04Z misattribution stays as written.
- **No new npm dependency and no markdown parser.** One runtime dependency (`js-yaml`) is the whole tree.
- **Do not change any accepted flag name, exit code, or event type.**
- **Do not fix a defect before its failing test exists.** A test written after the fix proves the test
  passes, not that the bug is gone.

## Requirements

### R-1: `finalize` preserves everything above the Result heading

The report body above the real `## Result` heading survives finalize **unconditionally** — regardless of what
the prose above it contains. This retires the undocumented rule that a unit report must not contain the
result heading's literal text anywhere in its body.

#### Scenario: prose spelling the heading inline is preserved

Given a report whose Heartbeats section contains a sentence quoting the result heading's text mid-line, when
the unit is finalized, then that sentence and every line above it are still present, and the Result section
is filled at the real heading.

#### Scenario: a line-start quotation of the heading is preserved

Given a report body containing a line that begins with the heading's text as quoted prose, when the unit is
finalized, then that line survives — this is the case an `/^…$/m` anchor would still destroy.

#### Scenario: a heading inside a fenced block is preserved

Given a report body with the heading's text on its own line inside a fenced code block, when the unit is
finalized, then the fenced block is intact and only the real trailing section is replaced.

#### Scenario: the nine shipped reports are unchanged

Given each existing `docs/slices/*/units/*-report.md`, when finalize's section position is computed under the
new implementation, then it is identical to the position the current implementation finds.

### R-2: `heartbeat` appends to the end of the Heartbeats section

A heartbeat is appended at the end of the Heartbeats section, and **its placement is unaffected by anything a
previous note contains.**

> **Revised 2026-07-30, after plan-check (user-approved).** As first approved, this requirement also said the
> placement "does not depend on any other section's heading existing or being unique." That clause forced the
> writer to find the section's end by scanning for the next line beginning `## ` — which any note body can
> contain, truncating the scan so the *next* heartbeat lands inside the previous note. It was an
> implementation prescription dressed as a requirement, and it mandated the very bug this requirement exists
> to fix. The requirement now states the outcome; the mechanism is the plan's business. See
> `deviation.raised` in the event log.

#### Scenario: a heartbeat lands at the end of Heartbeats

Given a report with both sections present, when a heartbeat is recorded, then the note appears as the last
entry of the Heartbeats section, after any earlier beats, and no other content moves.

#### Scenario: a previous note containing a heading-shaped line does not displace a later beat

Given a report whose Heartbeats section already contains a note whose body has a line beginning with `## `,
when a further heartbeat is recorded, then it is appended after that note rather than inside it — the case
that misplaces silently at exit 0 both today and under an end-scanning implementation.

#### Scenario: beats stay in chronological order

Given three heartbeats recorded in sequence, the second of which contains a heading-shaped line, when the
report is read, then the three notes appear in the order they were recorded.

### R-3: note text is data, never a replacement pattern

Text supplied by a user or an agent is inserted verbatim. No character sequence in a note changes where or
what is written.

#### Scenario: a note containing an ampersand replacement pattern is written literally

Given a heartbeat note containing `$&`, when it is recorded, then the file contains `$&` exactly, not the
matched text.

#### Scenario: a finalize note containing a group reference is written literally

Given a finalize note containing `` $` `` or `$1`, when the unit is finalized, then those characters appear
as themselves in the Result section.

### R-4: one locator, two callers

`finalize` and `heartbeat` locate their target section through a single shared function that returns
positions and performs no replacement.

#### Scenario: the locator is the only section-finding code in the writers

Given `cli/lib/slices.js`, when the two writers are read, then neither contains a section-finding regex or
string search of its own, and neither calls `.replace` with a caller-supplied string in the replacement
position.

#### Scenario: a missing heading is named, not silently ignored

Given a report file with no `## Result` heading, when the unit is finalized, then the command fails with an
error naming the heading it could not find — following `derive.js`'s precedent of refusing rather than
guessing.

### R-5: `adrs:` has a writer, and the existing hand-written value stops being a breach

The slice-to-ADR edge is recordable through a `house` command, so `adrs:` has exactly one writer like every
other field in the manifest.

#### Scenario: an ADR is attached to a slice through a writer

Given a slice and an existing ADR id, when the ADR is attached via the new writer, then `slice.yaml`'s
`adrs:` list contains it and an event records the write.

#### Scenario: the writer refuses an ADR that does not exist

Given an ADR id with no corresponding file under `docs/adr/`, when attachment is attempted, then the command
exits non-zero and writes nothing — a manifest citing a missing ADR is the same class of plausible-wrong
record this slice is about.

#### Scenario: `[0001]`'s hand-written value is regularized

Given `docs/slices/0001-house-v2-s2-skills-rewrite/slice.yaml` already lists
`0004-house2-coexistence-and-advisory-hooks` with no event behind it, when it is re-recorded through the new
writer, then the value is unchanged in content and now has a recording event behind it — closed by the same
change that made closing it possible, and never by a hand-edit.

### R-6: a rejected flag names the accepted ones

The per-command unknown-flag guard tells the caller which flags the command does accept.

#### Scenario: a wrong spelling is self-correcting

Given `house event work.discovered --note "…"`, when it is run, then it still exits non-zero and the message
names `--payload` among the accepted flags, so the caller does not have to read the source to find the right
spelling.

### R-7: `unit` reports the real error

An invalid action is reported as an invalid action, not as a missing record.

#### Scenario: a phantom verb names itself

Given `house unit <slice> report <unit>`, when it is run, then the error names `report` as the unrecognized
action and lists the accepted ones — rather than the current `no such unit: undefined`, which blames the
wrong argument.
