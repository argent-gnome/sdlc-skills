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
