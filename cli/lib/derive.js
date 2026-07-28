import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readYaml } from './core.js';

export function buildIndex(root) {
  const dir = join(root, 'docs/slices');
  const slices = (existsSync(dir) ? readdirSync(dir) : [])
    .filter(d => existsSync(join(dir, d, 'slice.yaml'))).sort()
    .map(d => {
      const man = readYaml(join(dir, d, 'slice.yaml'));
      const tasksFile = join(dir, d, 'tasks.yaml');
      const tasks = existsSync(tasksFile) ? readYaml(tasksFile).tasks : [];
      const counted = tasks.filter(t => t.state !== 'skipped');
      const gatesDir = join(dir, d, 'gates');
      const gates = {};
      if (existsSync(gatesDir)) for (const g of readdirSync(gatesDir).sort())
        gates[g.replace(/\.yaml$/, '')] = readYaml(join(gatesDir, g)).verdict;
      return { id: man.id, title: man.title, kind: man.kind, rigor: man.rigor, state: man.state,
        blocked_on: man.blocked_on, branch: man.branch, pr: man.pr, units: man.units ?? [],
        progress: { done: counted.filter(t => t.state === 'done').length, total: counted.length },
        gates, tasks };
    });
  return { schema_version: 1, slices };
}
export function writeIndex(root) {
  writeFileSync(join(root, '.house/index.json'), JSON.stringify(buildIndex(root), null, 2) + '\n');
}
export function status(root, args) {
  const idx = buildIndex(root);
  if (args.json) return JSON.stringify({ slices: idx.slices.map(({ tasks, ...s }) => s) }, null, 2);
  return idx.slices.map(s => `${s.id}  [${s.state}]  ${s.progress.done}/${s.progress.total}  ${s.title}` +
    (s.blocked_on ? `  ⛔ ${s.blocked_on.gate ?? s.blocked_on}` : '')).join('\n') || '(no slices)';
}
export const list = status;                        // same projection; list keeps tasks out either way
export function next(root, args) {
  const idx = buildIndex(root);
  const ready = idx.slices.flatMap(s => (s.tasks ?? [])
    .filter(t => t.state === 'todo' && (t.depends_on ?? []).every(d => s.tasks.find(x => x.id === d)?.state === 'done'))
    .map(t => ({ slice: s.id, id: t.id, title: t.title })));
  return args.json ? JSON.stringify(ready, null, 2) : ready.map(t => `${t.slice} ${t.id} ${t.title}`).join('\n') || '(nothing ready)';
}

export function renderDevState() { throw new Error('not implemented'); }   // Task 10
