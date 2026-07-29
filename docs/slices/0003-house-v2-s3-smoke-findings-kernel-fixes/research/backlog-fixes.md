# Research digest — the four `[0002]` smoke-run backlog findings

Written 2026-07-28 by a research subagent for the S3 shaping pass. Scope: read the code, reproduce each
finding against a scratch house repo, propose fix shapes. **Nothing in the CLI was changed.** Baseline at
time of writing: `main`, `cd cli && npm test` → **67/67 pass**, `house validate` exit 0,
`house validate --strict` exit 0.

Source of the four items: [`docs/roadmap.md`](../../../roadmap.md) → "Backlog — discovered in the `[0002]`
smoke run (2026-07-28)"; the underlying `work.discovered` events are `.house/events.jsonl` lines 53–55 and 71.

> **Note on the marker literal.** This file discusses the NEEDS-CLARIFICATION marker and shows regexes
> containing it. `validate --strict` today scans only top-level `*.md` in each slice dir, **not**
> `research/`, so this file cannot trip it. If S3 ever broadens the scan to subdirectories, do the
> code-span strip (F1 fix) in the same change or this digest goes red.

---

## Housekeeping

Slice `0003` was minted (`state: shaping`, `rigor: patch`, appetite 1 session) while this research ran, so
`research/` landed inside an existing slice dir and `house validate` stays **exit 0** — verified after the
write. `research/` is already in `KNOWN_DIRS` (`cli/lib/validate.js:11`), and `--strict` does not scan
subdirectories, so this file is invisible to both checks.

Had the directory been created *before* the mint, two things would have broken, and they are worth knowing
for any future research-first flow: `validate` would report `slice dir without slice.yaml (orphan
directory)` (`validate.js:23`), and `house new` would have allocated `0004` — `nextOrdinal`
(`cli/lib/slices.js:48–52`) is `max(existing) + 1` over `docs/slices/`, so a hand-made `0003` dir pushes the
allocator past it and strands the research. **Mint first, then write research into the slice.**

---

## F1 — `--strict` marker check: false positives + no per-slice scoping

### What the code actually does

`cli/lib/validate.js:31–34`, inside the per-slice loop:

```js
if (args.strict) for (const f of readdirSync(dir).filter(f => extname(f) === '.md')) {
  const text = readFileSync(join(dir, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  if (text.includes('[NEEDS CLARIFICATION')) err(join(dir, f), 'NEEDS CLARIFICATION marker present — handoff blocked (--strict)');
}
```

Three separate defects sit in those four lines:

- **Naive substring.** The only carve-out is HTML comments (so the freshly minted `spec.md` template stays
  green). A backticked code span, a fenced block, or ordinary prose quoting the marker all trip it. This
  is not theoretical: it produced the S2 **merge-gate NO_GO** (finding F1 in
  `docs/slices/0001-house-v2-s2-skills-rewrite/gates/merge_gate.yaml`, commit `38c128a`), and the "fix" was
  to **reword a truthful retro sentence** to satisfy the linter — the record was degraded to make the tool
  happy, which is exactly backwards.
- **Every `.md` in the slice dir is scanned**, including `retro.md`, `merge-gate.md`, and `plan-check.md`.
  Those are post-hoc narrative documents whose *job* is to discuss things like unresolved markers. The rule
  exists to stop an unresolved question surviving into a **handoff artifact**; `retro.md` cannot block a
  handoff, because retros are written at closeout.
- **No scoping at all.** `validate()` ignores every arg except `args.strict` / `args.json`. The loop is
  `for (const d of readdirSync(slicesDir).sort())` — whole repo, always.

### Reproduced

Scratch repo, two slices; a *quotation* of the marker added to `0002-beta-thing/spec.md`:

```
$ house validate --strict
error: …/docs/slices/0002-beta-thing/spec.md: NEEDS CLARIFICATION marker present — handoff blocked (--strict)
exit=1
$ house validate --strict --slice 0001-alpha-thing     # flag is silently ignored
error: …/docs/slices/0002-beta-thing/spec.md: NEEDS CLARIFICATION marker present — handoff blocked (--strict)
exit=1
```

`skills/house2-shaper/SKILL.md:83` makes `house validate --strict` (repo-wide) the literal handoff bar, so
one slice's prose blocks every other slice's `house state <id> ready`.

### Options

| # | Shape | Tradeoffs · test implications |
|---|---|---|
| **A** | **Scoping only** — `--slice <id>` filters the per-slice loop; unknown id throws `no such slice`. ~4 lines. | Smallest possible. Fixes blast radius, not the false positive. One new test in `cli/test/validate.test.js` (two slices, one dirty, scoped run green + bogus-id run exit 1). Leaves the "reword your retro" pathology intact. |
| **B** | **Precision only** — strip fenced blocks and inline code spans in addition to HTML comments, and require a *well-formed* marker: `/\[NEEDS CLARIFICATION\b[^\]]*\]/`. ~4 lines. | Kills the S2 NO_GO class (that quote had no closing bracket *and* was in backticks — either half catches it). Still repo-wide, so one genuinely-unresolved spec anywhere still blocks everyone. Test: extend the existing strict test with a backticked quote + a fenced quote that must stay green, plus a real marker that must still fire. |
| **C** | **B + scope the scan to handoff artifacts** (`spec.md`, `plan.md`) — narrative docs (`retro.md`, `plan-check.md`, `merge-gate.md`) are exempt by name. | Matches what the rule is *for*. Semantic change to the gate bar: worth a spec line, not a silent patch. Cheap in code (one `Set`), one test asserting a marker in `retro.md` no longer blocks while one in `spec.md` does. |

### Recommendation

**A + B + C, as one task** — they are three lines in the same block and splitting them costs more than it
saves. Fail-closed is preserved on every axis that matters:

- default (no `--slice`) stays whole-repo; scoping is **opt-in and named by the caller**, so nobody
  silently narrows the bar;
- `--slice <id>` with an unknown id must **throw**, not quietly validate zero slices — otherwise
  `house validate --strict --slice typo` exits 0 and looks green, which is the exact failure mode the
  kernel exists to prevent;
- the marker regex gets *stricter about form* (requires the closing bracket), not laxer about intent;
  the only thing exempted is text the author explicitly marked as a quotation (code span/fence) or as
  narrative (`retro.md` et al).

Then update the shaper's handoff bar (`skills/house2-shaper/SKILL.md:83`) to
`house validate --strict --slice <id>` — a doctrine change that belongs in the S3 spec, since it changes
what "green at handoff" asserts.

---

## F2 — no artifact/frontmatter cross-check

### What the code actually does

Two independent records of the same fact, with nothing comparing them:

- **`slice.yaml`** → `artifacts.<name>.state`, written only by `house artifact`
  (`cli/lib/slices.js:126–143`), which enforces `artifact_transitions` and emits `artifact.state_changed`.
- **The document's own frontmatter** → `status:` (free prose) and `state:` (an `artifact_states` value),
  seeded by `cli/templates/spec.md` as `status: "shaping"` / `state: draft`, and thereafter **hand-edited
  by the shaper**. `plan.md` carries the same two keys by convention, written entirely by hand — no
  template, no writer, no check.

`validate()` reads frontmatter in exactly one place: the ADR state enum (`validate.js:88–94`). Slice
artifacts are checked for enum-legality and skip-reasons (`validate.js:27–30`) and never against the file.

### Reproduced

```
$ house artifact 0001-alpha-thing spec draft && … awaiting_review && … approved
$ grep -A1 status: docs/slices/0001-alpha-thing/spec.md
status: "shaping"
state: draft                     # ← slice.yaml says approved
$ house validate ; echo exit=$?
exit=0
```

That is the `[0002]` drift verbatim: the user approved the spec, `house artifact … approved` was run, and
`spec.md` kept saying `status: shaping` / `state: draft` until it was hand-reconciled in the `0002` plan's
as-built section.

Current repo state is clean — `0001` and `0002` both carry `state: approved` in `spec.md`/`plan.md`
frontmatter and `approved` in `slice.yaml` — so a new rule can ship **as an error without turning the repo
red**. (`0001`'s `artifacts:` map is `{}`, i.e. never populated; the rule must treat an absent record as
"nothing to compare", not as drift.)

### Options

| # | Shape | Tradeoffs · test implications |
|---|---|---|
| **A** | **Strict equality** — for a name→file map (`spec`→`spec.md`, `plan`→`plan.md`), `man.artifacts[n].state` must equal frontmatter `state`. | Simplest to state, wrong in practice: `approved` vs `done` skew after ship is legitimate and would fire constantly. |
| **B** | **Ladder comparison** — rank `todo<draft<awaiting_review<approved<done`, flag when the file is *behind* the manifest. | Correct in general; introduces a second ordering that must be maintained alongside `artifact_transitions` in `schema/enums.yaml`. `skipped`/`superseded` are off-ladder and need explicit carve-outs. Most code of the three. |
| **C** | **Approval-boundary only** — if the manifest says `approved` or `done`, the file's frontmatter `state` must be in `{approved, done}`. Everything below approval is unwatched churn. | ~8 lines, no new enum, targets the one drift anyone gates on. Catches the `[0002]` case exactly. Tests: manifest-approved + file-draft → error; both approved → clean; no artifact record → clean. |

### Recommendation

**C**, with two hardening details that keep it fail-closed:

- **Missing is not innocent.** If the manifest claims `approved`/`done` and the mapped file has no
  frontmatter, or no `state:` key, emit a finding — otherwise the check is evaded by deleting the
  frontmatter. Ship it at `warning` level (it makes the hand-written `plan.md` convention *visible* before
  it is *binding*); promoting it to `error` later is a one-word change.
- **Never crash on a bad document.** Wrap the `parseFrontmatter` call in the same `try/catch` the ADR lint
  already uses (`validate.js:91–92`) — a malformed spec is a finding, not a stack trace.

Names outside the map are skipped silently, which is the necessary fail-open: artifact names are free-form
(`house artifact <id> <any-name> <state>`), so a typo'd name has no file to check against. Worth one line
in the S3 spec's Rabbit Holes as a known gap.

---

## F3 — gate/event payload loss (and the stale half of the finding)

### What the code actually does

`cli/lib/slices.js:96–100`:

```js
const extra = typeof args.payload === 'string' ? JSON.parse(args.payload) : (args.payload ?? {});
const rec = { gate, verdict: args.verdict, by: args.by ?? 'agent',
  recorded_at: new Date().toISOString(), notes: args.notes ?? null, ...extra };
writeYaml(join(dir, 'gates', `${gate}.yaml`), rec);
appendEvent(root, 'gate.recorded', { slice: args.slice, actor: rec.by, payload: { gate, verdict: args.verdict } });
```

The event payload is a hardcoded two-key literal. `extra` **and** `notes` are both dropped from the
OBSERVED copy. Confirmed by reproduction: `--payload '{"lenses":["a","b"]}'` lands in
`gates/spec_review.yaml` and the event reads `{"gate":"spec_review","verdict":"approved"}`.

**The second half of the backlog item is stale.** `house event <type> --payload` does **not** drop the
payload today — `emit()` (`slices.js:156–164`) parses and forwards it, it is covered by
`cli/test/slices.test.js:61` ("emit: house event passes through with slice + parsed payload"), and the S2
merge-gate NO_GO record's own manual reruns list `house event --payload persisted to events.jsonl`.
Reproduced clean:

```
$ house event work.discovered --slice 0001-alpha-thing --payload '{"summary":"x"}'
{"id":"01KY…","event":"work.discovered","slice":"0001-alpha-thing","actor":"agent","payload":{"summary":"x"}}
```

S3 should **close that half as not-reproducible** rather than budget work for it.

### Options

| # | Shape | Tradeoffs · test implications |
|---|---|---|
| **A** | **Inline everything** — `payload: { gate, verdict, notes, ...extra }`. One line. | OBSERVED becomes self-contained. But a `merge_gate` payload is ~2 KB of findings/reruns (see `0001`'s record); `house log` prints `JSON.stringify(e.payload)` per line (`cli/lib/derive.js:58`), so the log becomes unreadable and `events.jsonl` bloats with a second copy of a git-tracked file. |
| **B** | **Reference + manifest** — `payload: { gate, verdict, notes, record: 'docs/slices/<id>/gates/<name>.yaml', detail: [<extra keys>] }`. | Nothing is *silently* dropped: the event names where the detail lives and which keys it had. Log stays scannable. Matches the existing kernel stance — `readEvents` counts torn lines rather than hiding them (`core.js:56`), and the gate `*.yaml` is already the machine-read verdict (`validate.js:9`). Tests: one assertion that the event carries `record` + the `detail` key list and that the yaml still holds the values. |
| **C** | **A with a size cap** — inline under N bytes, else truncate and set a `truncated: true` flag. | Best of both on paper; a magic threshold is a new tuning knob and truncation invites "was it truncated?" doubt at exactly the moment (a gate) where doubt is expensive. |

### Recommendation

**B.** The durable record already exists and is committed alongside the event; duplicating it buys nothing,
while *not naming it* is the quiet lie. Fold `notes` into the payload directly (it is a short string and
its absence is pure loss). Same task as F4 — see coupling.

---

## F4 — `--actor` silently dropped by `house gate`

### Root cause (confirmed, and it is not a race or an override)

`house gate` is the **only** writer that reads `--by`. Every other command reads `--actor`:

| Command | Flag read | Line |
|---|---|---|
| `house gate` | **`args.by`** | `slices.js:97`, `actor: rec.by` at `:100` |
| `house event` | `args.actor` | `slices.js:163` |
| `house block` / `unblock` | `args.actor` | `slices.js:122`, `:152` |
| `house artifact` | `args.actor` | `slices.js:141` |
| `house unit` (all three) | `args.actor` | `slices.js:221`, `:232`, `:243` |
| `house pr` | `args.actor` | `slices.js:203` |
| `house state` | `args.actor` | `slices.js:266`, `:270`, `:272` |
| `house new` | `opts.actor` | `slices.js:64`, `:79` |

The arg parser (`cli/bin/house.js:16–23`) accepts **any** `--flag` into `args` and nothing validates the
keys, so `--actor reviewer` on a `gate` call is parsed, stored, and never read. `by` falls back to
`'agent'`, and `appendEvent` copies that same fallback into the event.

This explains the NO_GO/GO discrepancy exactly, with no inconsistency in the code:

- NO_GO (`38c128a`, event line 68) → `by: reviewer` — that invocation used `--by`, as
  `skills/house2-shaper/SKILL.md:50` and `cli/README.md:66` both document.
- GO (`8107159`, event line 69) → `by: agent` — that invocation used `--actor`, the spelling every *other*
  house command teaches.

Reproduced side by side:

```
$ house gate spec_review --slice 0001-alpha-thing --verdict approved --actor reviewer …
by: agent          # ← flag accepted, never read; event actor: agent
$ house gate plan_check --slice 0001-alpha-thing --verdict GO --by reviewer
by: reviewer       # ← event actor: reviewer
```

### Options

| # | Shape | Tradeoffs · test implications |
|---|---|---|
| **A** | **Accept both** — `by: args.actor ?? args.by ?? 'agent'`. One line. | Instant fix, backwards compatible. Two spellings live forever; the next person reading `README` still learns the odd one. |
| **B** | **A + canonicalize on `--actor`** — sweep `cli/README.md:66` and `skills/house2-shaper/SKILL.md:50` to `--actor`, keep `--by` as an undocumented alias, keep the record field named `by:` (it reads correctly in YAML). | Same one-line code change plus a two-line doc sweep. The CLI stops teaching a flag that exists nowhere else. Test: one assertion per spelling. |
| **C** | **B + unknown-flag guard** — a per-command known-flag table in `bin/house.js`; an unrecognized `--flag` exits 2 with `unknown flag --x for house gate`. ~20 lines + the table. | The only fix for the *class*. A silently-swallowed flag is the same failure family as a silently-dropped payload — the kernel exists to refuse exactly this. Cost: the table must be complete or working invocations start failing; needs a test per command family, and `house hook` must stay exempt (advisory-only, never exits non-zero — `bin/house.js:51–58`). |

### Recommendation

**B now, C in the same slice if the appetite holds** — and C is the item to cut first if it does not. B
alone leaves the door open for the next `--verdit` / `--noties` typo to be swallowed with an exit 0, which
is materially the same defect wearing a different flag name. Land C **after** B and F3 so the new table is
written against the final flag set; when it lands it will also prove the doc sweep, because any surviving
`--by` in a skill or README example immediately exits 2 in a smoke run.

---

## Coupling and task ordering

Two independent clusters, two files, no cross-file conflicts:

**Cluster V — `cli/lib/validate.js` + `cli/test/validate.test.js`** (F1, F2)
1. **F1** first: `--slice` scoping + marker precision + handoff-artifact scoping.
2. **F2** second: the artifact/frontmatter cross-check is a new rule *inside the same per-slice loop*, so
   sequencing it after F1 means it inherits `--slice` scoping for free and needs no scoping logic of its own.
   Reversing the order duplicates work and conflicts in the same hunk.

**Cluster G — `cli/lib/slices.js` `recordGate()` + `cli/test/slices.test.js`** (F3, F4)
3. **F3 + F4 are the same eight lines** (`slices.js:96–100`): F4 changes where `by` comes from, F3 changes
   what `appendEvent` receives — and `appendEvent`'s `actor` is `rec.by`, so F4 must be resolved for F3's
   event to carry the right actor. Do them as **one task**, not two.
4. **F4-C** (unknown-flag guard, `cli/bin/house.js`) last: it touches the dispatcher every command flows
   through, so landing it after the flag set is final avoids re-editing the table.

**Shared tail — one docs task.** `cli/README.md` rows 66 (`gate --by` → `--actor`, note the event's
`record`/`detail` keys) and 81 (`validate --slice`, the new cross-check, the narrowed marker rule);
`skills/house2-shaper/SKILL.md:50` (`--by` → `--actor`) and `:83` (handoff bar → `--strict --slice <id>`).
Doing this once at the end beats touching the same two files in four tasks.

**One decision that is not code.** F1-C and the handoff-bar change alter what "strict green" *asserts* at a
gate. That is doctrine, not a lint tweak — it belongs in the S3 spec text (and, if the shaper judges it
so, in front of the user) rather than riding in silently as a patch.

## Size estimate

| Task | Files | Lib Δ | New tests |
|---|---|---|---|
| V1 — strict scoping + marker precision + artifact-file scoping | `validate.js`, `bin/house.js` (arg pass-through already works) | ~10 | 2–3 |
| V2 — artifact/frontmatter approval cross-check | `validate.js` | ~10 | 2 |
| G1 — `--actor` alias + gate event payload (record ref + detail keys + notes) | `slices.js` | ~6 | 2–3 |
| G2 *(cut candidate)* — unknown-flag guard | `bin/house.js` | ~20 | 2 |
| D1 — docs sweep | `cli/README.md`, `skills/house2-shaper/SKILL.md` | ~6 doc lines | 0 |

**~50–60 lines of library code, ~9 new tests (67 → ~76), 5 tasks, 3 source files + 2 docs.** Comfortably one
session; one unit. **Patch tier fits the code**, with the caveat above that the doctrine half (what the
strict bar means at handoff) is a spec-level call, not a patch-level one — if the shaper wants that decision
recorded, the slice is `slice` tier with a one-paragraph spec, not `patch`.

Every change is behind an existing gate bar: `cd cli && npm test` plus `house validate --strict` on this
repo, which stays exit 0 throughout (verified: current frontmatter/artifact records are already consistent,
and no slice `.md` outside `research/` quotes the marker).
