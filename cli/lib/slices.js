import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
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

export function sliceDir(root, id) {
  const dir = join(root, 'docs/slices', id);
  if (!existsSync(join(dir, 'slice.yaml'))) throw new Error(`no such slice: ${id}`);
  return dir;
}

export function recordGate(root, gate, args) {
  const { gate_verdicts } = loadEnums();
  if (!gate_verdicts[gate]) throw new Error(`unknown gate: ${gate}`);
  if (!gate_verdicts[gate].includes(args.verdict)) throw new Error(`invalid verdict for ${gate}: ${args.verdict}`);
  const dir = sliceDir(root, args.slice);
  mkdirSync(join(dir, 'gates'), { recursive: true });
  const extra = typeof args.payload === 'string' ? JSON.parse(args.payload) : (args.payload ?? {});
  const rec = { gate, verdict: args.verdict, by: args.by ?? 'agent',
    recorded_at: new Date().toISOString(), notes: args.notes ?? null, ...extra };   // plan_check passes must_fix[]/advisory_folded[] here
  writeYaml(join(dir, 'gates', `${gate}.yaml`), rec);
  appendEvent(root, 'gate.recorded', { slice: args.slice, actor: rec.by, payload: { gate, verdict: args.verdict } });
  return rec;
}

const FREE_FORM = new Set(['work.discovered', 'deviation.raised', 'gate.requested', 'artifact.written',
  'unit.dispatched', 'unit.heartbeat', 'unit.report', 'session.started', 'session.ended']);
export function emit(root, type, args) {
  if (!FREE_FORM.has(type))
    throw new Error(`event '${type}' is owned by a dedicated command — not emittable via house event`);
  const payload = typeof args.payload === 'string' ? JSON.parse(args.payload) : (args.payload ?? {});
  return appendEvent(root, type, { slice: args.slice ?? null, actor: args.actor ?? 'agent', payload });
}

export function taskCmd(root, action, taskId, args) {
  const dir = sliceDir(root, args.slice);
  const file = join(dir, 'tasks.yaml');
  const doc = readYaml(file);
  const task = doc.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`no such task: ${taskId}`);
  if (action === 'done') {
    if (task.state === 'done') throw new Error(`task ${taskId} already done — no silent re-ticks`);
    const cmd = args['evidence-cmd'] ?? task.verify;   // verify: is the task's declared proof; --evidence-cmd overrides it
    if (!cmd) throw new Error('evidence required: pass --evidence-cmd or set verify: on the task');
    let out;
    try { out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { throw new Error(`evidence command failed (exit ${e.status}): ${cmd}`); }
    task.state = 'done';
    task.evidence = { cmd, cmd_exit: 0, summary: out.trim().split('\n').at(-1) ?? '', at: new Date().toISOString() };
    appendEvent(root, 'task.done', { slice: args.slice, actor: 'builder', payload: { task: taskId, cmd } });
  } else if (action === 'block') {
    if (!args.note) throw new Error('note required for a blocked task');
    task.state = 'blocked'; task.note = args.note;
    appendEvent(root, 'task.blocked', { slice: args.slice, actor: 'builder', payload: { task: taskId, note: args.note } });
  } else throw new Error(`unknown task action: ${action}`);
  writeYaml(file, doc);
}

export function setState(root, id, to, args) {
  const { slice_states, state_transitions, required_gates, passing_verdicts } = loadEnums();
  if (!slice_states.includes(to)) throw new Error(`unknown state: ${to}`);
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  const allowed = state_transitions[man.state] ?? [];
  if (!allowed.includes(to)) throw new Error(`illegal transition: ${man.state} → ${to}`);
  for (const gate of required_gates[to] ?? []) {
    const gf = join(dir, 'gates', `${gate}.yaml`);
    if (!existsSync(gf)) throw new Error(`missing gate record for '${to}': ${gate} (an unrecorded gate is an unpassed gate)`);
    const rec = readYaml(gf);
    if (!passing_verdicts[gate].includes(rec.verdict))          // fail-closed: only an explicit pass advances
      throw new Error(`gate ${gate}: '${rec.verdict}' is not a passing verdict`);
  }
  man.state = to;
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'slice.state_changed', { slice: id, actor: args.actor ?? 'agent', payload: { to } });
}
