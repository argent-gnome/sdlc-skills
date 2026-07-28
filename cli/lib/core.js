import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastTime = 0, lastRand = null;
export function ulid(now = Date.now()) {
  let t = now, time = '';
  for (let i = 9; i >= 0; i--) { time = B32[t % 32] + time; t = Math.floor(t / 32); }
  let rand;
  if (now === lastTime && lastRand) {            // same-ms monotonicity: increment prior randomness
    rand = [...lastRand];
    for (let i = 15; i >= 0; i--) { const v = B32.indexOf(rand[i]) + 1; if (v < 32) { rand[i] = B32[v]; break; } rand[i] = B32[0]; }
  } else {
    rand = Array.from({ length: 16 }, () => B32[Math.floor(Math.random() * 32)]);
  }
  lastTime = now; lastRand = rand;
  return time + rand.join('');
}

export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { data: null, body: text };
  return { data: yaml.load(m[1]) ?? {}, body: text.slice(m[0].length) };
}
export function serializeFrontmatter(data, body) {
  return `---\n${yaml.dump(data, { lineWidth: 100 })}---\n${body}`;
}

export const readYaml = (p) => yaml.load(readFileSync(p, 'utf8'));
export const writeYaml = (p, data) => writeFileSync(p, yaml.dump(data, { lineWidth: 100 }));

export function loadEnumsPath() { return fileURLToPath(new URL('../schema/enums.yaml', import.meta.url)); }

export function repoRoot(from = process.cwd()) {
  let dir = resolve(from);
  while (true) {
    if (existsSync(join(dir, '.house'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function appendEvent(root, event, fields) {
  const { event_types } = loadEnums();
  if (!event_types.includes(event)) throw new Error(`unknown event type: ${event}`);
  const line = JSON.stringify({ id: ulid(), ts: new Date().toISOString(), event, ...fields });
  appendFileSync(join(root, '.house', 'events.jsonl'), line + '\n');
  return JSON.parse(line);
}
export function readEvents(root) {
  const raw = readFileSync(join(root, '.house', 'events.jsonl'), 'utf8');
  return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
export function loadEnums() {
  return readYaml(loadEnumsPath());               // fileURLToPath — URL.pathname breaks on paths with spaces
}
