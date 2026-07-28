import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mkTmpRepo } from './helpers.js';
import { mint, recordGate } from '../lib/slices.js';
import { writeYaml } from '../lib/core.js';
import { buildIndex, writeIndex, status, next, renderDevState } from '../lib/derive.js';

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
