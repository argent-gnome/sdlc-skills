import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { readYaml, loadEnums, parseFrontmatter } from './core.js';

// plan-check.md / merge-gate.md are OPTIONAL prose narratives; the machine-read verdict is always gates/*.yaml
const KNOWN = new Set(['slice.yaml', 'spec.md', 'plan.md', 'plan-check.md', 'tasks.yaml', 'retro.md', 'merge-gate.md']);
const KNOWN_DIRS = new Set(['gates', 'units', 'mockups', 'research']);

export function validate(root, args) {
  const errs = [];
  const err = (path, msg, level = 'error') => errs.push({ level, path, msg });
  const enums = loadEnums();
  const slicesDir = join(root, 'docs/slices');
  if (!existsSync(slicesDir)) return errs;
  for (const d of readdirSync(slicesDir).sort()) {
    const dir = join(slicesDir, d);
    if (!statSync(dir).isDirectory()) continue;
    const manFile = join(dir, 'slice.yaml');
    if (!existsSync(manFile)) { err(dir, 'slice dir without slice.yaml (orphan directory)'); continue; }
    const man = readYaml(manFile);
    if (!enums.slice_states.includes(man.state)) err(manFile, `unknown state: ${man.state}`);
    if (man.id !== d) err(manFile, `manifest id '${man.id}' != directory name '${d}'`);
    for (const [name, a] of Object.entries(man.artifacts ?? {})) {
      if (a.state && !enums.artifact_states.includes(a.state)) err(manFile, `artifact '${name}': unknown state ${a.state}`);
      if (a.state === 'skipped' && !a.skip_reason && !a.reason) err(manFile, `artifact '${name}' skip without reason`);
    }
    if (args.strict) for (const f of readdirSync(dir).filter(f => extname(f) === '.md')) {
      const text = readFileSync(join(dir, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '');   // template's marker lives in a comment
      if (text.includes('[NEEDS CLARIFICATION')) err(join(dir, f), 'NEEDS CLARIFICATION marker present — handoff blocked (--strict)');
    }
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (!KNOWN_DIRS.has(f)) err(p, `orphan directory in slice dir: ${f}`); }
      else if (!KNOWN.has(f)) err(p, `orphan file in slice dir: ${f}`);
    }
    const mockups = join(dir, 'mockups');
    if (existsSync(mockups)) for (const f of readdirSync(mockups).filter(f => extname(f) === '.html')) {
      const html = readFileSync(join(mockups, f), 'utf8');
      if (/\b(?:src|href)\s*=\s*["']https?:\/\//i.test(html) || /@import\s+url\(/i.test(html))
        err(join(mockups, f), 'mockup has external ref — self-containment contract violated');
    }
    const tasksFile = join(dir, 'tasks.yaml');
    if (existsSync(tasksFile)) for (const t of readYaml(tasksFile).tasks ?? []) {
      if (!enums.task_states.includes(t.state)) err(tasksFile, `task ${t.id}: unknown state ${t.state}`);
      if (t.state === 'done' && !t.evidence) err(tasksFile, `task ${t.id}: done without evidence`);
      if ((t.state === 'blocked' || t.state === 'skipped') && !t.note && !t.skip_reason)
        err(tasksFile, `task ${t.id}: ${t.state} without a note/reason`);
    }
    if (man.state === 'shipped') {
      if (!existsSync(join(dir, 'gates/merge_gate.yaml'))) err(dir, 'shipped without a merge_gate record');
      if (man.rigor !== 'patch' && !existsSync(join(dir, 'retro.md'))) err(dir, 'shipped slice-tier without retro.md');
    }
  }
  const adrDir = join(root, 'docs/adr');
  if (existsSync(adrDir)) for (const f of readdirSync(adrDir).filter(f => f.endsWith('.md'))) {
    const { data } = parseFrontmatter(readFileSync(join(adrDir, f), 'utf8'));
    if (data?.state && !enums.adr_states.includes(data.state)) err(join(adrDir, f), `unknown ADR state: ${data.state}`);
  }
  return errs;
}
