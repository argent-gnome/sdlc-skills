import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init, mint } from '../lib/slices.js';
import { readYaml, readEvents, parseFrontmatter } from '../lib/core.js';
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
