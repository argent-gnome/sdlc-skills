export const meta = {
  name: 'code-health-sweep',
  description: 'Stage-7½ ADVISORY whole-app code-health review (after the merge-gate returns GO). N Opus lenses sweep the app for architecture / quality / idiom / refactor debt; a synthesis pass dedupes across lenses, drops anything in the accepted/wontfix ledger, and ranks by value-to-effort. NEVER blocks a merge — emits a prioritized health backlog so the codebase stays clean slice by slice instead of eroding.',
  phases: [
    { title: 'Sweep', detail: 'one Opus lens per code-health dimension over the app (or the slice blast-radius)' },
    { title: 'Synthesize', detail: 'dedupe across lenses, drop suppressed, rank by value/effort' },
  ],
}

// args: { project, repoPath, stack, sliceId, scope='whole-app'|'blast-radius', baseRef, headRef, ledgerPath }
// Defensive parse: args can arrive JSON-stringified (same class of bug fixed in merge-gate-panel.js c97ea90 / plan-check.js).
const a = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const repo = a.repoPath || '.'
const scope = a.scope || 'whole-app'
const ledgerPath = a.ledgerPath || 'docs/health/accepted.md'
const scopeNote = scope === 'blast-radius'
  ? `Scope: the BLAST RADIUS of this slice only — files changed in \`git -C "${repo}" diff ${a.baseRef || 'main'}...${a.headRef || 'HEAD'}\` plus their direct dependents/collaborators.`
  : `Scope: the WHOLE app under "${repo}".`

const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['findings'],
  properties: { findings: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['severity', 'title', 'why'],
    properties: {
      severity: { type: 'string', enum: ['major', 'minor', 'nit'] },
      title: { type: 'string' },
      file: { type: 'string' },
      why: { type: 'string' },
      suggestedChange: { type: 'string' },
      effort: { type: 'string', enum: ['S', 'M', 'L'] },
    },
  } } },
}
const BACKLOG_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['backlog'],
  properties: { backlog: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['title', 'severity', 'area', 'rationale'],
    properties: {
      title: { type: 'string' },
      severity: { type: 'string', enum: ['major', 'minor', 'nit'] },
      area: { type: 'string' },
      file: { type: 'string' },
      rationale: { type: 'string' },
      suggestedChange: { type: 'string' },
      effort: { type: 'string', enum: ['S', 'M', 'L'] },
      lenses: { type: 'array', items: { type: 'string' } },
    },
  } } },
}

const IOS_LENSES = [
  { key: 'architecture', focus: 'App architecture & layering: separation of concerns (view / model / persistence / engine), dependency direction, god-objects, leaky abstractions, modules that should be split or merged.' },
  { key: 'swiftui', focus: 'SwiftUI view-layer best practices (apply swiftui-pro): view decomposition, state ownership (@State / @Binding / @Observable), unnecessary re-renders, layout & perf, modern API usage, accessibility basics.' },
  { key: 'swiftdata', focus: 'SwiftData & persistence best practices (apply swiftdata-pro): model design, fetch efficiency, migration safety, main-thread access, redundant queries.' },
  { key: 'concurrency', focus: 'Swift concurrency correctness (apply swift-concurrency-pro): actor isolation, unintended @MainActor hops, Task.detached misuse, data races, async/await pitfalls, heavy work that should be off-main.' },
  { key: 'refactor', focus: 'Refactor & cleanup: duplication, dead code, over-complex functions, naming/readability, and premature abstraction to UNWIND. Flag only debt that is real or imminent — do NOT propose speculative redesigns or new abstractions.' },
]
const WEB_LENSES = [
  { key: 'architecture', focus: 'App / module architecture: package boundaries (monorepo), separation of concerns, dependency direction, god-modules, leaky abstractions.' },
  { key: 'quality', focus: 'Code quality & idiom (TypeScript / React / Next.js): type safety, component decomposition, hooks usage, server/client boundaries, error handling at edges only (not for impossible states).' },
  { key: 'data', focus: 'Data & schema: query efficiency (N+1), migration safety against populated data, validation only at system boundaries.' },
  { key: 'refactor', focus: 'Refactor & cleanup: duplication, dead code, complexity, naming. Flag real or imminent debt only — no speculative redesigns or new abstractions.' },
]
const LENSES = a.stack === 'web' ? WEB_LENSES : IOS_LENSES

phase('Sweep')
const sweeps = (await parallel(LENSES.map(L => () =>
  agent(
    `You are a code-health reviewer for "${a.project || '?'}" through the **${L.key}** lens. This is ADVISORY — it never blocks a merge; you are building a backlog of cleanup work.\n\n${scopeNote} Confine all reading to "${repo}" — the workspace holds OTHER repos; never read or report on them.\n\n` +
    `Review for: ${L.focus}\n\n` +
    `First read the accepted/wontfix ledger at "${repo}/${ledgerPath}" if it exists, and do NOT re-report anything already listed there.\n` +
    `Inspect the code under "${repo}". Report genuine, actionable health issues — real or imminent debt, not theoretical perfection. Do NOT invent refactors for their own sake or push premature abstraction. severity: major = architecture/correctness-adjacent debt worth its own backlog slice; minor = worth doing opportunistically; nit = trivial. Give a concrete suggestedChange and a rough effort (S/M/L). Return an empty findings array if the lens is clean.`,
    { label: `health:${L.key}`, phase: 'Sweep', schema: FINDINGS_SCHEMA }
  ).then(r => ({ lens: L.key, findings: (r && r.findings) || [] }))
))).filter(Boolean)

const raw = sweeps.flatMap(r => r.findings.map(f => ({ ...f, lens: r.lens })))
if (!raw.length) { log('code-health sweep: clean — no new findings'); return { backlog: [], rawCount: 0, lenses: LENSES.map(l => l.key), scope }; }

phase('Synthesize')
const synth = await agent(
  `Synthesize a code-health backlog for "${a.project || '?'}" from ${raw.length} raw findings across ${LENSES.length} lenses.\n` +
  `1) DEDUPE near-duplicates — the same root issue surfaced by multiple lenses becomes ONE backlog item (list the contributing lenses).\n` +
  `2) DROP anything already in the accepted/wontfix ledger at "${repo}/${ledgerPath}" (read it).\n` +
  `3) RANK by value-to-effort, highest first.\n` +
  `Be honest — do not pad the list; if there are only a few real items, return only those.\n\n` +
  `Raw findings (JSON):\n${JSON.stringify(raw).slice(0, 16000)}`,
  { label: 'synthesize', phase: 'Synthesize', schema: BACKLOG_SCHEMA }
)

const backlog = (synth && synth.backlog) || []
log(`code-health sweep → ${backlog.length} backlog item(s) (deduped from ${raw.length} raw) · scope=${scope}`)
return { backlog, rawCount: raw.length, lenses: LENSES.map(l => l.key), scope }
