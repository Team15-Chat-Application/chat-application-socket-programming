# Deviation and implementation-decision log

Part 2 requires following the submitted SRS, SAD and Test Plan, documenting
departures and explaining them during the final demo. Updated 23 October 2026.
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

## 23 October shared dispatch fix and owner-module review

A controlled two-thread/signed-JWT test reproduced expiry while waiting for the
Python shared room lock. The guard now acquires context then room locks before
validation, preserving the existing order and reentrant handler locking. This
also serializes guarded ping/unknown dispatch with room operations; real product
latency/load assessment remains pending. The original regression fails and the
fixed branch passes it. Base branch regression is 357 tests; an isolated exact
owner messaging head passes 459, and its Python suite with the guard overlay
passes 233. None is an approved working-product acceptance result.

PR #45 supplies real owner-authored messaging components but remains unmerged
and has a reproduced Node broadcast-error handoff. Authentication, usable client,
required human reviews and the genuine outcome video remain missing. The 23
October 18:00 IST Jira administrative checkpoint passed with product/video
acceptance incomplete. Part 2 specifies dates, not a required end hour; record
actual later completion and explain unresolved scope without backdating.

## Recording future changes

For each departure, record the exact SRS/SAD/STP clause, old and new behaviour,
reason, impact, linked issue/PR, test evidence and review/approval state. Obtain
genuine team/owner decisions and explain accepted changes in the final demo.
Do not fill approval/signature fields or mark acceptance without actual evidence.
## 23 October tracking convention observation

CHAT-42 asks for actual Jira keys in feature branch names, commits and PR titles.
Yaswanth's existing branch `sprint-1/yaswanth` lacks a CHAT key; PR #45 and its
feature commits identify CHAT-14/15/16/17. The actual branch and author are
preserved. No automatic Jira Development indexing is claimed from those strings.
The review package links the real commits/PR directly; no owner branch is renamed.

## 23 October requested review fixes (local, not yet published)

H1: the earlier guard-level global lock described above is superseded by a
per-socket validation lock plus a live_room_events mutation boundary. A slow
session lookup holds no shared room lock. Simply deleting the global guard lock
would reopen the signed-JWT expiry-during-room-wait race; after any contended
room wait, the mutation boundary revalidates outside that lock and retries a
nonblocking acquisition. Existing handler mutation blocks retain serialization.
Ping/unknown dispatch does not acquire the room lock. The old expiry regression
and new two-user slow-lookup isolation test must both pass.

M1: Node room dispatch terminates its pending promise chain with a rejection
handler so a throwing acknowledgement cannot poison later queued events. The
error response also checks socket.connected. New tests cover queue recovery
and an operation that fails after disconnection. The Python regression injects
an ACK packet-send failure, then verifies the next list/create operations work;
the framework sends its ACK after handler locks are released, rather than using
a Node-style promise queue. This does not claim a failed ACK can be delivered.

### Proposed Sprint 2 follow-ups (M2 / L1)

These named entries track the review findings without inventing team agreement,
new feature estimates, assignments or completed mitigation. Scope/policy needs
team review before Sprint 2 implementation.

| Tracking ID | Current limitation and impact | Proposed work / acceptance evidence | State |
| --- | --- | --- | --- |
| S2-ROOM-CAPACITY (M2) | Authenticated room creation has no count/rate quota and empty rooms persist until process restart. Memory/catalogue work can grow without bound. | Agree total/per-user capacity and creation-rate policy, empty-room lifetime/cleanup and safe refusal envelope. Test quota boundaries, independent users, cleanup under concurrent membership and bounded catalogue resources. Preserve required room behavior; do not silently evict active rooms. | Proposed Sprint 2 follow-up; not mitigated |
| S2-PROXY-IP (L1) | Login limiting uses the direct peer IP and ignores forwarded headers. Behind a reverse proxy, users can share one limit; the store is process-local. | Review deployment topology and explicit trusted-proxy allowlist/hop policy, reject spoofed forwarding, and choose a shared limiter for multiple workers. Test direct/proxied peer isolation, forged headers, five/six boundaries and cross-worker enforcement. | Proposed Sprint 2 follow-up; not mitigated |

The user requested these fixes before merging all PRs. No merge is inferred from
this log. Git integration preparation was not executed because automatic approval
review initially returned a usage error. A fresh approved retry subsequently
succeeded; the service restriction is resolved. The approved full run passed
176 Node + 185 Python tests and both launcher probes. Publication, owner messaging
integration, exact-commit CI and dependency-order merges follow as separate steps.

## 24 October human-review follow-up

The new reviews are COMMENTED, with no approvals on #22/#23/#43/#44. The concrete
fixes/dispositions and retained security decisions are recorded in
OCT24_REVIEW_DISPOSITION.md. Store/channel rollback, bounded dispatch, redacted
audit reasons, unknown-event responses, fixture propagation and bounded Unicode
counting are implemented for new review. The operational 64-event/three-50ms
bounds are proposed defaults, not accepted course capacity targets.

Additional proposed follow-ups: catalogue update coalescing/deltas with measured
capacity, explicit browser-origin/deployment policy, structured-log collection
and retention, and platform-complete hashed Python dependency artifacts. Existing
S2-ROOM-CAPACITY/S2-PROXY-IP entries remain open. Dual commit/PR CI is intentionally
retained to meet the adopted testing instructions. Do not treat these disclosed
follow-ups as implemented mitigations or use COMMENTED reviews as approvals.
