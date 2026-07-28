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
