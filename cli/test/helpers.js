import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export { readYaml, writeYaml } from '../lib/core.js';     // so tests never hand-roll js-yaml

export function mkTmpRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'house-'));
  mkdirSync(join(dir, '.house'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'slices'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'adr'), { recursive: true });
  writeFileSync(join(dir, '.house', 'events.jsonl'), '');
  writeFileSync(join(dir, '.house', 'config.yaml'), 'schema_version: 1\n');
  return dir;
}

const BIN = fileURLToPath(new URL('../bin/house.js', import.meta.url));
export const run = (cwd, ...a) => {
  const opts = typeof a.at(-1) === 'object' ? a.pop() : {};   // run(dir, 'hook', 'x', {input: '…'})
  try { return { out: execFileSync(process.execPath, [BIN, ...a], { cwd, encoding: 'utf8', ...opts }), code: 0 }; }
  catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status }; }
};
