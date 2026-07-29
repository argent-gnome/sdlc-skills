# Unit 01 — pages refresh (T1-T3)

- slice: 0006-public-pages-refresh-retire-v1-pages-publish-cur
- dispatched: 2026-07-29T22:55:47.684Z

## Heartbeats
- 2026-07-29T22:59:55.244Z — T1 done: six v1 page files git mv'd to archive/docs-v1/ + signpost README; links retargeted in README/quickstart/process-v2; M1 link-syntax grep clean
- 2026-07-29T23:03:33.177Z — T2 done: quickstart.html + process.html mirrors hand-rendered, self-contained, 25/25 hrefs resolve, A4 anchor live, M2 clean
- 2026-07-29T23:19:10.513Z — T3 done: index.html rewritten; whole-site link check 28/28 hrefs resolve (15 blob URLs all in git ls-files, 12 relative .html/#frag inside docs/, 1 repo root); gates green (npm test 72/72 exit 0, house validate exit 0)
- 2026-07-29T23:19:10.565Z — A5 pre-empt for the merge reviewer — historical docs that still reference the retired pages are CORRECTLY UNTOUCHED: docs/retros/*.md (3 files), docs/superpowers/{specs,plans,research}/*.md (12 files), docs/adr/0002, and the slice records for 0004/0005. They describe what was true when written. Per fold M1, prose was never reworded to satisfy a check; only markdown LINK syntax was retargeted, on 3 live surfaces (README.md, docs/quickstart.md, docs/process-v2.md).
- 2026-07-29T23:19:10.617Z — A6 verified: all six archived files byte-identical to their pre-slice originals (diff clean); .house/events.jsonl strictly append-only (0 deleted lines across the branch); the delete-then-recreate of docs/process.html is harmless — git renders the pairing as rename+add, content correct on disk.
- 2026-07-29T23:19:10.668Z — DISCLOSURE 1/3 (deviation): docs/quickstart.md nav LABEL changed, not just its href — 'the house SDLC' became 'the v1 process' (matching process-v2.md's existing wording). Pure href retargeting would have left a link labelled 'the house SDLC' pointing at a retired v1 document, which is the exact misleading-public-face failure the spec exists to prevent. A label is content, so this exceeds the literal scope guard 'NOT changing quickstart.md content (plus retargeting links)'.
- 2026-07-29T23:19:10.718Z — DISCLOSURE 2/3 (deviation): README.md's three v1 bullets had their parentheticals reworded from '(or docs/process.html)' to '(with its rendered process.html alongside)'. The old wording implied a published web page; those pages are no longer served from docs/. Beyond pure href retargeting.
- 2026-07-29T23:19:10.768Z — DISCLOSURE 3/3 (deviation): each mirror's nav line gains a 'home ·' link to index.html that its markdown source does not have. Plan T2 Step 2 authorised mirror-to-index relative .html links but the markdown navs contain none, so on the site the mirrors had no way back to the entry point. The other two mirror additions (generated-from footer, id= on all 14 headings) are spec-R-3- and fold-A4-driven respectively. All three are recorded in the plan's As-built.
- 2026-07-29T23:19:10.821Z — FINDING for the orchestrator/user (not self-resolved, out of plan scope): the site's old /best-practices.html and /case-study.html URLs now 404 — the plan's index content list (a)-(e) has no archive pointer and authorised no redirect stubs, so none were invented. /process.html deliberately resolves to the v2 narrative per spec. Worth a follow-up call on whether the index should signpost archive/docs-v1/.

## Result

**DEVIATION** — T1-T3 all done with evidence, both node gates green, 28/28 site hrefs resolve, all 8 plan-check folds built (A1 demonstrated against a fixture, not just asserted); DEVIATION for three disclosed text-scope calls — a quickstart nav label, README parentheticals, and a 'home' nav link the mirrors' markdown lacks — plus one surfaced finding (two old page URLs now 404).
- finalized: 2026-07-29T23:19:20.443Z
