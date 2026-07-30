---
id: "0008-kernel-record-integrity-writers-that-misrepresen"
kind: plan
slice: "0008-kernel-record-integrity-writers-that-misrepresen"
title: "kernel record integrity — writers that misrepresent their records"
status: "shaped 2026-07-30; plan_check GO_WITH_FIXES then GO after the R-2 spec revision; approved 2026-07-30"
state: approved
---
# kernel record integrity — writers that misrepresent their records — Implementation Plan

**Goal:** Replace `.replace`-as-document-editor in the two unit-report writers with a shared **locator**,
give `slice.yaml`'s `adrs:` field its missing writer, and make two error messages name the real mistake.

**Architecture:** One new exported helper, `findSection()`, in `cli/lib/slices.js`, consumed by both
`unitCmd` writers. One new command, `house adr <slice> attach <adr-id>`, plus one new event type in
`cli/schema/enums.yaml`. One-line changes to the flag guard in `cli/bin/house.js` and to `unitCmd`'s action
validation. No new dependency, no markdown parser, no change to the report template.

**Tech Stack:** Node ≥ 18 ESM, `node --test`, one runtime dependency (`js-yaml`) which this slice does not
touch. Tests use inline-string fixtures in throwaway temp repos via `cli/test/helpers.js` → `mkTmpRepo()`;
nothing in `cli/test/` reads from `docs/`.

---

## ⚠ One rule, two callers — read this before Task 1

The report skeleton `dispatch` writes is fixed:

```
# Unit NN — title

- slice: <id>
- dispatched: <ts>

## Heartbeats

## Result

(pending — absence of a finalized result is fail-closed unknown, never DONE)
```

Body text only ever enters **below** `## Heartbeats` (heartbeat notes) or **below** `## Result` (the finalize
note). One consequence carries the whole design: **the last exact whole-line `## Result` is always the
structural heading**, because everything a note can contain sits above it.

So both writers use the same locator with the same rule:

- **`finalize`** replaces from that position to the end of the section.
- **`heartbeat`** inserts immediately before that position — which *is* the end of the Heartbeats section.

`findSection()` therefore needs no occurrence parameter and no per-caller variation.

**Why not anchor `heartbeat` on its own `## Heartbeats` heading?** Because finding that section's *end*
requires scanning for the next line beginning `## `, and any note body can contain one — truncating the scan
so the next heartbeat lands *inside* the previous note. Content preserved, placement quietly wrong, exit 0:
the very bug R-2 exists to fix. This was tried, simulated, and rejected at plan-check; spec R-2 was revised
and re-approved accordingly. Do not reintroduce it.

**A named limit, deliberately not fixed here.** If a finalize `--note` itself contains a line that is exactly
`## Result`, a *second* `finalize` — or a heartbeat recorded after finalize, which the loop never does — would
locate that line instead of the heading. Single finalize is unaffected, and **Task 1 Step 1's third test**
pins that repeated finalize with an ordinary note is stable. Closing it needs a real parser, which is a
No-Go. This is the **only** residual hole; do not widen scope to chase it.

One hole that a reviewer might expect here is already closed by this design: `--title` flows unescaped into
the report's H1 (`slices.js:222`), so a title containing a newline plus a heading creates a fake heading. It
sits **above** the structural one, so last-match steps past it. No guard needed.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `cli/lib/slices.js` | Modify — add `findSection()`; rewrite the two writers at `:232-249`; hoist action validation; add `adrCmd()` | The record writers. All six defects except the flag guard live here. |
| `cli/bin/house.js` | Modify — guard message at `:39-42`; `FLAGS.adr`; `commands.adr` | Argument surface. |
| `cli/schema/enums.yaml` | Modify — add `slice.adr_attached` to `event_types` | The sole normative source for event types. **Not** added to `free_form_events`: the new event is owned by its dedicated command, exactly like `slice.pr_set`. |
| `cli/test/slices.test.js` | Modify — append the new tests | All `unitCmd` and manifest-writer coverage already lives here. |

`findSection()` is exported for its tests and for Task 1's measurement step. There is no second production
caller and no new module, so this is not the shared-module extraction the No-Gos forbid.

---

### Task 1: `findSection()` locator, and `finalize` uses it (R-1, R-4)

**Files:**
- Modify: `cli/lib/slices.js` (add helper above `unitCmd`; rewrite `:243-245`)
- Test: `cli/test/slices.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `cli/test/slices.test.js`:

```js
test('findSection: locates the structural heading by last exact whole-line match', async () => {
  const { findSection } = await import('../lib/slices.js');
  const doc = 'a\n## Result\nbody\n';
  assert.equal(doc.slice(findSection(doc, '## Result').start), '## Result\nbody\n');
  // last match wins: a mention above the real heading is stepped past
  const two = 'x\n## Result quoted in prose\n## Result\ntail\n';
  assert.equal(two.slice(findSection(two, '## Result').start), '## Result\ntail\n');
  // even an EXACT heading line inside a note is stepped past, because notes sit above
  const three = '## Heartbeats\n- T1 — quoting:\n## Result\n\n## Result\ntail\n';
  assert.equal(three.slice(findSection(three, '## Result').start), '## Result\ntail\n');
  // whole-line match only: `## Results` is not `## Result`
  assert.equal(findSection('## Results\n', '## Result'), null);
  // `end` stops at the next `## ` heading; for a last section it runs to EOF
  const h = '## Heartbeats\n- one\n\n## Result\ntail\n';
  assert.equal(h.slice(findSection(h, '## Heartbeats').end), '## Result\ntail\n');
  assert.equal(findSection(h, '## Result').end, h.length);
  // adjacent headings: empty body, and no character eaten or duplicated
  const adj = '## Heartbeats\n## Result\n';
  const a = findSection(adj, '## Heartbeats');
  assert.equal(adj.slice(a.bodyStart, a.end), '');
});

test('finalize: preserves everything above the Result heading (R-1)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Preserve');
  run(dir, 'unit', '0001-preserve', 'dispatch', '--title', 'U');
  const report = join(dir, 'docs/slices/0001-preserve/units/01-report.md');
  // three shapes that the current implementation destroys
  const inline  = 'the writer matched ## Result mid-sentence and ate this';
  const atStart = '## Result quoted at line start in prose';
  const fenced  = '```\n## Result\n```';
  run(dir, 'unit', '0001-preserve', 'heartbeat', '01', '--note', inline);
  run(dir, 'unit', '0001-preserve', 'heartbeat', '01', '--note', atStart);
  run(dir, 'unit', '0001-preserve', 'heartbeat', '01', '--note', fenced);
  assert.equal(run(dir, 'unit', '0001-preserve', 'finalize', '01',
    '--result', 'DONE', '--note', 'all green').code, 0);
  const out = readFileSync(report, 'utf8');
  assert.ok(out.includes(inline),  'mid-sentence mention was destroyed');
  assert.ok(out.includes(atStart), 'line-start quotation was destroyed');
  assert.ok(out.includes(fenced),  'fenced heading was destroyed');
  // exactly ONE finalize block was written. Note we do NOT assert a single `^## Result$` line:
  // the fenced heartbeat note legitimately contains one, and last-match is what steps past it.
  assert.equal(out.match(/\*\*DONE\*\* — all green/g).length, 1);
  assert.ok(out.indexOf(fenced) < out.lastIndexOf('## Result'), 'the fenced note must stay above the real heading');
});

test('finalize: refuses a report with no Result heading, and repeats are stable', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Refuse');
  run(dir, 'unit', '0001-refuse', 'dispatch', '--title', 'U');
  const report = join(dir, 'docs/slices/0001-refuse/units/01-report.md');
  const ok = run(dir, 'unit', '0001-refuse', 'finalize', '01', '--result', 'DONE', '--note', 'first');
  assert.equal(ok.code, 0);
  const once = readFileSync(report, 'utf8');
  assert.equal(run(dir, 'unit', '0001-refuse', 'finalize', '01', '--result', 'DONE', '--note', 'first').code, 0);
  assert.equal(readFileSync(report, 'utf8').replace(/- finalized: \S+/g, ''),
    once.replace(/- finalized: \S+/g, ''), 'repeated finalize with an ordinary note is stable');
  writeFileSync(report, '# Unit 01\n\nno sections here\n');
  const bad = run(dir, 'unit', '0001-refuse', 'finalize', '01', '--result', 'DONE');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /## Result/);       // helpers.run() has no .stderr — `out` carries both streams
});
```

`writeFileSync` is already imported by this test file; confirm at the top and add it to the existing
`node:fs` import if absent.

- [ ] **Step 2: Run the tests and confirm they fail for the right reasons**

Run: `cd cli && npm test 2>&1 | tail -20`

Expected: the `findSection` test fails with **`TypeError: findSection is not a function`** — destructuring a
missing export yields `undefined`, so it is a TypeError at the call, not a SyntaxError at the import; the R-1
test fails on `mid-sentence mention was destroyed` (today's unanchored regex matches the heading text inside
the first heartbeat note and truncates from there); the refuse test fails because the exit code is 0, not 1 —
today's `.replace` silently no-ops when the pattern is absent. **Read the failure text.** A test that fails
because the import is broken is not evidence about truncation.

- [ ] **Step 3: Write `findSection()`**

Insert immediately above `export function unitCmd` in `cli/lib/slices.js`:

```js
// The two unit-report writers used `.replace` as a document editor: finalize with an UNANCHORED
// /## Result[\s\S]*$/ (first match anywhere, so prose quoting the heading destroyed the body) and
// heartbeat with a first-occurrence plain-string replace. Both also interpreted $-patterns in
// caller-supplied notes. This locator returns POSITIONS and performs no replacement, which removes
// the replacement-pattern semantics entirely — the derive.js:84-112 precedent, one file over.
// LAST exact whole-line match, for both callers: body text only ever enters BELOW a heading, so the
// last exact match is always the structural one. Anchoring heartbeat on `## Heartbeats` instead was
// tried and rejected at plan-check — finding that section's END means scanning for the next `## `
// line, which any note body can contain. See the plan's "one rule, two callers" note.
export function findSection(text, heading) {
  const lines = text.split('\n');
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === heading) idx = i;          // keep going — last match wins
  }
  if (idx === -1) return null;
  const start = lines.slice(0, idx).reduce((n, l) => n + l.length + 1, 0);
  const bodyStart = start + heading.length + 1;
  let end = text.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (!lines[i].startsWith('## ')) continue;
    end = lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);
    break;
  }
  return { start, bodyStart, end };
}
```

Note `lines[i] !== heading` — an exact whole-line match, so `## Results` is not a match for `## Result`.

- [ ] **Step 4: Rewrite the `finalize` write**

Replace these three lines at `cli/lib/slices.js:243-245`:

```js
    const cur = readFileSync(reportPath, 'utf8');
    writeFileSync(reportPath, cur.replace(/## Result[\s\S]*$/,
      `## Result\n\n**${args.result}** — ${args.note ?? ''}\n- finalized: ${now()}\n`));
```

with:

```js
    const cur = readFileSync(reportPath, 'utf8');
    const sec = findSection(cur, '## Result');
    if (!sec) throw new Error(`report has no '## Result' heading — refusing to guess: ${reportPath}`);
    writeFileSync(reportPath, cur.slice(0, sec.start) +
      `## Result\n\n**${args.result}** — ${args.note ?? ''}\n- finalized: ${now()}\n` +
      cur.slice(sec.end));
```

Two things changed beyond the anchor: the note is **concatenated**, never passed as a replacement argument
(so `$&` is inert), and a missing heading is named rather than silently no-op'd.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd cli && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`, and `tests` at **80** (77 baseline + 3 new).

- [ ] **Step 6: Measure the blast radius across the nine shipped reports (R-1 final scenario)**

`cli/test/` never reads from `docs/`, so this is a measurement, not a test. It uses `fs.globSync`, which needs
**Node ≥ 22** — fine on this machine (v26), but it is a throwaway measurement script, not shipped code, so it
does not change the project's Node floor. Run from the repo root:

```bash
node --input-type=module -e '
import { findSection } from "./cli/lib/slices.js";
import { readFileSync, globSync } from "node:fs";
const files = globSync("docs/slices/*/units/*-report.md");
let diff = 0;
for (const f of files) {
  const t = readFileSync(f, "utf8");
  const old = t.search(/## Result[\s\S]*$/);
  const neu = findSection(t, "## Result")?.start ?? -1;
  if (old !== neu) { diff++; console.log("DIFFERS", f, old, neu); }
}
console.log(files.length + " reports, " + diff + " position changes");
'
```

Expected: `9 reports, 0 position changes`. Record the actual number in the unit report. If any report
differs, **stop and report a deviation** — the spec claims zero and a non-zero number contradicts it.

- [ ] **Step 7: Commit**

```bash
git add cli/lib/slices.js cli/test/slices.test.js
git commit -m "fix(unit): locate the Result section instead of pattern-matching it (R-1, R-4)"
```

---

### Task 2: `heartbeat` appends to Heartbeats; neither writer interprets note text (R-2, R-3, R-4)

**Files:**
- Modify: `cli/lib/slices.js:232-237` (the `heartbeat` branch)
- Test: `cli/test/slices.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `cli/test/slices.test.js`:

```js
test('heartbeat: a note containing a heading-shaped line does not displace later beats (R-2)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Beat');
  run(dir, 'unit', '0001-beat', 'dispatch', '--title', 'U');
  const report = join(dir, 'docs/slices/0001-beat/units/01-report.md');
  // note 2 is MULTI-LINE and its second line is exactly a heading. This is the shape that both the
  // old writer and an end-scanning implementation splice the NEXT beat into.
  run(dir, 'unit', '0001-beat', 'heartbeat', '01', '--note', 'first beat');
  run(dir, 'unit', '0001-beat', 'heartbeat', '01', '--note', 'careful:\n## Result appears here');
  run(dir, 'unit', '0001-beat', 'heartbeat', '01', '--note', 'third beat');
  const out = readFileSync(report, 'utf8');
  // the load-bearing assertion: beat 3 must land AFTER note 2, not inside it
  assert.ok(out.indexOf('## Result appears here') < out.indexOf('third beat'),
    'beat 3 was spliced into the middle of note 2');
  assert.ok(out.indexOf('first beat') < out.indexOf('careful:'), 'beats are out of order');
  const hb = out.slice(out.indexOf('## Heartbeats'), out.lastIndexOf('## Result'));
  assert.ok(hb.includes('first beat') && hb.includes('third beat'), 'a beat left the Heartbeats section');
});

test('heartbeat + finalize: note text is data, never a replacement pattern (R-3)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Dollar');
  run(dir, 'unit', '0001-dollar', 'dispatch', '--title', 'U');
  const report = join(dir, 'docs/slices/0001-dollar/units/01-report.md');
  assert.equal(run(dir, 'unit', '0001-dollar', 'heartbeat', '01', '--note', 'literal $& here').code, 0);
  assert.ok(readFileSync(report, 'utf8').includes('literal $& here'), '$& was interpreted');
  assert.equal(run(dir, 'unit', '0001-dollar', 'finalize', '01',
    '--result', 'DONE', '--note', 'group $1 and tick $` kept').code, 0);
  const out = readFileSync(report, 'utf8');
  assert.ok(out.includes('group $1 and tick $` kept'), '$1 / $` were interpreted');
});

test('heartbeat: refuses a report with no Result heading (R-4)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Norefuse');
  run(dir, 'unit', '0001-norefuse', 'dispatch', '--title', 'U');
  const report = join(dir, 'docs/slices/0001-norefuse/units/01-report.md');
  writeFileSync(report, '# Unit 01\n\nno sections here\n');
  const bad = run(dir, 'unit', '0001-norefuse', 'heartbeat', '01', '--note', 'nowhere to go');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /## Result/);
  // and nothing was written — the old writer silently no-op'd at exit 0
  assert.equal(readFileSync(report, 'utf8'), '# Unit 01\n\nno sections here\n');
});
```

- [ ] **Step 2: Run the tests and confirm they fail for the right reasons**

Run: `cd cli && npm test 2>&1 | tail -25`

Expected: the R-2 test fails on **`beat 3 was spliced into the middle of note 2`** — the old
first-occurrence `'\n## Result'` replace matches the line note 2 introduced, so beat 3 is inserted above it.
The R-3 test fails on `$& was interpreted`, because the heartbeat path still uses `.replace`; the R-3
finalize half already passes, since Task 1 Step 4 removed that one. The new heartbeat-refuses test fails on
the exit code being 0 — today's `.replace` silently no-ops when `\n## Result` is absent, writing the file
back unchanged and reporting success.

> This R-2 assertion was chosen because the obvious one is **not red**. A note reading
> `'careful: ## Result appears here'` — heading text mid-line — leaves the old writer finding the real
> heading, so every beat lands correctly and the test passes against today's code. The note must be
> multi-line, with the heading at line start, and the assertion must be about **placement**. A test that
> passes before the fix evidences nothing.

- [ ] **Step 3: Rewrite the `heartbeat` write**

Replace `cli/lib/slices.js:233-235`:

```js
    if (!args.note) throw new Error('--note is required for a heartbeat');
    const cur = readFileSync(reportPath, 'utf8');
    writeFileSync(reportPath, cur.replace('\n## Result', `- ${now()} — ${args.note}\n\n## Result`));
```

with:

```js
    if (!args.note) throw new Error('--note is required for a heartbeat');
    const cur = readFileSync(reportPath, 'utf8');
    // insert before the STRUCTURAL Result heading — which is the end of the Heartbeats section.
    // Anchoring on `## Heartbeats` and scanning for its end was rejected at plan-check: any note
    // body containing a `## ` line truncates that scan and the next beat lands inside the note.
    const sec = findSection(cur, '## Result');
    if (!sec) throw new Error(`report has no '## Result' heading — refusing to guess: ${reportPath}`);
    const head = cur.slice(0, sec.start).replace(/\n+$/, '');
    writeFileSync(reportPath, `${head}\n- ${now()} — ${args.note}\n\n` + cur.slice(sec.start));
```

The note is **concatenated**, never passed as a replacement argument, so `$&` is inert. The `.replace(/\n+$/, '')`
on `head` normalises trailing blank lines so repeated beats do not accumulate them — it operates on the
document prefix, never on caller text.

> **One boundary behaviour, so you do not "fix" it mid-build.** If a note itself *ends* in newline
> characters, the **next** beat's `head` trim collapses them, because by then that note is part of the
> document prefix. The write is verbatim; a later write normalises the boundary. This is cosmetic in
> markdown and it is intended — leave it. R-3 is about note text never changing *where or what* is written,
> and that still holds.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd cli && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`, `tests` at **83** (80 + 3 new).

- [ ] **Step 5: Confirm R-4 by reading the two writers**

Run: `sed -n '230,255p' cli/lib/slices.js`

Confirm by eye, and state it in the unit report: neither writer contains a section-finding regex or string
search of its own, and neither passes a caller-supplied string in a `.replace` replacement position. If
either is still true, R-4 is not met.

- [ ] **Step 6: Commit**

```bash
git add cli/lib/slices.js cli/test/slices.test.js
git commit -m "fix(unit): heartbeat anchors on its own section; notes are never patterns (R-2, R-3)"
```

---

### Task 3: `house adr <slice> attach <adr-id>` (R-5)

**Files:**
- Modify: `cli/schema/enums.yaml` (`event_types`)
- Modify: `cli/lib/slices.js` (add `adrCmd()` after `prCmd`)
- Modify: `cli/bin/house.js` (`FLAGS.adr`, `commands.adr`)
- Modify: `docs/slices/0001-house-v2-s2-skills-rewrite/slice.yaml` — **only via the new command**
- Test: `cli/test/slices.test.js`

- [ ] **Step 1: Write the failing test**

Append to `cli/test/slices.test.js`:

```js
test('adr attach: writes the slice→ADR edge through a writer, refusing a missing ADR (R-5)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Linky');
  assert.equal(run(dir, 'adr', '0001-linky', 'attach', '0009-nope').code, 1);   // no such ADR file
  let man = readYaml(join(dir, 'docs/slices/0001-linky/slice.yaml'));
  assert.deepEqual(man.adrs, [], 'a refused attach must write nothing');
  writeFileSync(join(dir, 'docs/adr/0001-real-decision.md'), '# ADR\n');
  assert.equal(run(dir, 'adr', '0001-linky', 'attach', '0001-real-decision').code, 0);
  man = readYaml(join(dir, 'docs/slices/0001-linky/slice.yaml'));
  assert.deepEqual(man.adrs, ['0001-real-decision']);
  assert.match(readFileSync(join(dir, '.house/events.jsonl'), 'utf8'), /"slice\.adr_attached"/);
  // idempotent: attaching twice does not duplicate
  assert.equal(run(dir, 'adr', '0001-linky', 'attach', '0001-real-decision').code, 0);
  man = readYaml(join(dir, 'docs/slices/0001-linky/slice.yaml'));
  assert.deepEqual(man.adrs, ['0001-real-decision']);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd cli && npm test 2>&1 | tail -15`

Expected: **the very first assertion fails with `2 !== 1`.** Before wiring, `house adr` falls through to the
unknown-command path in `cli/bin/house.js`, which exits **2**, not 1 — so `assert.equal(…code, 1)` fails there
and `node:test` aborts this test at that point. That is the genuine red. You will **not** reach the
`deepEqual`; do not go looking for it. After Step 5 the same assertion passes for the real reason (`adrCmd`
throwing on a missing ADR file exits 1).

- [ ] **Step 3: Add the event type**

In `cli/schema/enums.yaml`, add `slice.adr_attached` to the `event_types` list, on the line that already
carries the other `slice.*` types:

```yaml
event_types: [slice.created, slice.state_changed, slice.shipped, slice.abandoned, slice.unblocked, slice.pr_set,
  slice.adr_attached,
  artifact.written, artifact.state_changed, gate.requested, gate.recorded,
```

**Do not add it to `free_form_events`.** It is owned by its dedicated command, exactly like `slice.pr_set`,
so `house event slice.adr_attached` must keep failing.

- [ ] **Step 4: Write `adrCmd()`**

Insert after `prCmd` (i.e. after `cli/lib/slices.js:209`):

```js
export function adrCmd(root, id, action, adrId, args) {
  if (action !== 'attach') throw new Error(`unknown adr action: ${action} — expected 'attach'`);
  if (!adrId || adrId === true) throw new Error('usage: house adr <slice> attach <adr-id>');
  const dir = sliceDir(root, id);
  // a manifest citing a missing ADR is the same plausible-wrong record this slice is about
  if (!existsSync(join(root, 'docs/adr', `${adrId}.md`)))
    throw new Error(`no such ADR: docs/adr/${adrId}.md`);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.adrs = man.adrs ?? [];
  if (!man.adrs.includes(adrId)) {
    man.adrs.push(adrId);
    writeYaml(join(dir, 'slice.yaml'), man);
  }
  appendEvent(root, 'slice.adr_attached', { slice: id, actor: args.actor ?? 'shaper',
    payload: { adr: adrId } });
}
```

The `appendEvent` sits **outside** the `includes` guard on purpose: Step 7 regularizes `[0001]`'s existing
value, where the event *is* the entire point and the manifest does not change. The accepted cost is that an
accidental double-attach also logs an event with no manifest change. That is the right trade for a layer whose
whole job is provenance — and it is what makes Step 7's empty-diff prediction exact rather than hedged.

- [ ] **Step 5: Wire the command**

In `cli/bin/house.js`, add to `FLAGS` (after the `pr:` entry on `:33`):

```js
  adr: ['actor'],
```

and to `commands` (after the `pr:` entry on `:57`):

```js
  adr:     () => slices.adrCmd(need(root), pos[0], pos[1], pos[2], args),
```

**Nothing else to edit for the usage line.** It is generated from `Object.keys(commands)` at
`cli/bin/house.js:79`, so adding the `commands.adr` entry updates it automatically. There is no literal
command list in the file — do not go looking for one.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd cli && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`, `tests` at **84** (83 + 1 new).

- [ ] **Step 7: Regularize `[0001]`'s hand-written value through the writer**

The value is already correct; only its provenance is wrong. Confirm the current state, then re-record it:

```bash
grep -A1 '^adrs:' docs/slices/0001-house-v2-s2-skills-rewrite/slice.yaml
house adr 0001-house-v2-s2-skills-rewrite attach 0004-house2-coexistence-and-advisory-hooks --actor shaper
git diff --stat docs/slices/0001-house-v2-s2-skills-rewrite/slice.yaml
```

Expected: the `git diff --stat` is **empty or whitespace-only** — the writer is idempotent and the value was
already right. What changes is `.house/events.jsonl`, which now carries the recording event. If the diff
shows a content change, stop and report it: the hand-written value was not what the writer produces, and
that is a finding, not something to smooth over.

- [ ] **Step 8: Commit**

```bash
git add cli/schema/enums.yaml cli/lib/slices.js cli/bin/house.js cli/test/slices.test.js \
        .house/events.jsonl docs/slices/0001-house-v2-s2-skills-rewrite/slice.yaml
git commit -m "feat(adr): give slice.yaml adrs: its missing writer; regularize 0001 (R-5)"
```

---

### Task 4: error messages name the real mistake (R-6, R-7)

**Files:**
- Modify: `cli/bin/house.js:39-42` (the flag guard)
- Modify: `cli/lib/slices.js:211-249` (hoist action validation)
- Test: `cli/test/slices.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `cli/test/slices.test.js`:

```js
test('flag guard: a rejected flag names the accepted ones (R-6)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Flaggy');
  const r = run(dir, 'event', 'work.discovered', '--slice', '0001-flaggy', '--note', 'wrong spelling');
  assert.equal(r.code, 1);
  // helpers.run() returns { out, code } — `out` carries stdout+stderr; there is no .stderr
  assert.match(r.out, /--note/);        // still names what was rejected
  assert.match(r.out, /--payload/);     // and now names what to use instead
});

test('unit: an invalid action is reported as an invalid action (R-7)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Verby');
  run(dir, 'unit', '0001-verby', 'dispatch', '--title', 'U');
  const r = run(dir, 'unit', '0001-verby', 'report', '01');
  assert.equal(r.code, 1);
  assert.match(r.out, /report/);                        // names the real mistake
  assert.match(r.out, /dispatch\|heartbeat\|finalize/);  // and the accepted actions
  assert.doesNotMatch(r.out, /no such unit/);            // never blames the wrong argument
  // and with the unit id omitted too, it still blames the action
  const r2 = run(dir, 'unit', '0001-verby', 'report');
  assert.match(r2.out, /report/);
  assert.doesNotMatch(r2.out, /undefined/);
});
```

- [ ] **Step 2: Run them and confirm they fail for the right reasons**

Run: `cd cli && npm test 2>&1 | tail -20`

Expected: R-6 fails on the `--payload` assertion — today's message is only
`house event: unknown flag --note`.

R-7 fails on the **missing accepted-actions list** (`/dispatch\|heartbeat\|finalize/`), *not* on
`no such unit`. Unit `01` exists — it was dispatched two lines earlier — so today's lookup succeeds and the
trailing `else` already throws `unknown unit action: report`. The string `no such unit` never appears in that
run, and `node:test` aborts before reaching `r2`. The `doesNotMatch(/no such unit/)` assertion and the `r2`
case are there to pin the behaviour after the hoist, not to be the red.

- [ ] **Step 3: Make the guard name the accepted flags**

Replace `cli/bin/house.js:39-42`:

```js
if (FLAGS[cmd]) for (const k of Object.keys(args)) if (!FLAGS[cmd].includes(k)) {
  console.error(`house ${cmd}: unknown flag --${k}`);
  process.exit(1);
}
```

with:

```js
// naming the accepted flags kills the whole three-spelling family (--note / --notes / --payload)
// at the point of failure, without renaming any flag
if (FLAGS[cmd]) for (const k of Object.keys(args)) if (!FLAGS[cmd].includes(k)) {
  const ok = FLAGS[cmd].length ? FLAGS[cmd].map(f => `--${f}`).join(' ') : '(none)';
  console.error(`house ${cmd}: unknown flag --${k} — accepts: ${ok}`);
  process.exit(1);
}
```

- [ ] **Step 4: Hoist `unitCmd`'s action validation above the unit lookup**

In `cli/lib/slices.js`, insert immediately after `const now = () => new Date().toISOString();` (`:215`):

```js
  // validate the ACTION before looking up the unit: a typo'd verb used to surface as
  // `no such unit: undefined`, blaming the argument that was fine
  const UNIT_ACTIONS = ['dispatch', 'heartbeat', 'finalize'];
  if (!UNIT_ACTIONS.includes(action))
    throw new Error(`unknown unit action: ${action} — expected one of ${UNIT_ACTIONS.join('|')}`);
```

Then delete the now-unreachable trailing clause at the end of `unitCmd` — change:

```js
  } else throw new Error(`unknown unit action: ${action}`);
```

to:

```js
  }
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd cli && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`, `tests` at **86** (84 + 2 new).

- [ ] **Step 6: Full gate run**

Run from the repo root:

```bash
cd cli && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)" ; cd ..
house validate ; echo "validate: $?"
house validate --strict ; echo "strict: $?"
```

Expected: `pass 86`, `fail 0`, `validate: 0`, `strict: 0`.

- [ ] **Step 7: Commit**

```bash
git add cli/bin/house.js cli/lib/slices.js cli/test/slices.test.js
git commit -m "fix(cli): guard names accepted flags; unit action validated before lookup (R-6, R-7)"
```

---

## As-built

*(Empty at hand-off. Any post-approval correction to this plan's body is disclosed here, per the rule
`[0007]`'s merge gate established: an approved plan's body is corrected only where leaving it would mislead
the next author, and every such correction is recorded in this section.)*
