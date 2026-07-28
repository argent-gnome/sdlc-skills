import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkTmpRepo } from './helpers.js';

const BIN = fileURLToPath(new URL('../bin/house.js', import.meta.url));
const hook = (cwd, event, input) => {
  try { return { out: execFileSync(process.execPath, [BIN, 'hook', event],
    { cwd, encoding: 'utf8', input: JSON.stringify(input) }), code: 0 }; }
  catch (e) { return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status }; }
};

test('hook: exits 0 with no output outside a house repo — sessions there are untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nothouse-'));
  const r = hook(dir, 'session-start', { source: 'startup' });
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), '');
});

test('hook session-start: emits session.started + injects status as additionalContext', () => {
  const dir = mkTmpRepo();
  execFileSync(process.execPath, [BIN, 'new', 'Hooky'], { cwd: dir });
  const r = hook(dir, 'session-start', { source: 'startup', session_id: 's1' });
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.match(j.hookSpecificOutput.additionalContext, /0001-hooky/);
  assert.match(readFileSync(join(dir, '.house/events.jsonl'), 'utf8'), /"session\.started"/);
});

test('hook pre-write: asks on kernel-owned paths, silent elsewhere', () => {
  const dir = mkTmpRepo();
  const guarded = hook(dir, 'pre-write',
    { tool_name: 'Edit', tool_input: { file_path: join(dir, '.house/events.jsonl') } });
  const j = JSON.parse(guarded.out);
  assert.equal(j.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(j.hookSpecificOutput.permissionDecisionReason, /house/);
  const free = hook(dir, 'pre-write',
    { tool_name: 'Edit', tool_input: { file_path: join(dir, 'src/app.js') } });
  assert.equal(free.out.trim(), '');                               // no opinion outside kernel paths
  // the other two guarded shapes the reason text promises — gate records and the manifests
  execFileSync(process.execPath, [BIN, 'new', 'Guarded'], { cwd: dir });
  for (const rel of ['docs/slices/0001-guarded/gates/spec_review.yaml',
                     'docs/slices/0001-guarded/slice.yaml',
                     'docs/slices/0001-guarded/tasks.yaml']) {
    const g = hook(dir, 'pre-write', { tool_name: 'Write', tool_input: { file_path: join(dir, rel) } });
    assert.equal(JSON.parse(g.out).hookSpecificOutput.permissionDecision, 'ask', rel);
  }
  // and the spec.md next to them is NOT guarded — prose is hand-authored, the kernel does not own it
  const prose = hook(dir, 'pre-write',
    { tool_name: 'Write', tool_input: { file_path: join(dir, 'docs/slices/0001-guarded/spec.md') } });
  assert.equal(prose.out.trim(), '');
});

test('hook subagent-stop: advisory names units still building', () => {
  const dir = mkTmpRepo();
  execFileSync(process.execPath, [BIN, 'new', 'Subby'], { cwd: dir });
  execFileSync(process.execPath, [BIN, 'unit', '0001-subby', 'dispatch', '--title', 'half-done unit'], { cwd: dir });
  const r = hook(dir, 'subagent-stop', { agent_type: 'general-purpose' });
  const j = JSON.parse(r.out);
  assert.match(j.hookSpecificOutput.additionalContext, /01.*no finalized report|half-done unit/);
});

test('init: merges hooks into .claude/settings.json without clobbering existing hooks; idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'house-init-'));
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify(
    { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'my-precious-hook.sh' }] }] } }, null, 2));
  execFileSync(process.execPath, [BIN, 'init'], { cwd: dir });
  execFileSync(process.execPath, [BIN, 'init'], { cwd: dir });     // run twice — must be idempotent
  const s = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'));
  const cmds = s.hooks.SessionStart.flatMap(h => h.hooks.map(x => x.command));
  assert.ok(cmds.includes('my-precious-hook.sh'));                 // existing hook preserved byte-for-byte
  assert.equal(cmds.filter(c => c.includes('house hook session-start')).length, 1);
  assert.ok(s.hooks.PreToolUse.some(h => h.matcher === 'Edit|Write|MultiEdit'));
});
