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

## Next security checks on 21 October

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
`CHAT-44-part-2-planning`. New PR and exact-commit CI evidence will be added
after publication. Nothing in this checkpoint closes a pending acceptance item.
