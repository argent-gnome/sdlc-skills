---
id: "0006-public-pages-refresh-retire-v1-pages-publish-cur"
kind: spec
slice: "0006-public-pages-refresh-retire-v1-pages-publish-cur"
title: "public pages refresh — retire v1 pages, publish current docs"
status: "shaped 2026-07-29; user-approved (manual mirrors accepted)"
state: approved
---
# Spec — public pages refresh: retire v1 pages, publish current docs

## Problem
The GitHub Pages site (https://argent-gnome.github.io/sdlc-skills/) still publishes the v1 world:
`process.html` (banner'd but describing the retired process), `best-practices.html`, and
`case-study.html` all predate the kernel; `index.html`'s lede and body still claim a two-skill
ecosystem (the roadmap's one "actively wrong in public" item). Meanwhile the docs that describe the
current ecosystem — `quickstart.md` and `process-v2.md` — don't render on the site at all (`.nojekyll`
serves markdown raw). Owner call (2026-07-29): remove the three outdated pages and replace them with
the current docs.

## Appetite
0.5 session, docs-only, patch tier. No code, no skill changes, no CLI changes.

## Solution
Retire the three v1 pages (and their markdown sources) to `archive/docs-v1/` — archive, never erase,
matching the skills precedent — and rebuild the site around the current truth: a rewritten `index.html`
landing page plus HTML mirrors of `quickstart.md` and `process-v2.md` in the site's existing style.
The 0005-era objection to mirrors ("orphans without an index entry point") dissolves because the index
is rewritten to be their entry point; each mirror carries a "generated from <file>.md — edit the
markdown" note so drift has a stated direction.

## Rabbit Holes
- No redesign of the site's look — reuse `index.html`'s existing inline style idiom for the mirrors.
- No new content: the mirrors render the existing markdown faithfully; editorial changes go to the
  `.md` files through their own slices.
- `process-v2.md` keeps its filename (repo-internal links point at it); only its mirror is named
  `process.html` — taking over the retired page's URL so old links land on current truth.

## No-Gos
- NOT deleting the v1 pages' content from the repo — `archive/docs-v1/` keeps md + html.
- NOT touching `docs/slices/`, ADRs, roadmap/dev-state beyond the reconcile of this slice itself.
- NOT changing `quickstart.md`/`process-v2.md` content (mirror-only fidelity, plus retargeting any
  links that pointed at the retired pages).
- NOT adding a build step or generator dependency — mirrors are hand-rendered HTML, updated when the
  markdown changes.

## Requirements

### R-1: the three v1 pages retire to the archive
`docs/process.{md,html}`, `docs/best-practices.{md,html}`, `docs/case-study.{md,html}` move via
`git mv` to `archive/docs-v1/`, with a short `archive/docs-v1/README.md` (what these described, retired
2026-07-29 at owner call after the v2 cutover, superseded by the live site). Any repo link pointing at
the moved files retargets to the archive path or the replacement page (sweep: README, quickstart,
process-v2, roadmap, dev-state — historical slice records stay as written).

#### Scenario: no dead links on live surfaces
- When I check every link on live surfaces (README, quickstart, process-v2, index and the new mirrors,
  roadmap, dev-state)
- Then none points at `docs/process.*`, `docs/best-practices.*`, or `docs/case-study.*`

### R-2: index.html tells the current story
`docs/index.html` is rewritten as the landing page for the current ecosystem: the kernel (`house` CLI +
records + gates, one sentence each), the three canonical skills by name, and two cards linking the
quickstart and process mirrors. The stale "pair"/"two skills" claims are gone. Footer stays accurate.

#### Scenario: the public page cannot mislead
- When I read index.html top to bottom
- Then every named skill is canonical, the skill count is three, and no v1-era claim survives

### R-3: the current docs render on the site
`docs/quickstart.html` and `docs/process.html` (new) are faithful HTML mirrors of `quickstart.md` and
`process-v2.md`, in the site's existing style idiom, self-contained (no external refs — the mockup
rule applies to the site too), each with a "generated from `<file>.md` — edit the markdown, then
re-render this mirror" comment at the top. Intra-doc links resolve on the site: mirror-to-mirror links
use `.html`; links to repo-only files (schema, doctrine, ADRs, slice records) use GitHub blob URLs
(the 0005 M1 rule).

#### Scenario: a visitor can onboard from the public site alone
- Given a visitor with no repo checkout
- When they open the Pages URL and follow index → quickstart mirror → process mirror
- Then every link they can click resolves (html or blob URL), and the content matches the markdown

#### Scenario: mirror drift has a stated direction
- When I open either mirror's source
- Then the top comment names its markdown source as the edit target

## Open question for spec review
Mirror maintenance is manual by design (No-Go: no generator dependency). Accepted cost: whoever edits
`quickstart.md`/`process-v2.md` re-renders the mirror in the same slice — the reconcile checklist and
the mirrors' top comments both say so. Confirm this is acceptable vs. adding a tiny render script
(which would be a `cli/` change, out of scope here).
