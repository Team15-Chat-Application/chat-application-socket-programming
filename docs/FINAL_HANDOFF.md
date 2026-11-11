# Final acceptance and freeze checklist

Updated 10 November 2026; supersedes the 28 October handoff (see git history). This is a checklist, not a
signature, approval, release or freeze. Do not backdate any entry.

## Merge order

1. **Hrisheek** ports the 11 PR #53 tests to the contract events on `sprint2-integration`
   (`SPRINT2_INTEGRATION_HANDOFF.md`), ideally one commit per story, and opens a PR into it.
2. **Yaswanth** retargets PR #55 to `sprint2-integration` and addresses the 10 requested changes; closes
   PR #54 as superseded by #57.
3. Merge PR #58 (CHAT-38) and PR #55 into `sprint2-integration` once their CI passes.
4. Mark PR #57 ready, confirm all three CI jobs pass, merge it into `main`, then close PR #47 as delivered
   through #57.
5. Re-run CI on the merged `main` head and record the run.

## Gates

| Gate | Owner | Status on 10 Nov |
|---|---|---|
| PR #53 tests ported to the contract protocol; owner agrees the protocol | Hrisheek | Open |
| CHAT-52 review of presence/account integration | Hrisheek | Open |
| PR #47 security findings resolved | Yaswanth (QA) | Done: re-review at 27eef79, 10 Nov |
| PR #55 QA summary corrected and retargeted | Yaswanth | Changes requested 10 Nov |
| TC-UX-01 row 14 (200% zoom) and NVDA column recorded | Soham | Open |
| PR #58 merged (QA verified code 10 Nov) | Soham, after CI | Waits on the test port |
| Full-suite determinism re-checked on Node 24 after the port | Soham | Open |
| Final merged `main` passes all three CI jobs | Soham | Open |
| CHAT-30 availability | Soham | Recorded as not established (deviation) |
| Videos retained, Sprint 1 lateness explicit | Done | `videos/`, `docs/evidence/2026-10-28/video-evidence.json` |
| Repository visibility decision | Done | Kept public, 28 Oct (deviation) |
| Product Owner/team record the accepted commit, open defects, deviations and freeze date | Team | Open |

## Freeze record (fill in only when every open gate above is resolved or explicitly dispositioned)

Accepted `main` commit: ______  CI run: ______  Freeze date: ______
Open defects and deviations accepted: ______
Recorded by: ______  Team agreement noted by: ______
