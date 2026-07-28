# Spec — house v2: state-first redesign of the house SDLC ecosystem (design gate)

_Status: **Approved (owner, 2026-07-28)** — spec review gate passed; decisions D1–D5 resolved per
recommendation (§13). (Shaped 2026-07-28, house-shaper session; research ran as a
10-agent workflow — 3 skill deep-dives, 4 best-practices research passes, 3 competing redesign proposals.
Full corpus committed at [`../research/2026-07-28-house-v2/`](../research/2026-07-28-house-v2/) — the three
proposals are the recommended review reading, in this order:
[`proposal-state-first.md`](../research/2026-07-28-house-v2/proposal-state-first.md) ·
[`proposal-evolve.md`](../research/2026-07-28-house-v2/proposal-evolve.md) ·
[`proposal-simplify.md`](../research/2026-07-28-house-v2/proposal-simplify.md).)_

_Trigger: Jake is building a desktop "focused AI-dev IDE" (workspace per project, side pane surfacing
specs/plans/mockups live, embedded terminal hosting the Claude Code sessions). Owner call: do **not**
retrofit v1 to be parseable — redesign the process ground-up to be sound engineering practice AND
IDE-native. The IDE itself is a separate slice, shaped after this spec is approved (§10)._

---

## 1. Intent

One sentence: **give the house process a machine-readable skeleton — identity, persisted gate verdicts,
derived status, and enforcement — so that both the agents and the coming IDE read the same on-disk truth,
while keeping every v1 rule that earned its place.**

The diagnosis (all three deep-dives, independently): every audited v1 weakness — unticked plan checkboxes
on shipped slices, `Status: Draft` on merged specs, evaporating plan-check/merge-gate/builder verdicts,
four retro naming schemes, the mockup path that no skill ever specified, dev-state heading drift, ambiguous
"Slice N" identity — is the **same bug expressed differently: process state lives in conversations and
prose, and nothing owns the write.** The 2025–26 industry corpus (Oxide RFDs, GitHub spec-kit, OpenSpec,
Kiro, Beads, Linear) has converged on the fix, and all three competing proposals arrived at the same kernel.

## 2. The kernel (unanimous across all three proposals — adopt as the constitution)

Three layers of state per repo, **exactly one writer each**:

| Layer | Where | Writer | Git |
|---|---|---|---|
| **DECLARED** | YAML frontmatter on artifacts + `slice.yaml` manifests | the agent owning the current stage | tracked — truth |
| **OBSERVED** | `.house/events.jsonl` (append-only, ULID ids, `merge=union`) | the `house` CLI + Claude Code hooks only | tracked — truth |
| **DERIVED** | `.house/index.json` (rebuildable cache) | `house index` only | ignored — cache |

Constitutional rules:
1. **A gate that does not write a record did not run.** Every gate — hard or soft — writes a verdict file
   + an event; the next stage's entry precondition is *the record exists and says pass*, never "the
   conductor remembers."
2. **One writer per field, ever.** The IDE renders state; it never writes any field except gate
   resolutions via `house gate` (the Kiro `[-]`-bug vaccine).
3. **Anything derivable is derived, never hand-written.** Deleting `.house/index.json` and rebuilding is a
   byte-identical no-op.
4. **`git clone` + a text editor must remain sufficient.** The CLI and IDE are conveniences over files
   Jake owns. (The anti-lock-in clause.)
5. **Never parse Claude Code transcripts as state** — emit deliberately via hooks/CLI.

**Build-order consequence (load-bearing): the `house` CLI ships before the skill rewrite, and both ship
before the IDE.** The contract must be true from a bare terminal on day one.

## 3. Identity & artifact model

### 3.1 Identity: the directory is the id
- Every unit of work is minted by **`house new "<title>" --kind <kind>`** → zero-padded monotonic id +
  kebab slug → `docs/slices/0007-dfs-oom-fix/`. Directory creation is the allocator lock. **Date is never
  identity** (eight retros stamped `2026-07-07` in edge-scanner proved why).
- Everything derives mechanically: branch `slice/0007-dfs-oom-fix`, PR prefix `[0007]`, commit trailer
  `House-Slice: 0007`, mockup/retro/report paths. There are no naming conventions left to define because
  there are no names left to choose — this deletes the retro-key, mockup-path, and two-"Slice N"-series
  bug classes at the root.
- Ideas are first-class: `--kind idea` mints identity for a backlog line on day one (Oxide's `ideation`);
  a re-shaped audible keeps its id instead of orphaning a date-keyed twin.
- ADRs keep their independent `docs/adr/NNNN-*.md` series, allocated by the same CLI (`house new --adr`),
  linked both directions via frontmatter (`slices: [0007]` / `adrs: [0004]`).

### 3.2 The per-slice directory
```
docs/slices/0007-dfs-oom-fix/
├── slice.yaml        # manifest: id·kind·rigor·appetite·state·blocked_on·branch·base_sha·pr·artifacts·units·kickoff
├── spec.md           # Shape Up five slots (Problem·Appetite·Solution·Rabbit Holes·No-Gos) + ## Requirements (R-N, each with a Scenario)
├── plan.md           # writing-plans output + house header slots; NO progress state in prose
├── plan-check.md     # persisted verdict: GO | GO_WITH_FIXES | NO_GO + must_fix[]/advisory_folded[] with ids
├── research/NN-*.md  # durable research digests; spikes carry frontmatter verdict GO|NO_GO|INCONCLUSIVE
├── mockups/NN-*.html # ONE canonical home; self-contained by checked contract; sidecar meta (fidelity, signoff)
├── units/NN-report.md# builder record, written INCREMENTALLY (state·heartbeat·tasks·gates·deviations)
├── merge-gate.md     # persisted reviewer/panel verdict: GO | NO_GO | INCONCLUSIVE
└── retro.md          # ledger as frontmatter DATA (computed); prose narrative for the human content
```
`docs/superpowers/specs|plans/` is retired for new work. "No-Gos" is the durable home for v1's "NOT this
slice" scope guards. `[NEEDS CLARIFICATION: …]` is the literal grep-able ambiguity marker;
`house validate --strict` blocks handoff while any remain.

### 3.3 Status: Linear's name/type split
Every artifact carries a free-text `status:` for humans **and** a closed `state:` enum for tooling —
`todo | draft | awaiting_review | approved | done | skipped | superseded` — defined **once** in
`schema/enums.yaml`. **A skip requires a reason and drops out of the progress denominator** (OpenSpec) —
no silent third state between done and not-done. Slice states:
`idea | shaping | ready | building | gating | live_check | shipped | parked | abandoned`, with `blocked_on`
as an **orthogonal field** (a slice can be `building` and blocked — that's how reality works). `parked` and
`abandoned` are first-class terminal states: "we decided not to" finally has a home.

### 3.4 Progress: evidence-gated ticks
The builder is the **sole writer** of task state, via `house task done <id> --evidence-cmd "<verify cmd>"` —
the CLI runs the command, records exit/summary/log as an event, and refuses the tick on failure. Markers:
`[ ] / [x] / [!] reason`. Ticking is a claim; the CLI is `verification-before-completion` made
deterministic. The v1 "11/13 plans 100% unchecked on shipped slices" category dies here, and the IDE's
progress bar can never lie.

### 3.5 Projections, not documents
- **`docs/dev-state.md` becomes generated** (`house render dev-state`): the Active/In-flight/Slated/Done
  half is rendered from the index; Gotchas/Infra/Process-notes stay hand-authored between
  `<!-- house:manual -->` markers. The allowlist becomes a template a generator cannot violate.
- **`slice.merged`** (from `gh pr` facts — never branch reachability; the squash caveat is code now) is
  the single event that flips spec state to shipped, moves the Done entry, and closes the slice. All three
  staleness bugs die to one merge-triggered projection.
- **`docs/roadmap.md` stays hand-authored prose** with a light contract: backlog items may carry `[NNNN]`
  ids; `house validate` checks only that referenced ids exist.

## 4. The `house` CLI + enforcement

`house new · init · status --json · list --json · next --json · event · gate <name> --verdict <v> ·
task done|block · validate [--strict] · index · render dev-state · archive · adopt`

- `house next` computes the ready set (Beads' `bd ready`) — the hand-written "next action:" line becomes a
  rendering of it.
- `house gate` **refuses** to record a forward transition past an unresolved NO_GO.
- `house validate` is the linter the doctrine allowlist never had; it runs in the merge-gate, pre-push, and
  the orchestrator's Stop hook. **If it doesn't fail the build, it rots.**
- Enforcement rides Claude Code hooks, not agent discipline: `SubagentStop` blocks a builder returning
  without a finalized unit record; `Stop` blocks a conductor session ending without validate-green +
  dev-state render; `SessionStart/End` emit session↔slice binding events; hooks fail open **with a
  recorded event** so enforcement gaps are visible, never silent.

## 5. Skill topology: three skills, thin actors over shared state

**Owner decision D1 (recommended: keep three skills).** proposal-simplify argues for merging
shaper+orchestrator into one `house` skill; state-first and evolve keep three. Recommendation: keep
**shaper / orchestrator / builder** — the session-shape economics (heavy reading dies in subagents,
dialogue stays interactive, transcripts disposable) are v1's best idea, and the seam bugs simplify cites
were *interface* bugs, fixed by the payload handoff below. But adopt the reversal unanimous in the other
two: **the long-lived orchestrator session becomes an optimization, not the substrate** — every iteration
is `read state → one action → write state + event`, so any fresh session resumes mid-slice from
`house status`, mid-stage death is recoverable, and multiple slices in flight are representable.

- **Shaper** mints identity at intake (`house new` before anything else — a dying shaping session leaves a
  resumable `state: shaping` slice, not an invisible orphan spec); forks mode/tier **before** brainstorming
  (fixing the composition bug where brainstorming's forced "terminal state is writing-plans" steamrolls
  decision-only mode); persists research digests; writes every gate record; owns the spike + mockup stages
  and the rigor dial — which move into *its* instruction set + doctrine at last. Decision-only mode gains
  the ⛔ ADR-approval gate it never had.
- **Orchestrator** keeps never-builds verbatim — now also mechanical (write access: `docs/` + `.house/`
  only). The workflows (merge-gate panel, health sweep) **write their verdict files** (their JSON schemas
  already exist — the only missing line was the write), gain a real `modelProfile` arg (a Fable outage must
  not become a NO-GO generator), per-lens quorum, and data-driven per-stack lens sets.
- **Builder** gets one versioned **kickoff brief** (the `kickoff` block in slice.yaml + per-dispatch
  fields: unit, tasks, folded plan-check commitments, fold_forward, stakes, attended) replacing the two
  divergent prose lists — `NEEDS_CONTEXT` becomes "brief failed validation, missing_inputs named," and
  re-dispatch is mechanical. Its report is **an artifact written incrementally** (opened at start,
  heartbeat, per-task evidence, finalized to the 4-state) — a builder that dies at task 4/6 is re-dispatched
  with its own record as the brief; absence of a record is fail-closed unknown, never DONE. Stack gates
  move to declarative `.house/gates.yml`; **unknown stack ⇒ NEEDS_CONTEXT, never proceed** — closing the
  one fail-open hole, which sits exactly where the Electron IDE project will step.
- **Composition contract** becomes explicit take/suppress/own per composed superpowers skill (take TDD's
  iron law + brainstorming's dialogue; suppress writing-plans' execution menu + worktree assumption +
  brainstorming's forced terminal transition; drop `finishing-a-development-branch` and `executing-plans`
  from the loops entirely).

## 6. Stages, gates, tiers

- **Stage numbers (0–11 with 4¼/7½/9½) are deleted** in favor of named states + a single canonical stage
  table in doctrine (owner · entry precondition · exit artifact · gate rung). Fractional numbering was a
  changelog wearing an enum costume.
- **Loop-backs exist at last:** plan-check `NO_GO → replan`, spec-defect → respec, scope-explosion →
  decompose into N minted slices, iteration cap 2 → hard stop.
- **Hard (human) gates:** spec review · mockup sign-off (UI) · ADR approval · live/device check ·
  irreversible actions · CI merge-through · any rigor downgrade. Each halt writes `gate.requested` +
  `blocked_on` → the IDE renders an **approvals inbox**; resolution (`house gate`) wakes the next session.
  "Notify and halt" becomes real instead of a terminal that stopped scrolling.
- **Rigor tiers** (one dial, set at intake, in the manifest, readable by everyone — ending v1's three
  unreconciled dials): `decision` → ADR only · `patch/hotfix` → tasks+evidence+single-reviewer merge gate ·
  `slice` (default) → full set · `high/epic` → panel + mockup + spike. **Floor kept verbatim: the dial
  never skips the merge-gate, and proposing to skip it is itself a hard gate.**
- **Appetite** is declared in the manifest (`1-session | 1-day | N-sessions`); blowing it is a surfaced
  event → scope-hammer or park, never silent extension. (The Shape Up idea that matters most at agent
  throughput, where "one more thing" feels free.)
- **Owner decision D2 (recommended: single reviewer default, panel at high rigor).** simplify calls the
  3-refuter panel process theater for n=1; evolve keeps it with fixes. Recommendation: one fresh
  refute-biased reviewer always (fail-closed, INCONCLUSIVE ≠ pass); the panel runs at `high` tier or on
  owner request. The `accepted.md` suppression ledger is kept verbatim and handed to every reviewer.
- **Owner decision D3 (recommended: keep per-slice retro, ledger computed).** simplify wants retro only
  when deviations ≠ ∅. Recommendation: ledger is always computed (free, from events); prose retro required
  for `slice`+ tiers, optional for patches — a clean patch shouldn't force a form nobody reads.
- Health sweep stays advisory, on-demand cadence; its findings finally get a defined destination
  (`work.discovered` events → roadmap backlog or `accepted.md`).

## 7. The IDE contract (what this whole redesign buys)

The desktop app reads **exactly four surfaces, zero heuristics**:
1. `.house/index.json` — home screen: slice cards (state badge, blocked_on, evidence-backed progress,
   appetite vs elapsed), in-flight units with heartbeats, stalled-session detection.
2. `.house/events.jsonl` tail — live timeline + the **approvals inbox** (unresolved `gate.requested` as
   actionable cards; approving writes the record via `house gate`).
3. Frontmatter + markdown under `docs/` — side pane grouped by slice, typed by `kind`, auto-opening on
   `artifact.written` events; gate records render as an evidence panel (cmd · exit · log click-through).
4. `docs/slices/*/mockups/*.html` — sandboxed CSP-locked webview; self-containment is a validated contract,
   so the pane can never make a network request.
Terminal panes (xterm.js + node-pty in a flow-controlled utility process — VS Code's model) bind to slices
via hook-emitted `session.started` events, never transcript parsing. The IDE writes **only** through
`house` commands. Stack recommendation from research: **Electron** (webview fidelity + pty maturity); final
call belongs to the IDE slice's own spec.

## 8. Deliberate non-adoptions (recorded so they stay decided)

- **OpenSpec delta-specs / capability truth files** — best template in the corpus, still deferred to v2.1:
  large authoring-habit change; the headline benefit (location-is-status) is obtained more cheaply via the
  merge-event projection + `house archive`. The slice-dir layout is forward-compatible.
- **Beads-style DB/daemon** — JSONL + rebuildable index steals the architecture without the machinery.
- **A fourth agent role / ACP as durable contract / spec→code regeneration (Tessl)** — no.
- **Hill charts replacing checkboxes** — one optional `confidence: uphill|over-the-top|downhill` field on
  unit records instead; evidence-gated ticks remain the ledger.

## 9. Migration (~15 repos)

Forward-only, per-repo opt-in, history indexed not moved: `house init` (scaffold `.house/`, hooks,
`.gitattributes`, `docs/slices/` — minutes, idempotent) → `house adopt` (optional: legacy artifacts
fuzzy-mapped to synthetic `L*` ids in a read-only index — **no file moved**, `validate` warn-only on
legacy) → active slices adopted for real (one reconcile-subagent pass each) → v2 skills **refuse to run**
in a repo without `.house/` (and v1 flows refuse where it exists): no repo ever runs half-v1/half-v2.
Proving pair: sdlc-skills itself + edge-scanner, then one iOS repo, then fleet-lazy.

## 10. Slicing proposal (build order, after spec approval)

1. **v2-S1 — kernel + CLI:** `schema/enums.yaml`, slice-dir scaffold, events, `house`
   new/status/event/gate/task/validate/index/render/next. Dogfooded on sdlc-skills.
2. **v2-S2 — skills rewrite:** doctrine v2 (canonical stage table, one rigor dial, take/suppress/own),
   shaper/orchestrator/builder as thin actors; hooks wired.
3. **v2-S3 — migrate the proving pair** (`init` + `adopt` + active-slice adoption).
4. **v2-S4+ — the IDE**, shaped as its own slice against a contract already true on disk (workspace,
   side pane, webview mockups, approvals inbox, terminal panes).

## 11. Verification & acceptance (for the program, measured at S3)

- `house validate --strict` green on both proving repos; deleting + rebuilding `index.json` is a no-op.
- A killed-mid-stage orchestrator session resumes from `house status` alone with zero information loss.
- A shipped slice shows: every gate a record, every task evidence or a reasoned skip, spec state flipped by
  the merge event — no hand-edited status anywhere.
- The IDE prototype (S4) renders home screen, slice detail, mockup pane, and approvals inbox **without one
  filename heuristic or fuzzy match.**

## 12. Scope guards — NOT this program (this pass)

- No delta-spec re-architecture (v2.1 candidate, §8). No daemon, no DB, no fourth role.
- No bulk rewrite of legacy artifacts in any repo. No edits to v1 skills in place (v2 ships alongside;
  v1 archived at cutover).
- The IDE's product design (panes, UX, stack final call) is its own future spec — this spec only fixes the
  contract it consumes.

## 13. Owner decisions — RESOLVED (owner call, 2026-07-28: all per recommendation)

| # | Decision | Resolution |
|---|---|---|
| D1 | 3 skills vs 2 (merge shaper+orchestrator) | **Keep 3** (§5); orchestrator session = optimization, never substrate |
| D2 | Merge-gate: panel vs single reviewer default | **Single refute-biased reviewer default; panel at `high` rigor or on owner request** (§6) |
| D3 | Retro cadence | **Ledger always (computed); prose retro required for `slice` tier, optional for patches** (§6) |
| D4 | Spec+plan as separate files vs merged `slice.md` | **Separate**, spec = five-slot pitch + Requirements (§3.2); single-file form available at patch tier |
| D5 | CLI implementation language | **Node** (lives in `sdlc-skills/cli/`, installed globally) — absorbs the JS workflows + matches hook scripts |

_Sources: the 10-report corpus at `../research/2026-07-28-house-v2/` (deep-dives quote v1 file:line
throughout; research digests carry links). Reviewed against the three proposals' §"what v1 got right"
lists — every kept-verbatim rule (fail-closed gates, CI-red taxonomy, discriminating-test rule,
NEEDS_CONTEXT-don't-guess, suppression ledger, research-dispatch contract, never-builds, rigor floor) is
carried into §5–6 unchanged._
