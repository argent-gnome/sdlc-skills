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
