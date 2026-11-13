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
| SRS CHAT-F-005/006 (CHAT-14/CHAT-15) real-time delivery and acknowledgement | `message:send` resolves the room, then this socket's membership, then the shared content helper; broadcasts `message:received` to `chat:room:<roomId>` and returns the sender's acknowledgement only after the broadcast has been dispatched. The acknowledgement is not per-recipient delivered/read confirmation (CHAT-24/25) and this increment adds no history or persistence | One shared membership store gates sending, identity stays server-issued, and the acknowledgement claim is limited to what the tests actually show | `src/messages.js`, `python_backend/chat_backend/messages.py`; messaging unit and integration tests (Node 124 unit + 37 integration, Python 122 unit + 39 integration, run 20 October 2026) | Component and fixture-token transport tested; production login/issuance, UI and team/QA review pending |

## Local toolchain deviations on the development machine (20 October 2026)

These are environment facts rather than product decisions: they change how the documented
commands are run, not what is tested.

- mise resolves Node 26.7.0 globally, while this repository requires `>=24 <25`. Every Node
  command needs the `mise exec node@24 --` prefix (verified: v24.22.0). CI still pins Node 24.
- `python_backend/.venv` is created by `uv` and contains no `pip`, so the documented
  `.venv/bin/python -m pip install ...` cannot run. Use
  `uv pip install --python .venv/bin/python -r python_backend/requirements-dev.lock.txt`
  and invoke the venv interpreter explicitly (verified: Python 3.12.14; the system `python3`
  is 3.14.7 and must not be used).

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


## 28 October working-product update

See [current delivery record](DELIVERY_2026_10_28.md) for integrated authentication, persistence, browser UI, actual network/restart, load/TLS and video evidence. Earlier missing-feature and unmerged-PR statements remain historical snapshots. Runtime/database decisions and late Sprint 1 delivery are explicitly recorded there. Monthly availability, manual accessibility review and genuine owner/QA/final acceptance are not inferred from automated tests.


## 28 October repository visibility decision

CHAT-9's recorded setup criterion specified a private repository. The repository was already public. On 28 October 2026 the owner explicitly instructed: "Keep public; document the deviation." Public visibility is therefore retained as an owner-authorized deviation. No repository access/visibility change was made, no earlier approval is inferred, and the original private criterion remains visible for traceability. Explain this decision during the final demo. This decision resolves the visibility question only; Jira development-indexing evidence is assessed separately.


## 28 October Soham close-out preparation and regression fix

Prepared the STP's isolated 10-user/5-room/200-message fixture with guarded creation and truthful synthetic-state labels. Two deterministic Node account-lockout interleavings were reproduced: post-expiry failure-count overwrite and a new lock cleared after a pending successful password check. Both regressions failed before the correction. Current account/time are now rechecked after bcrypt for success and failure; all 251 Node tests and both actual process-restart flows pass locally. The new high-priority bug CHAT-53 remains subject to Hrisheek/Yaswanth review in the current PR. No prior owner authorship, approval or accepted ticket is rewritten.

Explicit member submission/review/scope tasks CHAT-49 through CHAT-52 were assigned by Soham's 28 October request, with proposed estimates/29 October targets. These are new coordination assignments, not point values or approvals supplied by the PDFs. See SOHAM_DELIVERY_HANDOFF.md. The monthly availability window and final Product Owner freeze remain genuine open dependencies.


## 31 October — actual blocking review, corrections and delegated scope decision

Yaswanth submitted CHANGES_REQUESTED on PR #47 at 577a69e. Independently reproduced the Python fail-open findings (8 failing/3 passing new startup cases), then implemented shared production-flag/partial-TLS validation. Both flags are honored for Flask; incomplete TLS is rejected before listening/database creation. TLS-mode CSP and session-based Node logout cleanup were also hardened. All 11 new regressions, the 252-test Node and 266-test Python suites, and actual Node/Flask TLS/WSS checks passed locally. See OCT31_REVIEW_RESPONSE.md; these results request actual re-review rather than converting a blocking review into approval.

Soham replied "whatever u think is best" to the concrete admin/private scope options and delegated the choice. Option A was selected on 31 October: keep the 29 numbered SRS requirements as this delivery baseline and explicitly defer uncontracted admin/private functionality described in SAD/STP. Original source scope is retained and the departure must be explained during the demo. See OCT31_SCOPE_DECISION_BRIEF.md for rationale/impacts and remaining genuine team/course review. No numbered NFR/security requirement, monthly uptime, manual accessibility, owner PR or final acceptance is waived.

The scheduled Sprint 2 end was 30 October. This work is dated 31 October and is late completion; formal freeze is still pending. The reviewer's referenced local branch/report was not available in the visible remote refs; no unpublished authored work is claimed integrated.


## 31 October — QA Lead reconciliation report and test-method disposition

Kalluri Yaswanth prepared the formal reconciliation report and test-method disposition (see `docs/ADMIN_PRIVATE_SCOPE_RECONCILIATION.md` and `docs/QA_TEST_SUMMARY_SPRINT2.md`):
- Confirms alignment with the Product Owner's Option A scope decision: the 29 numbered SRS requirements constitute the verified Sprint 2 delivery baseline, and uncontracted admin/private features are deferred as future backlog items.
- Documents tool and environment deviations (Socket.IO client load testing in lieu of JMeter; unit/integration/TLS assertions in lieu of OWASP ZAP; SQLite in WAL mode; automated Axe-core Chromium covers WCAG 2.1 AA rules and keyboard focus; CHAT-38 reassigned to Soham on 8 Nov with manual NVDA screen-reader and 200% zoom checks completed and recorded on 10 November in PR #58).
- Provides end-to-end traceability across all 29 requirements with test IDs and failure/pass boundaries.


## 5 November — independent review findings and dispositions

An independent review of PR #47 head `140da7f` re-checked Yaswanth's two blocking findings and the two
recommendations. All four are genuinely corrected in `c16bba9`. The review then found one remaining
instance of the same fail-open class, now fixed, plus items that are recorded rather than changed.

Fixed in this increment (test-first, both backends):

| Finding | Correction | Evidence |
| --- | --- | --- |
| Production mode matched the literal string `production` only. `run_flask.ps1` copies `.env` values verbatim, so `FLASK_ENV=Production`, `"production"` or `production ` selected plaintext, while Node's `--env-file` strips quotes and failed closed on the same file. | `tls_config._is_production` trims one layer of surrounding quotes and compares case-insensitively; Node normalises identically so one `.env` cannot open one backend and close the other. | New parametrised `test_tls_startup.py` cases; extended `tests/integration/runtime.test.js` (which now also asserts the previously untested production `JWT_SECRET` refusal); `scripts/python_tls_check.js` spawns the real CLI for the plain/capitalised/quoted/padded flags and asserts non-zero exit, expected stderr and no database file. Confirmed the new checks fail against the pre-fix validator. |
| Flask `presence:list` and `typing:set` caught only `RoomError`, so a malformed payload propagated out of the handler instead of returning an envelope, unlike every sibling handler and unlike Node's `presence.js`, which acknowledges a safe envelope. | Both handlers now return the structured `INTERNAL_ERROR` envelope and audit a fixed label. | Existing envelope-shape assertions; no behaviour change for valid payloads. |

Recorded, not changed — each needs a requirement or product decision that is outside this PR:

- **Unthrottled registration and logout.** `app.py:57-60` and the Node account routes apply the limiter
  only to login. CHAT-SR-004 contracts five login attempts/minute/IP, so extending it is a requirements
  decision for QA, not a private fix. bcrypt runs per registration, so this is a CPU-cost exposure.
- **Per-IP limiter counts successful logins.** The contracted wording is *attempts*, so a shared campus
  NAT address can reach 429 after five legitimate sign-ins. Needs a product decision on per-account or
  per-IP-plus-per-account limiting and a trusted-proxy policy; `S2-PROXY-IP` above already tracks it.
- **Message `status` is one aggregate column.** Per-recipient state is in `readBy`, but the client renders
  the aggregate, so a `Read` receipt means "someone read it". Owned by the CHAT-24/25 messaging author.
- **`connect-src 'self' wss:`/`ws:`** permits connections to any host of that scheme, not just this origin.
  Yaswanth's recommendation (drop `ws:` under TLS) is implemented; narrowing to same-host only is a further
  hardening step that also changes the `secureCsp` assertion, so it is proposed for his ratification.
- **No WSGI entry point.** `create_application` is importable without the TLS validator, but returns an
  application with `UnavailableAuth`, so it cannot serve chat; `docs/DEVELOPMENT.md` already records that
  production hosting awaits a deployment decision, and Werkzeug is not a production server.
- **Test isolation seam.** `create_runtime(env=...)` validates the injected mapping, so an injected
  non-production env ignores ambient production flags. Every real entry point passes no `env` and reads
  `os.environ`; test and CI harnesses rely on the injected isolation.
- **Client state.** `public/app.js` never trims `messages`/`unread` for rooms left, and read receipts fire
  per rendered message. Bounded for this deployment size; tracked as follow-up.

Local verification for this increment: 252 Node tests (17 suites), 281 Python tests, real Node and Flask
TLS/WSS checks including the new fail-closed subprocess cases, and both real process-restart system checks
passing. The Python suite grew from 266 to 281; earlier figures stay valid for their own heads. No
approval, monthly availability or manual accessibility result is inferred from these automated results.

## 7-8 November 2026: Sprint 2 merge incident and pending protocol decision

- **What happened.** On 7 November, 8555c53 merged `CHAT-26-sprint2-delivery` into `main` from a stale local
  copy (140da7f). It kept the `HistoryStore`-based `src/messages.js` together with PR #53's `src/database.js`
  message schema and tests. Both create a `messages` table in the same SQLite file, so the server failed to
  start (`no such column: seq`) and 10 CHAT-23/24/25 integration tests failed (CI runs #76 and #77). The
  merge also missed a6b78bf, d1d0662 and 27eef79 from PR #47. The Sprint 2 window had already closed on
  30 October; this is late integration work and is recorded with its actual dates.
- **Recovery.** PR #56 reverted e73d66c and 8555c53 on 8 November, restoring the tree of 6877800 (PR #53
  merge). CI run #81 passed on `main`. Jira CHAT-22 to CHAT-25, CHAT-31 and CHAT-4, briefly moved to Done on
  7 November, were moved back to In Review with a correction comment.
- **Two protocols for one requirement set.** PR #53 implements history and status with `message:history`,
  `message:delivered` and a `database.js` message store. `contracts/events.json`, the browser client and the
  Flask backend use `room:history`, `message:status` and the `HistoryStore` `seq`/`status` schema. The
  proposed decision is to keep the contract protocol for Node/Flask parity and port PR #53's tests to it.
  **This is a proposal pending Hrisheek's agreement (owner of CHAT-22 to CHAT-25), not a recorded team
  decision.**
- **Integration branch.** Draft PR #57 (`sprint2-integration`) restores the reverted work, adds the three
  missing PR #47 commits, and initialises `HistoryStore` before `createDatabase` so the server starts.
  The remaining failures are 11 PR #53 tests mapped in `docs/SPRINT2_INTEGRATION_HANDOFF.md`.
- **Full-suite determinism (CHAT-41 follow-up from PR #47).** Measured on `sprint2-integration` on
  8 November with `--runInBand` in one process, the `npm test` path. `--detectOpenHandles` reported no open
  handles for the unit suites or for the integration suites other than `messaging.test.js`. 22 consecutive
  runs without `messaging.test.js` and 10 runs with it each produced the same verdict (1 and 11 failures,
  all of them the PR #53 tests awaiting porting), printed a summary every time, and never hit "Jest did not
  exit". The verdict-less run seen on 27eef79 was not reproduced. **Caveat:** this machine has Node 22, so
  Jest loaded `sanitize-html` 2.13.1 (CommonJS) through a local `moduleNameMapper` instead of the locked
  2.18.1; CI still runs the locked versions on Node 24. Treat this as "not reproduced", not "fixed", and
  re-check on Node 24 after the PR #53 tests are ported, because their leaked 3-second timers are a known
  source of cross-suite noise.

## 9 November 2026: CHAT-30 / CHAT-NF-002 monthly availability not established for this delivery

- **Requirement (SRS CHAT-NF-002, TC-Ops-01).** At least 99.5% uptime per calendar month, excluding planned
  maintenance; acceptance is a monthly uptime report of at least 99.5%. Owner: Soham.
- **Why it cannot be met in this delivery.** The course timeline gave two one-week sprints (19-23 and
  26-30 October). There is no selected hosted service, and the application has only run locally on demand,
  so no complete operational calendar month exists to measure. A month cannot be observed retrospectively.
- **What exists.** `scripts/monitor_uptime.py` probes `/api/health`, appends every observation to a JSONL log
  and writes a summary whose `monthlyAcceptance` is always `NOT_ESTABLISHED`. Recorded so far: two short local
  windows on 28-29 October, 18 probes, all healthy. Unobserved time is not counted as healthy.
- **Status.** CHAT-30 stays In Progress and the requirement is **not met** for this delivery. It is not waived
  and is not claimed from short samples, CI runs or restart checks.
- **For the final demo.** Explain the conflict between a monthly SLA and a two-week delivery window, show the
  monitor and its `NOT_ESTABLISHED` output, and state what acceptance would need: a chosen host, continuous
  probing for a full calendar month, a maintenance-exclusion log and a review of the resulting report.
  Whether the course accepts this as a documented deviation is a team/course decision, not recorded here.
## 13 November 2026: SQLite persistence unification — integration review

The SQLite unification work consolidates account and messaging persistence around one database connection.

- `createDatabase()` initializes the canonical database schema.
- `HistoryStore` receives the existing database connection rather than opening an independent connection.
- Versioned migrations preserve supported legacy room, message and receipt data.
- Migration backup, rollback, schema validation and foreign-key checks are covered by dedicated tests.
- `scripts/seed_review.js` has been updated to use the shared connection.

The earlier dual-connection initialization workaround documented in the 7–8 November incident is superseded by this architecture. The original incident and recovery history remain unchanged for traceability.

The SQLite unification pull request has resolved its reported merge conflict. Its GitHub browser, Node and Python checks passed. Local verification on the source branch also passed 19 test suites and 283 tests, including the runtime restart-persistence tests.

**Integration status:** Pull request review and final integration verification remain pending. These source-branch results do not establish acceptance on the integrated target branch.

CHAT-22 through CHAT-25 acceptance must be verified against the integrated implementation before their completion is claimed.
