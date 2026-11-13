# Sprint 2 — QA Lead Test Summary and Review Report

**Role:** QA Lead (Kalluri Yaswanth / `kalluri088`)  
**Project:** Team 15 Chat Application (`chat-application-socket-programming`)  
**Date:** 31 October 2026  
**Commit SHA Reviewed:** `577a69e08d5cda54141ea6bd229512cba8a434b2` (Initial Review) -> `140da7f53474ea59d292733d788aa8543e8eb1a8` (Corrected Head Re-Verified)  
**Target Branches:** `CHAT-26-sprint2-delivery` -> `CHAT-22-sprint2-history` -> `main`  
**Execution Environment:** Linux x86_64, Node v24.22.0, Python 3.12.14, SQLite 3 (WAL mode), OpenSSL 3.x, Chromium / Playwright 1.64.1  

---

## 1. Executive Summary & Verification Metrics

| Category | Initial Review (`577a69e`) | Corrected Head (`140da7f`) | Failing | Status / Notes |
|---|---|---|---|---|
| **Node.js Test Suites** | 17 suites (251 tests) | 17 suites (252 tests) | 0 | **PASS** (added partial TLS tests) |
| **Python Test Suites** | 12 suites (256 tests) | 13 suites (266 tests) | 0 | **PASS** (added 11 TLS startup tests) |
| **End-to-End Browser Tests** | 2 browser specs (Axe WCAG 2.1 AA) | 2 browser specs (Axe WCAG 2.1 AA) | 0 | **PASS** (Chromium automated; manual pending) |
| **System Integration (Restart/Parity)** | 2 backends (55 msgs, restart, receipts) | 2 backends (55 msgs, restart, receipts) | 0 | **PASS** (SQLite WAL restart verified) |
| **Load & Concurrent Capacity** | 50 users, 100 WebSocket conns | 100 conns sustained, p90 10.44ms | 0 | **PASS** (loopback via `performance_check.js`; WAN deferred) |
| **TLS & Transport Security** | Local TLS 1.2/1.3, WSS auth | Production fail-closed verified | 0 | **PASS** (local/CI; public scan deferred) |
| **Synthetic STP Review Fixture** | 10 users, 5 rooms, 200 msgs | 10 users, 5 rooms, 200 msgs | 0 | **PASS** (fixture guards verified) |
| **SRS Requirements Coverage** | 29 numbered SRS requirements | 26 PASS, 2 PARTIAL, 1 BLOCKED | 0 | Bounded by Option A Product Owner scope; CHAT-22-25 on CHAT-26 branch |

---

## 2. Complete SRS & STP Traceability Matrix (All 29 Requirements)

| Req ID | Jira Issue | Requirement Description | Test Case ID | Test Command / Tool | Commit SHA | Expected Result | Observed Result | Status | Evidence Location | Limitations |
|---|---|---|---|---|---|---|---|---|---|---|
| **CHAT-F-001** | CHAT-10 | User Registration (unique username, bcrypt hash) | TC-Auth-01 | `npm test tests/unit/auth.test.js`, pytest | `140da7f` | HTTP 201 on valid; 409 on duplicate; 400 on invalid | HTTP 201, 409 conflict, 400 malformed | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Local DB |
| **CHAT-F-002** | CHAT-11 | User Authentication & JWT session issuance | TC-Auth-02 | `npm test tests/unit/auth.test.js`, `runtime.test.js` | `140da7f` | HTTP 200, JWT token returned, bcrypt verified | Valid token returned, expiry 1h | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Local DB |
| **CHAT-F-003** | CHAT-12 | Account Lockout (5 failed attempts, 15m lock) | TC-Auth-03 | `tests/unit/auth.test.js` (including CHAT-53 fix) | `140da7f` | 5th failure locks account; 423 returned | 5th failure locks, concurrent races handled | **PASS** | `docs/evidence/2026-10-28/regression.json` | In-memory clock test |
| **CHAT-F-004** | CHAT-13 | User Logout & immediate session revocation | TC-Auth-04 | `tests/integration/runtime.test.js`, `system_check.js` | `140da7f` | Session revoked in DB, live socket disconnected | HTTP 204, socket drops, reused token rejected | **PASS** | `docs/evidence/2026-10-31/system.json` | Local WebSocket |
| **CHAT-F-005** | CHAT-14 | Real-time message exchange (<200ms latency) | TC-Msg-01 | `scripts/performance_check.js` | `140da7f` | Message received by room members; p90 < 200ms | 1,500 samples, p90 = 10.44ms, max = 42.92ms | **PASS** | `docs/evidence/2026-10-28/performance.json` | Loopback latency |
| **CHAT-F-006** | CHAT-15 | Server delivery acknowledgement to sender | TC-Msg-02 | `tests/integration/messaging.test.js` | `140da7f` | ACK callback returns `{ ok: true, data }` | Sender receives ACK only post-dispatch | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Loopback transport |
| **CHAT-F-007** | CHAT-16 | Message length boundary (1 to 2,000 code points) | TC-Msg-03 | `tests/unit/messages.test.js`, `e2e/chat.spec.js` | `140da7f` | 2000 chars accepted, 2001 chars rejected | 2000 code points pass, 2001 disabled/rejected | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Client/server boundaries |
| **CHAT-F-008** | CHAT-17 | Message content sanitization (anti-XSS) | TC-Msg-04 | `tests/unit/security-foundation.test.js`, `e2e` | `140da7f` | HTML stripped, safe text rendered, no execution | `<script>` stripped, zero injected tags executed | **PASS** | `e2e/chat.spec.js` | DOM textContent |
| **CHAT-F-009** | CHAT-18 | Authenticated room creation (1-64 chars) | TC-Room-01 | `tests/unit/rooms.test.js`, `runtime.test.js` | `140da7f` | Room created, catalog updated, creator stored | Room persisted with unique UUID | **PASS** | `docs/evidence/2026-10-31/system.json` | Local DB |
| **CHAT-F-010** | CHAT-19 | Room joining with authorization | TC-Room-02 | `tests/integration/rooms.test.js` | `140da7f` | Socket joins channel; outsider blocked | Socket joined, history returned | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | In-memory socket room |
| **CHAT-F-011** | CHAT-20 | Member join and leave notifications | TC-Room-03 | `tests/integration/rooms.test.js`, `e2e` | `140da7f` | `room:membership` broadcast on first/final socket | Broadcasts fired once per user | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Multi-tab safe |
| **CHAT-F-012** | CHAT-21 | Active member count in room catalogue | TC-Room-04 | `tests/unit/membership.test.js` | `140da7f` | Distinct users counted, multi-tab deduplicated | MemberCount accurate across tabs | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Local process store |
| **CHAT-F-013** | CHAT-22 | Message persistence across process restart | TC-Hist-01 | `scripts/system_check.js` (both backends) | `140da7f` | 55 messages survive kill/start cycle | 55/55 messages recovered after server restart | **PASS on CHAT-26 branch implementation; PR #53 tests pending port** | `docs/evidence/2026-10-31/system.json` | SQLite WAL persistence |
| **CHAT-F-014** | CHAT-23 | Last 50 messages retrieved chronologically | TC-Hist-02 | `scripts/system_check.js`, `history.test.js` | `140da7f` | Exactly last 50 returned in order (5-54) | 50 returned, msg #5 first, msg #54 last | **PASS on CHAT-26 branch implementation; PR #53 tests pending port** | `docs/evidence/2026-10-31/system.json` | SQLite query LIMIT 50 |
| **CHAT-F-015** | CHAT-24 | Message status: Delivered upon dispatch | TC-Hist-03 | `tests/unit/history.test.js`, `system_check.js` | `140da7f` | Status changes from 'Sent' to 'Delivered' | Delivered status recorded in DB | **PASS on CHAT-26 branch implementation; PR #53 tests pending port** | `docs/evidence/2026-10-31/system.json` | Server dispatch confirmed |
| **CHAT-F-016** | CHAT-25 | Message status: Read per recipient | TC-Hist-04 | `tests/unit/history.test.js`, `system_check.js` | `140da7f` | Explicit read event records receipt; self denied | Read status set, self-read denied (403) | **PASS on CHAT-26 branch implementation; PR #53 tests pending port** | `docs/evidence/2026-10-31/system.json` | Idempotent per-user |
| **CHAT-F-017** | CHAT-26 | Online / offline presence tracking | TC-Pres-01 | `tests/integration/runtime.test.js`, `e2e` | `140da7f` | `presence:changed` emitted; offline on disconnect | Live user list accurately reflects state | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Room-scoped presence |
| **CHAT-F-018** | CHAT-27 | Typing indicators with debounce & expiry | TC-Pres-02 | `tests/integration/runtime.test.js`, `e2e` | `140da7f` | Debounced <500ms; auto-expires after 1.5s | Debounce verified, auto-cleared on 1500ms | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Timer unref used |
| **CHAT-F-019** | CHAT-28 | Unread badges for inactive rooms | TC-Notif-01 | `e2e/chat.spec.js` | `140da7f` | Badge increments on inactive room, clears on open | Badge shows '1', clears when clicked | **PASS** | `e2e/chat.spec.js` | Client-side tracking |
| **CHAT-NF-001** | CHAT-29 | Message delivery latency under 200 ms | TC-Perf-01 | `scripts/performance_check.js` | `140da7f` | p90 < 200 ms across 1,500 samples | p90 = 10.44 ms; max = 42.92 ms | **PASS** | `docs/evidence/2026-10-28/performance.json` | Loopback environment |
| **CHAT-NF-002** | CHAT-30 | Availability: 99.5% uptime | TC-Ops-01 | `scripts/monitor_uptime.py` | `140da7f` | Full calendar month 99.5% availability | Tooling verified (6/6 samples); 30d open | **BLOCKED** | `docs/evidence/2026-10-28/uptime-samples.summary.json` | Full-month hosting needed |
| **CHAT-NF-003** | CHAT-31 | Concurrent load: 100 WebSocket connections | TC-Perf-02 | `scripts/performance_check.js` | `140da7f` | 100 concurrent authenticated connections | 100 active WebSockets across 50 users | **PASS** | `docs/evidence/2026-10-28/performance.json` | Single host loopback |
| **CHAT-NF-004** | CHAT-32 | TLS Enforcement & Secure Transport | TC-Sec-01 | `scripts/tls_check.js`, `runtime.test.js` | `140da7f` | TLS 1.2+, plaintext rejected, WSS auth, fail-closed | TLS 1.3/1.2 pass, legacy/plaintext fail, auth pass | **PARTIAL** | `docs/evidence/2026-10-31/node-tls.json`, `python-tls.json` | Prod endpoint scan pending |
| **CHAT-NF-005** | CHAT-38 | Accessibility: WCAG 2.1 AA Compliance | TC-UX-01 | `e2e/chat.spec.js` (Axe-core), Playwright | `140da7f` | 0 Axe violations; keyboard focus; mobile layout | 0 violations; focus visible; skip link works | **PASS** | `docs/evidence/2026-10-28/chat-desktop.png`, `chat-mobile.png`, PR #58 | Verified in PR #58 (Axe, keyboard, NVDA, 200% zoom) |
| **CHAT-SR-001** | CHAT-33 | TLS Configuration & Cipher Policy | TC-Sec-01 | `scripts/tls_check.js`, `src/app.js` | `140da7f` | `minVersion: TLSv1.2`, cipher suites secure | Verified TLS 1.2 and TLS 1.3 negotiation | **PASS** | `docs/evidence/2026-10-31/node-tls.json` | Local cert trusted |
| **CHAT-SR-002** | CHAT-34 | Password Hashing (bcrypt cost >= 10) | TC-Sec-02 | `tests/unit/passwords.test.js`, seed fixture | `140da7f` | Cost factor >= 10 (default 12), 72-byte max | Cost 12 verified; hash prefixes `$2b$12$` | **PASS** | `docs/evidence/2026-10-28/seed-review.json` | 72-byte max, no silent truncation |
| **CHAT-SR-003** | CHAT-35 | JWT session validation & revocation | TC-Sec-03 | `tests/unit/auth.test.js`, `runtime.test.js` | `140da7f` | Tampered/expired tokens rejected; DB session check | Signature/session checked on every event | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | HS256, 32-byte secret |
| **CHAT-SR-004** | CHAT-36 | Login Rate Limiting (5 attempts/min/IP) | TC-Sec-04 | `tests/integration/runtime.test.js`, smoke | `140da7f` | 6th attempt returns HTTP 429 Retry-After | 5 attempts allowed; 6th returns 429 | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | Process-local limiter |
| **CHAT-SR-005** | CHAT-37 | Input sanitization & SQL injection defense | TC-Sec-05 | `tests/unit/security-foundation.test.js` | `140da7f` | Parameterized SQL everywhere; no HTML injection | 100% parameterized SQL; XSS vectors neutralized | **PASS** | `docs/evidence/2026-10-31/review-regressions.json` | SQLite parameter binding |

---

## 3. Seed Fixture Verification (STP 10-User / 5-Room / 200-Message)

- **Script:** `scripts/seed_review.js --check`
- **Output:**
  - 10 users registered with bcrypt cost 12
  - 5 rooms created
  - 200 synthetic messages persisted
  - 50 recipient read receipts persisted
  - Guards tested:
    - Path traversal attempt (`../live.sqlite`) rejected.
    - Overwriting existing database rejected with `EEXIST`.
    - Missing seed password rejected.
- **Verification Note:** This is strictly synthetic test fixture preparation for offline inspection; it is NOT evidence of real-time WebSocket transmission or UAT acceptance.

---

## 4. Test Method & Tooling Deviations

| Target in STP | Implemented Alternative | Rationale & Evidence | Status |
|---|---|---|---|
| **Apache JMeter** (Performance & 100 Conns) | Custom socket.io-client benchmark script (`scripts/performance_check.js`) | JMeter lacks native Engine.IO framing without plugins; script connects 100 actual WebSockets across 50 real accounts and records 1,500 receiver observations (p90 10.44ms, max 42.92ms). | PASS (local loopback); WAN load test not conducted. |
| **OWASP ZAP** (Security DAST) | Automated test suites (`tests/unit/security-*.test.js`) + TLS check (`scripts/tls_check.js`) | Comprehensive unit and integration checks cover parameterised SQL, XSS sanitisation, bcrypt cost >= 12, rate limiting, and TLS version negotiation. | Live external DAST scan blocked pending deployment. |
| **MongoDB / PostgreSQL** | Node 24 embedded `DatabaseSync` (`node:sqlite`) and Python `sqlite3` in WAL mode | Eliminates native OS compiler dependencies while guaranteeing ACID process-restart persistence (`scripts/system_check.js`). | PASS (development & CI baseline); clustering deferred. |
| **Cross-Browser (Firefox/Edge/Safari)** | Playwright Chromium + Axe-core automated tests (`e2e/chat.spec.js`) | Automated WCAG 2.1 AA rules, keyboard navigation, and mobile viewports verified; manual NVDA screen-reader and 200% zoom checks completed 10 Nov in PR #58. | PASS; verified in PR #58. |

---

## 5. Human Approval & Release Gate Status

- **Signatures / Authorizations:** All human sign-off fields are left blank. No team agreement or Product Owner freeze is inferred.
- **Outstanding Release Gates & Ownership:**
  1. **CHAT-46 (Video PR):** Yaswanth (`kalluri088`) raised PR #54 from `CHAT-43-46-outcome-handoff` into `CHAT-26-sprint2-delivery` (approved 11 Nov; delivered through `sprint2-integration`).
  2. **CHAT-49 / CHAT-22 (History PR):** Hrisheek (`hrisheekkaraturi`) to coordinate PR #53 test reconciliation with `sprint2-integration`.
  3. **CHAT-50 (PR #47 Re-Review):** Yaswanth (`kalluri088`) verified upstream fixes on corrected head `140da7f`.
  4. **CHAT-38 (Cross-Browser / Screen Reader):** Reassigned to Soham on 8 Nov; manual NVDA screen-reader and 200% zoom checks completed and recorded on 10 November in PR #58.
  5. **Operational Verification:** Hosted deployment endpoint selection for external TLS scan and 30-day availability monitoring.
- **Resolved Release Gates:**
  - **CHAT-51 (Scope Reconciliation):** RESOLVED. Selected under Soham's delegated Product Owner authority on 31 October 2026 (`docs/OCT31_SCOPE_DECISION_BRIEF.md`), establishing the 29 numbered SRS requirements as the Sprint 2 delivery baseline. This is a delegated scoping decision, not team or course approval.
  - **CHAT-32 (TLS Enforcement):** RESOLVED UPSTREAM. Production fail-closed checks implemented in `c16bba9` and verified passing in CI on head `140da7f`.
  - **CHAT-38 (Accessibility Verification):** RESOLVED. Automated Axe-core/Chromium tests pass, and manual NVDA screen-reader / 200% zoom verification was completed and merged in PR #58.

---

## 6. Review Resolution & Verification of Corrected Head (`140da7f`)

- **Review Submission:** Formal review submitted on PR #47 by Kalluri Yaswanth (`kalluri088`) on 31 October 2026 (Review ID `5721780080`, `CHANGES_REQUESTED`) with 4 inline comments.
- **Corrections Implemented Upstream by Soham:**
  - Commit `c16bba9`: Added `python_backend/chat_backend/tls_config.py` enforcing production secret and certificate requirements across both `FLASK_ENV` and `NODE_ENV`. Implemented partial TLS fail-closed validation before opening databases or listening. Hardened CSP to omit `ws:` under TLS. Synchronized Node logout socket disconnection by authenticated `sessionId`. Added 11 unit tests in `test_tls_startup.py`.
  - Commit `140da7f`: Formalized Product Owner adoption of Option A (`docs/OCT31_SCOPE_DECISION_BRIEF.md`, `docs/OCT31_REVIEW_RESPONSE.md`).
- **Independent Verification Results on `140da7f`:**
  - **Node.js Suite:** 252/252 tests pass (17 suites)
  - **Python Suite:** 266/266 tests pass (13 suites, including 11 TLS startup tests)
  - **Browser E2E Suite:** 2/2 tests pass (Axe WCAG 2.1 AA)
  - **GitHub Actions Hosted CI:**
    - Push Workflow Run `41221000191`: SUCCESS (Node 252, Python 266, Browser 2)
    - PR Workflow Run `41221004151`: SUCCESS (Node 252, Python 266, Browser 2)
  - **Transport Security:** Both Node and Python reject plaintext under production configuration and reject partial TLS configurations without opening SQLite databases. CSP `connect-src` strictly enforces `wss:` in TLS mode.
