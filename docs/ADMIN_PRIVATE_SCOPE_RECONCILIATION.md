# CHAT-51: Admin/Private Scope and Test-Method Reconciliation Proposal

**Author:** Kalluri Yaswanth (`kalluri088`), QA Lead & Software Engineer  
**Recipient:** Jamula Soham Rao (`JSohamRao`), Product Owner & Integration Lead  
**Date:** 31 October 2026  
**Status:** ADOPTED (Option A selected under Soham's delegated Product Owner authority on 31 October 2026; see `docs/OCT31_SCOPE_DECISION_BRIEF.md`. This records delegated scoping, not team or course approval.)  
**References:** Submitted SRS v1.0, SAD v1.0, STP v1.0, Jira CHAT-51, GitHub Issues #50, #41, #42, `docs/DEVIATIONS.md`, `docs/OCT31_SCOPE_DECISION_BRIEF.md`  

---

## 1. Executive Summary

During Sprint 2 QA and architecture audit, discrepancies were identified between the high-level design specifications (SAD, STP) and the formal numbered requirements backlog (SRS):
1. **Administrative Capabilities:** The STP (Sections 1–2) describes admin room management, admin monitoring, and force logout. The SAD (Section 4) discusses administrative controls, but leaves interface contracts open in Section 4.6. The numbered SRS backlog (29 requirements) contains **zero** administrative requirements or acceptance criteria.
2. **Private Conversations (1-on-1):** The SAD discusses private 1-on-1 conversations, but Section 4.6 leaves event contracts open. The numbered SRS backlog specifies only named, shared rooms (`room:create`, `room:join`, `room:leave`, `room:list`).
3. **Test Method & Infrastructure Tooling:** The STP proposed Apache JMeter for load testing, OWASP ZAP for DAST security scanning, MongoDB/PostgreSQL for persistence, and multi-browser test coverage (Firefox/Chrome/Edge). Current execution implemented lightweight, highly deterministic alternatives: custom Socket.IO load test tooling (`scripts/performance_check.js`), embedded Node 24 / Python SQLite in WAL mode, and Playwright Chromium with Axe-core.

This document presents a structured decision proposal to reconcile these discrepancies without silently dropping requirements, inventing fake SRS IDs, or forging stakeholder approvals.

---

## 2. Source-Grounded Requirements Audit

### 2.1 Implemented & Fully Verified (Scope Baseline)
- All 19 functional requirements in the numbered SRS:
  - Account registration, bcrypt hashing, JWT issuance, session storage, and 15-minute account lockout after 5 failures (`CHAT-F-001` through `CHAT-F-004`).
  - Real-time room messaging, sender delivery acknowledgement, 2000-character limits, and XSS sanitization (`CHAT-F-005` through `CHAT-F-008`).
  - Named room creation, joining, leave/join notifications, and distinct-user active member counts (`CHAT-F-009` through `CHAT-F-012`).
  - SQLite persistence across server process restarts, last 50 room history in chronological order, Delivered status on dispatch, and per-recipient Read receipts (`CHAT-F-013` through `CHAT-F-016`).
  - Room-scoped presence, debounced/expiring typing indicators, and unread badges for inactive rooms (`CHAT-F-017` through `CHAT-F-019`).
- All 5 security requirements in the numbered SRS:
  - TLS 1.2+ configuration enforcement (`CHAT-SR-001`).
  - bcrypt cost factor >= 10 with 72-byte maximum, no silent truncation (`CHAT-SR-002`).
  - Fresh revocable database session verification per event (`CHAT-SR-003`).
  - IP-based rate limiting of 5 attempts/minute/IP on login (`CHAT-SR-004`).
  - Parameterized SQL and HTML sanitization (`CHAT-SR-005`).
- Non-functional performance and accessibility baselines:
  - Sub-200ms message receiver latency (`CHAT-NF-001`).
  - 100 concurrent WebSocket connections (`CHAT-NF-003`).
  - Automated WCAG 2.1 AA accessibility (0 Axe violations) & keyboard navigation (`CHAT-NF-005`).

### 2.2 Unimplemented / Missing Features (Described in SAD/STP but Absent from SRS Backlog)
1. **Admin Room Management:** Deleting arbitrary rooms, kicking users, closing rooms.
2. **Admin Monitoring Dashboard:** Live system health metrics, message throughput graphs, error logs viewer.
3. **Admin Force Logout:** Immediate session termination of a third-party user by an administrator.
4. **Private Conversations (1-on-1):** Direct messaging without a public room entity.
5. **Role-Based Access Control (RBAC) Enforcement:** The database schema has a `role` field (defaulting to `'user'`), but there is no API or Socket.IO middleware enforcing administrative role privileges.

### 2.3 Requirements Needing Clarification
1. **Scope Priority for Admin Features:** Was the admin panel intended as an optional stretch deliverable for Phase 3/future work, or is it mandatory for Sprint 2 acceptance?
2. **Private Conversation Model:** Should 1-on-1 messaging be implemented as private rooms with `maxMembers: 2` or as a distinct direct-message protocol?

---

## 3. Test Tooling and Environment Deviations

| Planned in STP | Implemented Alternative | Technical Justification | Impact & Open Actions |
|---|---|---|---|
| **Apache JMeter** (Performance Testing) | Node.js socket.io-client benchmark script (`scripts/performance_check.js`) | JMeter lacks native Engine.IO / Socket.IO framing support without third-party plugins. Custom script measures real receiver-side timestamps and SQLite write latencies with 50 real accounts and 100 WebSockets. | Load test criteria (`CHAT-NF-001`, `CHAT-NF-003`) met locally. WAN / multi-host distributed load test not performed. |
| **OWASP ZAP** (Security DAST) | Multi-layered automated test suite + TLS check script (`scripts/tls_check.js`) | Automated unit/integration test coverage tests SQL injection, XSS vectors, bcrypt work factor, JWT tamper/expiry, rate limiting, and TLS version negotiation. | Live external DAST scan against an exposed deployment endpoint remains open. |
| **MongoDB / Dedicated RDBMS** | Embedded SQLite (`node:sqlite` in Node 24, `sqlite3` in Python) in WAL mode | Eliminates native OS build tool dependencies (C++ compilers, Python headers) while providing ACID transactions and persistence across server restarts. | Validated in `scripts/system_check.js` (55 messages survive restart). Production clustering not supported. |
| **Cross-Browser (Firefox, Edge, Safari)** | Chromium automated via Playwright + Axe-core | Playwright Chromium covers automated WCAG 2.1 AA rules, DOM text rendering, mobile layouts, and keyboard focus. | Manual screen reader (NVDA/VoiceOver) and Firefox verification assigned to Hrisheek under CHAT-38 remain pending human execution. |

---

## 4. Decision Proposals for Product Owner

### Option A (Recommended): Formalize SRS Backlog as Sprint 2 Definition of Done; Defer Admin/Private to Backlog
- **Rationale:** The 29 numbered SRS requirements represent the committed, estimated, and fully implemented scope. All 29 are tracked in Jira and GitHub Projects. Introducing uncontracted admin/private features at the close of Sprint 2 would introduce high regression risk to the working product.
- **Action:** Document in `docs/DEVIATIONS.md` that Admin Room Management, Admin Monitoring, Force Logout, and Private Conversations are deferred as Phase 3 / Post-Sprint 2 backlog items. Mark STP test cases for admin/private as `DEFERRED / SCOPE_RECONCILED`.

### Option B: Implement Minimal Admin/Private Scope in an Extension Sprint
- **Action:** Agree on event contracts in `contracts/events.json` (`admin:*`, `direct:*`), define acceptance criteria, assign story points, and implement backend RBAC middleware and UI views.
- **Risk:** Requires substantial architectural expansion, new migrations, and re-verification of regression test suites.

---

## 5. Decisions and Stakeholder Actions Status

- [x] **Product Owner Delegated Decision:** Option A was selected on 31 October 2026 under Soham's delegated authority (recorded in `docs/OCT31_SCOPE_DECISION_BRIEF.md` and `docs/OCT31_REVIEW_RESPONSE.md`), defining the 29 numbered SRS requirements as the Sprint 2 baseline and deferring admin/private messaging features to the future backlog. This records delegated scoping, not team or course approval.
- [x] **Deviation Log Ratification:** Recorded in `docs/DEVIATIONS.md` and referenced across review artifacts.
- [ ] **Cross-Browser / Accessibility Evidence:** Reassigned to Soham on 8 Nov (fixes and isolated keyboard runs in PR #58); manual NVDA screen-reader and 200% zoom checks remain open.
- [ ] **Production Hosting Agreement:** Team to determine if a public deployed endpoint will be provisioned for external TLS scanning and 30-day availability monitoring.
