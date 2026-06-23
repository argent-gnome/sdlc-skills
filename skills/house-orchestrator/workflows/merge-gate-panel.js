export const meta = {
  name: 'merge-gate-panel',
  description: 'The opus-profile stage-7 merge-gate: N refute-biased Opus lens reviewers → independent multi-refuter verification → GO/NO-GO. Replaces the single-Fable reviewer with independence-of-PERSPECTIVE (diverse lenses) standing in for the lost independence-of-ARCHITECTURE.',
  phases: [
    { title: 'Review', detail: 'one refute-biased Opus reviewer per rubric lens, in parallel' },
    { title: 'Verify', detail: 'three independent Opus refuters per critical/should-fix finding; majority-refute kills it' },
  ],
}

// args (passed by the orchestrator at stage 7):
//   { project, repoPath, baseRef='main', headRef='HEAD', sliceId, specGlobs, stack, highStakes, notes, ledgerPath }
const a = (typeof args === 'string' ? JSON.parse(args) : args) || {}   // defensive: args can arrive JSON-stringified
const repo = a.repoPath || '.'
const base = a.baseRef || 'main'
const head = a.headRef || 'HEAD'
const diffCmd = `git -C "${repo}" diff ${base}...${head}`
// The accepted/known-backlog ledger (same file the stage-7½ health-sweep reads). A finding already accepted and
// ROUTED there is not a fresh should-fix — it re-surfaces on every slice that touches that surface (e.g. hims'
// field_def-seed deploy gap, routed to the auth/migrations slice, was re-flagged S3e/S4a/S4c). Tell each lens to
// DROP / down-rate-to-nit anything already on the ledger; a genuinely NEW aspect of a tracked item is still fair game.
const ledgerPath = a.ledgerPath || 'docs/health/accepted.md'
const ledgerNote =
  `\n**Known-backlog ledger:** read "${repo}/${ledgerPath}" if it exists. A finding ALREADY listed/accepted there ` +
  `(and routed to a future slice) is NOT a fresh should-fix — DROP it, or down-rate to a nit, so a known, deferred ` +
  `item does not re-consume a should-fix slot every slice. A NEW aspect of a ledger item (not the already-logged one) ` +
  `is still in scope.\n`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'title', 'rationale'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'should-fix', 'nit'] },
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          rationale: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
    outOfScope: { type: 'array', items: { type: 'string' } },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['refuted', 'reason'],
  properties: {
    refuted: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reason: { type: 'string' },
  },
}

// Each lens is one rubric dimension. Splitting the rubric across independent agents is what buys
// independence-of-perspective: four reviewers that cannot see each other's blind spots.
const LENSES = [
  { key: 'correctness', focus: 'Logic & algorithm correctness. Wrong results, broken invariants, off-by-one, state that diverges across the slice. Demand a DISCRIMINATING test for each spec rule — at least one input where the intended behavior and the nearest plausible-wrong implementation DISAGREE (non-monotone / boundary / divergent cases). A suite that only exercises inputs where right==wrong is a coverage gap, not coverage.' },
  { key: 'data-safety', focus: 'Regression & data safety. Destructive migrations or schema changes (SwiftData @Model / SQL), data loss against a POPULATED store, silently-destructive casts. A fresh CI DB or fresh install passing is NOT proof against a populated store; a @Model/schema change must be exercised against a previous-schema store.' },
  { key: 'spec-compliance', focus: 'Spec-rule compliance. Every change should cite the spec rule it satisfies; flag drift from the approved spec/mockup. High-stakes rules flagged in the spec are never down-rated (rigor floor).' },
  { key: 'cross-seam', focus: 'Cross-task seams & gate compliance. Integration points BETWEEN the slice\'s tasks that no single-task review could see; stack-gate compliance — lint clean, the app-target tests actually RUN in CI (not merely build), the xcodebuild destination simulator exists. Also flag a STALE STAKEHOLDER DEMO SCRIPT (the seeded-fixture roster + scripted click-through) the slice falsified: a step that now clicks differently, a roster row at a state the slice removed, or a "what\'s not built" line naming a thing the slice built — should-fix, the reconcile backstop (it has caught this on consecutive slices).' },
]

phase('Review')
const reviews = (await parallel(LENSES.map(L => () =>
  agent(
    `You are the merge-gate's **${L.key}** lens for slice "${a.sliceId || '?'}" of project "${a.project || '?'}".\n\n` +
    `Review the completed slice ONLY through this lens, and be REFUTE-BIASED — assume a critical is hiding and hunt for it:\n${L.focus}\n\n` +
    `Inspect the diff with \`${diffCmd}\` (run it), then read the changed files and the spec under "${repo}".\n` +
    `**Stay strictly within this slice's scope** — only files inside "${repo}" that this diff touches. The workspace holds OTHER repos; never read or judge them. An issue OUTSIDE this slice/repo is NOT a finding here: if you spot one, put a one-line note in \`outOfScope\` (surfaced separately, NEVER blocks the merge).\n` +
    ledgerNote +
    (a.specGlobs ? `Spec / source-of-truth: ${a.specGlobs}.\n` : '') +
    (a.stack ? `Stack: ${a.stack}.\n` : '') +
    (a.highStakes ? `HIGH-STAKES slice (${a.highStakes}) — the rigor floor applies; do NOT down-rate findings.\n` : '') +
    (a.notes ? `Context: ${a.notes}\n` : '') +
    `\nReturn findings for THIS lens only. Severity: critical = must BLOCK the merge; should-fix = real but non-blocking; nit = cosmetic. If the lens is clean, return an empty findings array.`,
    { label: `lens:${L.key}`, phase: 'Review', schema: FINDINGS_SCHEMA }
  ).then(r => ({ lens: L.key, findings: (r && r.findings) || [], outOfScope: (r && r.outOfScope) || [] }))
))).filter(Boolean)

// Fail-CLOSED on infra failure: if fewer than a majority of lenses actually returned (an API-overload storm can
// kill them), the panel did NOT review — never let that read as a clean GO. Report INCONCLUSIVE so the
// orchestrator reruns the panel or falls back to a single merge-gate-reviewer.
const quorum = Math.ceil(LENSES.length / 2)
if (reviews.length < quorum) {
  log(`merge-gate panel → INCONCLUSIVE: only ${reviews.length}/${LENSES.length} lenses ran — NOT a pass`)
  return { verdict: 'INCONCLUSIVE', reason: `only ${reviews.length} of ${LENSES.length} lenses returned (likely API overload); rerun the panel or fall back to a single merge-gate-reviewer — do NOT treat as GO`, lensesRan: reviews.length, panel: { lenses: LENSES.map(l => l.key), refutersPerFinding: 3 } }
}

// Only critical/should-fix go to verification; nits are reported but never block.
const candidates = reviews.flatMap(r =>
  r.findings
    .filter(f => f.severity === 'critical' || f.severity === 'should-fix')
    .map((f, i) => ({ ...f, lens: r.lens, id: `${r.lens}-${i}` })))
// Out-of-scope notes (real issues a lens spotted outside this slice/repo) — surfaced, never block the merge.
const outOfScope = reviews.flatMap(r => (r.outOfScope || []).map(n => ({ lens: r.lens, note: n })))

phase('Verify')
// Three independent refuters per candidate; a candidate survives only if a MAJORITY did not refute it.
const verified = (await parallel(candidates.map(c => () =>
  parallel([0, 1, 2].map(k => () =>
    agent(
      `Adversarially REFUTE this merge-gate finding. Default to refuted=true unless you become convinced it is a real, correctly-severity-rated issue.\n\n` +
      `Lens: ${c.lens}\nSeverity claimed: ${c.severity}\nTitle: ${c.title}\nLocation: ${c.file || '?'}${c.line ? ':' + c.line : ''}\nClaim: ${c.rationale}\nEvidence cited: ${c.evidence || '(none)'}\n\n` +
      `Independently verify against the actual diff (\`${diffCmd}\`) and code under "${repo}". Is it real and correctly rated, or a false positive / over-rated? **A finding about anything OUTSIDE "${repo}" or outside this slice's diff is automatically refuted=true (out of scope for this slice).**`,
      { label: `refute:${c.id}#${k}`, phase: 'Verify', schema: VERDICT_SCHEMA }
    )
  )).then(votes => {
    const v = votes.filter(Boolean)
    const refutes = v.filter(x => x.refuted).length
    // Refute only on a real majority (>=2 of 3). If ALL refuters errored (no signal), KEEP the finding
    // (refuted=false) — fail-CLOSED: an unverified critical blocks. A false NO-GO is safe; a false GO is not.
    return { ...c, refuted: v.length === 0 ? false : refutes >= 2, votes: v.length }
  })
))).filter(Boolean)

const confirmed = verified.filter(c => !c.refuted)
const criticals = confirmed.filter(c => c.severity === 'critical')
const shouldFixes = confirmed.filter(c => c.severity === 'should-fix')
const verdict = criticals.length === 0 ? 'GO' : 'NO-GO'

log(`merge-gate panel → ${verdict}: ${criticals.length} confirmed critical(s), ${shouldFixes.length} should-fix, from ${candidates.length} candidate(s) across ${LENSES.length} lenses`)

return {
  verdict,
  criticals: criticals.map(c => ({ lens: c.lens, title: c.title, file: c.file, rationale: c.rationale, refuters: c.votes })),
  shouldFixes: shouldFixes.map(c => ({ lens: c.lens, title: c.title, file: c.file })),
  nits: reviews.flatMap(r => r.findings.filter(f => f.severity === 'nit').map(f => ({ lens: r.lens, title: f.title }))),
  outOfScope,
  panel: { lenses: LENSES.map(l => l.key), candidates: candidates.length, refutersPerFinding: 3 },
}
