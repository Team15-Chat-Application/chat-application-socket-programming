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
