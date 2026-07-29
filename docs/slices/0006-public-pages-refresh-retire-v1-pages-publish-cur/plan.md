---
id: "0006-public-pages-refresh-retire-v1-pages-publish-cur"
kind: plan
slice: "0006-public-pages-refresh-retire-v1-pages-publish-cur"
title: "public pages refresh — implementation plan"
status: "planned 2026-07-29"
state: draft
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
- [ ] **Step 4: Verify** — `house validate` exit 0; the Step-3 grep over those five files returns
  only archive-path or process-v2 hits; `test -f archive/docs-v1/process.html`.
- [ ] **Step 5: Commit** — `docs(pages): retire v1 pages to archive/docs-v1, retarget links`

### Task 2: the two mirrors

**Files:** Create `docs/quickstart.html` (mirror of `docs/quickstart.md`) and `docs/process.html`
(mirror of `docs/process-v2.md` — deliberately takes the retired page's URL).

- [ ] **Step 1:** Render each markdown to HTML by hand, faithfully: same headings/anchors (kebab-case
  ids matching the markdown heading anchors so existing `#fragment` links keep working), tables as
  tables, fenced blocks as `<pre><code>`. Reuse `index.html`'s style idiom (its `:root` variables and
  section/card classes, inline `<style>` — self-contained, zero external refs). Top of each file, an
  HTML comment: `generated from <file>.md — edit the markdown, then re-render this mirror`.
- [ ] **Step 2:** Link policy inside the mirrors (spec R-3): mirror-to-mirror and mirror-to-index →
  relative `.html`; anything repo-only (schema, doctrine, cli/README, ADRs, slice records, archive) →
  GitHub blob URLs `https://github.com/argent-gnome/sdlc-skills/blob/main/<path>`. The quickstart
  names table stays canonical-names-only.
- [ ] **Step 3: Verify** — `house validate` exit 0; both files contain `generated from`; zero external
  refs: `! grep -nE 'src=\"https?://|href=\"https?://' docs/quickstart.html docs/process.html | grep -v
  'github.com/argent-gnome/sdlc-skills' | grep -q .`; every `href` in both files either starts with
  `#`, ends in `.html`, or is a repo blob URL (list any exception in the unit report).
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
  `process.html`: every relative href resolves to a file that exists in `docs/`; every blob URL path
  exists in the repo (`git ls-files` check). Script it; paste the output in the unit report.
- [ ] **Step 3: Verify** — `house validate` exit 0; `! grep -in 'two skills\|the pair\|dev-command-
  center' docs/index.html | grep -q .`; the Step-2 script exits 0.
- [ ] **Step 4: Commit** — `docs(pages): index rewritten for the current ecosystem`

---

## NOT this slice
- NOT deleting the v1 pages' content from the repo — `archive/docs-v1/` keeps md + html.
- NOT touching `docs/slices/`, ADRs, roadmap/dev-state beyond the reconcile of this slice itself.
- NOT changing `quickstart.md`/`process-v2.md` content (mirror-only fidelity, plus retargeting any
  links that pointed at the retired pages).
- NOT adding a build step or generator dependency — mirrors are hand-rendered HTML.

## Self-review
- Spec coverage: R-1→T1, R-3→T2, R-2→T3; the no-dead-links scenario is T3's whole-site check; the
  drift-direction scenario is T2's `generated from` comment + verify.
- Ordering: T1 first (the URL for `process.html` must be vacant before T2 recreates it), T2 before T3
  (the index links files that must exist for the link check).
- The mirrors' fidelity is the merge-gate reviewer's to judge against the markdown side-by-side.
