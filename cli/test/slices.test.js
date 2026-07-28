import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init, mint, recordGate, emit, taskCmd, setState } from '../lib/slices.js';
import { readYaml, writeYaml, readEvents, parseFrontmatter, loadEnums } from '../lib/core.js';
import { mkTmpRepo, run } from './helpers.js';   // readYaml/writeYaml already imported from core.js above

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

test("task done: a declared verify: IS executed when no --evidence-cmd is passed (and can refuse the tick)", () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'verifyfallback', {});
  writeYaml(join(repo, `docs/slices/${id}/tasks.yaml`), { tasks: [
    { id: 't1', title: 'declared proof fails', state: 'todo', verify: 'exit 7', depends_on: [] },
    { id: 't2', title: 'declared proof passes', state: 'todo', verify: 'echo proven', depends_on: [] } ] });
  // an implementation that ignored task.verify would tick t1 happily — or refuse t2 for lack of a command
  assert.throws(() => taskCmd(repo, 'done', 't1', { slice: id }), /evidence command failed \(exit 7\)/);
  assert.equal(readYaml(join(repo, `docs/slices/${id}/tasks.yaml`)).tasks[0].state, 'todo');
  taskCmd(repo, 'done', 't2', { slice: id });
  const t2 = readYaml(join(repo, `docs/slices/${id}/tasks.yaml`)).tasks[1];
  assert.equal(t2.state, 'done');
  assert.equal(t2.evidence.cmd, 'echo proven');                    // the DECLARED command is what ran
  assert.equal(t2.evidence.summary, 'proven');
});

test('task done: a passing command with megabytes of output still ticks (real suites are noisy)', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'noisy', {});
  writeYaml(join(repo, `docs/slices/${id}/tasks.yaml`), { tasks: [{ id: 't1', title: 'a', state: 'todo', depends_on: [] }] });
  // ~2MB of stdout — over execSync's 1MB default, which would report a PASSING command as "exit null"
  taskCmd(repo, 'done', 't1', { slice: id, 'evidence-cmd': 'node -e "process.stdout.write(\'x\'.repeat(2e6)+\'\\ndone\\n\')"' });
  const t = readYaml(join(repo, `docs/slices/${id}/tasks.yaml`)).tasks[0];
  assert.equal(t.state, 'done');
  assert.equal(t.evidence.summary, 'done');
});

test('setState: GO_WITH_FIXES is a passing plan_check verdict (MF2 pinned on both sides)', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'gwf', {});
  recordGate(repo, 'spec_review', { slice: id, verdict: 'approved', by: 'human' });
  recordGate(repo, 'plan_check', { slice: id, verdict: 'GO_WITH_FIXES', by: 'agent' });
  setState(repo, id, 'ready', {});                                 // must NOT throw
  assert.equal(readYaml(join(repo, `docs/slices/${id}/slice.yaml`)).state, 'ready');
});

test('commands that need a slice say so instead of throwing a path TypeError', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'needslice', {});
  assert.throws(() => recordGate(repo, 'plan_check', { verdict: 'GO' }), /--slice is required/);
  assert.throws(() => taskCmd(repo, 'done', 't1', {}), /--slice is required/);
  assert.throws(() => recordGate(repo, 'plan_check', { slice: 'nope', verdict: 'GO' }), /no such slice/);
  assert.throws(() => taskCmd(repo, 'done', 't1', { slice: id }), /no tasks\.yaml/);
});

test('mint: a title with no alphanumerics is refused rather than minting a danglingid', () => {
  const repo = mkTmpRepo();
  assert.throws(() => mint(repo, '???', {}), /at least one alphanumeric/);
  assert.throws(() => mint(repo, '', {}), /title is required/);
});

test('free-form event list is a subset of the event-type enum (single source of truth)', () => {
  const { event_types, free_form_events } = loadEnums();
  assert.ok(free_form_events.length > 0);
  for (const e of free_form_events) assert.ok(event_types.includes(e), `${e} is not a known event type`);
  for (const owned of ['slice.created', 'slice.state_changed', 'gate.recorded', 'task.done', 'task.blocked'])
    assert.ok(!free_form_events.includes(owned), `${owned} must stay owned by its dedicated command`);
});

test('block/unblock: writes pinned shape, gate record with passing verdict auto-clears', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Blocky');
  assert.equal(run(dir, 'block', '0001-blocky', '--gate', 'spec_review', '--note', 'awaiting user').code, 0);
  let man = readYaml(join(dir, 'docs/slices/0001-blocky/slice.yaml'));
  assert.deepEqual(Object.keys(man.blocked_on).sort(), ['gate', 'note', 'since']);   // shape pinned
  assert.equal(man.blocked_on.gate, 'spec_review');
  // a NON-passing verdict must NOT clear the block
  run(dir, 'gate', 'spec_review', '--slice', '0001-blocky', '--verdict', 'changes_requested');
  man = readYaml(join(dir, 'docs/slices/0001-blocky/slice.yaml'));
  assert.ok(man.blocked_on);
  // a passing verdict clears it and emits slice.unblocked — no hand-edit anywhere (spec R-2 scenario)
  run(dir, 'gate', 'spec_review', '--slice', '0001-blocky', '--verdict', 'approved');
  man = readYaml(join(dir, 'docs/slices/0001-blocky/slice.yaml'));
  assert.equal(man.blocked_on, null);
  const ev = readFileSync(join(dir, '.house/events.jsonl'), 'utf8');
  assert.match(ev, /"gate\.requested"/);
  assert.match(ev, /"slice\.unblocked"/);
});

test('unblock: manual clear; refuses when not blocked; block refuses unknown gate', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Blocky');
  assert.equal(run(dir, 'block', '0001-blocky', '--gate', 'nonsense').code, 1);
  assert.equal(run(dir, 'unblock', '0001-blocky').code, 1);        // not blocked — refuse
  run(dir, 'block', '0001-blocky', '--gate', 'merge_gate');
  assert.equal(run(dir, 'unblock', '0001-blocky', '--note', 'user said proceed').code, 0);
  const man = readYaml(join(dir, 'docs/slices/0001-blocky/slice.yaml'));
  assert.equal(man.blocked_on, null);
});

test('artifact: walks the state machine, refuses illegal jumps, records skip reasons', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Arty');
  // spec R-2 scenario: todo → approved is an illegal jump, named with the legal transitions
  const bad = run(dir, 'artifact', '0001-arty', 'spec', 'approved');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /illegal transition/);
  assert.equal(run(dir, 'artifact', '0001-arty', 'spec', 'draft').code, 0);
  assert.equal(run(dir, 'artifact', '0001-arty', 'spec', 'awaiting_review').code, 0);
  assert.equal(run(dir, 'artifact', '0001-arty', 'spec', 'approved').code, 0);
  const man = readYaml(join(dir, 'docs/slices/0001-arty/slice.yaml'));
  assert.equal(man.artifacts.spec.state, 'approved');
  assert.equal(run(dir, 'artifact', '0001-arty', 'mockups', 'skipped').code, 1);   // skip needs --reason
  assert.equal(run(dir, 'artifact', '0001-arty', 'mockups', 'skipped', '--reason', 'CLI slice, no UI').code, 0);
  assert.match(readFileSync(join(dir, '.house/events.jsonl'), 'utf8'), /"artifact\.state_changed"/);
});

test('unit: dispatch allocates NN + report skeleton; heartbeat appends; finalize records 4-state', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Unity');
  const d = run(dir, 'unit', '0001-unity', 'dispatch', '--title', 'CLI enablers');
  assert.equal(d.code, 0);
  const man1 = readYaml(join(dir, 'docs/slices/0001-unity/slice.yaml'));
  assert.equal(man1.units.length, 1);
  assert.equal(man1.units[0].id, '01');
  assert.equal(man1.units[0].state, 'building');
  const report = join(dir, 'docs/slices/0001-unity/units/01-report.md');
  assert.match(readFileSync(report, 'utf8'), /never DONE/);        // fail-closed pending marker
  assert.equal(run(dir, 'unit', '0001-unity', 'heartbeat', '01', '--note', 'task 2/5 done').code, 0);
  assert.match(readFileSync(report, 'utf8'), /task 2\/5 done/);
  // finalize requires a valid 4-state result
  assert.equal(run(dir, 'unit', '0001-unity', 'finalize', '01', '--result', 'SHRUG').code, 1);
  assert.equal(run(dir, 'unit', '0001-unity', 'finalize', '01', '--result', 'DONE', '--note', 'all green').code, 0);
  const man2 = readYaml(join(dir, 'docs/slices/0001-unity/slice.yaml'));
  assert.equal(man2.units[0].state, 'finalized');
  assert.equal(man2.units[0].result, 'DONE');
  const ev = readFileSync(join(dir, '.house/events.jsonl'), 'utf8');
  assert.match(ev, /"unit\.dispatched"/); assert.match(ev, /"unit\.heartbeat"/); assert.match(ev, /"unit\.report"/);
  // and `house event` may no longer forge unit lifecycle events
  assert.equal(run(dir, 'event', 'unit.report', '--slice', '0001-unity').code, 1);
});
