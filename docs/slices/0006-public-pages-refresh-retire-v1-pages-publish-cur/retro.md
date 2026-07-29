# Retro — 0006: public pages refresh

Written at ship, 2026-07-29, before the `shipped` flip. Sources: `.house/events.jsonl`, gate records,
unit 01 report, PR #12, live HTTP checks against the deployed site.

## What shipped

The public face now describes the system that exists. Three v1 pages (md + html) archived
byte-identical to `archive/docs-v1/`; hand-rendered self-contained mirrors of `quickstart.md` and
`process-v2.md` published (the process mirror taking over the retired page's URL so old links land on
current truth); `index.html` rewritten around three canonical skills and the kernel. Verified against
the real deploy, not the working tree: `/`, `/quickstart.html`, `/process.html` all 200 with zero
stale claims; the two retired URLs 404 by owner ruling.

## What worked

- **Fidelity was machine-checked on both sides.** The builder accounted for 60/60 quickstart and 96/96
  process markdown chunks with non-alphanumerics stripped so markup couldn't mask an omission; the
  merge-gate reviewer independently ran a 14/14 anchor census and a 28-href link census with every
  blob path confirmed in `git ls-files`. Hand-rendered mirrors are exactly the kind of work that rots
  silently — this is the check that makes them survivable.
- **The branch-cut lesson from 0004 held.** Every shaping record was committed *before* the branch was
  cut, so the builder saw its own folded plan, plan-check record, and kickoff. Zero record confusion,
  and the contrast with 0004 is the cleanest evidence that the lesson was real.
- **The builder surfaced rather than invented.** Retiring the pages orphaned two public URLs; the plan
  authorised neither stubs nor a signpost, so it built neither and asked. The owner ruled 404s
  acceptable and the reviewer independently confirmed R-1's scenario governs outbound links, not
  inbound URLs — so the ruling closed a real question instead of papering over a spec violation.
- **A folded advisory with no shipped case was still exercised.** A1's directory prefix-match branch
  had no real link to test, so the builder ran it against a throwaway fixture rather than marking it
  done on the strength of the fold alone.

## Judgment calls, all disclosed and ruled

Unit 01 finalized DEVIATION for three text-scope calls, all accepted: a nav *label* reading "the house
SDLC" would have pointed a current-sounding name at a retired document (href-only retargeting would
have shipped the exact defect R-1 exists to prevent); README parentheticals implying
`docs/process.html` was still published had become false; the mirrors needed a `home` link their
markdown navs lacked. The pattern across 0004 and 0006: **a literal scope guard that contradicts the
spec loses to the spec, and the builder is right to say so out loud rather than obey the guard into a
defect.**

## Open items after this slice

- Two backlog items were recorded during this slice and route to the roadmap here: the **re-baseline
  experiment** (periodically re-test which prescriptive process rules still earn their keep — scope
  limited to plan literalism, gates untouched) and the **roadmap status/intent split** (~12k chars of
  derivable status narration across five cells, four drift errors caught in one day; fix by the
  dev-state precedent — hand-authored intent, generated-or-deleted status).
- The nested-fence `--strict` residual on 0003's plan remains the repo's only strict red.
- An index signpost to `archive/docs-v1/` is a possible follow-up; deliberately not this slice.
