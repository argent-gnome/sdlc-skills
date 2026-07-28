import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { readYaml, writeYaml, appendEvent, loadEnums } from './core.js';

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
  if (!slug(title)) throw new Error(`title must contain at least one alphanumeric character: ${title}`);
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
  if (!id || typeof id !== 'string') throw new Error('--slice is required');
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
  // auto-clear a blocked_on that names the gate just recorded — but ONLY on a passing verdict; a
  // changes_requested record is exactly when the block must hold (spec R-2)
  const man = readYaml(join(dir, 'slice.yaml'));
  const { passing_verdicts } = loadEnums();
  if (man.blocked_on?.gate === gate && (passing_verdicts[gate] ?? []).includes(args.verdict)) {
    man.blocked_on = null;
    writeYaml(join(dir, 'slice.yaml'), man);
    appendEvent(root, 'slice.unblocked', { slice: args.slice, actor: rec.by,
      payload: { gate, via: 'gate.recorded' } });
  }
  return rec;
}

export function block(root, id, args) {
  if (!args.gate || args.gate === true) throw new Error('--gate <name> is required');
  const { gate_verdicts } = loadEnums();
  if (!gate_verdicts[args.gate]) throw new Error(`unknown gate: ${args.gate}`);
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.blocked_on = { gate: args.gate, note: args.note ?? null, since: new Date().toISOString().slice(0, 10) };
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'gate.requested', { slice: id, actor: args.actor ?? 'agent',
    payload: { gate: args.gate, note: man.blocked_on.note } });
}

export function artifactCmd(root, id, name, to, args) {
  if (!name || !to) throw new Error('usage: house artifact <slice-id> <name> <state> [--reason …]');
  const { artifact_states, artifact_transitions } = loadEnums();
  if (!artifact_states.includes(to)) throw new Error(`unknown artifact state: ${to}`);
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  const cur = man.artifacts?.[name]?.state ?? 'todo';
  const allowed = artifact_transitions[cur] ?? [];
  if (!allowed.includes(to))
    throw new Error(`artifact '${name}': illegal transition ${cur} → ${to} (allowed: ${allowed.join(', ') || 'none'})`);
  if (to === 'skipped' && !args.reason) throw new Error(`artifact '${name}': skip requires --reason`);
  man.artifacts = man.artifacts ?? {};
  man.artifacts[name] = { ...(man.artifacts[name] ?? {}), state: to,
    ...(args.reason ? { skip_reason: args.reason } : {}), updated: new Date().toISOString().slice(0, 10) };
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'artifact.state_changed', { slice: id, actor: args.actor ?? 'agent',
    payload: { artifact: name, from: cur, to } });
}

export function unblock(root, id, args) {
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  if (!man.blocked_on) throw new Error(`slice ${id} is not blocked`);
  const was = man.blocked_on;
  man.blocked_on = null;
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'slice.unblocked', { slice: id, actor: args.actor ?? 'agent',
    payload: { gate: was.gate, via: 'manual', note: args.note ?? null } });
}

export function emit(root, type, args) {
  // which types `house event` may write is a separate concept from which types exist — but it still
  // lives in schema/enums.yaml, so nothing restates an enum (plan header rule + advisory A2)
  const { free_form_events } = loadEnums();
  if (!free_form_events.includes(type))
    throw new Error(`event '${type}' is owned by a dedicated command — not emittable via house event`);
  const payload = typeof args.payload === 'string' ? JSON.parse(args.payload) : (args.payload ?? {});
  return appendEvent(root, type, { slice: args.slice ?? null, actor: args.actor ?? 'agent', payload });
}

export function taskCmd(root, action, taskId, args) {
  const dir = sliceDir(root, args.slice);
  const file = join(dir, 'tasks.yaml');
  if (!existsSync(file)) throw new Error(`no tasks.yaml for slice ${args.slice} — nothing to ${action}`);
  const doc = readYaml(file) ?? {};
  const task = (doc.tasks ?? []).find(t => t.id === taskId);
  if (!task) throw new Error(`no such task: ${taskId}`);
  if (action === 'done') {
    if (task.state === 'done') throw new Error(`task ${taskId} already done — no silent re-ticks`);
    const cmd = args['evidence-cmd'] ?? task.verify;   // verify: is the task's declared proof; --evidence-cmd overrides it
    if (!cmd) throw new Error('evidence required: pass --evidence-cmd or set verify: on the task');
    let out;
    // maxBuffer: a real `npm test` / `pytest -v` blows past execSync's 1MB default, which throws with
    // status === null and would report a PASSING command as a failed one. timeout: never hang the CLI.
    try { out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 }); }
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

export function prCmd(root, id, args) {
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  const sha = args['base-sha'];
  if ((!args.set || args.set === true) && (!sha || sha === true))
    throw new Error('nothing to set: pass --set <pr-url> and/or --base-sha <sha>');
  if (args.set && args.set !== true) man.pr = args.set;
  if (sha && sha !== true) man.base_sha = sha;
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'slice.pr_set', { slice: id, actor: args.actor ?? 'orchestrator',
    payload: { pr: man.pr, base_sha: man.base_sha } });
}

export function unitCmd(root, id, action, unitId, args) {
  const dir = sliceDir(root, id);
  const man = readYaml(join(dir, 'slice.yaml'));
  man.units = man.units ?? [];
  const now = () => new Date().toISOString();
  if (action === 'dispatch') {
    if (!args.title) throw new Error('--title is required');
    const uid = String(man.units.length + 1).padStart(2, '0');
    man.units.push({ id: uid, title: args.title, state: 'building', result: null, dispatched: now() });
    mkdirSync(join(dir, 'units'), { recursive: true });
    writeFileSync(join(dir, 'units', `${uid}-report.md`),
      `# Unit ${uid} — ${args.title}\n\n- slice: ${id}\n- dispatched: ${now()}\n\n## Heartbeats\n\n## Result\n\n` +
      `(pending — absence of a finalized result is fail-closed unknown, never DONE)\n`);
    writeYaml(join(dir, 'slice.yaml'), man);
    appendEvent(root, 'unit.dispatched', { slice: id, actor: args.actor ?? 'orchestrator',
      payload: { unit: uid, title: args.title } });
    return uid;
  }
  const unit = man.units.find(u => u.id === unitId);
  if (!unit) throw new Error(`no such unit: ${unitId}`);
  const reportPath = join(dir, 'units', `${unitId}-report.md`);
  if (action === 'heartbeat') {
    if (!args.note) throw new Error('--note is required for a heartbeat');
    const cur = readFileSync(reportPath, 'utf8');
    writeFileSync(reportPath, cur.replace('\n## Result', `- ${now()} — ${args.note}\n\n## Result`));
    appendEvent(root, 'unit.heartbeat', { slice: id, actor: args.actor ?? 'builder',
      payload: { unit: unitId, note: args.note } });
  } else if (action === 'finalize') {
    const { unit_results } = loadEnums();
    if (!unit_results.includes(args.result))
      throw new Error(`--result must be one of ${unit_results.join('|')} — got: ${args.result}`);
    unit.state = 'finalized'; unit.result = args.result; unit.finalized = now();
    const cur = readFileSync(reportPath, 'utf8');
    writeFileSync(reportPath, cur.replace(/## Result[\s\S]*$/,
      `## Result\n\n**${args.result}** — ${args.note ?? ''}\n- finalized: ${now()}\n`));
    writeYaml(join(dir, 'slice.yaml'), man);
    appendEvent(root, 'unit.report', { slice: id, actor: args.actor ?? 'builder',
      payload: { unit: unitId, result: args.result } });
  } else throw new Error(`unknown unit action: ${action}`);
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
    if (!passing_verdicts[gate])
      throw new Error(`gate ${gate} has no passing_verdicts entry in schema/enums.yaml — failing closed`);
    if (!passing_verdicts[gate].includes(rec?.verdict))          // fail-closed: only an explicit pass advances
      throw new Error(`gate ${gate}: '${rec.verdict}' is not a passing verdict`);
  }
  man.state = to;
  writeYaml(join(dir, 'slice.yaml'), man);
  appendEvent(root, 'slice.state_changed', { slice: id, actor: args.actor ?? 'agent', payload: { to } });
  // terminal transitions get their matching terminal event — `slice.shipped` finally has a producer
  // (ADR-0004: the shipped enum beats program spec §3.5's `slice.merged`)
  if (to === 'shipped')
    appendEvent(root, 'slice.shipped', { slice: id, actor: args.actor ?? 'agent', payload: { pr: man.pr } });
  if (to === 'abandoned')
    appendEvent(root, 'slice.abandoned', { slice: id, actor: args.actor ?? 'agent', payload: {} });
}
