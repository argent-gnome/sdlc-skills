#!/usr/bin/env node
// cli/bin/house.js — the shebang above MUST be line 1 of the file or `npm link` execution breaks
import { readFileSync } from 'node:fs';
import { repoRoot } from '../lib/core.js';
import * as slices from '../lib/slices.js';
import * as derive from '../lib/derive.js';
import * as hooks from '../lib/hooks.js';
import { validate } from '../lib/validate.js';

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === '--version') {                        // pre-dispatch: must work outside a house repo
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}
const args = {};                                  // --k v / --k / positionals
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const k = rest[i].slice(2);
    if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) { args[k] = rest[++i]; } else args[k] = true;
  } else pos.push(rest[i]);
}
// R-5: a silently-swallowed flag is the failure class this kernel exists to refuse.
// Over-permitting here is harmless; under-permitting breaks a suite test — the 67-test net is the check.
const FLAGS = {
  init: [], 'new': ['kind', 'rigor', 'appetite', 'adr', 'actor'],
  event: ['slice', 'payload', 'actor'],
  gate: ['slice', 'verdict', 'actor', 'by', 'payload', 'notes'],
  task: ['slice', 'evidence-cmd', 'note', 'skip-reason', 'actor'],
  state: ['actor', 'note'], block: ['gate', 'note', 'actor'], unblock: ['note', 'actor'],
  artifact: ['reason', 'note', 'actor'], unit: ['title', 'note', 'result', 'actor'],
  pr: ['set', 'base-sha', 'actor'], log: ['slice', 'n', 'json'], status: ['json', 'slice'],
  list: ['json'], next: ['slice', 'n', 'json'], index: [],
  validate: ['strict', 'json', 'slice'], render: [],
  // NO `hook` key (A4): hooks are advisory-only and never exit non-zero (ADR-0004, bin/house.js:51-53) —
  // an absent key skips the guard entirely, which is the exemption, on purpose.
};
if (FLAGS[cmd]) for (const k of Object.keys(args)) if (!FLAGS[cmd].includes(k)) {
  console.error(`house ${cmd}: unknown flag --${k}`);
  process.exit(1);
}
const need = (root) => { if (!root) { console.error('not a house repo — run `house init`'); process.exit(2); } return root; };
const root = cmd === 'init' ? process.cwd() : repoRoot();

const commands = {
  init:    () => { slices.init(process.cwd()); console.log('house: initialized'); },
  new:     () => console.log(slices.mint(need(root), pos.join(' '), args)),
  event:   () => slices.emit(need(root), pos[0], args),
  gate:    () => slices.recordGate(need(root), pos[0], args),
  task:    () => slices.taskCmd(need(root), pos[0], pos[1], args),
  state:   () => slices.setState(need(root), pos[0], pos[1], args),
  block:   () => slices.block(need(root), pos[0], args),
  unblock: () => slices.unblock(need(root), pos[0], args),
  artifact: () => slices.artifactCmd(need(root), pos[0], pos[1], pos[2], args),
  unit:    () => { const r = slices.unitCmd(need(root), pos[0], pos[1], pos[2], args); if (r) console.log(r); },
  pr:      () => slices.prCmd(need(root), pos[0], args),
  log:     () => console.log(derive.log(need(root), args)),
  status:  () => console.log(derive.status(need(root), args, pos[0] ?? null)),
  list:    () => console.log(derive.list(need(root), args)),
  next:    () => console.log(derive.next(need(root), args)),
  index:   () => derive.writeIndex(need(root)),
  validate: () => {
    const errs = validate(need(root), args);
    if (args.json) console.log(JSON.stringify({ errors: errs.filter(e => e.level === 'error').length, findings: errs }, null, 2));
    else errs.forEach(e => console.error(`${e.level}: ${e.path}: ${e.msg}`));
    process.exit(errs.some(e => e.level === 'error') ? 1 : 0);
  },
  render:  () => { if (pos[0] !== 'dev-state') throw new Error('usage: house render dev-state'); derive.renderDevState(need(root)); },
  // NOT need(root): a hook fired outside a house repo exits 0 with no output, and a hook never
  // exits non-zero at all — advisory-only (ADR-0004)
  hook: () => {
    let stdin = '';
    try { stdin = readFileSync(0, 'utf8'); } catch { /* TTY / no stdin (EAGAIN) — a hook never exits non-zero (A6) */ }
    const out = hooks.run(repoRoot(), pos[0], stdin);
    if (out) console.log(out);
  },
};
if (!commands[cmd]) { console.error(`usage: house <${Object.keys(commands).join('|')}>`); process.exit(2); }
try { commands[cmd](); } catch (e) { console.error(`house ${cmd}: ${e.message}`); process.exit(1); }
