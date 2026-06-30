# Design — Shared docs & hygiene doctrine (Piece A)

- **Date:** 2026-06-30
- **Repo:** `sdlc-skills` (the house SDLC skills — a published, versioned, install-via-symlink artifact)
- **Status:** approved design, pre-plan
- **Part of:** a three-piece ecosystem redesign. **A (this spec)** → shared doctrine + dev-state contract +
  routing, *and* wiring the two highest-value self-checks live (dev-state lint @ reconcile, per-merge teardown
  @ finish). **B** → the remaining self-checks (resume git-reality, broad hygiene sweep, repo-setup readiness).
  **C** → a new `house-shaper` skill for front-of-loop research/brainstorm/reconcile. Chosen sequencing:
  doctrine-first (B and C depend on A).

## Why

A real session exposed two classes of rot the ecosystem never prevented:

1. **Hygiene rot is no one's job.** The loop *creates* artifacts (a worktree + branch + PR per unit) but no
   stage *owns* tearing them down. Cleanup only happened reactively at the next session's resume check, so
   between sessions stale local/remote branches, worktrees, and stashes accumulated. (GitHub
   auto-delete-head-branch was also never enabled.)
2. **No shared substrate.** There was no canonical doc-model — which docs exist, what each is for, what's
   allowed in each, which stage owns it. So `dev-state.md` had no allowlist and became a kitchen sink (it
   absorbed the live roadmap + locked decisions + SEO calls); `roadmap.md` existed but no stage kept it
   current, so it went stale; decisions had no routing rule to ADRs.

Root finding: **the rules were implicit and nothing verified them.** The fix is an explicit, project-agnostic
doctrine the skills cite, with active self-checks at defined gates (decided separately; wiring = Piece B).

## Constraints

- **Project-agnostic.** These skills ship to iOS and web users. The doctrine names roles and rules
  generically; LeadBook/web specifics are illustrative only.
- **Token-lean.** The doctrine is read **on-demand** at doc-touching / reconcile / finish / resume moments —
  never always-loaded. Each skill body carries only a one-line pointer + the trigger moments. (Per
  `docs/best-practices.md`: a big doc read once is cheap; an always-loaded one is not.)
- **No `install.sh` change.** Reuse the existing `$HOME/.claude/skills/house-orchestrator/...` absolute-path
  reference pattern the workflow scripts already use.
- **Published-site parity.** `docs/*.html` are hand-authored (bespoke CSS, no generator). Any prose change to a
  `docs/*.md` must be mirrored by hand into its matching `docs/*.html`, and the index/README checked.

## Deliverables (Piece A scope)

### 1. The doctrine file — `skills/house-orchestrator/references/doctrine.md`

A new runtime reference owned by the orchestrator (the doc/state owner), cited by the builder (and later the
shaper) via absolute `$HOME` path. Contents:

**a) Doc model** — the canonical doc set, each with one job + an owning stage:

| Doc | Job | Owner |
|---|---|---|
| `dev-state.md` | operational tracker — where we are / what's next | every stage transition + session end |
| `roadmap.md` | durable spine: sequencing, gating, milestones, future expansions | shaper / reconcile |
| `docs/adr/NNNN-*.md` | decision records — *why* a call was made | shaper / reconcile, on any decision |
| `docs/<specs>` · `<plans>` | per-slice spec + plan | brainstorm / plan |
| `docs/retros/` | per-slice retro | reconcile (stage 11) |
| `docs/health/` | sweep backlog + `accepted.md` | health-sweep |

`roadmap.md` is the **blessed canonical name** for the durable-strategy doc (with "or equivalent" noted for
portability) so the routing rules can name a concrete target.

**b) dev-state contract (allowlist)** — dev-state holds ONLY: active slice (id/stage/next-action/blocked-on) ·
in-flight builders/PRs · slated · done (retro index) · infra/secrets pointers · gotchas · process notes.
**Banned → routed out:** durable roadmap/sequencing, decisions + rationale, strategy/positioning, anything
that isn't current operational state. Rule of thumb: *if it would still be true and worth knowing three slices
from now, it isn't dev-state.*

**c) Routing rules** — decision (chose X over Y + why) → **new ADR** · scope/priority/sequencing change →
**roadmap** · progress/blockers → **dev-state** · as-built drift → reconcile **spec/plan** in the slice PR ·
deferred debt → roadmap backlog or `docs/health/`.

**d) Hygiene checklist** — the git/doc cleanliness contract (content here; stage-wiring is Piece B):
- *Per-merge (finish):* unit branch deleted (prefer GH auto-delete-head-branch, else explicit prune), worktree
  removed, no leftover stash.
- *Repo-setup (one-time):* enable auto-delete-head-branch; `.gitignore` covers IDE/tooling noise.
- *Session-end / reconcile:* dev-state passes the allowlist; no stale local branches/worktrees/stashes; no
  merged-but-undeleted remote branches.
- *Resume:* the git-reality check **plus the squash-merge caveat** — git's `--merged` does NOT recognize
  squash-merged branches; confirm merged-ness via PR state (`gh pr list --state merged`) before pruning.

### 2. dev-state template — `skills/house-orchestrator/dev-state.template.md`

Update to the allowlisted structure (fixed sections only) so the template itself models the contract.

### 3. Skill citations

`house-orchestrator/SKILL.md` and `house-builder/SKILL.md` get a one-line pointer to the doctrine + the
trigger moments at which to read it (reconcile / finish / resume for the orchestrator; doc-reconcile / teardown
for the builder). No rule duplication — the skills point, the doctrine holds.

### 4. Wire two active self-checks (A goes live)

A doesn't just author the rules — it activates the two highest-value checks at their creation points, so new
rot can't form while B (the broader safety net) is still pending:

- **dev-state lint @ orchestrator reconcile (stage 11):** before writing the resting state, the orchestrator
  checks `dev-state.md` against the allowlist and migrates any stray durable content out to roadmap/ADR.
- **per-merge teardown @ orchestrator finish (stage 10):** after merge, prune the merged unit branch, remove
  the unit's worktree, and verify no stray stash. (The builder, which created the worktree in multi-session
  topology, leaves it clean for this teardown.)

The remaining self-checks (strengthened resume git-reality check, broad session-end hygiene sweep, one-time
repo-setup readiness) are **Piece B**.

### 5. Human docs + site + version

- `docs/process.md` — add a short "Docs & hygiene doctrine" section (human-facing) pointing at the runtime
  reference; mirror into `docs/process.html`.
- Check `docs/index.html` and `README.md` for anything that lists the doc-model / sections and update if so.
- `docs/best-practices.md` / `docs/case-study.md` — likely unchanged (cost theory is unaffected); verify.
- `VERSION` 0.1.0 → 0.2.0 (skill contract change).

## Non-goals (NOT this slice)

- **The remaining self-checks** — the strengthened **resume** git-reality check (squash-merge caveat), the
  **broad session-end hygiene sweep** (scan for *any* stale local branches/worktrees/stashes and
  merged-but-undeleted remote branches beyond the just-merged unit), and the one-time **repo-setup readiness**
  items (auto-delete-head-branch, `.gitignore` coverage) — are **Piece B**. (Piece A wires only the dev-state
  lint @ reconcile and per-merge teardown @ finish; see Deliverable 4.)
- **The `house-shaper` skill** — Piece C.
- Any change to the merge-gate / health-sweep workflows, stack gates, or model routing.
- Backfilling existing consumer projects' docs (web-services is already reconciled by hand).

## Success criteria

- A single project-agnostic `doctrine.md` exists and is cited (not duplicated) by both skills.
- The dev-state template and contract make the allowlist unambiguous — a reader can tell at a glance whether a
  line belongs in dev-state or should route to roadmap/ADR.
- `process.md` + `process.html` explain the doctrine to a human; the site stays self-consistent.
- `VERSION` reflects the contract change.
- No always-loaded weight added (doctrine is on-demand; skill bodies grow by ~a pointer each).
- **A goes live:** the dev-state lint runs at every reconcile and per-merge teardown runs at every finish — so
  no *new* dev-state bloat or undeleted branch/worktree/stash can form from this point, even before Piece B.
