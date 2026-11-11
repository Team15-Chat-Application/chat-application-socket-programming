# Final acceptance and freeze checklist

Updated 11 November 2026; supersedes the 28 October handoff (see git history). This is a checklist, not a
signature, approval, release or freeze. Do not backdate any entry.

## Merge order (completed 11 November)

1. Done. Hrisheek ported the 11 PR #53 tests to the contract events in 21ce67c (11 Nov).
2. Done. Yaswanth retargeted PR #55 to `sprint2-integration`. PR #54 was closed on 11 Nov as delivered
   through #57.
3. Done. PR #58 (CHAT-38) was merged as d82aafd and PR #55 as df68292 into `sprint2-integration`, after the
   seed-fixture fix e360001 made CI pass (runs #112 and #113).
4. Done. PR #57 was marked ready and merged into `main` as 7bff802 with a merge commit. PR #47 was closed
   as delivered through #57.
5. Done. Build and test run #114 on `main` at 7bff802 passed the Node, Python and Browser jobs.

## Gates

| Gate | Owner | Status on 11 Nov |
|---|---|---|
| PR #53 tests ported to the contract protocol; owner agrees the protocol | Hrisheek | Done: ported by Hrisheek in 21ce67c |
| CHAT-52 review of presence/account integration | Hrisheek | Open (In Progress in Jira) |
| PR #47 security findings resolved | Yaswanth (QA) | Done: re-review at 27eef79, 10 Nov; PR closed as delivered, 11 Nov |
| PR #55 QA summary corrected and retargeted | Yaswanth | Done: merged as df68292, 11 Nov |
| TC-UX-01 row 14 (200% zoom) and NVDA column recorded | Soham | Done: all 16 rows pass at 194b40d (recorded in 10db345) |
| TC-UX-01 QA review signature | Yaswanth | Open: the "QA review" line in `ACCESSIBILITY_TC-UX-01.md` is blank |
| PR #58 merged (QA verified code 10 Nov) | Soham | Done: d82aafd, 11 Nov |
| Full-suite determinism re-checked after the port | Soham | Done on Node 22: 15 of 15 runs passed at 7bff802 (`DEVIATIONS.md`, 11 Nov). Node 24 evidence is CI only |
| Final merged `main` passes all three CI jobs | Soham | Done: run #114 at 7bff802 |
| CHAT-30 availability | Soham | Recorded as not established (deviation) |
| Videos retained, Sprint 1 lateness explicit | Done | `videos/`, `docs/evidence/2026-10-28/video-evidence.json` |
| Repository visibility decision | Done | Kept public, 28 Oct (deviation) |
| Product Owner/team record the accepted commit, open defects, deviations and freeze date | Team | Open |

Candidate for the freeze record, once the open gates are resolved or dispositioned: `main` at 7bff802,
CI run #114. This is not yet a freeze.

## Freeze record (fill in only when every open gate above is resolved or explicitly dispositioned)

Accepted `main` commit: ______  CI run: ______  Freeze date: ______
Open defects and deviations accepted: ______
Recorded by: ______  Team agreement noted by: ______
