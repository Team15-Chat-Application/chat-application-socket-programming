# Deviation and implementation-decision log

Part 2 requires following the submitted SRS, SAD and Test Plan, documenting
departures and explaining them during the final demo. Updated 22 October 2026.
This log records actual decisions and open gaps, not an approved waiver or sign-off.

## Recorded decisions for review

| Source / baseline | Current decision | Reason / impact | Evidence | Review state |
| --- | --- | --- | --- | --- |
| STP original Node 18 / Python 3.10 environment; SRS minimum versions | Development/CI use Node 24 / Python 3.12 | Existing setup chose supported Node and reproducible runtime lines; retain exact tested versions in reports | DEVELOPMENT.md; PR #22; CI | Team review pending |
| SRS named-room creation; name uniqueness/length/lifecycle not specified | Names trim ASCII edge whitespace; 1-64 Unicode code points; duplicate names get distinct IDs; empty rooms retained until restart | Concrete implementation defaults; confirm UI and messaging expectations | INTERFACE_CONTRACT.md; OCT_04_PROGRESS.md; PR #23 | Proposed, not an additional SRS requirement |
| SRS bcrypt cost >=10; registration strength remains an auth responsibility | Shared helpers default to cost 12 (operational range 10-14), strict UTF-8 and 72-byte maximum | Prevent silent bcrypt truncation; real registration must enforce SRS credential rules and store only the hash | Password helper code and interoperability tests; PR #23 | Auth integration and team policy review pending |
| SAD 3.9/4.3 leaves JWT signing and key policy open | Prepared verifier permits only HS256, issuer team15-chat, audience chat-application, required identity/time claims, minimum 32-byte secret and a fresh revocable-session lookup | Concrete verification contract without implementing another member's login/issuance work; no default key | jwt-auth modules; security foundation tests; SOHAM_INTEGRATION_HANDOFF.md | Hrisheek/team policy review and production auth integration pending |
| SAD 4.3 proposes distinct-user room membership | Implement first/final-socket membership changes, idempotent joins/leaves and server-only chat:room: transport channels | Prevent inflated counts from tabs and prevent raw socket IDs from becoming public chat rooms | membership unit/integration tests; room store and handlers | Component-tested; team/QA review pending |
| SRS CHAT-SR-004 requires five attempts/minute/IP | Sliding window before supplied login handler; bounded process-local store; ignore forwarded headers | Enforce the stated limit without trusting spoofed headers; multi-process deployment needs a shared limiter and explicit proxy policy | login-limit modules; actual HTTP middleware tests | Production topology and real login integration pending |
| SRS CHAT-SR-005; SAD 4.3 leaves sanitisation/Unicode policy open | Prepared no-HTML message sanitizer; 2000 raw Unicode code points; reject unsafe controls/surrogates; usernames use a proposed 1-32 ASCII identifier policy | Shared safe input boundary; no silent credential renaming; escaped output display must be reviewed | input modules; contracts/input-vectors.json; security foundation tests | Team policy review and auth/message call-site integration pending |

## Acceptance gaps, not accepted deviations

- Authentication issuance/session storage, business messaging, persistence and the UI
  are not complete. Room/component and signed-test-token checks do not demonstrate full application
  acceptance or the working-product video requirement.
- Catalogue persistence and production deployment remain pending. Live membership
  and list updates are now component-tested; no product-level requirement is waived.
- Monthly 99.5% availability requires a real observation window. A short sprint
  report must state its duration and cannot be labelled a full-month SLA pass.
- Node integration uses actual HTTP/Socket.IO transport; Python integration uses
  the in-process client plus real Node subprocesses for bcrypt interoperability.
  Retain that distinction when reporting test coverage.

## 22 October security verification

The 21 October checklist was carried forward and executed on 22 October, without
backdating. PR #44 hardens the existing JWT/session boundary and delayed room
transport operations. Both runtimes now share safe-integer time bounds and
1-128-code-point identity bounds without unpaired surrogates. These are concrete
validation policies for owner review, not newly agreed SRS requirements.
356 local tests passed, including JWT and sanitizer interoperability. Production
auth/message call sites and human QA review remain open; see the daily execution
record and owner handoff for exact coverage and acceptance boundaries.

## 22 October integration preparation

Actual launcher smoke checks use real processes and Socket.IO polling; they do
not establish a WebSocket-only transport result, business messaging, the 200 ms
message-delivery criterion or a working-product video. Prepared an explicit
requirement/test matrix and blocked-case checklist. Retained TC-Msg-01's own
200 ms target despite dedicated performance work being allocated to Sprint 2.
No SRS acceptance criterion has been waived.

## Recording future changes

For each departure, record the exact SRS/SAD/STP clause, old and new behaviour,
reason, impact, linked issue/PR, test evidence and review/approval state. Obtain
genuine team/owner decisions and explain accepted changes in the final demo.
Do not fill approval/signature fields or mark acceptance without actual evidence.
