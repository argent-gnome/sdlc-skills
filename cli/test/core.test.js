import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ulid, parseFrontmatter, serializeFrontmatter, repoRoot, appendEvent, readEvents } from '../lib/core.js';
import { mkTmpRepo } from './helpers.js';

test('ulid: 26 chars, Crockford base32, monotonic-ish lexical order', () => {
  const a = ulid(), b = ulid();
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.ok(b >= a);
});

test('ulid: same-millisecond ids are STRICTLY increasing (a purely random suffix would not be)', () => {
  // pin the clock so both ids share a timestamp prefix — this is the case where a naive
  // random-suffix implementation orders events wrongly ~50% of the time in the same tick
  const t = 1753660800000;
  const ids = Array.from({ length: 50 }, () => ulid(t));
  assert.equal(new Set(ids).size, 50, 'same-ms ids must be unique');
  assert.deepEqual(ids, [...ids].sort(), 'same-ms ids must sort into emission order');
  assert.equal(ids[0].slice(0, 10), ids[49].slice(0, 10), 'same-ms ids share the time prefix');
  for (const id of ids) assert.match(id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.ok(ulid(t + 1) > ids[49], 'a later millisecond still sorts after');
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
