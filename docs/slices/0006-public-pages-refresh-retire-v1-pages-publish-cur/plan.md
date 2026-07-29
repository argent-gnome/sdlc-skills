---
id: "0006-public-pages-refresh-retire-v1-pages-publish-cur"
kind: plan
slice: "0006-public-pages-refresh-retire-v1-pages-publish-cur"
title: "public pages refresh — implementation plan"
status: "planned 2026-07-29; plan-check GO_WITH_FIXES folded"
state: approved
---
# Public Pages Refresh Implementation Plan

> **For agentic workers:** docs-only, three tasks. Source-read before writing: `docs/index.html` (the
> style idiom to reuse — its inline `:root` vars, layout classes), `docs/quickstart.md` +
> `docs/process-v2.md` (the content to mirror faithfully), `archive/skills-v1/README.md` (the archive
> README precedent). The kickoff brief is the contract.

**Goal:** v1 pages archived, `index.html` telling the current three-skill/kernel story, faithful HTML
mirrors of quickstart + process narrative live on the Pages site.

---

### Task 1: archive the v1 pages + retarget links

**Files:** `git mv` `docs/process.md`, `docs/process.html`, `docs/best-practices.md`,
`docs/best-practices.html`, `docs/case-study.md`, `docs/case-study.html` → `archive/docs-v1/`.
Create `archive/docs-v1/README.md`. Retarget links in `README.md`, `docs/quickstart.md`,
`docs/process-v2.md`, `docs/roadmap.md`, `docs/dev-state.md` (manual block).

- [ ] **Step 1:** `mkdir -p archive/docs-v1` + the six `git mv`s.
- [ ] **Step 2:** `archive/docs-v1/README.md` (~8 lines): these described the v1 process
  (retired at the 2026-07-29 cutover, see `../../docs/adr/0004-house2-coexistence-and-advisory-hooks.md`);
  pages retired from the site 2026-07-29 at owner call; superseded by `docs/index.html`,
  `docs/quickstart.{md,html}`, and the process narrative `docs/process-v2.md` / `docs/process.html`.
- [ ] **Step 3:** Retarget every live-surface link to the moved files: `grep -rn
  'process\.html\|process\.md\|best-practices\|case-study' README.md docs/quickstart.md
  docs/process-v2.md docs/roadmap.md docs/dev-state.md` — each hit either retargets to
  `archive/docs-v1/…` (when citing the v1 document as a record) or to the replacement page (when
  telling a reader where to go now). Historical text inside `docs/slices/*` stays untouched. NOTE:
  links to `docs/process-v2.md` itself are NOT stale — leave them.
- [ ] **Step 4: Verify** (M1 fold — link syntax only; historical PROSE mentioning the old filenames
  in roadmap/dev-state shipped-records stays untouched and untested): `house validate` exit 0;
  `! grep -nE '\]\((docs/)?(process\.(md|html)|best-practices|case-study)' README.md
  docs/quickstart.md docs/process-v2.md docs/roadmap.md docs/dev-state.md | grep -q .` → true
  (no live markdown LINK targets a retired path; prose is exempt by construction);
  `test -f archive/docs-v1/process.html`.
- [ ] **Step 5: Commit** — `docs(pages): retire v1 pages to archive/docs-v1, retarget links`

### Task 2: the two mirrors

**Files:** Create `docs/quickstart.html` (mirror of `docs/quickstart.md`) and `docs/process.html`
(mirror of `docs/process-v2.md` — deliberately takes the retired page's URL).

- [ ] **Step 1:** Render each markdown to HTML by hand, faithfully: same headings/anchors (kebab-case
  ids matching the markdown heading anchors so existing `#fragment` links keep working — A4: the
  quickstart mirror MUST carry `id="current-skill-names"`, since process-v2 links that anchor),
  tables as tables, fenced blocks as `<pre><code>`. Reuse `index.html`'s style idiom (`:root` vars,
  `.cards`/`a.card`), and take the table/`pre` styles from the archived pages
  (`archive/docs-v1/process.html` — A3: index.html has no table CSS to copy). Self-contained, zero
  external refs. Top of each file, an HTML comment: `generated from <file>.md — edit the markdown,
  then re-render this mirror`.
- [ ] **Step 2:** Link policy inside the mirrors (spec R-3): mirror-to-mirror and mirror-to-index →
  relative `.html`; anything repo-only (schema, doctrine, cli/README, ADRs, slice records, archive) →
  GitHub blob URLs `https://github.com/argent-gnome/sdlc-skills/blob/main/<path>`. The quickstart
  names table stays canonical-names-only.
- [ ] **Step 3: Verify** — `house validate` exit 0; both files contain `generated from`; zero external
  refs: `! grep -nE 'src=\"https?://|href=\"https?://' docs/quickstart.html docs/process.html | grep -v
  'github.com/argent-gnome/sdlc-skills' | grep -q .`; **M2 fold — no raw markdown hrefs survive a
  faithful render** (`.nojekyll` serves them as plain text): `! grep -nE 'href=\"[^\"]*\.md[\"#]'
  docs/quickstart.html docs/process.html | grep -v 'github.com/argent-gnome/sdlc-skills/blob' |
  grep -q .` → true (every `.md` target must have become a blob URL or an `.html` mirror link);
  every `href` in both files either starts with `#`, ends in `.html`, or is a repo blob URL (list any
  exception in the unit report).
- [ ] **Step 4: Commit** — `docs(pages): quickstart + process mirrors, self-contained, blob-linked`

### Task 3: index.html rewrite + whole-site link check

**Files:** Rewrite `docs/index.html` (keep its style idiom; replace the content).

- [ ] **Step 1:** New content, top to bottom: (a) lede — the house SDLC: a records-first process run
  by three cooperating skills over a small CLI kernel; (b) three one-sentence skill cards
  (`house-shaper` / `house-orchestrator` / `house-builder` — shape, conduct, build); (c) one kernel
  paragraph (slice records + event log + fail-closed gates; `house` CLI); (d) two big cards →
  `quickstart.html` ("start a project") and `process.html` ("how the process works"); (e) footer:
  "three skills: house-shaper · house-orchestrator · house-builder" (already true, keep). No "pair",
  no "two skills", no plugin-history lede.
- [ ] **Step 2: Whole-site link check** — for each of `index.html`, `quickstart.html`,
  `process.html`: every relative href resolves to a file that exists in `docs/` AND ends in `.html`
  or `#…` (M2 applies site-wide); every blob URL path exists in the repo via `git ls-files` — with
  directory targets (A1: e.g. a link to `archive/skills-v1/`) checked by prefix match, not exact.
  Script it; paste the output in the unit report.
- [ ] **Step 3: Verify** (A2 fold — broadened negatives + positive canonical checks) — `house
  validate` exit 0; `! grep -inE 'two skills|pair of claude|dev-command-center' docs/index.html |
  grep -q .`; `grep -q 'house-shaper' docs/index.html && grep -q 'house-orchestrator' docs/index.html
  && grep -q 'house-builder' docs/index.html`; the Step-2 script exits 0.
- [ ] **Step 4: Commit** — `docs(pages): index rewritten for the current ecosystem`

---

## NOT this slice
- NOT deleting the v1 pages' content from the repo — `archive/docs-v1/` keeps md + html.
- NOT touching `docs/slices/`, ADRs, roadmap/dev-state beyond the reconcile of this slice itself.
- NOT changing `quickstart.md`/`process-v2.md` content (mirror-only fidelity, plus retargeting any
  links that pointed at the retired pages).
- NOT adding a build step or generator dependency — mirrors are hand-rendered HTML.

## Plan-check (2026-07-29)

Verdict **GO_WITH_FIXES** (fresh Fable reviewer; record at `gates/plan_check.yaml`). Folded:
- **M1** → T1's verify greps markdown LINK syntax only; historical prose in shipped records is exempt
  by construction, never reworded to satisfy a check.
- **M2** → mirrors and index machine-checked against raw `.md` hrefs (blob URLs exempt) — the
  `.nojekyll` plain-text trap is now a failing verify, not a review hope.
- **A1** → link-check script prefix-matches directory targets.
- **A2** → index verify broadened ("pair of claude", positive canonical-name greps).
- **A3** → table/`pre` styles taken from the archived pages (index has none).
- **A4** → `id="current-skill-names"` required in the quickstart mirror (process-v2 links it).
- **A5** → unit report must pre-empt the merge reviewer: historical docs (retros, superpowers
  specs/plans) reference the retired pages and are correctly untouched.
- **A6** → the delete-then-recreate of `docs/process.html` verified harmless (validate reads records,
  evidence is append-only history, git handles mv+create) — recorded so it isn't re-litigated.

## Self-review
- Spec coverage: R-1→T1, R-3→T2, R-2→T3; the no-dead-links scenario is T3's whole-site check; the
  drift-direction scenario is T2's `generated from` comment + verify.
- Ordering: T1 first (the URL for `process.html` must be vacant before T2 recreates it), T2 before T3
  (the index links files that must exist for the link check).
- The mirrors' fidelity is the merge-gate reviewer's to judge against the markdown side-by-side.

## As-built — Unit 01 (reconciled 2026-07-29, branch `slice/0006-public-pages-refresh-retire-v1-pages-publish-cur`)

T1–T3 all `done` with evidence in `tasks.yaml` (each verify chain run as written, `cmd_exit: 0`);
`house validate` exit **0**. Commits off `base_sha` `9b413c5`: `9149e9d` (T1) · `313f921` (T2) · `fedef01`
(T3). Shipped surface: the six v1 page files moved to `archive/docs-v1/` as **pure renames** (git records
0 changed lines for all six, so the archived content is byte-identical — no content loss), a new
`archive/docs-v1/README.md` signpost, `README.md`'s three v1 bullets retargeted at `archive/docs-v1/…`,
one nav line each in `docs/quickstart.md` and `docs/process-v2.md`, new `docs/quickstart.html` and
`docs/process.html` mirrors, and `docs/index.html` rewritten (records-first lede · three one-sentence
skill cards · one kernel paragraph · two cards to the mirrors · the already-correct three-skill footer
kept). All plan-check folds held as written: **M1** (T1's grep tested markdown *link syntax* only — the
roadmap's and dev-state's historical prose about `docs/process.md`/`.html` inside the `[0004]`/`[0005]`
write-ups was left exactly as written, never reworded to satisfy a check), **M2** (no raw `.md` href
survives in either mirror or the index), **A2** (the broadened negatives and positive canonical-name
greps ran on `index.html`), **A3** (table/`pre` styles taken from the archived pages), **A4**
(`id="current-skill-names"` is live in the quickstart mirror and `process.html` links it), **A6**
(the delete-then-recreate of `docs/process.html` behaved exactly as predicted — `9149e9d` records the
move as a rename with zero content change, `313f921` creates the new file, and no commit has two
claimants to the path).

**Three deliberate additions the mirrors make beyond their markdown.** Recorded because "faithful render"
is the merge-gate reviewer's bar, and these are the only three places the HTML says something its `.md`
source does not:

- **A `home ·` link prepended to each mirror's nav line.** The markdown nav lines carry only sibling-doc
  links; the mirrors add `<a href="index.html">home</a> ·` in front, because on the published site the
  rewritten index is the entry point these pages are reached through and there was no way back to it.
- **A `<footer>` in each mirror carrying the "generated from `<file>.md` — edit the markdown, then
  re-render this mirror" note.** This restates, where a human reader can see it, the same drift direction
  the required top-of-file HTML comment states for whoever opens the source. The comment (the
  spec-mandated form) is present in both files as well; the footer is additive, not a substitution.
- **`id=` attributes on every heading**, kebab-cased from the heading text so existing and future
  `#fragment` links resolve. T2 Step 1 required this only for `id="current-skill-names"` (fold A4); it was
  applied uniformly to all 14 headings across the two mirrors rather than to that one heading, so the
  mirrors' anchors match the markdown's GitHub-rendered anchors throughout.

Nothing else in either page is new prose. **One rendering choice, not an addition:** `docs/process-v2.md`'s
five `---` rules are absorbed by the shared stylesheet's `h2 { border-top: … }` rather than emitted as
`<hr>` — each of the five immediately precedes an `## ` heading, so the visual break lands in exactly the
same place. No `<hr>` element appears in either mirror.

**Directory link targets were resolved to files.** T2 Step 2's blob-URL policy and T3 Step 2's fold **A1**
both anticipated a link to a *directory* (`archive/skills-v1/`), with A1 adding a prefix-match branch to
the link check for that case. As built, the quickstart mirror points that link at
`archive/skills-v1/README.md` — the directory's own signpost — with the visible link text still reading
`archive/skills-v1/`. Net effect: every one of the **28** hrefs across the three pages targets a real file
or an in-page anchor (15 GitHub blob URLs, all paths present in `git ls-files`; 12 relative
`.html`/`#fragment` links, all resolving inside `docs/`; 1 repo-root URL). No *shipped* link therefore
needed A1's prefix-match branch — so rather than leave a folded commitment merely asserted, the branch was
exercised against a throwaway fixture: a real directory target resolved with and without a trailing slash
(`archive/skills-v1/`, `cli/schema`), and a bogus one (`does/not/exist/`) failed. The fold is built and
demonstrated, not decorative; the fixture was removed and never committed.

**The link-check script was deliberately not committed.** T3 Step 2 says "script it"; the plan's own No-Go
says "NOT adding a build step or generator dependency". Both hold only if the script lives outside the
tree, so it was written and run from the session scratchpad and its result (28/28 hrefs resolve) reported
through the build session's records — the repo gains no script, no dev dependency, and no file a future
reader could mistake for part of the site build. The check is re-runnable from its greps at any time; the
standing invariant it enforces is prose, in `dev-state.md`'s Gotchas ("`docs/*.html` are hand-authored —
mirror any `docs/*.md` prose change into the matching `.html` by hand"), which is where it belongs given
[ADR-0003](../../adr/0003-no-hosted-ci-local-verification.md)'s no-hosted-CI stance.
