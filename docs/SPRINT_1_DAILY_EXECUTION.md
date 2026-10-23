# Sprint 1 daily execution

User instruction on 20 October 2026: do Sprint 1 systematically from today
through 23 October. Follow-ups are scheduled in this chat at **18:00 IST on
21, 22 and 23 October**. Dates below are actual work dates and planned next
steps, not backdated sprint activity. This plan covers Soham's work and the
integration dependencies needed for the team outcome.

## Daily sequence

| Date | Focus | Deliverable and completion boundary |
| --- | --- | --- |
| 20 October | CHAT-19, CHAT-20, CHAT-21: room membership, notices and live catalogue | Both backend implementations, unit/integration tests and a reviewable PR. Component tests do not establish a working chat UI or business-message delivery. |
| 21 October at 18:00 IST | CHAT-35, CHAT-36, CHAT-37: security verification and owner handoffs | Harden the prepared JWT/rate-limit/sanitisation foundation, test actual JWT expiry after connection and rejected claims, and verify auth/messaging integration when their owners' modules are available. |
| 22 October at 18:00 IST | CHAT-41/42: integration, regression fixes, exact-commit CI and tracking | Run the available integrated product; record concrete missing owner modules instead of substituting auth fixtures for an end-to-end product. |
| 23 October at 18:00 IST | Final regression, QA evidence and Sprint 1 outcome support | Human QA/test-case review, owner review and authentic one-minute video coordinated by Yaswanth; complete only items with the required evidence. |

Start a daily run by inspecting Git state, this file, current PRs and live Jira
assignments. Carry unfinished earlier-day work forward first. Use the existing
branch/PR rather than duplicating it. Preserve all unrelated user changes.

## Verified on 20 October

- Live Jira/GitHub assignments confirm Soham owns the room and shared-security
  items listed above. Room creation CHAT-18 and bcrypt CHAT-34 already await
  review in PR #23. The existing dependency chain is #22, then #23, then #43.
  No human reviews were submitted on setup PR #22 or planning PR #43 at read-back.
- Setup and planning PR CI checks are successful. CHAT-9 was corrected from
  To Do to In Review after evidence read-back. CHAT-44 stays In Review; CHAT-45
  is Yaswanth's optional practice task. The preparation sprint was not closed.
- Baseline: 67 Node and 69 Python tests passed (136 total). Windows sandbox
  loopback restrictions caused the first Node attempt to fail with EACCES;
  rerunning with permitted local networking passed.
- Current local increment: **114 Node and 117 Python tests passed (231 total)**.
  Both backend build/check steps and `git diff --check` passed. Reports are
  `reports/oct20-node.json` and `reports/oct20-python.xml` (ignored local evidence).
- Node room integration uses real HTTP/Socket.IO connections. Python room
  integration uses Flask-SocketIO's in-process client. Actual signed JWTs and
  a test session lookup are used in the new membership tests. Test-only
  transport probes demonstrate room routing, not Yaswanth's message service.
- Tested room cases include first/final tab membership, duplicate joins/leaves,
  room-only routing, disconnect and revocation cleanup, forged identities,
  invalid/unknown room IDs, unique-user counts and authenticated live updates.
- Security code was prepared alongside room integration: strict JWT verifier,
  revocable-session lookup, per-IP login middleware and shared sanitisation
  vectors. This is preparation for 21 October verification, not a claim that
  real login, logout, registration or message sending is integrated.

## Planned security checks for 21 October

1. Re-read any new authentication/messaging PRs and integrate only genuine
   owner-submitted work through the existing interfaces.
2. Extend TC-Sec-03 to expire an actual signed JWT after connection, verify
   each known and unknown event is rejected, and exercise missing/malformed
   claims, session lookup failure and queued event expiry. Check cross-runtime
   token interoperability and secret/session configuration with Hrisheek.
3. Extend TC-Sec-04 with concurrent attempts, independent peer IPs, long-running
   windows, and the actual auth route once supplied. Account lockout remains
   Hrisheek's separate CHAT-F-003 responsibility.
4. Extend TC-Sec-05 with malformed markup, entities and Unicode boundaries;
   verify Hrisheek calls `sanitizeUsername` / `sanitize_username` at registration
   and Yaswanth calls `sanitizeMessage` / `sanitize_message` before broadcasting.
   Persistence must use parameterised operations; stripping HTML is not SQL
   query protection. No persistence module is present yet.
5. Record agreed policies or remaining decisions in INTERFACE_CONTRACT.md and
   DEVIATIONS.md. Keep the PR draft until the planned security review is complete.

## Dependencies and sign-off

Hrisheek owns authentication/JWT issuance and session persistence plus unit-test
level work. Yaswanth owns messaging and QA/test-case review, integration-test
level work and the one-minute outcome-video coordination. Soham owns the listed
room/security work, CI/CD and tracking. The current launchers still deny socket
authentication until a real authentication adapter is supplied.

No registration/login implementation, production session store, business
messaging handler, persistence or browser UI is present in the reviewed branch.
These dependencies prevent a full working-product claim. They also prevent
marking all Sprint 1 acceptance criteria or the video requirement complete.
Prepare handoffs for other members; do not impersonate them or fabricate their
PRs, reviews, contributions or demonstration evidence.

GitHub Actions passing and a requested review are not human approval. Required
QA and repository-owner reviews remain human decisions. Do not merge the open
dependency PRs without those reviews. Sprint 2 work remains 26-30 October;
monthly availability and final development freeze cannot be pre-certified now.

## Publication checkpoint

Branch: `CHAT-19-rooms-security`, based on the planning branch
`CHAT-44-part-2-planning`. Published [draft PR #44](https://github.com/Team15-Chat-Application/chat-application-socket-programming/pull/44)
under Soham's authorized GitHub identity. The implementation commit is
`b3275a5395ad5f59666ebe31db2800a2068e8c75`.

Both [PR CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39399571122)
and [push CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39399563724)
passed for that exact implementation commit. PR CI logs report Node 95 unit +
19 integration tests and Python 95 unit + 22 integration tests: **231 passed**.
Build/check jobs passed. Later checkpoint-only commits still require their own
checks before being described as passing.

Jira and GitHub Project API read-back now show CHAT-9 and CHAT-19/20/21 In Review,
CHAT-35/36/37 In Progress, and CHAT-44 still In Review. No items were marked Done;
no PR was merged and no human approval was inferred. The preparation sprint was
left intact. On the next run, check PR #44's newest commit and reuse this branch.

## 21 October security work completed on 22 October (catch-up)

The user requested yesterday's tasks on 22 October. No execution or approval is
backdated to 21 October. Re-read both AGENTS.md files, inspected the clean branch,
fetched origin and inspected open PRs and live Jira assignments before changing
code. CHAT-35/36/37 remain Soham's responsibility. No new owner-submitted auth or
messaging PR was available; continue the existing draft PR #44.

- **CHAT-35 / TC-Sec-03:** actual signed JWTs expire after a successful connection
  and room join. All six exercised events (ping, create, list, join, leave and an
  unknown event) reject expired sessions and clean up membership. Required and
  malformed claims, revoked/mismatched sessions, safe errors, queued work and
  lookup failures are covered. Real Node-to-Python and Python-to-Node signing /
  verification tests pass using a test-only session lookup.
- Reproduced and fixed stale Node session-expiry checks after asynchronous lookup
  and a delayed transport join that could mutate membership after expiry. Node
  now checks token/session expiry after lookup and revalidates after awaited
  transport join/leave before changing membership. Identity claims use 1-128
  Unicode code points without unpaired surrogates in both runtimes. Python now
  rejects timestamp values outside the shared safe-integer range.
- **CHAT-36 / TC-Sec-04:** concurrent HTTP attempts allow exactly five per peer IP
  per sliding minute; excess attempts receive HTTP 429, Retry-After and no-store.
  Tests cover independent peers, spoofed forwarded headers and exact expiry
  boundaries. Python reads its clock inside the limiter lock. Real login-handler
  integration remains dependent on Hrisheek; account lockout is separate.
- **CHAT-37 / TC-Sec-05:** shared sanitisation passes adversarial markup/entity,
  control/surrogate, username and 2000/2001 Unicode-character boundaries in both
  runtimes. Cross-runtime corpus outputs agree. Existing sanitizer code needed
  no change. Registration and message call sites remain owner handoffs.
- Local regression: **174 Node + 182 Python = 356 passed**, with zero failures.
  `npm run build`, Python compileall and `git diff --check` passed. Ignored local
  reports: `reports/oct22-security-node.json` and
  `reports/oct22-security-python.xml`. Node uses real HTTP/Socket.IO; Flask uses
  in-process clients and actual Node subprocesses for interoperability.

The new tests are `tests/unit/security-edge.test.js`,
`tests/integration/security.test.js`, `python_backend/tests/unit/test_security_edge.py`,
`python_backend/tests/integration/test_security.py` and
`python_backend/tests/integration/test_security_interop.py`, with the test-only
`tests/fixtures/security_bridge.js`. These extend the submitted security cases;
Yaswanth's test-case review remains pending. Component verification does not
complete real auth/messaging integration, product acceptance or the outcome video.

Published implementation commit `3d31f4bef92f233879518b862c21744654a41ed6` to the
existing [draft PR #44](https://github.com/Team15-Chat-Application/chat-application-socket-programming/pull/44).
Exact-commit [push CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39734653774)
and [PR CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39734658496)
both completed successfully. Node and Python build/test jobs passed in both runs.
Jira confirms CHAT-35/36/37 In Review; the matching GitHub Project items were
updated to In Review. No Done status, human sign-off or merge is implied. The
next integration run must inspect new owner modules before proceeding; current
missing dependencies are unchanged. This publication checkpoint follows the
implementation commit; inspect its own head checks before claiming current-head
CI success.

## Board correction on 22 October

The empty board was caused by the saved `assignee = empty` (Unassigned) filter;
all sprint issues have assignees. Cleared the filter and verified the populated
board after refresh. Preparation sprint 102 had also been left active while
official Sprint 1 was future. Closed preparation administratively at
`2026-10-22T06:52:59.217Z` (12:22:59 IST), keeping its original 2 October start,
16 October planned end and historical evidence. Its three unfinished issues
were moved to the backlog: CHAT-9 and CHAT-44 remain In Review; optional CHAT-45
remains To Do with Yaswanth. No issue was marked Done or deleted.

Activated existing Sprint 1 (135) at its actual administrative start,
`2026-10-22T06:53:39.345Z` (12:23:39 IST), retaining the planned end of
23 October at 18:00 IST and all 21 allocated issues. The adopted course window
remains 19-23 October; Jira's activation was late and was not backdated. Read-back
confirms preparation closed, Sprint 1 active and Sprint 2 (136) still future on
26-30 October. Sprint 1 statuses remain 11 To Do, 2 In Progress, 8 In Review,
0 Done. Preparation issues are not assigned to an open sprint.

PR #44 was separately made ready for review and assigned to Yaswanth
(`kalluri088`) with his review requested on the user's instruction. This is not
human approval or completion of the missing product integrations. Use the current
states above instead of earlier historical future/draft/active-preparation notes.

## 22 October integration work - executed on the user's request

Completed the independent part of today's plan in the existing branch. GitHub
fetch/PR/review refresh failed due connectivity, and Jira refresh failed with a
connector transport error. A bounded retry also failed DNS resolution. Therefore
no new owner PR, review or Jira status is asserted in this checkpoint. The last
successful remote checks earlier today had only Soham's four PRs, no human
reviews and no auth/messaging owner PR. Recheck remote state before integration.

Prepared SPRINT_1_TRACEABILITY.md covering all 16 proposed Sprint 1 requirements,
the five support items, exact submitted test-case IDs, actual component evidence
and blocked integrated acceptance checks. Retained the 200 ms normal-load p90
criterion within TC-Msg-01; dedicated performance work in Sprint 2 does not waive
that criterion. Message persistence/history stay in proposed Sprint 2 scope;
real auth session lookup/revocation is a distinct Sprint 1 dependency.

Prepared SPRINT_1_REVIEW_DEMO.md with normal/boundary/negative real-user cases,
readiness and human-review gates, a one-minute recording sequence and verified
upload/playback requirements. The usable demo-client owner still needs agreement.
Existing owner handoffs remain applicable; no teammate module was fabricated or
taken over. Local source still lacks real auth/session, business messaging and UI.

Added scripts/verify_sprint1.ps1 and extended actual launcher smoke checks.
The Node built launcher and actual Flask process now verify HTTP health, first
five unavailable-login responses, sixth-attempt HTTP 429/Retry-After/no-store and
explicit default-auth socket denial over real Socket.IO polling, without injected
users or successful fixture auth. Added those probes/report artifacts to CI.
Corrected stale launcher text which incorrectly said rooms were unimplemented.
Aligned shared-contract boundary metadata and linked the new review documents.

Full reproducible local run at 14:38:08-14:38:43 UTC (20:08 IST): **174 Node +
182 Python = 356 tests passed**, both builds/checks, actual launcher smoke checks
and whitespace checks passed. Reports: reports/sprint1/node.json, python.xml,
launchers.json and run.json. The run records base 9a2be776fc673cbb3be3122fbd554daf0f784ad6
with a dirty checkout: this is actual local working-tree evidence, not exact-new-
commit CI evidence. SPRINT_1_OCT22_INTEGRATION_EVIDENCE.json preserves the snapshot.

Publication and new exact-commit CI remain pending connectivity. Preserve the
current In Review / In Progress statuses; do not claim new Jira updates, human
approval, approved merges, a working product or a video. On the next connected run,
fetch/re-read owners' PRs and reviews, push this existing branch, verify its CI and
then execute the blocked real acceptance cases when their modules are available.
The 23 October 18:00 IST follow-up carries forward those remaining actions.

### Publication retry for today's integration preparation

Published implementation commit `4220d17073df49b3ca8bcaf88a0c6cde8a4fe603`
to the existing PR #44 branch after the initial network failures. Fetch succeeded
on retry and PR-head read-back confirms that commit, Yaswanth assigned/requested,
no submitted reviews and no PR comments. Refreshing the complete PR list, CI
status and Jira still failed intermittently. Therefore the implementation is
published, but new exact-commit CI, current owner PR availability and fresh Jira
read-back must still be verified; the earlier pending-publication paragraph is
historical. Keep the tested local results distinct from remote CI success.

## 23 October final available work

Resumed on the user's instruction after the planned 18:00 IST endpoint; no date,
approval or acceptance was backdated. The 22 October implementation/checkpoint
was published through 5aedbd200d5a78f745e84a59e6ea1ebdb1828105. Previously
unavailable exact-head push CI 39800040861 and PR CI 39800055009 are now verified
successful: 174 Node + 182 Python tests and both real-launcher probes passed.

Owner-submitted messaging PR #45 by Yaswanth is now available, head
9af2ad20f07b2e33d1b578d62d0d7818d45b035a, based on this branch. An isolated
review checkout passed 227 Node + 232 Python tests (459 total), builds and real
launcher probes; its exact-head CI 39824321298 passed. No human review is recorded
on #44 or #45; no pending PR was merged. Hrisheek's authentication/session PR is
still absent at the live read-back. Messaging exists in the unmerged owner PR;
real authentication and the usable UI remain absent.

Reproduced and fixed a Soham-owned Python guard race: a request validated its
signed JWT before waiting for the global room lock and could mutate after expiry.
Now the existing lock order is acquired before validation. The new two-thread,
controlled-clock TC-Sec-03 regression failed before and passed after the fix.
Full local branch verification: 174 Node + 183 Python = **357 passed**, builds,
launcher probes and whitespace checks passed. In an explicitly unpublished
PR #45 overlay with this guard change, all 233 Python tests also pass; Node
source is unchanged from its 227-test exact-head run. This is compatibility
validation, not a human-approved integration or exact candidate CI claim.

A separate Node broadcaster-throws probe reproduced an escaping error with no
safe acknowledgement in the owner messaging handler. Prepared the reproduction,
proposed error-boundary structure and owner test expectation in
PR45_INTEGRATION_REVIEW.md; the owner PR was not silently changed or messaged.

Live Jira now has CHAT-14/15/16/17 and CHAT-40/43 In Review. Yaswanth's 23 October
CHAT-43 comment explicitly says no video has been recorded/uploaded, blocked by
auth and an agreed demo-client owner. The working-product/video deliverables remain incomplete at this administrative
checkpoint; Part 2 specifies the date rather than a mandatory end hour. Passing
357/459 component tests does not waive the real-product/video requirement. Sprint 1 remains
administratively active, preparation closed, Sprint 2 future. Preserve these
accurate limitations and outstanding human QA/owner review boundaries.

SPRINT_1_OCT23_EVIDENCE.json contains the actual execution and CI snapshot.
The final feature commit still requires its own exact-commit CI before being
called passing. No work is marked Done or merged by this checkpoint.

### 23 October publication and tracking checkpoint

Implementation commit `407155ed3279f4ae597ee4a393b44828cb604414` is published
on PR #44. Exact-head [push CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39956171367)
and [PR CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39956178311)
both passed. Logs confirm Node 147 unit + 27 integration and Python 148 unit +
35 integration tests (**357 passed**), plus both actual launcher smoke probes.

CHAT-41 is now In Review in Jira and GitHub Project; CHAT-42 remains In Progress
because final contributions/review/acceptance evidence is incomplete. Mirrored
CHAT-14/15/16/17 and CHAT-40/43 to the live Jira In Review state. Final live Sprint 1
snapshot: 21 items, **5 To Do, 1 In Progress, 15 In Review, 0 Done**. Corrected the
GitHub Project's stale future-sprint wording without erasing preparation history.
No issue was marked Done and no PR was merged. No human approval was inferred.

Preserved the actual exact-head PR #45 reports and unpublished guard-overlay
patch under ignored reports/pr45-review, then removed the temporary detached
checkout and dependency junction after verifying its absolute cleanup path.
The main dependency installation and owner's remote branch were untouched.

The one-minute real-product recording remains blocked, as confirmed by the
owner's CHAT-43 update. Remaining actions and proposed recording flow are in
SPRINT_1_REVIEW_DEMO.md; the reproduced owner fix is in PR45_INTEGRATION_REVIEW.md.
This final scheduled Sprint 1 session ends after recording the available work;
stop its automation and do not continue changes after 23 October. Any later
completion must retain its actual dates, genuine reviews and explanation of
unmet scope. Separate Sprint 2 scheduling is unchanged. Later documentation-only
checkpoint commits still need their own head checks before claiming head CI green.

### 23 October user-requested personal-task completion

On the new instruction "finish off my tasks", reconciled CHAT-42 against its
actual acceptance criteria. Tracking unfinished team work accurately does not
require representing it as delivered. The package now includes
SPRINT_1_CONTRIBUTIONS.md and SPRINT_1_TRACKING_AUDIT.json, with live evidence
for all 21 selected items: unique Jira/GitHub links, acceptance criteria, matching
owners/statuses, positive proposed estimates/due dates and 16 requirement/test
mappings. Project 1's repository link was verified by GraphQL; its 40-item
backlog remains intact. No duplicate task or PR was created.

Updated README, handoff and traceability availability notes to acknowledge the
actual unmerged messaging PR and 357-test room/security baseline. Recorded the
owner branch-name convention deviation without renaming his branch. Linked real
member commits, absent auth/reviews and outstanding defect/video dependencies.
Local Markdown-link, JSON/mapping and whitespace checks passed; no runtime code
changed in this checkpoint. The new publication still needs its own CI result.

CHAT-42's Jira description now links the delivered package and retains previous
history. Its transition to In Review succeeded; GitHub Project mirrors it.
All ten Soham Sprint 1 items are now In Review: CHAT-18-21, CHAT-34-37,
CHAT-41 and CHAT-42. No Done transition or merge was performed. Real QA/owner
approval and integrated acceptance remain pending. The earlier snapshot is
historical; following this transition the board has 5 To Do, 16 In Review,
0 In Progress and 0 Done, subject to later owner updates.

### 23 October pre-merge review fixes requested by the user

The user explicitly requested all PRs merged, then supplied H1/M1/M2/L1 findings
and asked for these fixes first. No Git fetch or integration checkout was made:
automatic approval review could not execute that command because its account
usage limit was reached; this was a review-service failure, not an unsafe-action
determination. Independent local implementation/testing continued.

New tests reproduced H1 (slow Python validation blocked another socket) and M1
(Node throwing acknowledgement poisoned the pending chain; the disconnected
error path also acknowledged a dead socket). After the local fixes, both Node
tests pass; Python slow-lookup isolation, ACK-failure recovery and the original
signed-JWT room-wait expiry regression pass. Validation now holds only the
per-context lock. Mutations use live_room_events, retrying validation outside
the global room lock after contention, so the old expiry bug is not reopened.

Recorded M2/L1 as proposed Sprint 2 entries S2-ROOM-CAPACITY and S2-PROXY-IP in
DEVIATIONS.md, with limitations and concrete acceptance checks. No quota, proxy
trust, agreed scope or remote ticket creation is falsely claimed.

Pending: publish these local changes, retain live_room_events in PR #45's Python
message dispatch, resolve its Node broadcast-error finding, verify exact-commit
CI and merge in dependency order. The requested sequence into main is #22,
#23, documentation #43 retargeted as appropriate, #44 and #45. Preserve real
authorship and existing branches; the user's merge instruction does not fabricate
QA/test-case approval or working-product/video acceptance.

Initial available checks passed 149 Node unit tests and all 185 Python tests.
The first full Node attempt hit loopback EACCES in the restricted session.
A fresh approved retry resolved the service/access failure without bypassing
permissions: **176 Node + 185 Python = 361 tests passed**, Node build/Python
compile and both actual launcher probes passed. Reports and the initial failure
are captured in SPRINT_1_PREMERGE_EVIDENCE.json. These remain dirty-checkout
results until the published commit's CI is verified. No merge was performed
during the initially blocked preparation; publication and merges follow separately.

### 23 October messaging integration and actual merge gate

The approved base-branch full run passed 361 tests and launcher probes. Published
Soham commit cdd572a for H1/M1, retaining expiry-after-room-wait protection while
removing session lookup from the shared lock. M2/L1 remain proposed follow-ups.

In an isolated PR #45 checkout, merged that shared base using a genuine Soham
merge commit, preserving Yaswanth's original commits. Added two negative cases:
Node adapter broadcast throws, and Python message session expires while waiting
for a shared room dispatch lock. Both failed before the integration changes.
Soham's integration fix catches Node broadcast errors before success response
and uses live_room_events for Python message dispatch. Full candidate checks:
**230 Node + 236 Python = 466 passed**, Node build, Python compile and both actual
default-launcher probes passed. Current-head CI must still verify publication.

No PR was merged. Automatic approval review rejected the command to merge #22
into main because no genuine human review was evidenced and AGENTS.md requires
it. The rejection occurred before execution, so the bundled retarget/next-PR
steps also did not run. Do not bypass this through direct main pushes, alternate
APIs, auto-merge or fabricated reviews. Publish the concrete tested fixes, then
obtain actual required human review before retrying dependency-order merges.

These changes are attributed to Soham, with maintainer edits enabled on the
existing owner PR. They do not impersonate Yaswanth or establish QA/test-case,
working-product or video approval. Authentication/client acceptance remains open.
