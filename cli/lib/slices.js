import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readYaml, writeYaml, appendEvent, loadEnums, parseFrontmatter } from './core.js';

function ensureLine(file, line) {
  const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!cur.includes(line)) appendFileSync(file, (cur && !cur.endsWith('\n') ? '\n' : '') + line + '\n');
}

export function init(dir) {
  mkdirSync(join(dir, '.house'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'slices'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'adr'), { recursive: true });
  if (!existsSync(join(dir, '.house/events.jsonl'))) writeFileSync(join(dir, '.house/events.jsonl'), '');
  if (!existsSync(join(dir, '.house/config.yaml'))) writeYaml(join(dir, '.house/config.yaml'), { schema_version: 1 });
  ensureLine(join(dir, '.gitattributes'), '.house/events.jsonl merge=union');
  ensureLine(join(dir, '.gitignore'), '.house/index.json');
}

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const pad = (n) => String(n).padStart(4, '0');

function nextOrdinal(dir, re) {
  if (!existsSync(dir)) return 1;
  const nums = readdirSync(dir).map(f => re.exec(f)).filter(Boolean).map(m => parseInt(m[1], 10));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export function mint(root, title, opts = {}) {
  if (!title) throw new Error('a title is required');
  const tpl = (name) => readFileSync(new URL(`../templates/${name}`, import.meta.url), 'utf8');
  if (opts.adr) {
    const dir = join(root, 'docs/adr');
    const id = pad(nextOrdinal(dir, /^(\d{4})-/));
    const file = join(dir, `${id}-${slug(title)}.md`);
    writeFileSync(file, tpl('adr.md').replaceAll('{{ID}}', id).replaceAll('{{TITLE}}', title)
      .replaceAll('{{DATE}}', new Date().toISOString().slice(0, 10)));
    appendEvent(root, 'artifact.written', { actor: opts.actor ?? 'shaper', payload: { kind: 'adr', path: file } });
    return file;
  }
  const kind = opts.kind ?? 'slice';
  const { kinds } = loadEnums();
  if (!kinds.includes(kind)) throw new Error(`unknown kind: ${kind}`);
  const dir = join(root, 'docs/slices');
  const id = `${pad(nextOrdinal(dir, /^(\d{4})-/))}-${slug(title)}`;
  mkdirSync(join(dir, id));                        // mkdir IS the allocator lock — throws if raced
  const state = kind === 'idea' ? 'idea' : 'shaping';
  const man = { schema_version: 1, id, title, kind, rigor: opts.rigor ?? 'slice', state, blocked_on: null,
    appetite: opts.appetite ?? null, created: new Date().toISOString().slice(0, 10),
    branch: `slice/${id}`, base_sha: null, pr: null, adrs: [], artifacts: {}, units: [], kickoff: null };
  writeYaml(join(dir, id, 'slice.yaml'), man);
  writeFileSync(join(dir, id, 'spec.md'), tpl('spec.md').replaceAll('{{ID}}', id).replaceAll('{{TITLE}}', title));
  appendEvent(root, 'slice.created', { slice: id, actor: opts.actor ?? 'shaper', payload: { kind, rigor: man.rigor } });
  return id;
}
