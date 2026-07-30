import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { mkTmpRepo, run } from './helpers.js';   // readYaml/writeYaml already imported from core.js below
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

test('validate: a shipped slice needs a merge_gate record and (above patch tier) a retro', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'shipping', {});                          // rigor defaults to 'slice'
  const dir = join(repo, 'docs/slices', id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.state = 'shipped';
  writeYaml(join(dir, 'slice.yaml'), man);
  let msgs = validate(repo, {}).map(e => e.msg).join(' | ');
  assert.match(msgs, /shipped without a merge_gate record/);
  assert.match(msgs, /shipped slice-tier without retro\.md/);

  mkdirSync(join(dir, 'gates'), { recursive: true });
  writeYaml(join(dir, 'gates/merge_gate.yaml'), { gate: 'merge_gate', verdict: 'GO' });
  writeFileSync(join(dir, 'retro.md'), '# retro\n');
  assert.deepEqual(validate(repo, {}).filter(e => e.level === 'error'), []);

  // patch tier is exempt from the retro rule ONLY — the merge_gate record is never optional
  const id2 = mint(repo, 'patching', { rigor: 'patch' });
  const dir2 = join(repo, 'docs/slices', id2);
  const man2 = readYaml(join(dir2, 'slice.yaml'));
  man2.state = 'shipped';
  writeYaml(join(dir2, 'slice.yaml'), man2);
  msgs = validate(repo, {}).map(e => e.msg).join(' | ');
  assert.match(msgs, /shipped without a merge_gate record/);
  assert.doesNotMatch(msgs, /shipped slice-tier without retro\.md/);
});

test('validate: blocked/skipped tasks need a note or reason', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'noteless', {});
  const dir = join(repo, 'docs/slices', id);
  writeYaml(join(dir, 'tasks.yaml'), { tasks: [
    { id: 't1', title: 'a', state: 'blocked', depends_on: [] },                       // no note
    { id: 't2', title: 'b', state: 'skipped', depends_on: [] },                       // no reason
    { id: 't3', title: 'c', state: 'blocked', note: 'upstream flake', depends_on: [] },
    { id: 't4', title: 'd', state: 'skipped', skip_reason: 'obsolete', depends_on: [] } ] });
  const msgs = validate(repo, {}).filter(e => /without a note\/reason/.test(e.msg)).map(e => e.msg);
  assert.equal(msgs.length, 2);                                   // only t1 and t2 — a blanket rule would flag 4
  assert.match(msgs.join(' '), /task t1: blocked/);
  assert.match(msgs.join(' '), /task t2: skipped/);
});

test('validate: id/dirname mismatch, orphan dir, and @import mockup refs each get their own error', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'fourrules', {});
  const dir = join(repo, 'docs/slices', id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.id = '9999-renamed-by-hand';                                 // manifest id no longer matches the dir
  writeYaml(join(dir, 'slice.yaml'), man);
  mkdirSync(join(dir, 'scratch'), { recursive: true });            // not in KNOWN_DIRS
  mkdirSync(join(dir, 'mockups'), { recursive: true });
  writeFileSync(join(dir, 'mockups/01.html'), '<style>@import url("https://fonts.example.com/x.css");</style>');
  const msgs = validate(repo, {}).map(e => e.msg).join(' | ');
  assert.match(msgs, /!= directory name/);
  assert.match(msgs, /orphan directory in slice dir: scratch/);
  assert.match(msgs, /external ref/);
  // and a clean slice next to it produces none of them
  mint(repo, 'tidy', {});
  assert.equal(validate(repo, {}).filter(e => e.path.includes('tidy')).length, 0);
});

test('validate: malformed frontmatter is reported, not thrown', () => {
  const repo = mkTmpRepo();
  mint(repo, 'ok', {});
  writeFileSync(join(repo, 'docs/adr/0002-bad.md'), '---\nstate: [unclosed\n---\n# ADR\n');
  let errs;
  assert.doesNotThrow(() => { errs = validate(repo, {}); });
  assert.match(errs.map(e => e.msg).join(' '), /unparseable frontmatter/);
});

test('validate: roadmap [NNNN] refs must exist; style-attr url() breaks self-containment; tasks.yaml structure', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Vali');
  writeFileSync(join(dir, 'docs/roadmap.md'), '# Roadmap\n\n- [0001] real ref\n- [0007] ghost ref\n');
  mkdirSync(join(dir, 'docs/slices/0001-vali/mockups'), { recursive: true });
  writeFileSync(join(dir, 'docs/slices/0001-vali/mockups/m.html'),
    '<div style="background: url(https://evil.example/x.png)">hi</div>');
  writeFileSync(join(dir, 'docs/slices/0001-vali/tasks.yaml'),
    'tasks:\n  - id: T1\n    title: a\n    state: todo\n    verify: "true"\n' +
    '  - id: T1\n    title: dup id\n    state: todo\n' +                       // duplicate id → error
    '  - id: T3\n    title: b\n    state: todo\n    depends_on: [T9]\n' +      // ghost dep → error
    '  - id: T4\n    title: c\n    state: todo\n    frobnicate: yes\n');       // unknown key → warning
  const r = run(dir, 'validate', '--json');
  assert.equal(r.code, 1);
  const msgs = JSON.parse(r.out).findings.map(f => `${f.level}:${f.msg}`).join('\n');
  assert.match(msgs, /error:.*\[0007\].*no such slice/);
  assert.doesNotMatch(msgs, /\[0001\].*no such slice/);
  assert.match(msgs, /error:.*style.*url\(/i);
  assert.match(msgs, /error:.*duplicate task id/);
  assert.match(msgs, /error:.*depends_on.*T9/);
  assert.match(msgs, /warning:.*unknown key.*frobnicate/);
});

test('validate: hand-written blocked_on off the pinned shape is a finding (A3 — the enum gets a consumer)', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Blocko');
  const manPath = join(dir, 'docs/slices/0001-blocko/slice.yaml');
  const man = readYaml(manPath);
  man.blocked_on = { gate: 'spec_review', vibes: 'bad' };          // stray key, missing note/since
  writeYaml(manPath, man);
  const r = run(dir, 'validate', '--json');
  assert.equal(r.code, 1);
  assert.match(JSON.parse(r.out).findings.map(f => f.msg).join('\n'), /blocked_on.*vibes/);
});

test('validate: kickoff brief — required fields, version int, tasks must exist', () => {
  const dir = mkTmpRepo();
  run(dir, 'new', 'Kicky');
  writeFileSync(join(dir, 'docs/slices/0001-kicky/tasks.yaml'),
    'tasks:\n  - id: T1\n    title: a\n    state: todo\n    verify: "true"\n');
  const manPath = join(dir, 'docs/slices/0001-kicky/slice.yaml');
  const man = readYaml(manPath);
  man.kickoff = { version: 'one', unit: '01', tasks: ['T1', 'T9'], stakes: 'low', attended: true };
  // missing scope_guards; version not an int; T9 does not exist
  writeYaml(manPath, man);                                         // helpers re-export (Task 1 Step 0)
  const r = run(dir, 'validate', '--json');
  assert.equal(r.code, 1);
  const msgs = JSON.parse(r.out).findings.map(f => f.msg).join('\n');
  assert.match(msgs, /kickoff.*scope_guards.*required/);
  assert.match(msgs, /kickoff.*version.*integer/);
  assert.match(msgs, /kickoff.*T9/);
});

test('validate --strict R-1: well-formed markers only, handoff artifacts only, --slice scoping', () => {
  const repo = mkTmpRepo();
  const a = mint(repo, 'slice a', {});
  const b = mint(repo, 'slice b', {});
  const aDir = join(repo, 'docs/slices', a);
  const bDir = join(repo, 'docs/slices', b);
  // prose/backtick mentions must NOT trip: quoted marker in backticks, fenced block, bracketless prose
  writeFileSync(join(aDir, 'spec.md'), readFileSync(join(aDir, 'spec.md'), 'utf8') +
    '\nthe `[NEEDS CLARIFICATION` literal in a code span\n' +
    '```\n[NEEDS CLARIFICATION: inside a fence]\n```\n' +
    'prose about NEEDS CLARIFICATION without brackets\n');
  // retro.md discussing a real marker must NOT trip (not a handoff artifact)
  writeFileSync(join(aDir, 'retro.md'), '# Retro\n\n[NEEDS CLARIFICATION: retros may discuss markers]\n');
  assert.deepEqual(validate(repo, { strict: true }).filter(e => e.level === 'error'), []);
  // a real well-formed marker in slice b's spec trips repo-wide strict…
  writeFileSync(join(bDir, 'spec.md'),
    readFileSync(join(bDir, 'spec.md'), 'utf8') + '\n[NEEDS CLARIFICATION: which auth?]\n');
  assert.match(validate(repo, { strict: true }).map(e => e.msg).join(' '), /NEEDS CLARIFICATION/);
  // …but NOT a strict run scoped to slice a
  assert.deepEqual(validate(repo, { strict: true, slice: a }).filter(e => e.level === 'error'), []);
  // and scoped to slice b it still trips, naming b's spec
  const scoped = validate(repo, { strict: true, slice: b }).filter(e => e.level === 'error');
  assert.equal(scoped.length, 1);
  assert.match(scoped[0].path, new RegExp(b));
  // plan.md is a handoff artifact too (A3)
  writeFileSync(join(aDir, 'plan.md'), '# Plan\n\n[NEEDS CLARIFICATION: sequencing?]\n');
  assert.match(validate(repo, { strict: true, slice: a }).map(e => e.msg).join(' '), /NEEDS CLARIFICATION/);
});

test('validate --slice: unknown id fails closed, never green', () => {
  const repo = mkTmpRepo();
  mint(repo, 'real', {});
  assert.throws(() => validate(repo, { slice: '0099-typo' }), /unknown slice: 0099-typo/);
  assert.throws(() => validate(repo, { slice: true }), /--slice needs a slice id/);
});

test('validate R-2: manifest-approved artifact must have agreeing frontmatter; missing state is a warning', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'drift', {});
  const dir = join(repo, 'docs/slices', id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.artifacts = { spec: { state: 'approved', updated: '2026-07-29' } };
  writeYaml(join(dir, 'slice.yaml'), man);
  // minted spec.md frontmatter says state: draft → the 0002 drift, now an error naming both records
  const drifted = validate(repo, {}).filter(e => e.level === 'error');
  assert.equal(drifted.length, 1);
  assert.match(drifted[0].msg, /approved in slice\.yaml.*frontmatter says draft/);
  // frontmatter agreeing → clean
  const spec = readFileSync(join(dir, 'spec.md'), 'utf8');
  writeFileSync(join(dir, 'spec.md'), spec.replace('state: draft', 'state: approved'));
  assert.deepEqual(validate(repo, {}).filter(e => e.level === 'error'), []);
  // manifest approved + frontmatter done (past the boundary) also clean — boundary check, not equality (A2)
  writeFileSync(join(dir, 'spec.md'), spec.replace('state: draft', 'state: done'));
  assert.deepEqual(validate(repo, {}).filter(e => e.level === 'error'), []);
  // deleting the frontmatter does not evade the check — it degrades to a warning finding
  writeFileSync(join(dir, 'spec.md'), '# Spec — no frontmatter at all\n');
  const evaded = validate(repo, {});
  assert.deepEqual(evaded.filter(e => e.level === 'error'), []);
  assert.match(evaded.filter(e => e.level === 'warning').map(e => e.msg).join(' '), /no frontmatter state/);
});

test('validate --strict [0007] R-1: a fence run mid-line is not a fence', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'nested fence', {});
  const dir = join(repo, 'docs/slices', id);
  // Reproduces docs/slices/0003-…/plan.md lines 48 / 58 / 84: a real ```js fence whose body holds
  // two three-backtick runs mid-line inside a JS string literal, with marker text between them.
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n' +
    '```js\n' +
    "    '```\\n[NEEDS CLARIFICATION: inside a string literal]\\n```\\n' +\n" +
    '    const x = 1;\n' +
    '```\n\n' +
    'ordinary prose after the fence\n');
  assert.deepEqual(validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error'), []);
});

test('validate --strict [0007] R-1: an odd mid-line run count does not invert later fences', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'parity', {});
  const dir = join(repo, 'docs/slices', id);
  // ONE mid-line run — the odd count that flips parity for the rest of the file under the old regex.
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n' +
    '```js\n' +
    "    const fence = '```';\n" +
    '```\n\n' +
    'prose between the two blocks\n\n' +
    '```\n' +
    '[NEEDS CLARIFICATION: quoted in a second block]\n' +
    '```\n');
  assert.deepEqual(validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error'), []);
});

test('validate --strict [0007] R-1: tilde fences are stripped', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'tilde', {});
  const dir = join(repo, 'docs/slices', id);
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n~~~\n[NEEDS CLARIFICATION: inside a tilde fence]\n~~~\n');
  assert.deepEqual(validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error'), []);
});

test('validate --strict [0007] R-2: a comment opener quoted in a fence does not pair forward', () => {
  const repo = mkTmpRepo();
  const id = mint(repo, 'comment order', {});
  const dir = join(repo, 'docs/slices', id);
  // The trailing complete comment is load-bearing: the comment regex is non-greedy and needs a
  // closing --> to pair with. Without one, the quoted opener strips nothing and the bug cannot fire.
  writeFileSync(join(dir, 'plan.md'),
    '# Plan\n\n' +
    '```html\n' +
    '<!-- an opener with no close inside this fence\n' +
    '```\n\n' +
    '[NEEDS CLARIFICATION: must still be seen]\n\n' +
    '<!-- an ordinary complete comment -->\n');
  const errs = validate(repo, { strict: true, slice: id }).filter(e => e.level === 'error');
  assert.equal(errs.length, 1);
  assert.match(errs[0].path, /plan\.md$/);
});
