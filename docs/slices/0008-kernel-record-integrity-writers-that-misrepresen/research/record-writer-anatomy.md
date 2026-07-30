# Record-writer anatomy — ground truth for the six `[0008]` defects

Research digest. Read-only investigation of `cli/lib/slices.js`, `cli/bin/house.js`,
`cli/schema/*.yaml` and `cli/test/*`. Nothing in the kernel was changed; this file is the only
artifact written. Line numbers are against `main` at `678bb98` (working tree clean except
`.house/events.jsonl`). Suite verified at **77 pass / 0 fail** (`cd cli && npm test`).

Every claim below was reproduced against the real code or the real files. Where the briefing's
summary was incomplete or slightly wrong, that is called out explicitly.

---

## Findings

### §0 — The surface map (what actually writes and reads each field)

`cli/lib/slices.js` is the whole DECLARED-layer writer. Eleven exported functions, each the sole
writer of its fields. `cli/bin/house.js` is a thin arg parser + dispatch table + per-command
flag guard. `cli/lib/derive.js` is the only reader of the manifest for projection purposes;
`cli/lib/validate.js` is the only reader for lint purposes.

| `slice.yaml` field | written by | read by (kernel) |
|---|---|---|
| `state` | `setState` (`:268`) | `derive.buildIndex:20`, `validate:58`, `validate:132` |
| `blocked_on` | `block` (`:124`), `unblock` (`:154`), `recordGate` auto-clear (`:110`) | `buildIndex:21`, `validate:96-100` |
| `artifacts{}` | `artifactCmd` (`:142`) | `validate:60-74` |
| `units[]` | `unitCmd` dispatch (`:219`) / finalize (`:242`) | `buildIndex:21`, `hooks.js:67` |
| `pr` | `prCmd` (`:204`) | `buildIndex:21`, `derive:72`, `setState:274` |
| `base_sha` | `prCmd` (`:205`) | **nothing in the kernel** — prose only |
| `kickoff` | nothing (mint literal only, `:76`) | `validate:123-131` |
| `adrs` | **nothing** (mint literal only, `:76`) | **nothing** |

Two dead-ish fields, and they are dead in **different** ways — that distinction drives §4:

* `base_sha` has a writer and **no kernel reader**. It is consumed by human/agent prose:
  `skills/house-orchestrator/SKILL.md:58-59` and `references/doctrine.md:89` both define the
  reviewed diff as `git diff $(base_sha)...HEAD`. So it is load-bearing, just not
  machine-checked. That is exactly the hole ADR-0005 describes.
* `adrs` has **neither** a writer nor a kernel reader. See §4.

Note also: `validate.js` has an allowlist for **task** keys (`TASK_KEYS`, `:108`) and for
**kickoff** keys (`:127`), but **no allowlist for manifest keys**. So an unknown/stale key in
`slice.yaml` is silently accepted. This matters for (f).

---

### §1 — Per-defect ground truth

#### (a) `finalize` truncates at an unanchored heading match — **CONFIRMED, verbatim as briefed**

`cli/lib/slices.js:238-248`, the offending statement at **`:243-245`**:

```js
    const cur = readFileSync(reportPath, 'utf8');
    writeFileSync(reportPath, cur.replace(/## Result[\s\S]*$/,
      `## Result\n\n**${args.result}** — ${args.note ?? ''}\n- finalized: ${now()}\n`));
```

`String.prototype.replace` with a non-global regex replaces the **first** match. The regex is
unanchored, so the first occurrence of the literal byte sequence `## Result` *anywhere* — inside a
sentence, a table cell, a code span, a fence — becomes the cut point, and `[\s\S]*$` deletes
everything from there to EOF.

**Caller:** `cli/bin/house.js:56` → `slices.unitCmd(root, pos[0], pos[1], pos[2], args)`, i.e.
`house unit <slice> finalize <unit> --result <R> [--note "<s>"]`. Documented at
`cli/README.md:75` and invoked by the builder skill at `skills/house-builder/SKILL.md:73`.

**Behaves (skeleton or well-behaved body):** the pending block under the real heading is replaced;
everything above it survives.

**Misfires (reproduced):** body containing the heading text mid-sentence —

```
## Evidence

finalize rewrites from the ## Result heading down, which is a trap.

More hard-won evidence here.

## Result

(pending — absence of a finalized result is fail-closed unknown, never DONE)
```

becomes

```
## Evidence

finalize rewrites from the ## Result

**DONE** — all green
- finalized: TS
```

Exit **0**. The `unit.report` event fires. The manifest says `result: DONE`. The section the
result was supposed to occupy is gone, along with the evidence below the trigger phrase. This is
the exact failure that ate part of `docs/slices/0007-.../units/01-report.md`; the surviving file
is the hand-repaired version (its git history shows a single commit, `85731f3`, so the destroyed
intermediate is not recoverable from the repo) and it documents its own destruction at lines
104-109, deliberately spelling the regex as `/## Res…[\s\S]*$/` so it cannot re-trigger.

**Correction to the roadmap's proposed fix.** `docs/roadmap.md:324` prescribes
`/^## Result[\s\S]*$/m`. That is a genuine improvement but **not sufficient** — verified:

| body shape | current | `/^## Result[\s\S]*$/m` | last-match |
|---|---|---|---|
| heading text mid-sentence | destroys | **correct** | correct |
| heading text on its own line in prose (`The section is named:\n## Result\nand …`) | destroys | **still destroys** | correct |
| heading inside a fenced block | destroys | **still destroys** | correct |

Anchoring fixes the case that actually happened and the most likely recurrence, and leaves two
narrower ones live. Retiring the rule *"a unit report must never contain the result heading's
literal text anywhere in its body"* (the roadmap's stated goal at `:335`) requires last-match or a
non-textual boundary, not `^…$/m`.

#### (b) `heartbeat` does a first-occurrence plain-string replace — **CONFIRMED, and the briefing understates the fix**

`cli/lib/slices.js:232-237`, the offending statement at **`:235`**:

```js
    writeFileSync(reportPath, cur.replace('\n## Result', `- ${now()} — ${args.note}\n\n## Result`));
```

A string first argument to `.replace` is a literal, first-occurrence substitution. **Caller:** same
dispatch line, `bin/house.js:56`; `house unit <slice> heartbeat <unit> --note "<s>"`
(`cli/README.md:74`, `skills/house-builder/SKILL.md:37`).

**Behaves:** in the freshly-dispatched skeleton (`:221-223`) the first `\n## Result` *is* the real
heading, so the line lands at the bottom of the Heartbeats section — correct by coincidence of
document order, not by construction.

**Misfires (reproduced):** if the builder has already written narrative containing a line
`## Result` above the real heading, the heartbeat is inserted **into that prose** —

```
## Evidence

Beware:- TS — second hb

## Result
is matched by the plain-string replace.
```

Exit **0**, nothing deleted, no event anomaly — the `unit.heartbeat` event is emitted correctly
and points at a report where the heartbeat is not in the Heartbeats section. Quieter than (a)
and correspondingly harder to notice, as briefed.

**Where the briefing understates it:** the roadmap says "same anchoring discipline" (`:325`).
Anchoring the *Result* heading in the heartbeat writer is the wrong target. The heartbeat's
semantic intent is *append a line to the end of the Heartbeats section*; it currently expresses
that as *insert before the Result heading*, which couples one section's writer to a different
section's heading. Anchoring makes the current expression less wrong; it does not make it right.
A body with narrative between Heartbeats and Result still gets heartbeats appended below that
narrative. The honest fix anchors on `^## Heartbeats$` and inserts at the end of that section —
a **different** operation from (a)'s.

#### (c) `house event` takes `--payload`, not `--note` — **CONFIRMED, and the root cause is broader**

Two independent mechanisms, both real:

1. **The flag guard.** `cli/bin/house.js:29` declares `event: ['slice', 'payload', 'actor']`. The
   guard at `:39-42` prints `house event: unknown flag --note` and `process.exit(1)`. No `notes`
   either.
2. **The parse.** `cli/lib/slices.js:166` —
   `const payload = typeof args.payload === 'string' ? JSON.parse(args.payload) : (args.payload ?? {});`
   So even the *right* flag with a bare sentence throws a `SyntaxError`, caught at
   `bin/house.js:80` → exit 1. `docs/slices/0007-.../plan.md:340-342` records exactly this
   second-order trap being hit and corrected in place.

**The root cause is that the kernel has three spellings for free text**, and which one applies
depends on the command:

| flag | commands (`bin/house.js:26-38`) |
|---|---|
| `--note` | `task`, `state`, `block`, `unblock`, `artifact`, `unit` |
| `--notes` | `gate` |
| `--payload` (JSON) | `event`, and `gate` additionally |

`--note` is the majority spelling and the one a builder has just typed (`house unit … heartbeat
--note`). `house event` is the one command in the family that rejects it. The trap is not that
`event` is documented wrong — the SKILL files are all correct (`house-orchestrator/SKILL.md:27,73`
and `house-shaper/SKILL.md:73` all say `--payload`) — it is that the surface is inconsistent and
the guard is unforgiving. The wrong spelling in the wild came from `[0007]`'s own plan, not from a
skill.

Note the guard is *correct* behavior per spec R-5 (`bin/house.js:24-25`: "a silently-swallowed
flag is the failure class this kernel exists to refuse"). (c) is not a bug in the guard. It is
either a docs fix, or an ergonomics fix (accept `--note` on `event` as a free-text shorthand that
becomes `{note: "…"}`), or a better error message. It is the only one of the six where "change
nothing in the kernel" is a defensible answer.

#### (d) `house unit <slice> report <unit>` does not exist — **CONFIRMED, with an extra wrinkle**

`unitCmd` (`cli/lib/slices.js:211`) handles exactly three actions: `dispatch` (`:216`),
`heartbeat` (`:232`), `finalize` (`:238`), and throws at **`:249`**:

```js
  } else throw new Error(`unknown unit action: ${action}`);
```

`finalize` (`:247`) is what emits `unit.report`. Confirmed there is no `report` verb anywhere in
`cli/`, and the phantom verb appears in **no** committed file — not in `skills/house-builder/SKILL.md`,
not in `cli/README.md`, not in any kickoff brief. It exists only in the orchestrator's improvised
dispatch prompt (a transcript), which `docs/roadmap.md:346-352` records as a correction to the
original `work.discovered` payload's mis-attribution. So (d) has **no code location to fix** in
the sense the roadmap table implies; `:211` is where the absence lives, not a defect.

**The extra wrinkle (not in the briefing).** The action is validated *after* the unit lookup —
`:229-231` runs `man.units.find(...)` and throws `no such unit: <id>` before `:232` ever inspects
the action. Consequences:

* `house unit 0007-x report 01` → `house unit: unknown unit action: report`, exit 1. Honest.
* `house unit 0007-x report` (verb typo'd, unit id omitted) → `unitId` is `undefined` →
  **`house unit: no such unit: undefined`**, exit 1. The error names the wrong thing entirely and
  sends the reader hunting for a missing unit record instead of a missing verb.

If (d) gets any code at all, hoisting the action check above the unit lookup is a two-line change
that makes the error honest — cheaper and more valuable than a `report` alias.

#### (e) `--base-sha` accepts an unreachable sha — **map only, per instructions**

Owned by the other research agent. What this digest establishes:

**Write path.** `prCmd` (`cli/lib/slices.js:198-209`):

```js
  const sha = args['base-sha'];
  if ((!args.set || args.set === true) && (!sha || sha === true))
    throw new Error('nothing to set: pass --set <pr-url> and/or --base-sha <sha>');
  if (args.set && args.set !== true) man.pr = args.set;
  if (sha && sha !== true) man.base_sha = sha;
```

The only validation is *"is it a non-empty string"*. No `git rev-parse`, no `git cat-file`, no
`merge-base --is-ancestor`. Any string is accepted verbatim, written to the manifest (`:206`) and
echoed into the `slice.pr_set` payload (`:207-208`). Flag registered at `bin/house.js:33`.

**Read path.** No kernel reader (see §0). Every consumer is prose:
`skills/house-orchestrator/SKILL.md:58-59` and `doctrine.md:89`. `validate.js` never looks at
`base_sha`; `derive.buildIndex` (`:20-23`) does not project it. So there is currently **no place
in the kernel where a bad `base_sha` could be caught after the fact** — the write site is the only
possible checkpoint.

**Test coverage — and the single most important sequencing fact in this digest.**
`cli/test/slices.test.js:271-291` pins the current permissive behavior:

```js
  assert.equal(run(dir, 'pr', '0001-shippy', '--set', 'https://github.com/x/y/pull/9',
    '--base-sha', 'abc123').code, 0);
  …
  assert.equal(man.base_sha, 'abc123');
```

`abc123` is not a valid object in any repository. **And `mkTmpRepo()` (`cli/test/helpers.js:8-16`)
does not run `git init`** — it only `mkdir`s `.house/` and `docs/`. There is no git repo, no
`origin`, no default branch. So any reachability guard added to `prCmd` will, in the existing
fixture, either throw on a failed `git` invocation or (if it fails open) not be exercised at all.
Fixing (e) therefore *requires* touching either this test or `helpers.js`. That is the only
test-coupled defect of the six.

#### (f) `adrs:` is unpopulatable — **CONFIRMED, with one significant fact the briefing missed**

`grep -n adrs cli/lib/slices.js` returns exactly one hit, `:76`:

```js
    branch: `slice/${id}`, base_sha: null, pr: null, adrs: [], artifacts: {}, units: [], kickoff: null };
```

The `--adr` early-return is confirmed. `mint()` (`:54-81`): `if (opts.adr) { … return file; }` at
`:58-66` — the `return file` at `:65` means control never reaches the slice-manifest literal at
`:74-76`. `--adr` mints a *document* in `docs/adr/` and emits `artifact.written`; it is not an
attach path in any sense.

No other subcommand writes it. Verified against every writer in `slices.js`: `recordGate`,
`block`, `artifactCmd`, `unblock`, `emit`, `taskCmd`, `prCmd`, `unitCmd`, `setState` — none touch
`man.adrs`. Confirmed genuinely unpopulatable **through the CLI**.

**The fact the briefing missed: it has already been populated by hand.**
`docs/slices/0001-house-v2-s2-skills-rewrite/slice.yaml:13-14` reads

```yaml
adrs:
  - 0004-house2-coexistence-and-advisory-hooks
```

Every other manifest (`0002`–`0007`) reads `adrs: []`. So the field is not merely dead — it is a
field with **no writer and one hand-written value**, which is precisely the one-writer-per-field
breach doctrine §1 exists to prevent, already committed to `main`. `validate` does not flag it
(no manifest key allowlist, §0). `[0007]`'s reconcile subagent *correctly refused* to repeat the
hand-edit (`.house/events.jsonl:270`, `docs/slices/0007-.../retro.md:130`,
`docs/adr/0005-...md:112-116`) — so the repo now contains both the honest refusal and the earlier
dishonest write, side by side. Analysis in §4.

#### (g) NOT IN THE BRIEFING — `$`-pattern injection in both writers

Both `.replace()` calls pass a **template-literal replacement string** built from user input.
`String.prototype.replace` interprets `$&`, `` $` ``, `$'`, `$1`, `$$` in the replacement
regardless of whether the pattern was a regex or a string. `args.note` and `args.result` land in
those templates unescaped (`:235`, `:244-245`).

Reproduced — `house unit … finalize 01 --result DONE --note '$& and $`'` on a clean skeleton
produces a report where the result line contains the *entire matched Result section* followed by
*the entire document above the match*, and the finalized timestamp ends up orphaned after a blank
line. `house unit … heartbeat 01 --note '$&'` inserts the literal matched `\n## Result` into the
heartbeat line, producing a duplicate heading.

Realistic trigger: a note quoting shell or regex syntax — e.g. `--note "sed 's/x/$&/'"` or
`--note "fixed the \$& case"`. Low probability, same failure *direction* as (a) and (b) (a record
that reads plausible and is wrong), and **the same root cause**: naive `.replace` used as a
document-editing primitive. Any fix that routes both writers through a helper doing explicit
`slice`/concatenation instead of `.replace` eliminates (g) for free. Any fix that only changes the
regex leaves (g) live in both writers.

---

### §2 — Do the fixes interact?

**They are adjacent but not the same operation.** (a) is *replace from an anchor to EOF*. (b) is
*insert at a section boundary*. A single "replace this section" helper covers both only if it is
built as **"locate the anchored heading, return its index"** plus two thin callers — a locator, not
a replacer. That framing is what makes one patch honest:

```
findSection(text, heading) -> { start, end } | null      // locator, last-match, fence-aware
```

* finalize = `text.slice(0, start) + newBlock`  (no `.replace`, so (g) dies)
* heartbeat = insert at `end` of the Heartbeats section  (no `.replace`, so (g) dies)

Written as a *replacer* instead, the two callers need different signatures and the shared helper
buys nothing.

**Anchoring is behavior-preserving on every shipped report.** Measured all nine reports under
`docs/slices/*/units/*.md`, comparing the first-match index of `/## Result[\s\S]*$/` against
`/^## Result[\s\S]*$/m`, and separately the first index of the literal `'\n## Result'`:

| report | unanchored first match | anchored first match | plain-string `\n## Result` |
|---|---|---|---|
| `0001/units/01-report.md` | line 9 | line 9 | line 9 |
| `0001/units/02-report.md` | line 11 | line 11 | line 11 |
| `0001/units/03-report.md` | line 8 | line 8 | line 8 |
| `0002/units/01-report.md` | line 8 | line 8 | line 8 |
| `0003/units/01-report.md` | line 10 | line 10 | line 10 |
| `0004/units/01-report.md` | line 12 | line 12 | line 12 |
| `0005/units/01-report.md` | line 10 | line 10 | line 10 |
| `0006/units/01-report.md` | line 17 | line 17 | line 17 |
| `0007/units/01-report.md` | line 111 | line 111 | line 111 |

**All nine identical, all three regimes.** Every report contains exactly one occurrence of the
heading text, and it is a real heading at line start. So:

* No legitimate existing body behaves differently under an anchored regex — **zero regression risk
  from anchoring**, and equally zero from moving to last-match.
* The `0007` report is the interesting case and it is safe *because it was hand-repaired* — it
  contains `Result` three times (a table header at `:26`, a table header at `:42`, and the real
  heading at `:111`) but the heading text only once, at line start.
* Corollary: the sweep proves the *fix* is safe; it does not prove the bug is rare. The one report
  written by a builder verbose enough to discuss the kernel is the one that was destroyed. The
  population of at-risk reports grows with report quality.

**No interaction with anything else.** (c) is `bin/house.js` + docs. (d) is `unitCmd`'s dispatch
ordering. (e) is `prCmd`. (f) is `mint`. None share a line with (a)/(b).

---

### §3 — Existing test coverage

Suite: **77 pass / 0 fail**, five files, 71 `test()` blocks. Distribution:
`cli.test.js` 4, `core.test.js` 9, `derive.test.js` 16, `hooks.test.js` 6, `slices.test.js` 24.

**Tests that touch this surface — 8 of the 71:**

| target | file:lines | what is pinned | what is NOT pinned |
|---|---|---|---|
| `unitCmd` (all three actions) | `slices.test.js:246-269` | dispatch allocates `01`; `units[0].state === 'building'`; skeleton contains `/never DONE/`; heartbeat exit 0; **the note text appears somewhere in the file**; finalize rejects `SHRUG` (exit 1); finalize `DONE` exit 0; manifest `state`/`result`; all three events present; `house event unit.report` refused | **nothing about position.** `assert.match(readFileSync(report), /task 2\/5 done/)` at `:258` matches anywhere in the document — **(b) passes this test while misfiring**. And **nothing asserts any pre-Result content survives finalize** — **(a) passes this test while destroying the body.** No unknown-action test. No `$`-pattern test. |
| `emit` | `slices.test.js:61-67` | JSON payload parsed and reaches the event; `slice.created` refused as CLI-owned | no `--note` behavior; no test that a non-JSON `--payload` exits 1 rather than crashing |
| `recordGate` | `slices.test.js:49-59` | record written; unknown gate; invalid verdict; event payload gate | — |
| `recordGate` R-3/R-4 | `slices.test.js:305-326` | `--actor` wins over `--by`; payload lands in yaml; event carries `record` ref + `detail` keys + `notes`; absent extras → no `detail` | — |
| `recordGate` auto-clear | `slices.test.js:198-216` | non-passing verdict does not clear `blocked_on`; passing verdict clears + emits | — |
| `recordGate`/`taskCmd` slice guard | `slices.test.js:175-182` | `--slice is required`; `no such slice` | — |
| `mint` | `slices.test.js:23-36`, `38-47`, `184-188` | ordinal allocation; slug; `state` by kind; `slice.created` events; `--adr` separate series + MADR frontmatter; non-alphanumeric title refused | **nothing asserts the manifest key set.** No test would notice `adrs` appearing or disappearing. |
| `prCmd` | `slices.test.js:271-291` | refuses with neither flag (exit 1); `--set` + `--base-sha abc123` → exit 0; both written; `slice.pr_set` + `slice.shipped` events | **that `abc123` is nonsense is pinned as acceptable.** This test blocks (e) — see §1(e). |
| flag guard | `cli.test.js:53-59` | one case only: `gate … --actro` → exit 1, message text; `validate --strict` still parses | **no per-command coverage.** Nothing pins `event`'s flag set, so nothing would notice `--note` being added to it. |

**Net:** the two real bugs, (a) and (b), are *both invisible to the existing suite*. The single
`unit:` test at `:246-269` is a happy-path walk that asserts presence, never position or survival.
That is the coverage gap the slice should close first, TDD-style: write the two red tests against
today's code, watch them fail, then fix.

---

### §4 — (f): writer, or delete?

**Is it read or unread?** Determined: **neither read nor written by any kernel code.** Verified
`adrs` absent from `validate.js`, `derive.js`, `hooks.js`, `core.js`, and from `bin/house.js`.
`derive.buildIndex` (`:20-23`) enumerates its projection explicitly and `adrs` is not in it, so it
never reaches `index.json`, `status`, `list`, `next` or `render dev-state`. There is no renderer,
validator or index reader.

This is the *cheaper* of the two problems the briefing distinguishes — a field that is read but
never written would be actively lying to a consumer. This one lies only to a human reading
`slice.yaml` directly, which is nonetheless a real consumer under doctrine §1's anti-lock-in clause
(*"`git clone` + a text editor stays sufficient"*). A human with a text editor is the design's
declared audience, and for them `adrs: []` on `[0007]` is a false statement — `[0007]` did cause
ADR-0005.

**What a writer would look like, respecting one-writer-per-field (§1) and CLI ownership (§6).**
`slice.yaml` is CLI-owned per §6's routing table, so the writer must be a `house` subcommand.
Shape, consistent with the surrounding code:

```js
// slices.js — new export, ~8 lines, mirrors artifactCmd's shape
export function adrCmd(root, id, adrId, args) {
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  if (!existsSync(join(root, 'docs/adr', `${adrId}.md`)))   // fail closed: no dangling refs
    throw new Error(`no such ADR: ${adrId}`);
  man.adrs = man.adrs ?? [];
  if (man.adrs.includes(adrId)) throw new Error(`ADR ${adrId} already attached to ${id}`);
  man.adrs.push(adrId);
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'artifact.written', { slice: id, actor: args.actor ?? 'shaper',
    payload: { kind: 'adr_link', adr: adrId } });
}
```

plus `adr: ['actor']` in `FLAGS` (`bin/house.js`), one dispatch line, one README row. Roughly
**15 lines across three files**, no new event type needed (`artifact.written` already exists in
`event_types`), no schema change. It also wants a `validate` rule — *every id in `adrs` names an
existing `docs/adr/` file*, mirroring the roadmap ref lint at `validate.js:147-153` — which is the
consumer that makes the field non-decorative. Call it ~25 lines with the lint and two tests.

**Is deleting cheaper and equally honest?** Deleting is cheaper (one token removed from `:76`) but
**not equally honest, and not actually clean**:

1. The backlink is genuinely wanted. ADR frontmatter already carries the forward direction —
   `cli/templates/adr.md:7` ships `slices: []` and `docs/adr/0005-....md:8` has
   `slices: ["0007-validate-strict-nested-fence-false-positive"]`. The design is explicitly
   bidirectional (`docs/superpowers/specs/2026-07-28-house-v2-design.md:70`: *"linked both
   directions via frontmatter"*). Deleting `adrs` makes the graph one-directional by decision
   rather than by accident — a narrower record, honestly labelled. Defensible, but it is a design
   retreat, not a cleanup.
2. **Deletion does not remove the data.** Because there is no manifest key allowlist (§0),
   dropping `adrs` from the mint literal leaves `adrs: []` in `0002`–`0007` and
   `adrs: [0004-house2-coexistence-and-advisory-hooks]` in `0001`, unread and unremovable by any
   CLI writer, forever. To actually delete the field you must also hand-edit eight CLI-owned
   manifests — the very breach that makes (f) a problem. Deletion is only clean if paired with a
   manifest key allowlist in `validate` that would then *flag* the eight files, which is more work
   than the writer.
3. Adding a writer **retroactively legitimises `0001`'s hand-edit** (its value becomes something
   the CLI could have written and can now re-derive), and lets `[0008]` attach ADR-0005 to
   `[0007]` on record. Deletion leaves the `0001` hand-edit as a permanent orphan.

**Recommendation for (f): add the writer.** It is ~15-25 lines, needs no schema or event change,
closes a doctrine §1 breach already committed to `main`, and gives the field the consumer that
makes it real. Deletion is the fallback if the slice's appetite is genuinely exhausted — and if
chosen, it must include the eight-manifest cleanup, so it is not the cheap option it looks like.

---

### §5 — Risk and sequencing

**Independence.** Six defects, four independent code sites and one non-site:

| # | site | independent? | risk |
|---|---|---|---|
| a | `slices.js:243-245` | coupled to **b** (same function, adjacent, shared helper candidate) | low — 9/9 shipped reports unaffected by the fix |
| b | `slices.js:235` | coupled to **a** | low, same |
| c | `bin/house.js:29` + docs | independent | **lowest** — may be docs-only |
| d | `slices.js:229-232` (ordering) | independent; textually inside `unitCmd`, so it merges with a/b | lowest |
| e | `slices.js:198-209` | independent in code, **test-coupled** | **highest** — the only merge-gate hole, and the only one that breaks a green test |
| f | `slices.js:76` + new export | independent | low, but touches `mint`, the most-tested function |

**Compile coupling:** none. Every change is local; no signature changes except (f)'s new export
and (b)'s possible new helper. **Test coupling:** exactly one — (e), via
`slices.test.js:276-279` (pins `--base-sha abc123` → exit 0) and `helpers.js:8-16`
(`mkTmpRepo` is not a git repo). Everything else is additive.

**An ordering that keeps the suite green at every boundary:**

1. **(a)+(b) together, TDD.** Write two red tests against `unitCmd` first — *finalize preserves a
   body containing the heading text*, and *heartbeat lands inside the Heartbeats section*. Both
   fail on today's code (proven in §3: the existing test cannot see either bug). Then the helper.
   Add a third for (g) if the helper drops `.replace`. Green at the boundary; the nine shipped
   reports are provably unaffected.
2. **(d), same file, same commit or the next one.** Hoist the action check above the unit lookup;
   add a test that `house unit <slice> report` reports an unknown *action*, not an unknown *unit*.
   Purely additive.
3. **(f).** New `adrCmd` + FLAGS entry + dispatch + `validate` lint + two tests. Additive; the
   existing `mint` tests do not assert the key set so they stay green either way.
4. **(c).** Docs, or a deliberate `--note` shorthand on `event`. If the shorthand is chosen, add
   the per-command flag-set test that `cli.test.js:53-59` currently lacks. Additive.
5. **(e) LAST, and in two commits.** First commit: make `mkTmpRepo` a real git repo (or add a
   `mkTmpGitRepo`) and rewrite `slices.test.js:271-291` to use a reachable sha — suite green,
   behavior unchanged. Second commit: add the reachability guard in `prCmd` plus its red-then-green
   test. Splitting this way is what keeps the boundary green; doing it in one commit means a
   window where a passing test is asserting behavior the same commit removes.

**Why (e) last:** it is the one with a real design decision inside it (refuse vs. warn; behavior
when there is no remote, no `origin`, a detached HEAD, or a shallow clone), the one that must fail
open in fixtures that have no git, and the one whose test rewrite is the largest diff. Landing it
after the cheap four means the slice has already delivered value if (e) turns out to need its own
shaping pass.

---

## Options

**Option 1 — six separate small fixes.** Follow the roadmap table literally: anchor `:244`,
anchor `:235`, fix the docs for (c), add a `report` alias for (d), guard `prCmd` for (e), give
`adrs` a writer for (f). Six commits, six tests.

*For:* each is minimal and independently reviewable; matches the roadmap's own framing; no new
abstraction to justify at patch tier. *Against:* it leaves (g) live in both writers, leaves (a)'s
line-start and fenced-heading cases live, encodes the same document-editing mistake twice, and
answers (b) with a fix that does not match (b)'s intent (§1b). Two writers that both misuse
`.replace` on markdown, patched independently, remain two writers that misuse `.replace`.

**Option 2 — one locator helper subsuming (a), (b) and (g); the rest separate.** Add a
`findSection(text, heading)` locator to `slices.js`, express finalize as `slice(0, start) +
newBlock` and heartbeat as an insert at the Heartbeats section's end. Neither writer calls
`.replace`. Then (c), (d), (e), (f) as their own small changes.

*For:* one root-cause change retires three defects and the unstated rule the roadmap wants gone
(`:335`); both writers become anchor-correct and injection-proof at once; the helper is ~10 lines
and has exactly two callers in the same file, so it is not premature extraction — it is the same
justification `stripFences` earned in `[0007]` (`validate.js:18-19`). *Against:* one new internal
function at patch tier; slightly more to review than two regex edits.

**Option 3 — replace the text protocol.** Stop keying off markdown headings; write the report with
explicit machine markers (`<!-- house:result -->` … `<!-- /house:result -->`), the way
`renderDevState` already does for dev-state (`derive.js:81-82, 88-112`).

*For:* structurally immune to every variant of (a), (b) and (g); consistent with the one place in
this kernel that already solved this exact problem, and that solved it *because* a regex-strip
silently dropped content (`derive.js:84-87`, the MF6 finding). *Against:* changes the report
skeleton (`:221-223`), so the nine existing reports predate the markers and finalize would need a
fallback for them — which reintroduces the heading path it was meant to remove. Too large for
patch tier; it is an ADR-shaped decision, not a fix.

---

## Recommendation

**Take Option 2, in the §5 order, and treat (d) as an error-ordering fix rather than a new verb.**

The argument for one root-cause change is not aesthetic. `renderDevState` is the precedent that
settles it: this repo has already learned, once, at merge-gate cost (the MF6 letter-gap), that
regex-stripping a hand-authored document silently drops content — and it responded by replacing
the regex with a positional parse that *names and refuses* what it does not expect
(`derive.js:84-112`). `unitCmd` is the same problem, one file over, still unlearned, twice. Fixing
it twice with two different regexes is how it stays unlearned a third time. A ten-line locator with
two callers in the same function is the same trade `stripFences` made in `[0007]` and it was right
there too.

Three concrete commitments a plan should carry:

1. **Last-match or fence-aware, not `/^…$/m`.** The roadmap's proposed anchor
   (`docs/roadmap.md:324`) fixes the case that happened and leaves two live (§1a table). Since the
   sweep proves **all nine shipped reports behave identically under every regime** (§2), the
   stronger fix is free — there is no compatibility argument for the weaker one. And only the
   stronger one retires the rule the roadmap says it wants retired.
2. **Anchor heartbeat on `## Heartbeats`, not on `## Result`.** (b)'s intent is "append to the
   Heartbeats section." Anchoring the Result heading in the heartbeat writer makes a wrong
   expression less wrong. This is the one place the briefing's framing should be overridden.
3. **Add (g) to scope explicitly.** It costs nothing under Option 2 — dropping `.replace` removes
   it — but it must be *named*, or a reviewer will reasonably ask why `args.note` is being
   concatenated rather than substituted, and the answer will not be in the plan.

On the individual defects: **(f) gets a writer, not a deletion** (§4 — deletion requires
hand-editing eight CLI-owned manifests, so it is not the cheap option, and `0001`'s existing
hand-edit is a live doctrine §1 breach the writer retires). **(d) gets the ordering hoist, not a
`report` alias** — the alias adds a second name for `finalize`, which is a second writer of the
`unit.report` event in everything but implementation, and this kernel's whole thesis is one writer
per record; the honest error message is strictly better and half the code. **(c) is the one
candidate for "change nothing"**: the guard is correct per R-5, every SKILL file already says
`--payload`, and the only wrong spelling in the repo was in `[0007]`'s plan and is already
corrected in place there. If the slice touches it at all, the higher-value change is not accepting
`--note` on `event` but making the guard's message name the accepted flags — `house event: unknown
flag --note (accepted: --slice, --payload, --actor)` — which fixes the whole family of three
spellings (§1c) rather than one instance of it, in one line at `bin/house.js:40`.

**Finally: write the two red tests first.** §3 establishes that the existing `unit:` test
(`slices.test.js:246-269`) passes while both (a) and (b) misfire, because it asserts presence and
never position or survival. Until those two tests exist and fail, there is no evidence any fix
fixes anything — and this slice's whole subject is writers that produce records which read
plausible and are wrong.
