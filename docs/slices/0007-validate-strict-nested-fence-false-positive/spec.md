---
id: "0007-validate-strict-nested-fence-false-positive"
kind: spec
slice: "0007-validate-strict-nested-fence-false-positive"
title: "validate --strict nested-fence false positive"
status: "shaped 2026-07-29; user-approved 2026-07-30; shipped 2026-07-30"
state: approved
---
# Spec — validate --strict nested-fence false positive

> Research digest: [`research/fence-stripper.md`](research/fence-stripper.md). Parent requirement:
> **R-1** of [`0003`](../0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md). Backlog origin:
> [`roadmap.md`](../../roadmap.md) → "Backlog — discovered in the `[0003]` build".
>
> **Note on this document's own wording:** it deliberately never writes a well-formed clarification
> marker (the bracketed `NEEDS CLARIFICATION` form). Doing so would block its own handoff under
> `--strict` — the very check this slice repairs. Bare `NEEDS CLARIFICATION` is used throughout.

## Problem

`house validate --strict` scans handoff artifacts (`spec.md`, `plan.md`) for unresolved
`NEEDS CLARIFICATION` markers and blocks the shaper's hand-off when it finds one. Before matching, it
strips fenced code blocks and inline code spans, because a marker that is *quoted* is not a marker that is
*declared*. That stripping is done by a byte-oriented regex pair — `cli/lib/validate.js:52` — and it is
wrong.

A markdown fence is a **line-level** construct: it must begin a line at no more than three spaces of
indent and contain nothing but the fence run and an info string. The regex is **byte-level** and knows
none of that, so it pairs any run of three backticks with the next one anywhere in the file, including a
run that appears mid-line inside a string literal.

**Live symptom.** `house validate --strict` exits 1 with exactly one error, on
`docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md`. It is the only `--strict` red in the
repo; plain `house validate` is exit 0. Line 48 of that plan opens a real fence, line 84 closes it, and
line 58 — inside the fenced body, inside a JavaScript string literal — contains two three-backtick runs.
The stripper pairs line 48 with the *first* run on line 58, resumes mid-line, and re-exposes the string
body between the two runs: a literal test fixture that reads as a marker but is not one. The tool is red
on the plan that specified the tool.

**The dangerous variant, which is why this is worth fixing rather than dodging.** Line 58 happens to carry
an **even** number of fence runs, so parity for the rest of the file is restored by accident and every
later fence still pairs correctly. A line carrying an **odd** number of runs would invert every fence
after it — turning stripped regions into scanned ones and, worse, scanned regions into stripped ones. In
that direction the failure is a **false negative**: a genuine unresolved question in a spec sails through
`--strict` and into a build with no signal that anything was skipped. `--strict` exists precisely to stop
that, and 28 of this repo's 75 markdown files already contain nested fences.

**Why it has to be the tool and not the document.** Rewriting `0003/plan.md` to use a four-backtick outer
fence would clear the red today in zero lines. It leaves the trap armed for the next plan that quotes
markup, and retro-editing a shipped slice's records to make a validator green is the records-hygiene move
this house exists to refuse.

## Appetite

**0.5 session, patch tier.** The change is roughly fifteen lines at a single site. The research pass was
larger than the fix, and that is proportionate for one reason only: this check *is* the shaper's hand-off
gate (`house validate --strict --slice <id>`), so a silent false negative here contaminates every slice
downstream. If the work grows past one unit, the growth is the signal — stop and re-shape rather than
absorb it.

## Solution

Replace the byte-oriented regex pair at `cli/lib/validate.js:47-56` with a **line-oriented fence tracker**
operating at the level the construct actually lives at.

Walking the document line by line: a fence **opens** on a line indented no more than three spaces whose
content is a run of three or more backticks or tildes followed only by an info string — and, per
CommonMark, a backtick-fence's info string may not itself contain a backtick. While a fence is open, it
**closes** only on a line whose content is a run of the *same character*, of length *greater than or equal
to* the opening run, with nothing following it. Lines inside a fence are blanked. Nothing else opens or
closes a fence, which is exactly why `0003/plan.md:58` — a run appearing mid-line inside a string literal
— stops being a fence at all.

Three rulings are fixed here rather than left to the builder:

**Ordering becomes fences → HTML comments → code spans.** Today comments are stripped first
(`validate.js:51`), so an unbalanced `<!--` quoted inside a fence would swallow forward across fence
boundaries — the same defect one layer up. Every such occurrence in the repo is balanced today, so this is
latent, not live. The reorder removes the class at no cost: the research pass measured both orderings and
they classify identically across every handoff artifact in the repo.

**An unclosed fence never hides anything.** CommonMark says a fence that is never closed runs to end of
document. This spec deliberately departs from that: an unclosed fence does not open a hidden region, and
the remaining text stays scannable. The reason is asymmetry of consequence, and it is recorded here so a
future reader does not file the deviation as a bug. A false positive from this tool is loud, visible, and
costs someone a minute. A false negative is silent and ships an unanswered question into a build. Where
the two trade off, this check leans to the loud failure every time. This is the **only** respect in which
a CommonMark-faithful fix would have been more permissive than the bug it replaces.

**Tilde fences are handled.** They come free under the line rule, and they are a live false-positive
source today rather than a speculative one: the existing regex knows only backticks, so a marker quoted
inside a `~~~` block is not stripped at all and trips `--strict` right now.

Everything else is deliberately untouched: the marker regex, the set of scanned artifacts, `--slice`
semantics, exit codes, and the finding's message text.

## Rabbit Holes

- **Reaching for a markdown parser.** `markdown-it` or `remark` would be correct by construction and would
  take the CLI from one runtime dependency to a tree of them, for a fifteen-line problem, in a tool whose
  verification bar is ADR-0003's "runnable from a bare terminal in under a second". If a real parser ever
  becomes right, it is an ADR, not a bugfix.
- **Writing a general markdown-correctness pass.** Four-space indented code blocks, link reference
  definitions, setext headings and nested-list indentation are all unmodeled today and stay unmodeled.
  The bug is fences; the fix is fences.
- **A character-level scanner.** Strictly more state than the line tracker for zero additional
  classification change in this repo — measured. Fences are line-level; a character scanner is the wrong
  shape for the defect.
- **Adding line and column numbers to the finding.** Genuinely useful, genuinely tempting while in this
  code, and a separate item.
- **Making the repo green as the goal.** See R-3. The instinct to chase exit 0 is what produces the
  document-editing non-fix.

## No-Gos

- **No new npm dependency, and no markdown parser.**
- **No edit to `docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md`.** It must pass
  *unmodified*. That is the acceptance evidence, and changing it destroys the evidence.
- No change to the marker regex, to which artifacts are scanned (`spec.md` and `plan.md` only), to
  `--slice` semantics, to exit codes, or to the finding's message text.
- No line or column numbers in the finding.
- No extraction of the stripper into a shared module and no second caller. `derive.js` and `hooks.js` stay
  as they are; extract when a second caller actually exists, not before.
- No changes to any `skills/*/SKILL.md`. The hand-off bar wording at `skills/house-shaper/SKILL.md:83` is
  already correct and unaffected.
- No modeling of markdown constructs beyond fenced blocks and the existing inline code spans.

## Requirements

### R-1: fences are tracked line by line, not matched byte by byte

The `--strict` marker check strips fenced code blocks using line-oriented fence-state tracking. A fence
opens on a line with at most three leading spaces whose remaining content is a run of three or more
backticks or tildes followed only by an info string, where a backtick-fence's info string contains no
backtick. An open fence closes only on a line whose content is a run of the same character, of length at
least the opening run, followed by nothing. Lines within an open fence are excluded from marker matching.
No other construct opens or closes a fence. This is the parent requirement **R-1** of `[0003]` — which
required "stripping fenced code blocks" without prescribing how — implemented faithfully for the first
time; it amends nothing.

#### Scenario: a fence run inside a string literal is not a fence

- **Given** a `plan.md` containing a real opening fence; a body line at four spaces of indent holding two
  three-backtick runs inside a quoted string with the text of a well-formed marker *between* those two
  runs; and a later real closing fence — reproducing the shape of `0003/plan.md` lines 48, 58 and 84
- **When** I run `house validate --strict`
- **Then** the exit code is 0 and no finding names that file — the marker is inside the fence and stays
  stripped, where today the byte-oriented pairing re-exposes it

#### Scenario: an odd run count on one line does not invert later fences

- **Given** a `spec.md` whose fenced body contains a line with exactly one mid-line three-backtick run,
  followed after the fence closes by a second, separate fenced block that quotes a marker
- **When** I run `house validate --strict`
- **Then** the exit code is 0 — the second block is still recognised as fenced, and the quoted marker
  inside it is still stripped

#### Scenario: tilde fences are stripped

- **Given** a `spec.md` in which the only marker occurrence sits inside a `~~~` fenced block
- **When** I run `house validate --strict`
- **Then** the exit code is 0

### R-2: stripping order is fences, then HTML comments, then code spans

Fence tracking runs before HTML-comment stripping, which runs before inline-code-span stripping. An HTML
comment opener quoted inside a fenced block is removed with its fence, so it cannot pair with a later
comment close and consume the text between them.

Note the precise mechanism, because it is easy to state this bug wrongly: the comment regex is non-greedy
and requires a closing `-->`. A quoted opener with no close anywhere in the document strips nothing and is
harmless. The defect needs a *later, unrelated* `-->` to pair with — and this repo's slice docs carry
HTML comments routinely, including the marker hint in the spec template, so that pairing partner is
ordinarily present.

#### Scenario: a quoted comment opener does not pair with a later comment close

- **Given** a `spec.md` whose fenced block contains a `<!--` with no matching close inside the fence;
  after the fence, prose containing a genuine, well-formed marker; and after that, an ordinary complete
  HTML comment — so a `-->` exists later in the document for the quoted opener to pair with
- **When** I run `house validate --strict`
- **Then** the exit code is 1 and the finding names that file — the marker between them is still seen,
  where today the quoted opener pairs across it and swallows it

### R-3: correctness is the bar; a green repo is a consequence, not the goal

The acceptance bar for this slice is the unit-test suite, not the repo-wide exit code of
`house validate --strict`. The existing red on `0003/plan.md` is expected to clear as a consequence of the
fix, with that file **unmodified**. If the corrected stripper instead exposes a genuine unresolved marker
in any handoff artifact, that marker is a separate finding: it is recorded as a `work.discovered` event
and routed to the roadmap backlog per doctrine §6, and `--strict` is permitted to remain red on that file
when this slice ships. Resolving such a marker is out of scope, because it may require a decision this
slice's author has no standing to make.

#### Scenario: the previously-red plan passes untouched

- **Given** the repository with `docs/slices/0003-…/plan.md` byte-identical to its state at the `[0006]`
  ship
- **When** I run `house validate --strict`
- **Then** no finding names that file, and `git diff --stat` shows no change to it

#### Scenario: a newly exposed genuine marker is routed, not absorbed

- **Given** the corrected stripper exposes a well-formed marker in some other handoff artifact
- **When** the build unit reaches that finding
- **Then** it is recorded as `work.discovered` and routed to the roadmap backlog, the marker itself is
  left unresolved, and the slice is not expanded to fix it

### R-4: detection is not weakened

The change must not reduce the check's ability to find genuine markers. The existing `[0003]` R-1 test at
`cli/test/validate.test.js:173-200` continues to pass verbatim, and new coverage proves markers are still
caught in the positions a stripper could wrongly swallow.

#### Scenario: a genuine marker after a closed fence is still caught

- **Given** a `spec.md` containing a closed fenced block that quotes a marker, followed by prose
  containing a genuine, well-formed marker
- **When** I run `house validate --strict`
- **Then** the exit code is 1 and exactly one finding names that file

#### Scenario: a genuine marker between two fenced blocks is still caught

- **Given** a `plan.md` with a closed fenced block, then prose containing a genuine marker, then a second
  closed fenced block
- **When** I run `house validate --strict`
- **Then** the exit code is 1 and the finding names that file

#### Scenario: an unclosed fence does not hide what follows it

- **Given** a `spec.md` containing an opening fence that is never closed, followed by prose containing a
  genuine, well-formed marker
- **When** I run `house validate --strict`
- **Then** the exit code is 1 and the finding names that file

### R-5: the blast-radius claim is re-verified at the merge gate, not inherited

The research digest measured, against a prototype, that a corrected stripper changes marker classification
on exactly one file — `0003/plan.md`, red to green — with no file going green to red across all tracked
markdown. That measurement is the load-bearing assumption behind R-3's expectation that nothing new
surfaces. It was taken against a prototype, not the shipped implementation, so the merge-gate reviewer
re-runs the comparison against the actual implementation and records the result. The digest is evidence,
not authority.

#### Scenario: the reviewer re-measures rather than citing the digest

- **Given** the implemented stripper on the slice branch
- **When** the merge-gate reviewer evaluates the change
- **Then** the review record states the reviewer's own count of files whose classification changed, and
  names any file that went green to red
