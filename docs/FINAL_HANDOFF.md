# Final acceptance and freeze checklist

Updated 16 November 2026; supersedes the 28 October handoff (see git history). This is a checklist, not a
signature, approval, release or freeze. Do not backdate any entry.

## Merge order (completed 11 November; follow-up merged 15 November)

1. Done. Hrisheek ported the 11 PR #53 tests to the contract events in 21ce67c (11 Nov).
2. Done. Yaswanth retargeted PR #55 to `sprint2-integration`. PR #54 was closed on 11 Nov as delivered
   through #57.
3. Done. PR #58 (CHAT-38) was merged as d82aafd and PR #55 as df68292 into `sprint2-integration`, after the
   seed-fixture fix e360001 made CI pass (runs #112 and #113).
4. Done. PR #57 was marked ready and merged into `main` as 7bff802 with a merge commit. PR #47 was closed
   as delivered through #57.
5. Done. Build and test run #114 on `main` at 7bff802 passed the Node, Python and Browser jobs.
6. Done (15 Nov). Hrisheek's PR #60 (SQLite unification, merged into `sprint2-integration` on 13 Nov
   without a review) and PR #61 (CHAT-52 review fixes, approved by Soham, merged as dc4e13b) reached `main`
   through PR #62, merged as d608eb0 without a teammate approval: Yaswanth's requested review had not
   arrived. The reasons and evidence are recorded on #62 and in `DEVIATIONS.md`.

## Gates

| Gate | Owner | Status on 16 Nov |
|---|---|---|
| PR #53 tests ported to the contract protocol; owner agrees the protocol | Hrisheek | Done: ported by Hrisheek in 21ce67c |
| CHAT-52 review of presence/account integration | Hrisheek | Done: two findings fixed in PR #61 (approved by Soham), in `main` via #62; Done in Jira, 15 Nov |
| PR #47 security findings resolved | Yaswanth (QA) | Done: re-review at 27eef79, 10 Nov; PR closed as delivered, 11 Nov |
| PR #55 QA summary corrected and retargeted | Yaswanth | Done: merged as df68292, 11 Nov |
| TC-UX-01 row 14 (200% zoom) and NVDA column recorded | Soham | Done: all 16 rows pass at 194b40d (recorded in 10db345) |
| TC-UX-01 QA review signature | Yaswanth | Done: signed off by Yaswanth on 16 Nov against PR #58 / 194b40d and `main` ce3db73 (PR #65) |
| PR #58 merged (QA verified code 10 Nov) | Soham | Done: d82aafd, 11 Nov |
| Full-suite determinism re-checked after the port | Soham | Done: 15 of 15 runs passed at 7bff802 on Node 22 (11 Nov); 285/285 passed at 87c6ed3 on Node 24.22 (15 Nov). The "Jest did not exit" warning seen on Node 24.22.3 was not reproduced by Yaswanth on Node 24.22.0 with `--detectOpenHandles` (15 Nov) |
| Final merged `main` passes all three CI jobs | Soham | Done: run #137 at ce3db73, 15 Nov (Node, Python and Browser jobs); last code change run #131 at d608eb0 |
| CHAT-30 availability | Soham | Dispositioned: not met; accepted as a documented deviation by the Product Owner, 15 Nov (CHAT-30 and epic CHAT-6 closed in Jira) |
| Videos retained, Sprint 1 lateness explicit | Done | `videos/`, `docs/evidence/2026-10-28/video-evidence.json` |
| Repository visibility decision | Done | Kept public, 28 Oct (deviation) |
| Review of PR #60 (SQLite unification) | Yaswanth | Done: post-merge QA Lead review on #62, 15 Nov 23:57 IST. No blocking defect; two follow-ups recorded in `DEVIATIONS.md` |
| Product Owner/team record the accepted commit, open defects, deviations and freeze date | Soham | Done: freeze record below, 16 Nov |

Every gate above is resolved or explicitly dispositioned. The freeze record follows.

## Freeze record (fill in only when every open gate above is resolved or explicitly dispositioned)

Accepted `main` commit: **ce3db73** (PR #64 merge; the code is identical to d608eb0, PR #62)
CI run: **#137** at ce3db73 (Node, Python and Browser jobs passed); last code change: run #131 at d608eb0
Freeze date: **16 November 2026**

Open defects and deviations accepted:
- No open defects are known at the accepted commit. Yaswanth's post-merge review (15 Nov) found no blocking
  defect.
- CHAT-30 / CHAT-NF-002 monthly availability: **not met**; accepted as a documented deviation (15 Nov).
- Late delivery: Sprint 1 completed 28 Oct (end 23 Oct); Sprint 2 integration ran to 15 Nov (end 30 Oct).
- The 7 Nov merge incident: reverted 8 Nov and recovered through PR #57.
- Scope Option A: admin and private conversations deferred (31 Oct).
- Test tooling: Socket.IO load script instead of JMeter, automated security tests instead of OWASP ZAP,
  SQLite instead of MongoDB/PostgreSQL, Node 24.16+ and Python 3.12.
- Repository kept public (28 Oct).
- PR #60 and PR #62 merged without a pre-merge teammate approval; #60 reviewed post-merge by Yaswanth on
  15 Nov.
- Follow-ups, not blocking:
  - rehearse the backup/restore procedure in `docs/SQLITE_MIGRATION.md` before any real deployment;
  - the Node 24.22.3 "Jest did not exit" warning (not reproduced on 24.22.0);
  - unread counts are kept in browser memory only.

Recorded by: **Jamula Soham Rao (Product Owner), 16 November 2026**
Team agreement noted by: not recorded. This freeze is a Product Owner decision; Hrisheek and Yaswanth may
add their names here.

Commits after ce3db73 that only change documentation (including Yaswanth's sign-off in PR #65 and this record)
do not change the accepted code.
