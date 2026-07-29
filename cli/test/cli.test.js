import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkTmpRepo } from './helpers.js';

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

test('validate --json: machine-readable findings', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Val');
  writeFileSync(join(dir, 'docs/slices/0001-val/stray.txt'), 'orphan');
  const r = run(dir, 'validate', '--json');
  assert.equal(r.code, 1);
  const j = JSON.parse(r.out);
  assert.ok(j.findings.some(f => f.msg.includes('orphan file')));
  assert.equal(typeof j.errors, 'number');
});

test('cli: --version prints package.json version, exit 0, works outside a repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'house-ver-'));            // NOT a house repo (R-1)
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  const r = run(dir, '--version');
  assert.equal(r.code, 0);
  assert.equal(r.out, `${pkg.version}\n`);
  const repo = mkTmpRepo();                                         // house-tracked repo (R-1 scenario 1;
  const r2 = run(repo, '--version');                                //  plan-check must-fix)
  assert.equal(r2.code, 0);
  assert.equal(r2.out, `${pkg.version}\n`);
  assert.equal(run(dir, 'frobnicate').code, 2);                     // unknown-cmd path unchanged (R-2)
});

test('unknown flags fail closed (R-5)', () => {
  const repo = mkTmpRepo();
  const bad = run(repo, 'gate', 'merge_gate', '--slice', 'x', '--verdict', 'GO', '--actro', 'reviewer');
  assert.equal(bad.code, 1);
  assert.match(bad.out, /unknown flag --actro/);
  assert.equal(run(repo, 'validate', '--strict').code, 0);          // known flags still parse
});
