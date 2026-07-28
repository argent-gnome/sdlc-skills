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
