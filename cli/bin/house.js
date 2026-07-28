#!/usr/bin/env node
// cli/bin/house.js — the shebang above MUST be line 1 of the file or `npm link` execution breaks
import { repoRoot } from '../lib/core.js';
import * as slices from '../lib/slices.js';
import * as derive from '../lib/derive.js';
import { validate } from '../lib/validate.js';

const [cmd, ...rest] = process.argv.slice(2);
const args = {};                                  // --k v / --k / positionals
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const k = rest[i].slice(2);
    if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) { args[k] = rest[++i]; } else args[k] = true;
  } else pos.push(rest[i]);
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
  status:  () => console.log(derive.status(need(root), args)),
  list:    () => console.log(derive.list(need(root), args)),
  next:    () => console.log(derive.next(need(root), args)),
  index:   () => derive.writeIndex(need(root)),
  validate: () => { const errs = validate(need(root), args); errs.forEach(e => console.error(`${e.level}: ${e.path}: ${e.msg}`));
                    process.exit(errs.some(e => e.level === 'error') ? 1 : 0); },
  render:  () => derive.renderDevState(need(root)),
};
if (!commands[cmd]) { console.error(`usage: house <${Object.keys(commands).join('|')}>`); process.exit(2); }
try { commands[cmd](); } catch (e) { console.error(`house ${cmd}: ${e.message}`); process.exit(1); }
