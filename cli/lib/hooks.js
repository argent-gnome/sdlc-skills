import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, dirname, basename, resolve } from 'node:path';
import { appendEvent, readYaml } from './core.js';
import { status, next } from './derive.js';

// The hook's root comes from process.cwd() (already realpath'd by the OS) while tool_input.file_path
// arrives however the caller spelled it. On macOS those differ for anything under /var (a symlink to
// /private/var), and a guard that silently never fires is worse than no guard — so compare every
// root×path spelling and take the first that lands INSIDE the repo.
// realpath as much of `p` as exists (a Write names a file, and often whole dirs, that do not yet
// exist) and re-append the rest verbatim
const realish = (p) => {
  let cur = resolve(p);
  const suffix = [];
  for (;;) {
    try { const r = realpathSync(cur); return suffix.length ? join(r, ...suffix) : r; } catch { /* walk up */ }
    const parent = dirname(cur);
    if (parent === cur) return resolve(p);          // nothing on the path exists — give up honestly
    suffix.unshift(basename(cur));
    cur = parent;
  }
};
function repoRelative(root, p) {
  const cands = [];
  for (const r of new Set([root, realish(root)]))
    for (const q of new Set([p, realish(p)])) cands.push(relative(r, q));
  return cands.find(x => x && !x.startsWith('..')) ?? relative(root, p);
}

// Every handler: advisory-only in S2 (spec: Recorded deviations; ADR-0004). Every path FAILS OPEN —
// a broken hook must never cost a session; it records hook.degraded instead (best-effort).
export function run(root, event, stdinText) {
  if (!root) return '';                              // not a house repo — exit 0, no output, no opinion
  let input = {};
  try { input = JSON.parse(stdinText || '{}'); } catch { /* malformed stdin — treat as empty */ }
  try {
    switch (event) {
      case 'session-start': {
        appendEvent(root, 'session.started', { actor: 'hook',
          payload: { source: input.source ?? null, session_id: input.session_id ?? null } });
        const ctx = `house repo state:\n${status(root, {})}\n\nready tasks:\n${next(root, {})}`;
        return JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } });
      }
      case 'session-end': {
        appendEvent(root, 'session.ended', { actor: 'hook',
          payload: { session_id: input.session_id ?? null } });
        return '';
      }
      case 'pre-write': {
        const p = input.tool_input?.file_path ?? '';
        const rel = repoRelative(root, p);
        const guarded = rel === '.house' || rel.startsWith('.house/') ||
          (/^docs\/slices\/[^/]+\/gates\//.test(rel)) ||
          (/^docs\/slices\/[^/]+\/(slice|tasks)\.yaml$/.test(rel));
        if (!guarded) return '';
        return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `kernel-owned file (one writer per field): prefer the house CLI ` +
            `(house gate/task/state/block/artifact/unit/pr) over hand-edits to ${rel}` } });
      }
      case 'subagent-stop': {
        const dir = join(root, 'docs/slices');
        const open = [];
        if (existsSync(dir)) for (const d of readdirSync(dir)) {
          const manFile = join(dir, d, 'slice.yaml');
          if (!existsSync(manFile)) continue;
          for (const u of readYaml(manFile)?.units ?? [])
            if (u.state === 'building') open.push(`${d}/units/${u.id} ("${u.title}") has no finalized report`);
        }
        if (!open.length) return '';
        return JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStop',
          additionalContext: `advisory: ${open.join('; ')} — absence of a finalized unit record is ` +
            `fail-closed unknown, never DONE (house unit <slice> finalize <id> --result …)` } });
      }
      default: return '';                            // unknown hook event — no opinion, exit 0
    }
  } catch (e) {
    try { appendEvent(root, 'hook.degraded', { actor: 'hook', payload: { event, error: e.message } }); }
    catch { /* even the record failed — still exit 0; a hook must never cost a session */ }
    return '';
  }
}
