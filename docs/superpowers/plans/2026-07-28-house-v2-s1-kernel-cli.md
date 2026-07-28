# house v2 S1 — Kernel + `house` CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the house v2 state kernel — normative schemas + a Node `house` CLI (init · new · event · gate · task · state · status · list · next · validate · index · render dev-state) — dogfooded on the sdlc-skills repo itself.

**Architecture:** Three-layer state per the approved spec (`docs/superpowers/specs/2026-07-28-house-v2-design.md`): YAML frontmatter + `slice.yaml` manifests (DECLARED) · append-only `.house/events.jsonl` (OBSERVED) · rebuildable `.house/index.json` (DERIVED, gitignored). The CLI is the sole writer of OBSERVED and DERIVED; deleting the index and rebuilding must be byte-identical. No daemon, no DB — plain file reads, JSONL append.

**Tech Stack:** Node ≥ 20, ESM, `node:test` runner. Runtime deps: `js-yaml` only (ULID implemented inline — no dep). Lives in `cli/` of sdlc-skills; installed via `npm link` (install.sh wiring deferred to S2).

**Model routing (fable-profile, ADR-0001):** builder subagents on **Opus** (`model: opus`); per-task and merge review on **Fable**.

**Scope guards — NOT this slice:** no skill rewrites (S2) · no hooks wiring into `.claude/settings.json` (S2) · no `house archive` / delta-specs (v2.1) · no `house adopt` / migration of other repos (S3) · no IDE work (S4) · no daemon/watch mode · no edits to the three v1 skills.

**Interpretations locked at planning (surface if they fight the spec):**
1. Per-slice task progress lives in `docs/slices/<id>/tasks.yaml` (CLI-owned), not as checkboxes in `plan.md` — spec §3.2 bans progress state in plan prose; §3.4's `[ ]/[x]/[!]` markers are the *render* of tasks.yaml state, not the store. tasks.yaml's initial author is the **shaper at handoff** (S2 wires that); S1 only reads/mutates it.
2. Gate verdicts live canonically in `gates/<name>.yaml` (written by `house gate`); spec §3.2's `plan-check.md` / `merge-gate.md` are optional **prose narratives** referencing the yaml record — they are never the machine-read verdict.
3. `blocked_on` / `gate.requested` writers are deferred to S2 (the halt flow needs the skills); S1 ships the fields and event type only.

---

## File structure

```
cli/
├── package.json                # name: house-cli, bin: {house: ./bin/house.js}, type: module
├── bin/house.js                # arg parse + command dispatch table; exits 0/1/2
├── lib/core.js                 # repoRoot() · ulid() · readYaml/writeYaml · frontmatter parse/serialize · appendEvent/readEvents
├── lib/slices.js               # allocator (mintId) · manifest io · gates io · tasks io · state-transition guard
├── lib/derive.js               # buildIndex() · status() · next() · renderDevState()
├── lib/validate.js             # rule engine; returns [{level, path, msg}]
├── schema/enums.yaml           # THE normative enum lists (slice states, artifact states, verdicts, event types, kinds, tiers)
├── templates/spec.md           # five-slot pitch + Requirements skeleton
├── templates/adr.md            # MADR-lite skeleton (frontmatter + Context/Decision/Consequences/Confirmation)
└── test/
    ├── helpers.js              # mkTmpRepo(): tmp house-initialized dir (no git needed for these tests)
    ├── core.test.js
    ├── slices.test.js
    ├── derive.test.js
    ├── validate.test.js
    └── cli.test.js             # spawn-based smoke: bin dispatch + exit-code contract 0/1/2
```

`schema/enums.yaml` content (normative — every other file imports it, nothing restates it):

```yaml
slice_states: [idea, shaping, ready, building, gating, live_check, shipped, parked, abandoned]
artifact_states: [todo, draft, awaiting_review, approved, done, skipped, superseded]
task_states: [todo, doing, done, blocked, skipped]
kinds: [slice, decision, idea, hotfix, spike-only, docs-only]
tiers: [decision, patch, slice, high, epic]
gate_verdicts:
  spec_review: [approved, changes_requested]
  mockup_signoff: [approved, changes_requested]
  plan_check: [GO, GO_WITH_FIXES, NO_GO]
  merge_gate: [GO, NO_GO, INCONCLUSIVE]
  live_check: [approved, changes_requested]
  adr_review: [approved, changes_requested]
passing_verdicts:             # FAIL-CLOSED: forward motion requires the latest record ∈ this list (INCONCLUSIVE is NOT a pass)
  spec_review: [approved]
  mockup_signoff: [approved]
  plan_check: [GO, GO_WITH_FIXES]
  merge_gate: [GO]
  live_check: [approved]
  adr_review: [approved]
adr_states: [proposed, accepted, deprecated, superseded]
event_types: [slice.created, slice.state_changed, slice.shipped, slice.abandoned, artifact.written,
  gate.requested, gate.recorded, unit.dispatched, unit.heartbeat, unit.report,
  task.done, task.blocked, work.discovered, deviation.raised, session.started, session.ended]
state_transitions:            # from → allowed to (blocked_on is orthogonal, not a state)
  idea: [shaping, parked, abandoned]
  shaping: [ready, parked, abandoned]
  ready: [building, shaping, parked, abandoned]
  building: [gating, shaping, parked, abandoned]
  gating: [live_check, shipped, building, parked, abandoned]
  live_check: [shipped, building, parked, abandoned]
  parked: [shaping, ready, abandoned]
required_gates:               # entry preconditions checked by `house state`
  ready: [spec_review, plan_check]
  live_check: [merge_gate]    # merge-gate gates the EXIT from gating, not just shipped
  shipped: [merge_gate]
```

---

### Task 1: Package scaffold + core primitives (ulid, yaml, frontmatter, repoRoot)

**Files:**
- Create: `cli/package.json`, `cli/lib/core.js`, `cli/test/core.test.js`, `cli/test/helpers.js`, `cli/schema/enums.yaml` (content above)

- [x] **Step 1: Scaffold the package**

```bash
mkdir -p cli/{bin,lib,schema,templates,test} && cd cli && npm init -y >/dev/null
npm pkg set name=house-cli version=0.1.0 type=module bin.house=./bin/house.js scripts.test="node --test test/"
npm install js-yaml@4
```

- [x] **Step 2: Write failing tests for core**

```js
// cli/test/core.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ulid, parseFrontmatter, serializeFrontmatter, repoRoot } from '../lib/core.js';
import { mkTmpRepo } from './helpers.js';

test('ulid: 26 chars, Crockford base32, monotonic-ish lexical order', () => {
  const a = ulid(), b = ulid();
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.ok(b >= a);
});

test('frontmatter: round-trips YAML + body', () => {
  const doc = '---\nid: "0007"\nstate: draft\n---\n\n# Title\nbody\n';
  const { data, body } = parseFrontmatter(doc);
  assert.equal(data.id, '0007');
  assert.equal(data.state, 'draft');
  const out = serializeFrontmatter(data, body);
  assert.deepEqual(parseFrontmatter(out).data, data);
});

test('frontmatter: no-frontmatter file returns null data, full body', () => {
  const { data, body } = parseFrontmatter('# plain\n');
  assert.equal(data, null);
  assert.equal(body, '# plain\n');
});

test('repoRoot: walks up to the dir containing .house', () => {
  const repo = mkTmpRepo();                       // creates <tmp>/.house/ + docs/slices/
  assert.equal(repoRoot(`${repo}/docs/slices`), repo);
  assert.equal(repoRoot('/'), null);
});
```

```js
// cli/test/helpers.js
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function mkTmpRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'house-'));
  mkdirSync(join(dir, '.house'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'slices'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'adr'), { recursive: true });
  writeFileSync(join(dir, '.house', 'events.jsonl'), '');
  writeFileSync(join(dir, '.house', 'config.yaml'), 'schema_version: 1\n');
  return dir;
}
```

- [x] **Step 3: Run tests, verify they fail**

Run: `cd cli && npm test`
Expected: FAIL — `Cannot find module '../lib/core.js'`

- [x] **Step 4: Implement core.js**

```js
// cli/lib/core.js
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastTime = 0, lastRand = null;
export function ulid(now = Date.now()) {
  let t = now, time = '';
  for (let i = 9; i >= 0; i--) { time = B32[t % 32] + time; t = Math.floor(t / 32); }
  let rand;
  if (now === lastTime && lastRand) {            // same-ms monotonicity: increment prior randomness
    rand = [...lastRand];
    for (let i = 15; i >= 0; i--) { const v = B32.indexOf(rand[i]) + 1; if (v < 32) { rand[i] = B32[v]; break; } rand[i] = B32[0]; }
  } else {
    rand = Array.from({ length: 16 }, () => B32[Math.floor(Math.random() * 32)]);
  }
  lastTime = now; lastRand = rand;
  return time + rand.join('');
}

export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { data: null, body: text };
  return { data: yaml.load(m[1]) ?? {}, body: text.slice(m[0].length) };
}
export function serializeFrontmatter(data, body) {
  return `---\n${yaml.dump(data, { lineWidth: 100 })}---\n${body}`;
}

export const readYaml = (p) => yaml.load(readFileSync(p, 'utf8'));
export const writeYaml = (p, data) => writeFileSync(p, yaml.dump(data, { lineWidth: 100 }));

export function loadEnumsPath() { return fileURLToPath(new URL('../schema/enums.yaml', import.meta.url)); }

export function repoRoot(from = process.cwd()) {
  let dir = resolve(from);
  while (true) {
    if (existsSync(join(dir, '.house'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function appendEvent(root, event, fields) {
  const line = JSON.stringify({ id: ulid(), ts: new Date().toISOString(), event, ...fields });
  appendFileSync(join(root, '.house', 'events.jsonl'), line + '\n');
  return JSON.parse(line);
}
export function readEvents(root) {
  const raw = readFileSync(join(root, '.house', 'events.jsonl'), 'utf8');
  return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
export function loadEnums() {
  return readYaml(loadEnumsPath());               // fileURLToPath — URL.pathname breaks on paths with spaces
}
```

- [x] **Step 5: Run tests, verify pass; commit**

Run: `cd cli && npm test` — Expected: PASS (4 tests)

```bash
git add cli/package.json cli/package-lock.json cli/lib/core.js cli/test/ cli/schema/enums.yaml
git commit -m "feat(cli): core primitives — ulid, frontmatter, repoRoot, event append (house v2 S1)"
```

### Task 2: Event log semantics

**Files:**
- Modify: `cli/test/core.test.js` (append tests)

- [x] **Step 1: Write failing tests**

```js
test('events: append writes one JSON line with ulid id + ISO ts; read returns in order', () => {
  const repo = mkTmpRepo();
  appendEvent(repo, 'slice.created', { slice: '0001-x', actor: 'shaper', payload: { kind: 'slice' } });
  appendEvent(repo, 'gate.recorded', { slice: '0001-x', payload: { gate: 'plan_check', verdict: 'GO' } });
  const ev = readEvents(repo);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].event, 'slice.created');
  assert.match(ev[0].id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.ok(!Number.isNaN(Date.parse(ev[0].ts)));
  assert.equal(ev[1].payload.verdict, 'GO');
});

test('events: unknown event type throws (enum enforced at the only writer)', () => {
  const repo = mkTmpRepo();
  assert.throws(() => appendEvent(repo, 'made.up', { slice: 'x' }), /unknown event type/);
});
```

- [x] **Step 2: Run, verify the second test fails** — Expected: FAIL (no enum check yet)

- [x] **Step 3: Enforce the enum in appendEvent**

In `cli/lib/core.js`, at the top of `appendEvent` add:

```js
  const { event_types } = loadEnums();
  if (!event_types.includes(event)) throw new Error(`unknown event type: ${event}`);
```

- [x] **Step 4: Run tests → PASS; commit**

```bash
git add cli/lib/core.js cli/test/core.test.js
git commit -m "feat(cli): event-type enum enforced at the single OBSERVED-layer writer"
```

### Task 3: `house init`

**Files:**
- Create: `cli/bin/house.js`
- Test: `cli/test/slices.test.js`

- [x] **Step 1: Failing test (drive init through the lib so tests stay in-process)**

```js
// cli/test/slices.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../lib/slices.js';

test('init: scaffolds .house, docs/slices, gitattributes union-merge, gitignore for index', () => {
  const dir = mkdtempSync(join(tmpdir(), 'house-init-'));
  init(dir);
  assert.ok(existsSync(join(dir, '.house/events.jsonl')));
  assert.ok(existsSync(join(dir, '.house/config.yaml')));
  assert.ok(existsSync(join(dir, 'docs/slices')));
  assert.match(readFileSync(join(dir, '.gitattributes'), 'utf8'), /events\.jsonl merge=union/);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /\.house\/index\.json/);
  init(dir);                                    // idempotent: second run must not throw or duplicate lines
  const ga = readFileSync(join(dir, '.gitattributes'), 'utf8');
  assert.equal(ga.match(/merge=union/g).length, 1);
});
```

- [x] **Step 2: Run → FAIL.  Step 3: Implement `init` in `cli/lib/slices.js`**

```js
// cli/lib/slices.js
import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readYaml, writeYaml, appendEvent, loadEnums, parseFrontmatter } from './core.js';

function ensureLine(file, line) {
  const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!cur.includes(line)) appendFileSync(file, (cur && !cur.endsWith('\n') ? '\n' : '') + line + '\n');
}

export function init(dir) {
  mkdirSync(join(dir, '.house'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'slices'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'adr'), { recursive: true });
  if (!existsSync(join(dir, '.house/events.jsonl'))) writeFileSync(join(dir, '.house/events.jsonl'), '');
  if (!existsSync(join(dir, '.house/config.yaml'))) writeYaml(join(dir, '.house/config.yaml'), { schema_version: 1 });
  ensureLine(join(dir, '.gitattributes'), '.house/events.jsonl merge=union');
  ensureLine(join(dir, '.gitignore'), '.house/index.json');
}
```

- [x] **Step 4: Wire the CLI entry with a dispatch table**

```js
#!/usr/bin/env node
// cli/bin/house.js — the shebang above MUST be line 1 of the file or `npm link` execution breaks
import { repoRoot } from '../lib/core.js';
import * as slices from '../lib/slices.js';
import * as derive from '../lib/derive.js';
import { validate } from '../lib/validate.js';

const [cmd, ...rest] = process.argv.slice(2);
const args = {};                                  // --k v / --k / positionals
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const k = rest[i].slice(2);
    if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) { args[k] = rest[++i]; } else args[k] = true;
  } else pos.push(rest[i]);
}
const need = (root) => { if (!root) { console.error('not a house repo — run `house init`'); process.exit(2); } return root; };
const root = cmd === 'init' ? process.cwd() : repoRoot();

const commands = {
  init:    () => { slices.init(process.cwd()); console.log('house: initialized'); },
  new:     () => console.log(slices.mint(need(root), pos.join(' '), args)),
  event:   () => slices.emit(need(root), pos[0], args),
  gate:    () => slices.recordGate(need(root), pos[0], args),
  task:    () => slices.taskCmd(need(root), pos[0], pos[1], args),
  state:   () => slices.setState(need(root), pos[0], pos[1], args),
  status:  () => console.log(derive.status(need(root), args)),
  list:    () => console.log(derive.list(need(root), args)),
  next:    () => console.log(derive.next(need(root), args)),
  index:   () => derive.writeIndex(need(root)),
  validate: () => { const errs = validate(need(root), args); errs.forEach(e => console.error(`${e.level}: ${e.path}: ${e.msg}`));
                    process.exit(errs.some(e => e.level === 'error') ? 1 : 0); },
  render:  () => derive.renderDevState(need(root)),
};
if (!commands[cmd]) { console.error(`usage: house <${Object.keys(commands).join('|')}>`); process.exit(2); }
try { commands[cmd](); } catch (e) { console.error(`house ${cmd}: ${e.message}`); process.exit(1); }
```

- [x] **Step 5: Run tests → the init test PASSES (derive/validate imports may need empty stubs — create `cli/lib/derive.js` and `cli/lib/validate.js` exporting empty functions now, filled in Tasks 7–10). Commit.**

```bash
git add cli/bin/house.js cli/lib/slices.js cli/lib/derive.js cli/lib/validate.js cli/test/slices.test.js
git commit -m "feat(cli): house init + command dispatch skeleton"
```

### Task 4: Identity allocator — `house new` (slice · idea · decision/ADR)

**Files:**
- Modify: `cli/lib/slices.js`, `cli/test/slices.test.js`
- Create: `cli/templates/spec.md`, `cli/templates/adr.md`

- [x] **Step 1: Failing tests**

```js
test('mint: allocates 0001, 0002… scanning slices dir; slugifies; scaffolds dir + manifest + spec; emits slice.created', () => {
  const repo = mkTmpRepo();
  const id1 = mint(repo, 'DFS OOM fix!', { kind: 'slice' });
  assert.equal(id1, '0001-dfs-oom-fix');
  const man = readYaml(join(repo, 'docs/slices/0001-dfs-oom-fix/slice.yaml'));
  assert.equal(man.state, 'shaping');
  assert.equal(man.kind, 'slice');
  assert.ok(existsSync(join(repo, 'docs/slices/0001-dfs-oom-fix/spec.md')));
  const id2 = mint(repo, 'Second thing', { kind: 'idea' });
  assert.equal(id2, '0002-second-thing');
  assert.equal(readYaml(join(repo, 'docs/slices/0002-second-thing/slice.yaml')).state, 'idea');
  const ev = readEvents(repo);
  assert.deepEqual(ev.map(e => e.event), ['slice.created', 'slice.created']);
});

test('mint --adr: allocates in docs/adr with its own series, MADR-lite frontmatter', () => {
  const repo = mkTmpRepo();
  writeFileSync(join(repo, 'docs/adr/0007-old-decision.md'), '# ADR-0007');   // pre-existing max
  const file = mint(repo, 'Use Node for the CLI', { adr: true });
  assert.match(file, /docs\/adr\/0008-use-node-for-the-cli\.md$/);
  const { data } = parseFrontmatter(readFileSync(file, 'utf8'));
  assert.equal(data.state, 'proposed');
});
```

- [x] **Step 2: Run → FAIL.  Step 3: Implement**

```js
// append to cli/lib/slices.js
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const pad = (n) => String(n).padStart(4, '0');

function nextOrdinal(dir, re) {
  if (!existsSync(dir)) return 1;
  const nums = readdirSync(dir).map(f => re.exec(f)).filter(Boolean).map(m => parseInt(m[1], 10));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export function mint(root, title, opts = {}) {
  if (!title) throw new Error('a title is required');
  const tpl = (name) => readFileSync(new URL(`../templates/${name}`, import.meta.url), 'utf8');
  if (opts.adr) {
    const dir = join(root, 'docs/adr');
    const id = pad(nextOrdinal(dir, /^(\d{4})-/));
    const file = join(dir, `${id}-${slug(title)}.md`);
    writeFileSync(file, tpl('adr.md').replaceAll('{{ID}}', id).replaceAll('{{TITLE}}', title)
      .replaceAll('{{DATE}}', new Date().toISOString().slice(0, 10)));
    appendEvent(root, 'artifact.written', { actor: opts.actor ?? 'shaper', payload: { kind: 'adr', path: file } });
    return file;
  }
  const kind = opts.kind ?? 'slice';
  const { kinds } = loadEnums();
  if (!kinds.includes(kind)) throw new Error(`unknown kind: ${kind}`);
  const dir = join(root, 'docs/slices');
  const id = `${pad(nextOrdinal(dir, /^(\d{4})-/))}-${slug(title)}`;
  mkdirSync(join(dir, id));                        // mkdir IS the allocator lock — throws if raced
  const state = kind === 'idea' ? 'idea' : 'shaping';
  const man = { schema_version: 1, id, title, kind, rigor: opts.rigor ?? 'slice', state, blocked_on: null,
    appetite: opts.appetite ?? null, created: new Date().toISOString().slice(0, 10),
    branch: `slice/${id}`, base_sha: null, pr: null, adrs: [], artifacts: {}, units: [], kickoff: null };
  writeYaml(join(dir, id, 'slice.yaml'), man);
  writeFileSync(join(dir, id, 'spec.md'), tpl('spec.md').replaceAll('{{ID}}', id).replaceAll('{{TITLE}}', title));
  appendEvent(root, 'slice.created', { slice: id, actor: opts.actor ?? 'shaper', payload: { kind, rigor: man.rigor } });
  return id;
}
```

(Manifest carries `rigor` — the spec §3.2 field name — plus `base_sha`/`kickoff` scaffolded as null now so S2
doesn't need a schema migration. The manifest is written programmatically; no slice.yaml template file.)

Templates:

```markdown
<!-- cli/templates/spec.md -->
---
id: "{{ID}}"
kind: spec
slice: "{{ID}}"
title: "{{TITLE}}"
status: "shaping"
state: draft
---
# Spec — {{TITLE}}

## Problem
## Appetite
## Solution
## Rabbit Holes
## No-Gos

## Requirements
<!-- R-1 … each with at least one "#### Scenario:" ; mark unknowns [NEEDS CLARIFICATION: …] -->
```

```markdown
<!-- cli/templates/adr.md -->
---
id: "{{ID}}"
kind: adr
title: "{{TITLE}}"
state: proposed
date: {{DATE}}
slices: []
superseded_by: null
---
# ADR-{{ID}} — {{TITLE}}

## Context
## Decision
## Consequences
## Confirmation
<!-- how a health sweep would check the code still obeys this -->
```

- [x] **Step 4: Run tests → PASS.  Step 5: Commit**

```bash
git add cli/lib/slices.js cli/templates/ cli/test/slices.test.js
git commit -m "feat(cli): house new — mkdir-locked monotonic allocator for slices and ADRs"
```

### Task 5: `house event` + `house gate` (verdict records)

**Files:**
- Modify: `cli/lib/slices.js`, `cli/test/slices.test.js`

- [x] **Step 1: Failing tests**

```js
test('recordGate: writes gates/<name>.yaml + gate.recorded event; rejects unknown gate/verdict', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'thing', {});
  recordGate(repo, 'plan_check', { slice: id, verdict: 'GO_WITH_FIXES', by: 'agent' });
  const rec = readYaml(join(repo, `docs/slices/${id}/gates/plan_check.yaml`));
  assert.equal(rec.verdict, 'GO_WITH_FIXES');
  assert.ok(rec.recorded_at);
  assert.equal(readEvents(repo).at(-1).payload.gate, 'plan_check');
  assert.throws(() => recordGate(repo, 'vibes', { slice: id, verdict: 'GO' }), /unknown gate/);
  assert.throws(() => recordGate(repo, 'merge_gate', { slice: id, verdict: 'MAYBE' }), /invalid verdict/);
});

test('emit: house event passes through with slice + parsed payload', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'thing2', {});
  emit(repo, 'work.discovered', { slice: id, payload: '{"text":"found a thing","routed_to":"roadmap"}' });
  assert.equal(readEvents(repo).at(-1).payload.text, 'found a thing');
  assert.throws(() => emit(repo, 'slice.created', { slice: id }), /owned by a dedicated command/);   // no second writer path
});
```

- [x] **Step 2: Run → FAIL.  Step 3: Implement**

```js
// append to cli/lib/slices.js
export function sliceDir(root, id) {
  const dir = join(root, 'docs/slices', id);
  if (!existsSync(join(dir, 'slice.yaml'))) throw new Error(`no such slice: ${id}`);
  return dir;
}

export function recordGate(root, gate, args) {
  const { gate_verdicts } = loadEnums();
  if (!gate_verdicts[gate]) throw new Error(`unknown gate: ${gate}`);
  if (!gate_verdicts[gate].includes(args.verdict)) throw new Error(`invalid verdict for ${gate}: ${args.verdict}`);
  const dir = sliceDir(root, args.slice);
  mkdirSync(join(dir, 'gates'), { recursive: true });
  const extra = typeof args.payload === 'string' ? JSON.parse(args.payload) : (args.payload ?? {});
  const rec = { gate, verdict: args.verdict, by: args.by ?? 'agent',
    recorded_at: new Date().toISOString(), notes: args.notes ?? null, ...extra };   // plan_check passes must_fix[]/advisory_folded[] here
  writeYaml(join(dir, 'gates', `${gate}.yaml`), rec);
  appendEvent(root, 'gate.recorded', { slice: args.slice, actor: rec.by, payload: { gate, verdict: args.verdict } });
  return rec;
}

const FREE_FORM = new Set(['work.discovered', 'deviation.raised', 'gate.requested', 'artifact.written',
  'unit.dispatched', 'unit.heartbeat', 'unit.report', 'session.started', 'session.ended']);
export function emit(root, type, args) {
  if (!FREE_FORM.has(type))
    throw new Error(`event '${type}' is owned by a dedicated command — not emittable via house event`);
  const payload = typeof args.payload === 'string' ? JSON.parse(args.payload) : (args.payload ?? {});
  return appendEvent(root, type, { slice: args.slice ?? null, actor: args.actor ?? 'agent', payload });
}
```

- [x] **Step 4: Run → PASS.  Step 5: Commit**

```bash
git add cli/lib/slices.js cli/test/slices.test.js
git commit -m "feat(cli): gate records + generic event emit — an unrecorded gate is an unpassed gate"
```

### Task 6: `tasks.yaml` + evidence-gated `house task done`

**Files:**
- Modify: `cli/lib/slices.js`, `cli/test/slices.test.js`

- [x] **Step 1: Failing tests**

```js
test('task done: runs --evidence-cmd, records exit/summary, flips state; REFUSES on nonzero exit', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'thing3', {});
  writeYaml(join(repo, `docs/slices/${id}/tasks.yaml`), { tasks: [
    { id: 't1', title: 'a', state: 'todo', verify: 'true',  depends_on: [] },
    { id: 't2', title: 'b', state: 'todo', verify: 'false', depends_on: ['t1'] } ] });
  taskCmd(repo, 'done', 't1', { slice: id, 'evidence-cmd': 'echo ok' });
  let tasks = readYaml(join(repo, `docs/slices/${id}/tasks.yaml`)).tasks;
  assert.equal(tasks[0].state, 'done');
  assert.equal(tasks[0].evidence.cmd_exit, 0);
  assert.throws(() => taskCmd(repo, 'done', 't1', { slice: id, 'evidence-cmd': 'echo ok' }), /already done/);  // no silent re-ticks
  assert.throws(() => taskCmd(repo, 'done', 't2', { slice: id, 'evidence-cmd': 'exit 3' }), /evidence command failed/);
  tasks = readYaml(join(repo, `docs/slices/${id}/tasks.yaml`)).tasks;
  assert.equal(tasks[1].state, 'todo');            // unchanged — the tick was refused
  tasks.push({ id: 't5', title: 'e', state: 'todo', depends_on: [] });          // no verify: on the task
  writeYaml(join(repo, `docs/slices/${id}/tasks.yaml`), { tasks });
  assert.throws(() => taskCmd(repo, 'done', 't5', { slice: id }), /evidence required/);  // no verify + no --evidence-cmd = no tick
});

test('task block: requires a note', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'thing4', {});
  writeYaml(join(repo, `docs/slices/${id}/tasks.yaml`), { tasks: [{ id: 't1', title: 'a', state: 'todo', verify: 'true', depends_on: [] }] });
  assert.throws(() => taskCmd(repo, 'block', 't1', { slice: id }), /note required/);
  taskCmd(repo, 'block', 't1', { slice: id, note: 'flaky upstream' });
  assert.equal(readYaml(join(repo, `docs/slices/${id}/tasks.yaml`)).tasks[0].state, 'blocked');
});
```

- [x] **Step 2: Run → FAIL.  Step 3: Implement**

```js
// append to cli/lib/slices.js
import { execSync } from 'node:child_process';

export function taskCmd(root, action, taskId, args) {
  const dir = sliceDir(root, args.slice);
  const file = join(dir, 'tasks.yaml');
  const doc = readYaml(file);
  const task = doc.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`no such task: ${taskId}`);
  if (action === 'done') {
    if (task.state === 'done') throw new Error(`task ${taskId} already done — no silent re-ticks`);
    const cmd = args['evidence-cmd'] ?? task.verify;   // verify: is the task's declared proof; --evidence-cmd overrides it
    if (!cmd) throw new Error('evidence required: pass --evidence-cmd or set verify: on the task');
    let out;
    try { out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { throw new Error(`evidence command failed (exit ${e.status}): ${cmd}`); }
    task.state = 'done';
    task.evidence = { cmd, cmd_exit: 0, summary: out.trim().split('\n').at(-1) ?? '', at: new Date().toISOString() };
    appendEvent(root, 'task.done', { slice: args.slice, actor: 'builder', payload: { task: taskId, cmd } });
  } else if (action === 'block') {
    if (!args.note) throw new Error('note required for a blocked task');
    task.state = 'blocked'; task.note = args.note;
    appendEvent(root, 'task.blocked', { slice: args.slice, actor: 'builder', payload: { task: taskId, note: args.note } });
  } else throw new Error(`unknown task action: ${action}`);
  writeYaml(file, doc);
}
```

- [x] **Step 4: Run → PASS.  Step 5: Commit**

```bash
git add cli/lib/slices.js cli/test/slices.test.js
git commit -m "feat(cli): evidence-gated task ticks — the CLI runs the verify command or refuses the tick"
```

### Task 7: `house state` — transition guard

**Files:**
- Modify: `cli/lib/slices.js`, `cli/test/slices.test.js`

- [x] **Step 1: Failing tests**

```js
test('setState: legal transition writes manifest + event; illegal transition refused', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'thing5', {});                              // state: shaping
  assert.throws(() => setState(repo, id, 'building', {}), /illegal transition/);   // shaping → building not allowed
  assert.throws(() => setState(repo, id, 'ready', {}), /missing gate/);            // needs spec_review + plan_check
  recordGate(repo, 'spec_review', { slice: id, verdict: 'approved', by: 'human' });
  recordGate(repo, 'plan_check', { slice: id, verdict: 'GO', by: 'agent' });
  setState(repo, id, 'ready', {});
  assert.equal(readYaml(join(repo, `docs/slices/${id}/slice.yaml`)).state, 'ready');
  assert.equal(readEvents(repo).at(-1).event, 'slice.state_changed');
});

test('setState: refused while a required gate holds a blocking verdict', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'thing6', {});
  recordGate(repo, 'spec_review', { slice: id, verdict: 'approved', by: 'human' });
  recordGate(repo, 'plan_check', { slice: id, verdict: 'NO_GO', by: 'agent' });
  assert.throws(() => setState(repo, id, 'ready', {}), /not a passing verdict/);
});

test('setState: INCONCLUSIVE merge-gate is NOT a pass (fail-closed)', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'thing7', {});
  recordGate(repo, 'spec_review', { slice: id, verdict: 'approved', by: 'human' });
  recordGate(repo, 'plan_check', { slice: id, verdict: 'GO', by: 'agent' });
  setState(repo, id, 'ready', {}); setState(repo, id, 'building', {}); setState(repo, id, 'gating', {});
  recordGate(repo, 'merge_gate', { slice: id, verdict: 'INCONCLUSIVE', by: 'agent' });
  assert.throws(() => setState(repo, id, 'live_check', {}), /not a passing verdict/);
});
```

- [x] **Step 2: Run → FAIL.  Step 3: Implement**

```js
// append to cli/lib/slices.js
export function setState(root, id, to, args) {
  const { slice_states, state_transitions, required_gates, passing_verdicts } = loadEnums();
  if (!slice_states.includes(to)) throw new Error(`unknown state: ${to}`);
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  const allowed = state_transitions[man.state] ?? [];
  if (!allowed.includes(to)) throw new Error(`illegal transition: ${man.state} → ${to}`);
  for (const gate of required_gates[to] ?? []) {
    const gf = join(dir, 'gates', `${gate}.yaml`);
    if (!existsSync(gf)) throw new Error(`missing gate record for '${to}': ${gate} (an unrecorded gate is an unpassed gate)`);
    const rec = readYaml(gf);
    if (!passing_verdicts[gate].includes(rec.verdict))          // fail-closed: only an explicit pass advances
      throw new Error(`gate ${gate}: '${rec.verdict}' is not a passing verdict`);
  }
  man.state = to;
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'slice.state_changed', { slice: id, actor: args.actor ?? 'agent', payload: { to } });
}
```

- [x] **Step 4: Run → PASS.  Step 5: Commit**

```bash
git add cli/lib/slices.js cli/test/slices.test.js
git commit -m "feat(cli): state-transition guard — forward motion requires non-blocking gate records"
```

### Task 8: DERIVED layer — `house index` / `status` / `list` / `next`

**Files:**
- Create: `cli/lib/derive.js` (replace stub), `cli/test/derive.test.js`

- [x] **Step 1: Failing tests**

```js
// cli/test/derive.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mkTmpRepo } from './helpers.js';
import { mint, recordGate } from '../lib/slices.js';
import { writeYaml } from '../lib/core.js';
import { buildIndex, writeIndex, status, next } from '../lib/derive.js';

function seed() {
  const repo = mkTmpRepo();
  const id = mint(repo, 'OOM fix', {});
  writeYaml(join(repo, `docs/slices/${id}/tasks.yaml`), { tasks: [
    { id: 't1', title: 'a', state: 'done', verify: 'true', depends_on: [], evidence: { cmd: 'true', cmd_exit: 0, at: 'x' } },
    { id: 't2', title: 'b', state: 'todo', verify: 'true', depends_on: ['t1'] },
    { id: 't3', title: 'c', state: 'todo', verify: 'true', depends_on: ['t2'] },
    { id: 't4', title: 'd', state: 'skipped', skip_reason: 'obsolete', depends_on: [] } ] });
  recordGate(repo, 'plan_check', { slice: id, verdict: 'GO', by: 'agent' });
  return { repo, id };
}

test('index: aggregates manifests + tasks + gates; deterministic (delete + rebuild == identical)', () => {
  const { repo, id } = seed();
  writeIndex(repo);
  const a = readFileSync(join(repo, '.house/index.json'), 'utf8');
  rmSync(join(repo, '.house/index.json'));
  writeIndex(repo);
  assert.equal(readFileSync(join(repo, '.house/index.json'), 'utf8'), a);   // THE kernel invariant
  const idx = JSON.parse(a);
  assert.equal(idx.slices[0].id, id);
  assert.equal(idx.slices[0].progress.done, 1);
  assert.equal(idx.slices[0].progress.total, 3);                            // skipped leaves the denominator
  assert.equal(idx.slices[0].gates.plan_check, 'GO');
  // fixed key set — a generated_at/timestamp field would both break rebuild-determinism and fail this
  assert.deepEqual(Object.keys(idx.slices[0]).sort(),
    ['blocked_on', 'branch', 'gates', 'id', 'kind', 'pr', 'progress', 'rigor', 'state', 'tasks', 'title', 'units'].sort());
});

test('next: ready set = todo tasks with all depends_on done', () => {
  const { repo } = seed();
  const ready = JSON.parse(next(repo, { json: true }));
  assert.deepEqual(ready.map(t => t.id), ['t2']);                           // t3 waits on t2
});

test('status --json: one line per slice with state + progress', () => {
  const { repo, id } = seed();
  const s = JSON.parse(status(repo, { json: true }));
  assert.equal(s.slices[0].id, id);
  assert.equal(s.slices[0].state, 'shaping');
});
```

- [x] **Step 2: Run → FAIL.  Step 3: Implement**

```js
// cli/lib/derive.js
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readYaml } from './core.js';

export function buildIndex(root) {
  const dir = join(root, 'docs/slices');
  const slices = (existsSync(dir) ? readdirSync(dir) : [])
    .filter(d => existsSync(join(dir, d, 'slice.yaml'))).sort()
    .map(d => {
      const man = readYaml(join(dir, d, 'slice.yaml'));
      const tasksFile = join(dir, d, 'tasks.yaml');
      const tasks = existsSync(tasksFile) ? readYaml(tasksFile).tasks : [];
      const counted = tasks.filter(t => t.state !== 'skipped');
      const gatesDir = join(dir, d, 'gates');
      const gates = {};
      if (existsSync(gatesDir)) for (const g of readdirSync(gatesDir).sort())
        gates[g.replace(/\.yaml$/, '')] = readYaml(join(gatesDir, g)).verdict;
      return { id: man.id, title: man.title, kind: man.kind, rigor: man.rigor, state: man.state,
        blocked_on: man.blocked_on, branch: man.branch, pr: man.pr, units: man.units ?? [],
        progress: { done: counted.filter(t => t.state === 'done').length, total: counted.length },
        gates, tasks };
    });
  return { schema_version: 1, slices };
}
export function writeIndex(root) {
  writeFileSync(join(root, '.house/index.json'), JSON.stringify(buildIndex(root), null, 2) + '\n');
}
export function status(root, args) {
  const idx = buildIndex(root);
  if (args.json) return JSON.stringify({ slices: idx.slices.map(({ tasks, ...s }) => s) }, null, 2);
  return idx.slices.map(s => `${s.id}  [${s.state}]  ${s.progress.done}/${s.progress.total}  ${s.title}` +
    (s.blocked_on ? `  ⛔ ${s.blocked_on.gate ?? s.blocked_on}` : '')).join('\n') || '(no slices)';
}
export const list = status;                        // same projection; list keeps tasks out either way
export function next(root, args) {
  const idx = buildIndex(root);
  const ready = idx.slices.flatMap(s => (s.tasks ?? [])
    .filter(t => t.state === 'todo' && (t.depends_on ?? []).every(d => s.tasks.find(x => x.id === d)?.state === 'done'))
    .map(t => ({ slice: s.id, id: t.id, title: t.title })));
  return args.json ? JSON.stringify(ready, null, 2) : ready.map(t => `${t.slice} ${t.id} ${t.title}`).join('\n') || '(nothing ready)';
}
```

- [x] **Step 4: Run → PASS.  Step 5: Commit**

```bash
git add cli/lib/derive.js cli/test/derive.test.js
git commit -m "feat(cli): derived layer — deterministic index, status/list/next projections"
```

### Task 9: `house validate`

**Files:**
- Create: `cli/lib/validate.js` (replace stub), `cli/test/validate.test.js`

- [x] **Step 1: Failing tests**

```js
// cli/test/validate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mkTmpRepo } from './helpers.js';
import { mint } from '../lib/slices.js';
import { writeYaml, readYaml } from '../lib/core.js';
import { validate } from '../lib/validate.js';

test('validate: clean freshly-minted slice has no errors', () => {
  const repo = mkTmpRepo();
  mint(repo, 'clean', {});
  assert.deepEqual(validate(repo, {}).filter(e => e.level === 'error'), []);
});

test('validate: catches bad enum, skip-without-reason, orphan file, external mockup refs, done-without-evidence', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'dirty', {});
  const dir = join(repo, 'docs/slices', id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.state = 'polishing';                                          // not in enum
  man.artifacts = { mockups: { state: 'skipped' } };                // skip without reason
  writeYaml(join(dir, 'slice.yaml'), man);
  writeFileSync(join(dir, 'notes.txt'), 'orphan');                  // unknown file type in slice dir
  mkdirSync(join(dir, 'mockups'), { recursive: true });
  writeFileSync(join(dir, 'mockups/01-home.html'), '<link href="https://cdn.example.com/x.css">');
  writeYaml(join(dir, 'tasks.yaml'), { tasks: [{ id: 't1', title: 'x', state: 'done', depends_on: [] }] });  // no evidence
  const msgs = validate(repo, {}).map(e => e.msg).join(' | ');
  assert.match(msgs, /unknown state/);
  assert.match(msgs, /skip.*reason/i);
  assert.match(msgs, /orphan/i);
  assert.match(msgs, /external ref/i);
  assert.match(msgs, /done without evidence/i);
});

test('validate --strict: NEEDS CLARIFICATION blocks (but not inside HTML comments); ADR state enum checked', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'strictcase', {});
  const dir = join(repo, 'docs/slices', id);
  // freshly-minted spec has the marker only inside an HTML comment — strict must stay green
  assert.deepEqual(validate(repo, { strict: true }).filter(e => e.level === 'error'), []);
  writeFileSync(join(dir, 'spec.md'),
    readFileSync(join(dir, 'spec.md'), 'utf8') + '\n[NEEDS CLARIFICATION: which auth?]\n');
  assert.match(validate(repo, { strict: true }).map(e => e.msg).join(' '), /NEEDS CLARIFICATION/);
  assert.deepEqual(validate(repo, {}).filter(e => e.msg.includes('NEEDS')), []);   // non-strict ignores it
  writeFileSync(join(repo, 'docs/adr/0001-x.md'), '---\nid: "0001"\nkind: adr\nstate: vibing\n---\n# ADR-0001 — x\n');
  assert.match(validate(repo, {}).map(e => e.msg).join(' '), /unknown ADR state/);
});
```

- [x] **Step 2: Run → FAIL.  Step 3: Implement**

```js
// cli/lib/validate.js
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { readYaml, loadEnums, parseFrontmatter } from './core.js';

// plan-check.md / merge-gate.md are OPTIONAL prose narratives; the machine-read verdict is always gates/*.yaml
const KNOWN = new Set(['slice.yaml', 'spec.md', 'plan.md', 'plan-check.md', 'tasks.yaml', 'retro.md', 'merge-gate.md']);
const KNOWN_DIRS = new Set(['gates', 'units', 'mockups', 'research']);

export function validate(root, args) {
  const errs = [];
  const err = (path, msg, level = 'error') => errs.push({ level, path, msg });
  const enums = loadEnums();
  const slicesDir = join(root, 'docs/slices');
  if (!existsSync(slicesDir)) return errs;
  for (const d of readdirSync(slicesDir).sort()) {
    const dir = join(slicesDir, d);
    if (!statSync(dir).isDirectory()) continue;
    const manFile = join(dir, 'slice.yaml');
    if (!existsSync(manFile)) { err(dir, 'slice dir without slice.yaml (orphan directory)'); continue; }
    const man = readYaml(manFile);
    if (!enums.slice_states.includes(man.state)) err(manFile, `unknown state: ${man.state}`);
    if (man.id !== d) err(manFile, `manifest id '${man.id}' != directory name '${d}'`);
    for (const [name, a] of Object.entries(man.artifacts ?? {})) {
      if (a.state && !enums.artifact_states.includes(a.state)) err(manFile, `artifact '${name}': unknown state ${a.state}`);
      if (a.state === 'skipped' && !a.skip_reason && !a.reason) err(manFile, `artifact '${name}' skip without reason`);
    }
    if (args.strict) for (const f of readdirSync(dir).filter(f => extname(f) === '.md')) {
      const text = readFileSync(join(dir, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '');   // template's marker lives in a comment
      if (text.includes('[NEEDS CLARIFICATION')) err(join(dir, f), 'NEEDS CLARIFICATION marker present — handoff blocked (--strict)');
    }
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (!KNOWN_DIRS.has(f)) err(p, `orphan directory in slice dir: ${f}`); }
      else if (!KNOWN.has(f)) err(p, `orphan file in slice dir: ${f}`);
    }
    const mockups = join(dir, 'mockups');
    if (existsSync(mockups)) for (const f of readdirSync(mockups).filter(f => extname(f) === '.html')) {
      const html = readFileSync(join(mockups, f), 'utf8');
      if (/\b(?:src|href)\s*=\s*["']https?:\/\//i.test(html) || /@import\s+url\(/i.test(html))
        err(join(mockups, f), 'mockup has external ref — self-containment contract violated');
    }
    const tasksFile = join(dir, 'tasks.yaml');
    if (existsSync(tasksFile)) for (const t of readYaml(tasksFile).tasks ?? []) {
      if (!enums.task_states.includes(t.state)) err(tasksFile, `task ${t.id}: unknown state ${t.state}`);
      if (t.state === 'done' && !t.evidence) err(tasksFile, `task ${t.id}: done without evidence`);
      if ((t.state === 'blocked' || t.state === 'skipped') && !t.note && !t.skip_reason)
        err(tasksFile, `task ${t.id}: ${t.state} without a note/reason`);
    }
    if (man.state === 'shipped') {
      if (!existsSync(join(dir, 'gates/merge_gate.yaml'))) err(dir, 'shipped without a merge_gate record');
      if (man.rigor !== 'patch' && !existsSync(join(dir, 'retro.md'))) err(dir, 'shipped slice-tier without retro.md');
    }
  }
  const adrDir = join(root, 'docs/adr');
  if (existsSync(adrDir)) for (const f of readdirSync(adrDir).filter(f => f.endsWith('.md'))) {
    const { data } = parseFrontmatter(readFileSync(join(adrDir, f), 'utf8'));
    if (data?.state && !enums.adr_states.includes(data.state)) err(join(adrDir, f), `unknown ADR state: ${data.state}`);
  }
  return errs;
}
```

- [x] **Step 4: Run → PASS.  Step 5: Commit**

```bash
git add cli/lib/validate.js cli/test/validate.test.js
git commit -m "feat(cli): house validate — the linter the doctrine allowlist never had"
```

### Task 10: `house render dev-state`

**Files:**
- Modify: `cli/lib/derive.js`, `cli/test/derive.test.js`

- [x] **Step 1: Failing test**

```js
test('render dev-state: generated top from index; hand-authored block between markers preserved', () => {
  const { repo, id } = seed();
  const dsPath = join(repo, 'docs/dev-state.md');
  writeFileSync(dsPath, ['# x — dev state', '', '<!-- house:manual -->', '## Gotchas', '- editing repo file IS the live skill',
    '<!-- /house:manual -->', ''].join('\n'));
  renderDevState(repo);
  const out = readFileSync(dsPath, 'utf8');
  assert.match(out, new RegExp(`## Active\\b[\\s\\S]*${id}`));       // generated section lists the slice
  assert.match(out, /## In-flight/);                                 // all four doctrine sections render
  assert.match(out, /editing repo file IS the live skill/);          // manual block survived
  renderDevState(repo);                                              // idempotent
  assert.equal(readFileSync(dsPath, 'utf8'), out);
});

test('render dev-state: REFUSES when hand-authored content sits outside the manual markers (no silent drops)', () => {
  const { repo } = seed();
  writeFileSync(join(repo, 'docs/dev-state.md'), '# x — dev state\n\n## Rogue hand section\n- precious content\n');
  assert.throws(() => renderDevState(repo), /outside .* markers/);
});
```

- [x] **Step 2: Run → FAIL.  Step 3: Implement**

```js
// append to cli/lib/derive.js
export function renderDevState(root) {
  const idx = buildIndex(root);
  const active = idx.slices.filter(s => ['shaping', 'ready', 'building', 'gating', 'live_check'].includes(s.state));
  const slated = idx.slices.filter(s => s.state === 'idea');
  const done = idx.slices.filter(s => s.state === 'shipped');
  const line = (s) => `- **${s.id}** — ${s.title} · state: ${s.state} · ${s.progress.done}/${s.progress.total}` +
    (s.blocked_on ? ` · ⛔ blocked on ${s.blocked_on.gate ?? s.blocked_on}` : '');
  const inflight = idx.slices.filter(s => s.pr != null || (s.units ?? []).some(u => u.state === 'building'));
  const gen = ['<!-- generated by `house render dev-state` — do not hand-edit above the manual marker -->',
    '## Active', ...(active.length ? active.map(line) : ['- none']),
    '## In-flight', ...(inflight.length ? inflight.map(s => `- **${s.id}** — PR ${s.pr ?? 'n/a'}`) : ['- none']),
    '## Slated', ...(slated.length ? slated.map(line) : ['- none']),
    '## Done', ...(done.length ? done.map(line) : ['- none']), ''].join('\n');
  const dsPath = join(root, 'docs/dev-state.md');
  const cur = existsSync(dsPath) ? readFileSync(dsPath, 'utf8') : '';
  const m = /<!-- house:manual -->[\s\S]*?<!-- \/house:manual -->/.exec(cur);
  const manual = m ? m[0] : '<!-- house:manual -->\n<!-- /house:manual -->';
  const title = /^# .*$/m.exec(cur)?.[0] ?? '# dev state';
  // refuse silent data loss: content outside title / generated block / manual markers must be wrapped first
  const leftover = cur.replace(m?.[0] ?? '', '').replace(/^# .*$/m, '')
    .replace(/<!-- generated by[\s\S]*?(?=<!-- house:manual -->|$)/, '').trim();
  if (leftover)
    throw new Error('dev-state.md has content outside the <!-- house:manual --> markers — wrap it first (no silent drops)');
  writeFileSync(dsPath, `${title}\n\n${gen}\n${manual}\n`);
}
```

- [x] **Step 4: Run → PASS.  Step 5: Commit**

```bash
git add cli/lib/derive.js cli/test/derive.test.js
git commit -m "feat(cli): dev-state as a generated projection with a preserved manual block"
```

### Task 11: Dogfood on sdlc-skills + README

**Files:**
- Create: `cli/README.md`
- Repo effects: `.house/`, `docs/slices/0001-*/`, `.gitattributes`, `.gitignore`

- [x] **Step 1: Link + init + smoke the real repo**

```bash
cd cli && npm link && cd ..
house init
house new "house v2 S2 — skills rewrite" --kind idea
house status
```
Expected: `0001-house-v2-s2-skills-rewrite  [idea]  0/0  house v2 S2 — skills rewrite`

- [x] **Step 2: Spawn-based CLI smoke test (exit-code contract)**

```js
// cli/test/cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/house.js', import.meta.url));
const run = (cwd, ...a) => {
  try { return { out: execFileSync(process.execPath, [BIN, ...a], { cwd, encoding: 'utf8' }), code: 0 }; }
  catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status }; }
};

test('cli: exit 2 outside a repo + on unknown cmd; 0 on init/new/status; 1 on validate red', () => {
  const dir = mkdtempSync(join(tmpdir(), 'house-cli-'));
  assert.equal(run(dir, 'status').code, 2);                      // not a house repo
  assert.equal(run(dir, 'frobnicate').code, 2);                  // unknown command
  assert.equal(run(dir, 'init').code, 0);
  assert.equal(run(dir, 'new', 'Smoke slice').code, 0);
  assert.equal(run(dir, 'status').code, 0);
  assert.equal(run(dir, 'validate').code, 0);
  const man = join(dir, 'docs/slices/0001-smoke-slice/slice.yaml');
  writeFileSync(man, readFileSync(man, 'utf8').replace('state: shaping', 'state: polishing'));
  assert.equal(run(dir, 'validate').code, 1);                    // red validate = exit 1
});
```

Run: `cd cli && npm test` — Expected: PASS including the new spawn test.

- [x] **Step 3: Full-suite + validate green on the real repo**

Run: `cd cli && npm test && cd .. && house validate && house index && house render dev-state`
Expected: all tests PASS · validate exit 0 · `.house/index.json` written · dev-state regenerated with manual block intact (FIRST wrap the existing Infra/Gotchas/Process sections in `<!-- house:manual -->` markers by hand — the renderer refuses to run while content sits outside them; that refusal firing here is the feature working).

- [x] **Step 4: Write `cli/README.md`** — one screen: install (`npm link`), the command table (one line each), the three-layer contract diagram, and "the files are the contract; the CLI is a convenience."

- [x] **Step 5: Commit**

```bash
git add cli/README.md .house/events.jsonl .gitattributes .gitignore docs/slices/ docs/dev-state.md
git commit -m "feat(cli): dogfood — sdlc-skills initialized as the first house v2 repo (slice 0001 minted)"
```

---

## As-built (reconciled 2026-07-28 — branch `feat/house-v2-s1-kernel-cli`, draft [PR #6](https://github.com/argent-gnome/sdlc-skills/pull/6))

All 11 tasks were implemented in order, TDD, and every step above ran — the checkboxes are ticked as-built.
Apart from the one deviation below, every file was implemented exactly as this plan's literal code specified.

### Deviation D1 — the test script (Task 1, Step 1)

The plan specifies `scripts.test="node --test test/"`. **Under Node 26** (this machine's runtime, `v26.0.0`) a
bare directory argument to `node --test` is no longer accepted — it is resolved as a module and the run dies
with `Error: Cannot find module '…/cli/test'` before a single test executes.

**Shipped instead:** `"test": "node --test test/*.test.js"` (unquoted, so the *shell* expands the glob and
the script does not depend on Node's own `--test` glob support, which postdates the plan's Node ≥ 20 floor). It runs the whole suite correctly, and it has
the side benefit of not treating `test/helpers.js` (a fixture module, not a test file) as a test. Every
`npm test` invocation named elsewhere in this plan works unchanged. No test, assertion, or behaviour changed —
this is a runner-invocation fix, not a scope or contract change.

### Additions beyond the plan's literal file list

Two small files the plan did not enumerate, both hygiene rather than behaviour:

- **`cli/.gitignore`** containing `node_modules/`. The plan installs `js-yaml` (Task 1, Step 1) but never says
  to ignore the installed dependency; without this file the whole `node_modules/` tree shows up as committable.
- **The root `.gitignore` gained `.claude/worktrees/`** alongside the `.house/index.json` line that `house init`
  writes. This build's own worktree lives under `.claude/worktrees/`, and would otherwise show as untracked
  noise in every `git status` on the repo. `docs/health/.gitkeep` was also created — a scaffold directory the
  doctrine's doc-model expects that the repo was missing.

### Deviation D2 — the self-review found a real bug in the plan's literal `renderDevState` code

The plan's Task 10 code was implemented verbatim and its tests passed — but the shipped renderer **silently
dropped hand-authored content appended after the closing `<!-- /house:manual -->` marker**, which is precisely
the loss MF6 was folded in to prevent. Cause: the leftover probe removed the manual block *before* stripping
the generated one, leaving the generated block's lookahead with only the end-anchor to stop at, so it swallowed
everything past the closing marker. The plan's own test only covered the never-yet-rendered file, so the
mutant "delete the refusal entirely" was killed while the real bug survived.

**Resolution:** the MF6 *commitment* outranks the plan's literal code. The probe now strips the generated
block first (while the opening marker is still present to anchor its lookahead), and two tests cover the
append-after-render and wedged-between-title-and-generated cases. Verified end-to-end through the installed
binary: `house render dev-state` exits 1 and the content is still on disk.

### Other self-review fixes folded (not re-waived)

Crash paths and undefended rules found by the same pass, all fixed in
`fix(cli): close self-review findings`:

- A placeholder `tasks.yaml` with no `tasks:` key — exactly what the shaper writes at handoff per
  interpretation #1 — crashed `index`/`status`/`next`/`render` simultaneously; a stray `.DS_Store` in
  `gates/` did the same. Both now degrade gracefully.
- `execSync`'s default 1MB `maxBuffer` made a **passing** evidence command report as `exit null` and the tick
  be refused — any real `npm test`/`pytest -v` hits this. Raised to 64MB with a 15-minute timeout.
- `readEvents` threw on one torn JSONL line (an interrupted append, or a `merge=union` artifact), making the
  entire OBSERVED log unreadable. Unparseable lines are now skipped, never fatal.
- A missing `--slice` surfaced as a path `TypeError`; malformed ADR frontmatter threw out of `validate`
  instead of being reported as a finding.
- `FREE_FORM` was an enum-shaped list restated in `slices.js`, against this plan's header rule that
  `enums.yaml` is where "every other file imports it, nothing restates it." Moved to `free_form_events` in
  the schema with a subset test. The *concept* stays separate — advisory A2 is about which types `house
  event` may write, which is not the same set as which types exist.
- Rules asserted in code but undefended by the suite now have discriminating tests: the declared `verify:`
  command is actually executed (MF1's locked fallback), `GO_WITH_FIXES` passes `plan_check` (MF2 pinned on
  both sides), `required_gates.shipped`, index sort order and top-level key set, same-millisecond ULID
  ordering, the shipped-slice validate rules, id/dirname mismatch, orphan directories, `@import` mockup refs.
- `house render <anything>` rendered dev-state regardless of the subcommand; a title that slugs to nothing
  (`house new "???"`) minted the id `0001-`. Both refused now.

Test count went from the plan's 25 to **43**. No spec rule changed — every fix either restores a commitment
the plan already made or defends one the suite was not defending.

### Spec drift observed — flagged, NOT edited

Three places where the approved spec (`docs/superpowers/specs/2026-07-28-house-v2-design.md`) says something
the shipped S1 code does not do. None are S1 scope errors; each is recorded here for the S2 pass to resolve —
the spec was deliberately left unchanged rather than retro-fitted to the code:

1. **`slice.merged` vs `slice.shipped`.** Spec §3.5 names **`slice.merged`** as "the single event that flips
   spec state to shipped". The shipped `schema/enums.yaml` event list (locked at planning, plan-check approved)
   carries **`slice.shipped`** and has no `slice.merged`. The merge-triggered projection itself is S2/S3 work
   (it needs the hooks + `gh pr` facts), so nothing is broken today — but the event name has to be reconciled
   in one direction before that projection is written.
2. **The roadmap contract is not linted.** Spec §3.5 gives `docs/roadmap.md` a light contract ("backlog items
   may carry `[NNNN]` ids; `house validate` checks only that referenced ids exist"). `lib/validate.js` ships no
   roadmap rule. Already recorded as deferred in the Self-Review below; noted here so it is not lost.
3. **ADR template has no `status:`.** Spec §3.3 requires every artifact to carry both a free-text `status:` and
   the closed `state:` enum. `templates/spec.md` carries both; `templates/adr.md` carries only `state:`.

## Acceptance (S1 done when all true)

- `cd cli && npm test` green; `house validate` exit 0 on sdlc-skills.
- Deleting `.house/index.json` + `house index` reproduces it byte-identically.
- `house state` refuses: illegal transitions, missing gate records, blocking verdicts — with the exact error strings tested.
- `house task done` without passing evidence is impossible.
- `house new` minted `0001-…` in this repo; dev-state renders from the index with the manual block preserved.
- No hooks wired, no v1 skill touched, no other repo touched (scope guards held).

## Plan-check folded (2026-07-28, Fable fresh reviewer — verdict GO-WITH-FIXES)

All 8 must-fixes folded: **MF1** Task 6 test/impl reconciled (verify-fallback rule locked, re-tick guard added) ·
**MF2** `blocking_verdicts` replaced with per-gate `passing_verdicts` (fail-closed; INCONCLUSIVE ≠ pass, with a
dedicated test) · **MF3** gate-record home locked as interpretation #2 (gates/*.yaml canonical; the md files are
prose narrative) · **MF4** `--strict` implements the NEEDS-CLARIFICATION block, comment-stripped so templates
don't trip it · **MF5** `adr_states` enum added + validated · **MF6** renderer refuses when content sits outside
the manual markers (no silent drops) · **MF7** In-flight section renders · **MF8** spawn-based exit-code smoke
test + fixed-key index assertion (kills `generated_at`-style determinism drift).

Advisories folded (commitments): A2 `emit` restricted to free-form events (no second writer path) ·
A4 `merge_gate` required for `live_check` entry · A5 manifest uses `rigor` + scaffolds `base_sha`/`kickoff` ·
A6 `house gate --payload` carries structured fields (must_fix[] etc.) · A7 shebang line 1 · A8 partials
(fileURLToPath; slice.yaml template dropped; dead var removed; helpers comment fixed).
Advisories waived (recorded, not lost): A3 `blocked_on`/`gate.requested` writers → S2 (interpretation #3) ·
A8 leftovers (style-attr url() refs in the mockup grep, Done-line retro pointers, `doing` unused) → S2 backlog ·
A1 noted in interpretation #1 (tasks.yaml authored by shaper at handoff; dogfood exercises 0-task path only).

## Self-Review (author pass)

- Spec coverage: kernel §2 (three layers, one writer, determinism → Tasks 1–2, 8), identity §3.1 (Task 4), gate records §3.2/§4 (Tasks 5, 7), evidence ticks §3.4 (Task 6), projections §3.5 (Task 10), validate §4 (Task 9), dogfood §10-S1 (Task 11). Deferred per scope guards: hooks, archive, adopt, render of roadmap contract (S2/S3).
- Type consistency: `mint` returns id string (ADR path for `--adr`); `recordGate`/`setState`/`taskCmd` signatures match the dispatch table in Task 3; enums imported from one file everywhere.
- Placeholder scan: every step carries runnable code or an exact command; no TBDs.
