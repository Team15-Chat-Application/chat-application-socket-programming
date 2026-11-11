# Sprint 2 review and final demo notes

Updated 10 November 2026. Official Sprint 2 window: 26-30 October 2026. Work after 30 October is late
integration and is recorded with its actual dates. This is a review record, not an acceptance or freeze.

## What Sprint 2 delivered

| Jira | Requirement | Owner | Where it is | State on 10 Nov |
|---|---|---|---|---|
| CHAT-22-25 | Message persistence, last 50, delivered, read | Hrisheek | Two implementations: PR #53 (merged to `main` 7 Nov) and the contract `HistoryStore` in draft PR #57 | In Review. Protocol choice and port of 11 PR #53 tests pending (`SPRINT2_INTEGRATION_HANDOFF.md`) |
| CHAT-26-28 | Presence, typing indicator, in-app notification | Soham | PR #47, carried in PR #57 | In Review. QA re-review at 27eef79 satisfied (10 Nov) |
| CHAT-29 | Latency under 200 ms | Soham | `scripts/performance_check.js`, CI | In Review. Loopback measurement only |
| CHAT-30 | 99.5% monthly availability | Soham | `scripts/monitor_uptime.py` | Not established for this delivery (deviation) |
| CHAT-31 | 100 concurrent WebSockets | Hrisheek | `tests/integration/concurrent-load.test.js`, `performance_check.js` | In Review, waits on PR #57 |
| CHAT-32, 33 | TLS enforcement (HTTP and WebSocket) | Yaswanth, Soham | PR #47 (c16bba9, a6b78bf), carried in PR #57 | In Review. QA findings satisfied |
| CHAT-38 | WCAG 2.1 AA | Soham (reassigned 8 Nov) | PR #58 into `sprint2-integration` | In Review. Code verified by QA; zoom and NVDA rows open |
| CHAT-46 | Two-minute outcome video | Yaswanth | `videos/sprint-2-outcome-2026-10-28.webm` (in PR #57; PR #54 superseded) | In Review |
| CHAT-47, 48 | Documents and freeze | Soham | This file, `DEVIATIONS.md`, `FINAL_HANDOFF.md` | In progress |
| CHAT-50, 51 | QA review, scope reconciliation | Yaswanth | PR reviews; PR #55 (changes requested 10 Nov) | Done in Jira |
| CHAT-52 | Review of Soham's presence/account work | Hrisheek | Not started | To Do |

## Evidence to show

- **CI.** `main` is green after the PR #56 revert (Build and test #81). On PR #57 and PR #58 the Python and
  browser jobs pass; the Node job fails only on the 11 PR #53 tests awaiting the port.
- **Outcome videos.** `videos/sprint-1-outcome-2026-10-28.webm` (60 s, late) and
  `videos/sprint-2-outcome-2026-10-28.webm` (120 s): real two-user sessions with rooms, live messages,
  receipts, presence, unread badge and saved history.
- **System check.** `scripts/system_check.js`: real HTTP login, WebSocket chat, 55 persisted messages, last
  50 after a process restart, read receipt and logout revocation.
- **Accessibility.** `ACCESSIBILITY_TC-UX-01.md`: audit, fixes, isolated keyboard runs in Chrome and Firefox,
  and the open manual rows.
- **QA reviews (10 Nov).** PR #47 re-review (security findings satisfied), PR #57 architectural review
  (endorses the contract protocol), PR #58 QA review (`public/` changes verified).

## Live demo outline (about 3 minutes)

1. Start the server (`npm start`) and open two browser profiles at http://127.0.0.1:3000.
2. Register two users; create a room in one profile and join it from the other.
3. Exchange messages; show the receipt changing to Read and the typing indicator.
4. Create a second room, send to the first from the other profile, and show the unread badge.
5. Restart the server and show that the last 50 messages are still there.
6. Keyboard only: Tab through sign-in, room creation and sending; show the visible focus ring.
7. Sign out with the keyboard; focus returns to Username. Server-side revocation of the old session is
   shown by the system check, not in the UI.

## Deviations to explain (details in `DEVIATIONS.md`)

- **Late delivery.** Sprint 1 completed and its video was recorded on 28 October, after the 23 October end.
  Sprint 2 integration continued after 30 October.
- **7 November merge incident.** A merge from a stale branch combined two history implementations and broke
  `main`; PR #56 reverted it on 8 November. Recovery goes through PR #57.
- **History/status protocol.** Keeping the contract protocol is proposed and endorsed by the QA Lead, but
  needs Hrisheek's agreement as owner of CHAT-22 to CHAT-25.
- **CHAT-30 availability.** A calendar-month 99.5% measurement cannot be made in a two-week window without a
  hosted service. Not met; not waived.
- **Scope.** Admin and private-conversation features described in the SAD/STP are deferred (Option A, chosen
  31 October under Soham's delegated authority; not recorded as team or course approval).
- **Test tooling.** Socket.IO load script instead of JMeter, automated security tests instead of an OWASP ZAP
  scan, SQLite instead of MongoDB/PostgreSQL, Node 24 and Python 3.12.
- **Repository visibility.** Kept public (owner decision, 28 October) although CHAT-9 specified private.
- **Ownership changes.** CHAT-38 was reassigned from Hrisheek to Soham on 8 November. The outcome videos were
  recorded in Soham's session and raised for review by Yaswanth.
