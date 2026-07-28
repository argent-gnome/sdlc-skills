import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init, mint, recordGate, emit, taskCmd, setState } from '../lib/slices.js';
import { readYaml, writeYaml, readEvents, parseFrontmatter } from '../lib/core.js';
import { mkTmpRepo } from './helpers.js';

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

test('setState: shipped also demands the merge_gate record — the rigor dial can never skip it', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'thing8', { rigor: 'patch' });             // lowest non-decision tier
  recordGate(repo, 'spec_review', { slice: id, verdict: 'approved', by: 'human' });
  recordGate(repo, 'plan_check', { slice: id, verdict: 'GO', by: 'agent' });
  setState(repo, id, 'ready', {}); setState(repo, id, 'building', {}); setState(repo, id, 'gating', {});
  assert.throws(() => setState(repo, id, 'shipped', {}), /missing gate record for 'shipped': merge_gate/);
  recordGate(repo, 'merge_gate', { slice: id, verdict: 'GO', by: 'reviewer' });
  setState(repo, id, 'shipped', {});
  assert.equal(readYaml(join(repo, `docs/slices/${id}/slice.yaml`)).state, 'shipped');
});
