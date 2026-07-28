import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readYaml, loadEnums, parseFrontmatter } from './core.js';

// kickoff.yaml sits next to enums.yaml; fileURLToPath (not URL.pathname) — paths with spaces
const kickoffSchema = readYaml(fileURLToPath(new URL('../schema/kickoff.yaml', import.meta.url)));

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
      if (/\b(?:src|href)\s*=\s*["']https?:\/\//i.test(html) || /@import\s+url\(/i.test(html)
          || /style\s*=\s*["'][^"']*url\(\s*["']?\s*https?:\/\//i.test(html))
        err(join(mockups, f), 'mockup has external ref (src/href/@import/style url()) — self-containment contract violated');
    }
    if (man.blocked_on != null) {
      if (typeof man.blocked_on !== 'object') err(manFile, `blocked_on: bare values are retired — use house block`);
      else for (const k of Object.keys(man.blocked_on)) if (!enums.blocked_on_fields.includes(k))
        err(manFile, `blocked_on: unknown key '${k}' (shape is pinned in schema/enums.yaml)`);
    }
    const tasksFile = join(dir, 'tasks.yaml');
    if (existsSync(tasksFile)) for (const t of readYaml(tasksFile)?.tasks ?? []) {
      if (!enums.task_states.includes(t.state)) err(tasksFile, `task ${t.id}: unknown state ${t.state}`);
      if (t.state === 'done' && !t.evidence) err(tasksFile, `task ${t.id}: done without evidence`);
      if ((t.state === 'blocked' || t.state === 'skipped') && !t.note && !t.skip_reason)
        err(tasksFile, `task ${t.id}: ${t.state} without a note/reason`);
    }
    const TASK_KEYS = new Set(['id', 'title', 'state', 'verify', 'depends_on', 'evidence', 'note', 'skip_reason']);
    if (existsSync(tasksFile)) {
      const ts = readYaml(tasksFile)?.tasks ?? [];
      const ids = new Set();
      for (const t of ts) {
        if (!t.id || !t.title || !t.state) err(tasksFile, `task ${t.id ?? '?'}: id, title, state are required`);
        if (ids.has(t.id)) err(tasksFile, `duplicate task id: ${t.id}`);
        ids.add(t.id);
        for (const d of t.depends_on ?? []) if (!ts.some(x => x.id === d))
          err(tasksFile, `task ${t.id}: depends_on unknown task ${d}`);
        for (const k of Object.keys(t)) if (!TASK_KEYS.has(k))
          err(tasksFile, `task ${t.id}: unknown key '${k}' — YAML comments and stray keys carry no meaning`, 'warning');
      }
    }
    // MUST stay BELOW the `tasksFile` declaration above — reading it earlier is a TDZ ReferenceError
    if (man.kickoff != null) {
      const k = man.kickoff;
      for (const f of kickoffSchema.required) if (!(f in k)) err(manFile, `kickoff: '${f}' is required`);
      if ('version' in k && !Number.isInteger(k.version)) err(manFile, `kickoff: version must be an integer`);
      const known = new Set([...kickoffSchema.required, ...kickoffSchema.optional]);
      for (const key of Object.keys(k)) if (!known.has(key)) err(manFile, `kickoff: unknown field '${key}'`, 'warning');
      const tIds = (existsSync(tasksFile) ? readYaml(tasksFile)?.tasks ?? [] : []).map(t => t.id);
      for (const t of k.tasks ?? []) if (!tIds.includes(t)) err(manFile, `kickoff: brief names task ${t} which is not in tasks.yaml`);
    }
    if (man.state === 'shipped') {
      if (!existsSync(join(dir, 'gates/merge_gate.yaml'))) err(dir, 'shipped without a merge_gate record');
      if (man.rigor !== 'patch' && !existsSync(join(dir, 'retro.md'))) err(dir, 'shipped slice-tier without retro.md');
    }
  }
  const adrDir = join(root, 'docs/adr');
  if (existsSync(adrDir)) for (const f of readdirSync(adrDir).filter(f => f.endsWith('.md'))) {
    let data;
    try { ({ data } = parseFrontmatter(readFileSync(join(adrDir, f), 'utf8'))); }      // a bad doc is a finding,
    catch (e) { err(join(adrDir, f), `unparseable frontmatter: ${e.message.split('\n')[0]}`); continue; }  // not a crash
    if (data?.state && !enums.adr_states.includes(data.state)) err(join(adrDir, f), `unknown ADR state: ${data.state}`);
  }
  // roadmap reference lint (spec R-5): validate checks only that referenced ids EXIST — nothing about
  // what the line says about them
  const roadmap = join(root, 'docs/roadmap.md');
  if (existsSync(roadmap)) {
    const text = readFileSync(roadmap, 'utf8');
    for (const m of text.matchAll(/\[(\d{4})\]/g)) {
      const hit = existsSync(slicesDir) && readdirSync(slicesDir).some(d => d.startsWith(`${m[1]}-`));
      if (!hit) err(roadmap, `roadmap references [${m[1]}] but no such slice exists`);
    }
  }
  return errs;
}
