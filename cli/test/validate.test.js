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
