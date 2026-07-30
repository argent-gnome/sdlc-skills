# Research digest — `house validate --strict` nested-fence false positive

> Dispatched by the `[0007]` shaping session (2026-07-29), Opus subagent, read-only.
> Question: how does the `--strict` fence stripper work today, why does a nested fence defeat it,
> what is the blast radius of a correct fix, and what are the options?

## Findings

### 1. Reproduction (exact)

Run from repo root, on `main` (working tree clean except `.house/events.jsonl`):

| command | exit | output |
|---|---|---|
| `node cli/bin/house.js validate --strict` | **1** | `error: …/docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md: NEEDS CLARIFICATION marker present — handoff blocked (--strict)` |
| `node cli/bin/house.js validate` | **0** | (no output) |
| `… validate --strict --slice 0003-house-v2-s3-smoke-findings-kernel-fixes` | **1** | same single error |
| `… validate --strict --slice 0007-validate-strict-nested-fence-false-positive` | **0** | — |
| `cd cli && npm test` | **0** | 72 pass / 0 fail |

**There is no line reference in the finding** — `err(p, …)` at `cli/lib/validate.js:55` carries only the file
path. `--json` gives `{errors: 1, findings:[{level, path, msg}]}`. Exactly one error repo-wide; it is the
only `--strict` red.

### 2. The current stripper — verbatim

`cli/lib/validate.js:47-56`:

    if (args.strict) for (const f of ['spec.md', 'plan.md']) {   // handoff artifacts ONLY
      const p = join(dir, f);
      if (!existsSync(p)) continue;
      const text = readFileSync(p, 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')                         // template's marker lives in a comment
        .replace(/```[\s\S]*?```/g, '')                          // fenced code blocks quote, not declare
        .replace(/`[^`\n]*`/g, '');                              // inline code spans likewise
      if (/\[NEEDS CLARIFICATION\b[^\]]*\]/.test(text))
        err(p, 'NEEDS CLARIFICATION marker present — handoff blocked (--strict)');
    }

Only these three lines are the fence logic. No other fence stripper exists in `cli/lib/` — the sibling
`[\s\S]*?` uses are frontmatter (`core.js:23`), a unit-report replace (`slices.js:244`) and the dev-state
manual-block marker (`derive.js:81`). **Single site to fix.**

Wiring: `cli/bin/house.js:35` (`validate: ['strict','json','slice']` in the fail-closed FLAGS table) and
`cli/bin/house.js:63-68` (exit 1 iff any finding is `level === 'error'`). `--slice` is enforced fail-closed at
`validate.js:19-22` and filters the loop at `validate.js:24`. **None of that needs to change.**

### 3. Root cause — mechanically

The offending region is `docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/plan.md`:

- **line 48** opens a ```` ```js ```` fence (real)
- **line 58** is, verbatim, four spaces then: `'` + three backticks + `\n[NEEDS CLARIFICATION: inside a fence]\n` + three backticks + `\n' +`
- **line 84** closes the fence (real)

The nesting is **not** an indented fence, **not** a longer/shorter run, **not** a fence inside a code span.
It is **two three-backtick runs occurring mid-line inside a JavaScript single-quoted string literal**.
Under CommonMark, line 58 is not a fence at all — a fence must start the line (≤3 spaces indent) and
contain nothing but the fence run plus an info string. **This is what makes the fix easy: line-oriented
fence tracking rejects line 58 outright.**

The current regex is **byte-oriented, not line-oriented**. The non-greedy pair matches run #1 (line 48)
against run #2 (line 58, first occurrence). `lastIndex` then resumes mid-line-58, so the string body
between the two runs on line 58 is **re-exposed**. Verified surviving neighborhood in the stripped text:

    "- [ ] **Step 1: Write the failing tests** — append to :\n\n\\n[NEEDS CLARIFICATION: inside a fence]\\n\n\n- [ ] **Step 2: Run to verify they fail**"

Run #3 (line 58, second occurrence) then pairs with line 84. Because line 58 carries an **even** number of
fence runs, parity for everything past line 84 is restored *by accident* — the later fences still pair
correctly.

> **An odd count on one line would invert every subsequent fence in the file**, silently exposing or hiding
> everything after it. That is the latent, dangerous form of this bug — a false **negative** — and it argues
> against any parity-based patch.

Ironically, the exposed text is the plan's own quoted fixture from the R-1 test (`cli/test/validate.test.js:182`)
— the tool is red on the plan that specified the tool.

### 4. R-1 — the governing spec text

`docs/slices/0003-house-v2-s3-smoke-findings-kernel-fixes/spec.md:44-50`, verbatim:

> ### R-1: strict marker check — well-formed, handoff-scoped, sliceable
> The `--strict` marker check matches only a well-formed marker (`\[NEEDS CLARIFICATION\b[^\]]*\]`) after
> stripping fenced code blocks and inline code spans; it scans only handoff artifacts (`spec.md`,
> `plan.md`) — never `retro.md`, `plan-check.md`, `merge-gate.md`, or `research/`. `house validate`
> accepts `--slice <id>`: checks run for that slice only, and an unknown id is an error (exit 1), never a
> silent green. The shaper handoff bar becomes `house validate --strict --slice <id>`
> (`skills/house2-shaper/SKILL.md` §9 updated); repo-wide `--strict` keeps covering every slice.

Scenario 1 (`spec.md:52-55`) is load-bearing: *"Given a slice doc whose prose or backticked text mentions the
marker without a well-formed instance / When I run `house validate --strict` / Then the exit code is 0."*

**A correct fence-stripper does not violate R-1 — it is the first honest implementation of it.** R-1 says
"after stripping fenced code blocks"; it does not specify a regex. **No spec amendment is required.** The
`[0007]` spec should cite R-1 as parent and state the stripping algorithm precisely, so the next implementer
cannot regress to a regex pair.

Roadmap backlog entry: `docs/roadmap.md:164-183`.

### 5. Blast radius — quantified

A CommonMark-style line-based stripper was prototyped and its output diffed against the current stripper
across all 75 tracked `.md` files.

**Classification change — the whole list:**

| file | today | after fix |
|---|---|---|
| `docs/slices/0003-…/plan.md` | **RED** | green |

**Zero files go green → red. No currently-hidden real marker gets newly exposed.** The fix turns exactly
one red into zero reds. This was the single most important risk and it is empirically nil.

Both plausible orderings were checked — (B) strip HTML comments then track fences (today's order), and
(C) track fences then strip comments — and they produce **identical** classifications across all 12 tracked
`spec.md`/`plan.md` files plus the untracked `0007/spec.md`.

Only `spec.md` and `plan.md` under `docs/slices/*/` are ever read by the strict check (`validate.js:47`), so
`cli/`, `archive/`, `skills/`, `docs/superpowers/`, `docs/roadmap.md` and `research/` are **outside the blast
radius entirely** regardless of their fence shapes.

For completeness, 28 of 75 `.md` files produce *different stripped text* under the two algorithms — nested
fences in quoted code are common in this repo. **None of those differences matter**: either the file is never
scanned, or it contains no `[NEEDS CLARIFICATION` at all.

Two edge cases probed for and found **absent** from the repo today:

- **Tilde fences (`~~~`)**: zero occurrences in any `.md` file. The current code does not handle them at all
  (a `~~~` block's contents are never stripped, so a marker quoted in one is a false positive *today*).
  Supporting them is cheap and forward-looking; nothing currently depends on it.
- **Unclosed fences**: zero files have one. CommonMark says an unclosed fence runs to end of document — so a
  line-based tracker would blank everything after it, which is a **marker-hiding** vector the current regex
  does not have (an unpaired trailing fence is simply left alone today). No live impact, but it is the one
  respect in which a "correct" fix is strictly **more permissive** than the status quo. Deserves a pinned test
  and an explicit ruling.

One adjacent latent bug, noted not fixed by default: HTML comments are stripped **before** any fence reasoning
(`validate.js:51`), so a lone unbalanced `<!--` quoted inside a fence would swallow forward across fence
boundaries — same bug class, one layer up. Unbalanced instances do not exist today (every occurrence in
`0001/plan.md` and `0003/plan.md` is balanced on its own line), so it is inert. Ordering (C) — fences first,
then comments — removes the class at zero cost, since both orderings test identically.

### 6. Dependency stance

`cli/package.json` declares exactly one runtime dependency: `js-yaml@^4.3.0`. `npm ls --depth=0` confirms the
whole tree is that one package. No devDependencies; tests are `node --test test/*.test.js`; no build step; the
entire library is five files under `cli/lib/`.

There is **no ADR forbidding dependencies**, but ADR-0003 (`docs/adr/0003-no-hosted-ci-local-verification.md`)
establishes the operative value: verification must be *"runnable from a bare terminal in under a second"* with
no external infrastructure. Adding `markdown-it`/`remark` — a transitive tree, for a ~20-line problem, in a
tool whose pitch is a one-dep footprint — cuts against that grain hard. **Treat "no new dependency" as a
strong convention, not a hard rule.**

### 7. Test bar — how `cli/test/` actually works

All fixtures are **inline strings written into throwaway temp repos**. `cli/test/helpers.js` exports
`mkTmpRepo()` (an `mkdtempSync` repo with `.house/`, `docs/slices/`, `docs/adr/`) and
`run(cwd, ...args) → {out, code}`. **No fixture files on disk anywhere** — nothing in `cli/test/` reads from
`docs/`. A test depending on `docs/slices/0003-…/plan.md` would be the first of its kind and would break the
moment that doc is edited; **do not write one.**

Tests touching validate/strict/markers:

- `cli/test/validate.test.js` — the only file with strict/marker coverage. 10 tests.
  - `:36-48` — marker blocks, but not inside HTML comments; ADR state enum checked.
  - `:173-200` — *"validate --strict R-1: well-formed markers only, handoff artifacts only, --slice scoping"*.
    **Direct ancestor of the bug**: line 182 writes a fenced marker fixture into a spec — the exact construct
    that, when *quoted in a plan*, defeats the stripper. Also covers code-span quoting (`:181`), bracketless
    prose (`:183`), `retro.md` exemption (`:185`), scoping (`:186-196`), `plan.md` as handoff artifact (`:198-199`).
  - `:202-207` — `--slice` fails closed.
- `cli/test/cli.test.js` — no strict/marker assertions; owns subprocess-level checks incl. the unknown-flag guard.

**A discriminating test pair:**

*(a) Fails today, passes after.* A `spec.md`/`plan.md` containing a real fence whose **body** has a mid-line
embedded fence run inside a quoted string — reproducing `0003/plan.md:48/58/84` as an inline string — followed
by ordinary prose and a real fence later in the file. Assert zero errors. Add a second case where the embedded
line has an **odd** count of runs, so the parity-inversion failure mode is pinned too; that variant is more
sensitive than the real-world one, since the real file's even count self-heals.

*(b) Proves detection was not simply disabled.* Same file, plus a genuine top-level marker in prose **after**
the fence closes. Assert exactly one error naming that file. Strengthen with a real marker sandwiched *between*
two separate fenced blocks (proves fences close at the right line rather than swallowing to EOF), and re-assert
that `validate.test.js:173-200` still passes verbatim — that test is the existing anti-over-strip net.

Also pin: a `~~~` fence containing a marker (must not trip), and a file ending with an **unclosed** fence
followed by a marker (semantics must be decided and recorded).

## Options

**A — Line-by-line CommonMark fence-state tracking.** Replace the two regexes with a ~15-line loop: per line,
match `/^ {0,3}(`{3,}|~{3,})(.*)$/`; when closed, that opens a fence (rejecting backtick-fences whose info
string contains a backtick, per CommonMark); when open, only a run of the *same char* with *length ≥ opening*
and empty rest closes it. Blank fenced lines, then apply the existing code-span regex to what remains.
*Pros:* fixes the defect at its actual level; kills the parity-inversion class; picks up `~~~` free; no
dependency; ~15 lines in one place; verified zero classification change beyond the intended one.
*Cons:* introduces a small state machine into a currently-declarative file; must consciously decide
unclosed-fence semantics; still not a full parser (4-space indented code blocks, link reference definitions,
setext edge cases remain unmodeled).

**B — Character scanner over the whole document.** One pass tracking mode ∈ {text, fence, code-span}.
*Pros:* also resolves the fence/code-span interaction in one correct order.
*Cons:* strictly more code and state than A for **zero additional classification change in this repo** —
measured. Fences are a *line-level* construct in CommonMark, so a character scanner is the wrong shape for
the actual bug. Over-engineering for patch tier.

**C — Add a real markdown parser (`markdown-it`/`remark`) and walk the AST.**
*Pros:* correct by construction; no bespoke markdown code to maintain.
*Cons:* takes the CLI from 1 runtime dependency to a tree of them, against ADR-0003's spirit. Disproportionate
to a 15-line fix. Also a decision that should be an ADR, not a patch-tier slice.

**D — Fix the document, not the tool.** Rewrite `0003/plan.md:48-84` with a four-backtick outer fence.
*Pros:* zero code, zero risk, immediately green — and arguably better markdown regardless.
*Cons:* leaves the defect armed. The shaper's handoff bar is `house validate --strict --slice <id>`
(`skills/house-shaper/SKILL.md:83`), and 28 of 75 `.md` files already contain nested fences. It will re-fire,
next time possibly as a **false negative** (odd-count parity inversion hiding a real marker) — the failure
direction nobody notices. Also, retro-editing a shipped slice's plan to make the validator green is exactly the
records-hygiene move this house exists to refuse.

## Recommendation

**Option A**, patch tier, one unit, no new dependency.

The bug is that a **line-level** markdown construct is being matched by a **byte-level** regex. A is the
smallest change that operates at the construct's actual level, and it changes classification on exactly one
file — the intended one — with zero new reds and zero newly-hidden markers. It also closes the parity-inversion
variant, the dangerous silent-false-negative form, within the repo's existing one-dependency, stdlib-first
shape. B buys nothing measurable over A; C is a dependency decision disguised as a bugfix; D is records
revisionism that leaves the trap set.

Two implementation calls to make explicit in the spec rather than leave to the builder:

1. Reorder to **fences first, then HTML comments, then code spans** — costs nothing, tests identically, and
   removes the same-class latent bug where an unbalanced `<!--` quoted in a fence eats forward.
2. Pin the **unclosed-fence** semantics in a test — CommonMark says run-to-EOF, which is *more permissive* than
   today, and it is the only respect in which the fix could hide something.

**The specific risk that would change this recommendation:** if the blast-radius measurement were wrong — i.e.
if a corrected stripper newly exposed a real marker in some handoff artifact, turning one red into several. It
does not (verified across all 12 tracked `spec.md`/`plan.md` files plus `0007/spec.md`, under both orderings),
**but a reviewer should re-run that comparison against the actual implementation before the merge gate rather
than trust this digest.** If it *did* surface real markers, the right move flips: those markers are genuine open
questions and the fix becomes a finding-generating change needing its own triage pass before it can ship green
— not a patch-tier slice.

## Scope guards the digest recommends

- No new npm dependency; no markdown parser.
- No change to the marker regex `/\[NEEDS CLARIFICATION\b[^\]]*\]/`, to which artifacts are scanned
  (`spec.md`, `plan.md` only), to `--slice` semantics, to exit codes, or to the finding's message text.
- No line/column numbers added to the finding (tempting, genuinely useful, and a separate item).
- No edits to `docs/slices/0003-…/plan.md` to dodge the bug — the fix must make the existing document pass
  **unmodified**; that is the acceptance evidence.
- No general markdown-correctness project: 4-space indented code blocks, link reference definitions, setext
  headings and nested-list indentation stay unmodeled.
- No reuse of the stripper elsewhere (`derive.js`, `hooks.js`) and no extraction into a shared module until a
  second caller actually exists.
- No changes to `skills/*/SKILL.md` — the handoff bar wording at `skills/house-shaper/SKILL.md:83` is already
  correct and unaffected.
