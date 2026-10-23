# Sprint 1 requirement and test evidence - updated 23 October 2026

Sources: submitted SE_SRS_Division_of_Work.pdf sections 4.1-4.3 and 5.1;
15_TestPlan.pdf section 13 (pages 8-9); adopted Part 2 calendar; proposed
allocation in PART_2_PLAN.md. This is a working execution record, not a change
to the submitted PDFs or an approved feature allocation.

P below means the cited component checks passed. B means the integrated
acceptance test is blocked by a missing dependency. A passing helper suite is
not a passing whole requirement. No product requirement is signed off here.
Owners below are development owners; submitted Test Plan review roles remain
unchanged. The 23 October read-back before CHAT-42's review handoff had 5 To Do,
1 In Progress and 15 In Review. The item-by-item observation is retained in
SPRINT_1_TRACKING_AUDIT.json; later review transitions do not rewrite that snapshot.

## Allocated requirements

| Jira / SRS requirement | Submitted test case | Component evidence in both backends | Integrated result and next action |
| --- | --- | --- | --- |
| CHAT-10 / CHAT-F-001 registration | TC-Auth-01 | Username/bcrypt helper checks only | B: Hrisheek supplies registration, unique-name persistence and credential validation; verify duplicate registration and safe errors |
| CHAT-11 / CHAT-F-002 login/JWT issuance | TC-Auth-02 | Actual JWT verification and cross-runtime token tests, not real login | B: Hrisheek supplies credential lookup, issuance, live session store and launcher wiring; test valid/wrong credentials |
| CHAT-12 / CHAT-F-003 account lockout | TC-Auth-03 | IP limiter is a separate rule, not account-lockout evidence | B: Hrisheek supplies five-consecutive-failure / 15-minute lockout; test exact boundaries and reset policy |
| CHAT-13 / CHAT-F-004 logout | TC-Auth-04 | Revoked test-session lookup rejects later events | B: Hrisheek supplies actual logout/revocation persistence; test old token after real logout |
| CHAT-14 / CHAT-F-005 message delivery | TC-Msg-01 | P: owner PR #45 supplies guarded room-scoped message handlers and component tests | B: real auth/client integration and normal-load p90 against the SRS 200 ms target, with environment/sample size |
| CHAT-15 / CHAT-F-006 acknowledgement | TC-Msg-02 | P: PR #45 acknowledges after broadcast; Node adapter-throw error path has an open defect | B: owner fixes error boundary, then real integrated success/failure acceptance |
| CHAT-16 / CHAT-F-007 length | TC-Msg-03 | P: shared helper and PR #45 actual message-boundary tests cover 2000/2001 code points | B: real users/client acceptance; rejected content must never broadcast |
| CHAT-17 / CHAT-F-008 XSS | TC-Msg-04 | P: helper corpus and PR #45 sanitizer call sites/component tests | B: verify rendered client text, no script execution and no double decoding |
| CHAT-18 / CHAT-F-009 create room | TC-Room-01 | P: rooms unit/integration suites, invalid names, 1/64/65-character boundaries, unique IDs | B: real login and usable client are missing; verify authenticated create appears in another user's list |
| CHAT-19 / CHAT-F-010 join room | TC-Room-02 | P: membership unit/integration suites, duplicate joins, invalid/internal room IDs | B: real auth/message integration missing; verify subsequent business messages reach joined members only |
| CHAT-20 / CHAT-F-011 notices | TC-Room-03 | P: membership suites, first/final-tab notices, leave/disconnect/revocation cleanup | B: verify with real users and client; other tabs must not cause an early departure |
| CHAT-21 / CHAT-F-012 room list/counts | TC-Room-04 | P: membership suites verify authenticated live catalogue and distinct-user counts | B: real auth and room-list panel are absent; compare two clients after joins/leaves |
| CHAT-34 / CHAT-SR-002 bcrypt | TC-Sec-02 | P: passwords unit and password interoperability suites, cost 12, >=10 policy, salts, byte limits and no plaintext logging | B: Hrisheek integrates real stored hashes; inspect registration/login storage and logs |
| CHAT-35 / CHAT-SR-003 per-event JWT | TC-Sec-03 | P: security foundation/edge, membership, security integration and JWT interoperability suites | B: connect real issued tokens to the live lookup; verify invalid/expired/revoked known and unknown events, including new message handlers |
| CHAT-36 / CHAT-SR-004 login IP limit | TC-Sec-04 | P: security/membership HTTP integration, five/six attempts, concurrency, peer isolation and rolling boundaries; real launcher probe | B: Hrisheek wires actual login handler; retain separate account-lockout tests |
| CHAT-37 / CHAT-SR-005 input safety | TC-Sec-05 | P: shared input vectors, malformed markup/entities, controls/surrogates and Unicode boundaries | B: auth/message owners integrate helper call sites; persistence uses parameterized operations, not HTML stripping as query protection |

## Evidence file map

- Node unit: tests/unit/rooms.test.js, membership.test.js, passwords.test.js,
  security-foundation.test.js and security-edge.test.js.
- Node integration: tests/integration/rooms.test.js, membership.test.js and
  security.test.js. These use real local HTTP/Socket.IO connections.
- Python unit: corresponding test_rooms.py, test_membership.py, test_passwords.py,
  test_security_foundation.py and test_security_edge.py under python_backend/tests/unit.
- Python integration: test_rooms.py, test_membership.py, test_password_interop.py,
  test_security.py and test_security_interop.py under python_backend/tests/integration.
  Flask event tests use the in-process client; interoperability invokes real Node.
- scripts/smoke_startup.py now launches the built Node and actual Flask processes,
  checks HTTP health, unavailable login, sixth-attempt 429, and explicit default
  auth rejection over real Socket.IO polling. It never injects successful auth.
- Reproduce the full Windows component run with scripts/verify_sprint1.ps1.
  Reports are ignored local outputs under reports/sprint1; CI uploads test and
  launcher reports. Historical exact-commit evidence remains in the daily record
  and SPRINT_1_OCT22_SECURITY_EVIDENCE.json. A run is tied to its actual checkout;
  dirty-checkout results are not exact-commit CI evidence.

## Sprint support items

| Item | Current evidence and open boundary |
| --- | --- |
| CHAT-39 - Hrisheek, unit test leadership | Existing component tests pass; auth/message owner tests and genuine test-case review remain open |
| CHAT-40 - Yaswanth, integration/QA | Room/security tests pass; real credential-to-message flows and QA review remain blocked |
| CHAT-41 - Soham, CI | Builds, unit/integration jobs and report artifacts exist; launcher smoke added; final integrated-commit checks and required review remain open |
| CHAT-42 - Soham, tracking | 21-item live audit, contribution/CI/review links and concrete blockers in SPRINT_1_CONTRIBUTIONS.md; tracking package prepared for review, actual human approval pending |
| CHAT-43 - Yaswanth coordinates, all demonstrate | Real working-product flow and one-minute recording/upload/playback remain blocked; use SPRINT_1_REVIEW_DEMO.md |

## Scope and sign-off boundaries

The remaining 13 SRS requirements retain their proposed Sprint 2 allocation:
CHAT-F-013 through CHAT-F-019, CHAT-NF-001 through CHAT-NF-005 and CHAT-SR-001.
Message persistence/history/receipts are not extra Sprint 1 feature commitments.
Live authentication session lookup/revocation is a separate Sprint 1 dependency.
TC-Msg-01 still includes its own 200 ms acceptance target; deferring the dedicated
performance work does not erase it. Monthly availability is not established by
short helper runs. Record approved deviations rather than silently waiving them.

Yaswanth reviews test cases as QA Lead. Hrisheek retains unit-test leadership;
Soham maintains security/RTM evidence and coordinates product acceptance. Owner
review and actual sign-off are pending. No one has approved this matrix by virtue
of CI passing or a review request being sent.

## 23 October assessment (supersedes earlier availability notes)

Yaswanth's unmerged PR #45 (9af2ad2) now supplies the actual room/message handlers
and shared sanitization call sites for CHAT-F-005-008. Its exact head passes
227 Node + 232 Python tests and CI 39824321298. Full product acceptance remains
B for real auth/UI and the unmeasured TC-Msg-01 p90 target. A reproduced Node
broadcast-exception finding needs the owner fix and negative test; see
PR45_INTEGRATION_REVIEW.md. No message requirement is signed off here.

Soham's new TC-Sec-03 shared-lock expiry regression passes after the Python guard
fix; the base branch now has 174 Node + 183 Python passing tests. The regression
also passes in a PR #45 overlay (233 Python tests), which is not a merged/approved
product. New exact-commit CI is recorded through the final publication checkpoint.
CHAT-43's owner confirms no recording/upload exists; its In Review status is not
acceptance. All genuine QA/owner approvals and final product checks remain open.
