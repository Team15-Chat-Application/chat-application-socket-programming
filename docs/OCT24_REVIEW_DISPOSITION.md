# Review follow-up - 24 October 2026

Actual teammate reviews on #22/#23/#43/#44 are COMMENTED, not approvals. This
records checked findings and concrete changes for the required next review.
No human approval, merge or Sprint 1 acceptance is inferred. Work today follows
the user's explicit check-and-merge request; the ended automation is not resumed.

| Finding | Disposition and evidence |
| --- | --- |
| #43 missing delivery-plan file | Fixed the repository AGENTS.md reference to the existing docs/PART_2_PLAN.md on #43, commit 96bfcbb. The parent workspace guidance is unchanged. |
| #44 store/channel ordering and failed-operation desynchronization | Both Node and Python now mutate the room store first, repair store/channel state if transport throws (including partial adapter side effects), and disconnect if repair fails. New failure-path tests assert both store and actual/fake adapter membership. The previous Python code was also transport-first; the review's contrary description is not used as evidence. |
| #44 Python unbounded lock retry | At most three 50 ms room-lock waits, with RATE_LIMITED on saturation and a recovery regression. JWT/session lookup remains outside the global lock; revalidate after a contended wait, then attempt nonblocking acquisition. No unbounded verification loop or slow lookup under the shared lock. |
| #44 unbounded Node room queue | Cap at 64 outstanding room events per socket. Overflow returns RATE_LIMITED; acknowledgement failure is audited without poisoning later work. A blocked-queue/drain/recovery test verifies the boundary. These are explicit operational defaults for review, not new agreed SRS numbers. |
| #22/#44 silent security/internal failures | Fixed-label structured logging in both backends for connect/validation failures, room errors, failed acknowledgements and login rate rejection. No exception text/stacks, token, password, message or payload is logged. Tests prove redaction. External collection, retention and metrics remain deployment follow-ups. |
| #22 fixture token/identity propagation | Bootstrap adapters now assert the incoming credentials and validated identity/token. A Node test handler confirms identity reaches registered handlers. Existing signed-JWT and forged-sender tests remain separate evidence. |
| #22 smoke not wired to CI | Already fixed in the dependent #44 workflow: actual Node and Flask launchers and socket-denial probes run in CI. Do not misrepresent the historical #22 head as containing that later change. |
| #44 slow-lookup regression quality | Strengthened the slow path to room:create. The earlier room:list version did reproduce the old guard-level global lock (all guarded handlers were covered), as its actual pre-fix failure showed; it was not evidence of a passing pre-fix design. |
| #44 delayed-join test omits transport state | Now inspects the retained server socket's transport room set as well as final store membership after expiry/disconnect. With store-first ordering a temporary store join is expected; no expired membership or transport subscription may survive. |
| #44 unknown-event acknowledgement drift | Node acknowledges NOT_FOUND after per-packet authentication, matching Python. Avoid onAny for this because it executes before packet middleware. Invalid sessions still emit system:error and disconnect. |
| #44 iat default | Python explicitly enables verify_iat, retaining PyJWT's verified timestamp behavior rather than depending on an implicit default. |
| #44 allocation before text cap | Bounded code-point iteration and a 2x UTF-16 upper-bound check replace spread-array allocation in message/room-name validation. A raw value.length > 2000 rejection would incorrectly reject valid emoji payloads, so that suggested shortcut is not used. Existing Unicode boundary/interoperability tests remain required. |

## Explicit retained decisions and proposed follow-ups

- **Fresh queued validation:** packet middleware protects all events; the room
  queue validates again after waiting and after asynchronous join/leave. Reusing
  a pre-wait result would reopen the tested expiry/revocation races. The bounded
  queue controls retained work; do not remove the security check to reduce cost.
- **Catalogue fan-out:** full snapshots on room mutation remain the current
  contract. Coalescing/delta updates and catalogue capacity are proposed Sprint 2
  performance work alongside S2-ROOM-CAPACITY. No load/SLA target is certified.
- **Origins:** explicit browser-origin/proxy topology must be agreed before UI
  deployment and exercised on both backends. JWT authentication is still required;
  origin policy is not a substitute. No production CORS policy is claimed here.
- **Limiter scope:** only POST /api/auth/login is limited. All attempts, including
  successful logins, count toward five/minute/direct-peer-IP. Registration,
  refresh/logout and socket handshakes do not inherit that limiter. Account
  lockout remains separate; S2-PROXY-IP covers reviewed proxy/shared-worker policy.
- **Python dependency hashes:** pinned versions are not artifact hash verification.
  Hash-locked Python installs remain a proposed supply-chain improvement, with
  platform/wheel coverage needed before enabling --require-hashes.
- **Dual push/PR checks:** retained intentionally for the adopted requirement to
  test commits and PRs; duplicate run cost is disclosed. No workflow change to
  suppress feature-branch commit checks is made without an agreed policy.
- **Encoding/persistence:** sanitize once at the message boundary. Future history
  must preserve the canonical sanitized value and avoid applying the same escaping
  twice. Agree readable rendering with the UI owner; never decode a message and
  inject it as untrusted HTML. No persistence or rendered-XSS acceptance is claimed.
- **Revocation/expiry response:** system:error followed by disconnect is the
  authoritative outcome; a callback acknowledgement is not guaranteed after
  disconnect. Python in-process callback returns are not proof that a real client
  will receive a post-disconnect acknowledgement.

Next gate: verify exact-head CI for the published follow-up, then check the
owner-requested merge against the actual review requirements. #23's review reports
no actionable defect, but it too was submitted as COMMENTED. Preserve review
decisions rather than treating comments as formal approvals or QA sign-off.
