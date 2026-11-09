# CHAT-38 / TC-UX-01: WCAG 2.1 AA audit and manual test record

Owner: Soham (reassigned from Hrisheek on 8 November 2026). QA reviewer: Yaswanth.
Requirement CHAT-NF-005: the UI conforms to WCAG 2.1 Level AA, including keyboard navigation
and sufficient contrast. Acceptance: the accessibility audit passes. **Automated checks alone do
not close TC-UX-01; the manual table below must be completed with real results.**

## 8 November 2026 code audit (client: `public/`)

| WCAG | Finding | Fix (commit c67451e) |
|---|---|---|
| 4.1.3, 1.3.1 | Every receipt, new message or tab switch rebuilt the whole message list inside an `aria-live` region, so screen readers could re-read the conversation repeatedly | Rows updated in place, only new rows inserted; `aria-relevant="additions"`; history loads under `aria-busy` |
| 2.4.3 | Focus was lost after sign-in and after "Leave room" (the focused button was hidden) | Focus moves to "Create a room" after sign-in and back to the room in the list after leaving |
| 1.3.1, 4.1.2 | Unread count used `aria-label` on a `span` (not reliably announced); member and room counts were bare numbers | Visually hidden text: "Project, 2 members, 1 unread", "2 rooms" |
| 4.1.3 | Connection loss and reconnect were not announced (sidebar text hidden on mobile) | Announced through the existing status region |
| 3.3.1 | Over 2000 characters silently disabled Send | `aria-invalid`, "(too long)" counter and an announced reason |
| 1.4.11 | Composer border 1.64:1; room-name field border on the dark panel 2.96:1 | Raised to 3.35:1 and 3.84:1 |
| 2.4.2 | Page title did not change with the open room | Title names the open room |

Text contrast: every text/background pair in `style.css` was calculated and passes 4.5:1 (lowest:
footer 5.40:1). Focus ring `#be6420` passes 3:1 on white, page and dark-panel backgrounds.

Verification: a jsdom harness driving the real `app.js` with a fake socket passed 25/25 checks
(focus after sign-in and leave, row reuse on status updates, spoken counts, over-limit state,
connection announcements). The CI browser job runs the Playwright flows and axe WCAG 2.0/2.1 A/AA
rules in Chromium.

## Manual test run (to complete)

Record the browser and assistive-technology versions actually used. On Windows, NVDA is free.
Mark each cell Pass / Fail / Note. Firefox is required by the submitted operating environment.

| # | Check (keyboard only unless stated) | Chrome | Firefox | NVDA notes |
|---|---|---|---|---|
| 1 | Tab from page load: "Skip to conversation" appears first and moves focus to the main area | | | |
| 2 | Create an account, then sign in, using only the keyboard; errors are read out | | | |
| 3 | After sign-in, focus lands on "Create a room"; "Signed in as …" is announced | | | |
| 4 | Create a room and open another from the list with Enter/Space; current room is indicated | | | |
| 5 | Room buttons read as "# name, N members" and ", N unread" when there are unread messages | | | |
| 6 | Opening a room does not read out the whole history; focus lands in the message box | | | |
| 7 | Enter sends, Shift+Enter adds a line; a new incoming message is announced once | | | |
| 8 | Receipts changing to Delivered/Read do not re-announce earlier messages | | | |
| 9 | Typing over 2000 characters: field marked invalid, reason announced, Send disabled | | | |
| 10 | Message list can be focused and scrolled with arrow keys | | | |
| 11 | "Leave room": focus returns to that room in the list; "Left # …" announced | | | |
| 12 | Sign out with the keyboard; focus returns to Username | | | |
| 13 | Focus ring visible on every control, including on the dark room panel | | | |
| 14 | 200% browser zoom: no content lost or overlapping, no horizontal scrolling of text | | | |
| 15 | 320 px wide window (or 400% zoom): layout reflows to one column, all functions usable | | | |
| 16 | Stop the server briefly: "Connection lost. Reconnecting…" and then "Reconnected." announced | | | |

Tested head: 7285098 (isolated automated run below; manual table above remains uncompleted)  Date: 2026-11-09  Tester: Codex/Playwright, with Chrome 157.0.8103.38 (About Chrome verified) and Firefox 157.0 (Playwright-managed; runtime version verified, About page unverified)  QA review (Yaswanth): ______


### 9 November 2026 execution limitation

Node v24.15.0 was verified. The requested branch was fetched, checked out and pulled explicitly from origin because the local branch had no upstream configured; head was 7285098. npm ci and npm run setup completed, and npm start reported that the chat application was listening.

No manual test row was executed in Chrome or Firefox. Computer Use stopped before browser navigation with: 'it could not determine the current browser URL on Windows with enough confidence to enforce policy.' Neither browser About page was reached, so versions are unverified. All browser result cells remain empty (untested), and every NVDA notes cell remains empty. No screen-reader output or WCAG conformance result is claimed. The server was stopped with Ctrl+C during cleanup; row 16 was not tested.


Alternative-interface retry on 9 November 2026: the native Windows interface read Chrome's accessibility tree, but no test input completed. State capture reported 'window is minimized; call activate_window, refresh with get_window, then retry get_window_state'. Activation and the refreshed retry reported 'user input was detected in this window; call get_window_state before continuing'. The retry was stopped after recovery failed. All 32 browser result cells and all NVDA notes cells remain empty. The restarted server was stopped with Ctrl+C. No browser version, test result or screen-reader behavior was established by this retry.

### 9 November 2026 supplemental automated browser run

Tester: Codex via the repository's Playwright CLI. Command: `npm run test:browser`. Head: `7285098`; Node: `v24.15.0`. The generated report records start time `2026-11-09T06:35:44.674Z` (12:05:44 IST), duration 6.128 seconds, 2 passed, 0 failed, 0 skipped and 0 flaky.

- `actual two-browser product: rooms, messages, receipts, unread badges and keyboard access`: passed. The test uses two isolated contexts in the Playwright-managed Chromium browser. Assertions exercised registration, room creation/joining, two-way messaging, a Read receipt, typing status, unread count/history, safe rendering of markup, Send disabled at 2001 characters, Enter-to-send and sign-out. Its desktop axe WCAG 2.0/2.1 A/AA scan returned no violations.
- `login form and mobile layout pass automated accessibility checks`: passed. At a 390 x 844 viewport, the login-page axe WCAG 2.0/2.1 A/AA scan returned no violations, and the first Tab focused the skip link.

This is supplemental automated evidence only. The existing tests use clicks and direct field filling as well as keyboard input; they do not execute the 16-row keyboard-only protocol. They did not test Firefox, installed Chrome, the browsers' About pages, 200%/400% browser zoom, a 320-pixel viewport, live-region announcement behavior or the required disconnect/reconnect procedure. Browser versions remain unverified; no screen-reader behavior is claimed. All Chrome/Firefox manual result cells and all NVDA notes cells remain empty.

The suite used its own isolated server/database on port 31337. After the run, a health request to that port failed with ECONNREFUSED, confirming it was no longer listening. The user's existing port-3000 app and open browser windows were not controlled by this run. Generated test artifacts are in ignored reports/test-results directories; no source, test or configuration file was edited. No commit or push was made.

### 9 November 2026 isolated keyboard automation

The user requested a sandbox alternative after desktop browser control failed. This run used separate headless browser processes/contexts, a disposable SQLite database and a loopback-only server on port 31338. It did not control the user’s open browser windows or use their port-3000 database. These are isolated test sessions, not a full Windows Sandbox VM.

Chrome 157.0.8103.38 was launched from the installed Chrome channel with its browser sandbox enabled. The About Chrome page in a separate disposable profile exposed “Version 157.0.8103.38 (Official Build) (64-bit)”. Firefox 157.0 was the official Playwright-managed Firefox build (1555), not the user’s installed Firefox profile; its version came from the running browser API. Firefox About-page navigation was unavailable (about: returned NS_ERROR_MALFORMED_URI; the earlier about:support attempt timed out).

Application interactions used keyboard Tab/Shift+Tab, Enter, Space, arrow keys and text entry through the keyboard API. No clicks, locator.fill(), DOM focus calls or direct changes to application state were used. Viewport resizing and read-only DOM/accessibility observations were programmatic. Chrome native accessibility-tree data came from Accessibility.getFullAXTree. Firefox observations used computed accessible DOM snapshots and actual ARIA attributes/status text; its native platform accessibility tree/event stream was not available. No NVDA or other screen-reader speech is claimed.

**Scoped automated totals: Chrome 13 passed, 2 failed, 1 not tested; Firefox 13 passed, 2 failed, 1 not tested.** A Pass below means the described automated assertions passed. It does not certify every clause of the corresponding manual row, spoken announcements, or WCAG conformance. The original manual browser cells and every NVDA notes cell remain empty because this does not complete the original manual protocol.

| Row | Chrome isolated check | Firefox isolated check | Actual observation / scope |
|---|---|---|---|
| 1 | Pass | Pass | First Tab focused the visible skip link; Enter focused #main. |
| 2 | Pass | Pass | Keyboard registration, explicit sign-out/sign-in and invalid-login error completed; error exposed as an alert. No speech claim. |
| 3 | Fail | Fail | Repeat sign-in ended with #notice text Reconnected.; details below. |
| 4 | Pass | Pass | Room creation and Enter/Space activation worked; aria-current=true identified the active room. |
| 5 | Pass | Pass | Room snapshots exposed the name, 2 members and 1 unread. |
| 6 | Pass | Pass | Opening history focused Message and exposed an aria-busy loading state. Spoken history behavior was not tested. |
| 7 | Pass | Pass | Enter sent; Shift+Enter inserted a newline; one incoming message produced exactly one new message-row insertion. No speech count claimed. |
| 8 | Pass | Pass | Existing message rows retained their DOM identities; final Read receipt and aria-relevant=additions were exposed. Intermediate Delivered transition was not separately verified. |
| 9 | Pass | Pass | At 2001 characters: aria-invalid=true, exact reason in #notice, counter marked too long and Send disabled. |
| 10 | Pass | Pass | The focused message list scrolled upward/downward with arrow keys; scrollTop changes recorded. |
| 11 | Pass | Pass | Keyboard Leave returned focus to the corresponding room button and exposed Left # ... in #notice. |
| 12 | Pass | Pass | Keyboard sign-out returned focus to Username. |
| 13 | Pass | Pass | Computed focus-visible outlines were present on traversed controls, including the dark panel; screenshots retained. This was not a complete human visual audit. |
| 14 | Not tested | Not tested | Zoom shortcuts left innerWidth=1280, devicePixelRatio=1 and visualViewport.scale=1 in both headless browsers. 200% browser zoom was not established. |
| 15 | Fail | Fail | At a 320 CSS-pixel viewport, workspace reflowed to a column but document width overflowed to 391 px in Chrome and 332 px in Firefox. |
| 16 | Pass | Pass | Isolated npm server stopped with Ctrl+C, remained down for at least five seconds and restarted. Notice history contained Connection lost. Reconnecting… then Reconnected.; a message sent after restart. |

#### Observed failures

- **Row 3, Chrome and Firefox:** Using the keyboard, sign in, sign out, then sign in again. Expected: focus on Create a room and the signed-in user identified in #notice. Observed: focus correctly returned to room-name. Fresh first login exposed Signed in as alice_c_a11y. / Signed in as alice_f_a11y.; after repeat login the recorded notice sequence included Signed in as ... immediately followed by Reconnected., leaving Reconnected. as the final exposed status. The repeat-login assertion failed; this does not establish what a screen reader would speak.
- **Row 15, Chrome:** Resize the isolated viewport to 320 x 800 while signed in as alice_c_a11y with rooms available. Use the keyboard to open another room, send a message and create a room. Expected: single-column reflow with no horizontal page overflow and usable controls. Observed: the workspace became a column and those keyboard actions worked, but document clientWidth was 320 and scrollWidth was 391. The header account area extended to x=328.64. A full-page screenshot also shows content extending beyond the viewport.
- **Row 15, Firefox:** Repeat the same steps as alice_f_a11y. Expected: no horizontal page overflow at 320 pixels. Observed: document clientWidth was 320 and scrollWidth was 332; the header account area extended to x=331.77. The tested keyboard actions worked and the workspace reflowed, but horizontal overflow remained.

#### Harness retries and remaining limits

The first Firefox attempt encountered the headless browser’s focus-wrap limitation: Tab after the last page control did not cycle back to earlier controls. A keyboard-only retry used Shift+Tab for earlier controls and completed. Firefox’s bulk keyboard.insertText(2001 characters) also raised a protocol-level composition error; a separate retry using 2001 individual keyboard.type keystrokes passed the invalid-field, reason, counter and disabled-Send assertions. These harness errors are preserved in the raw evidence and are not counted as app failures.

Row 14 remains untested: actual 200% browser zoom was not established; CSS zoom was not substituted. Firefox’s native accessibility tree and its About-page version remain unverified. Receipt testing observed the final Read state and row stability; it did not independently confirm an intermediate Delivered state. Screenshots/computed focus outlines and viewport tests do not replace full manual visual checks. No manual or QA sign-off is recorded.

Evidence (ignored local artifacts): [combined results](../reports/a11y-sandbox-1794206349610/combined-results.json), [Chrome and initial Firefox run](../reports/a11y-sandbox-1794206349610/results.json), [Firefox keyboard retry](../reports/a11y-sandbox-1794206349610/results-firefox.json), [long-input, repeat-login and About-page checks](../reports/a11y-sandbox-1794206349610/results-extra.json), [Chrome 320 px screenshot](../reports/a11y-sandbox-1794206349610/Chrome-320px.png), [Firefox 320 px screenshot](../reports/a11y-sandbox-1794206349610/Firefox-320px.png), [Firefox long-input screenshot](../reports/a11y-sandbox-1794206349610/Firefox-2001-characters.png).

Cleanup: the isolated server was stopped with Ctrl+C; a subsequent health request to port 31338 returned ECONNREFUSED. Only this tracked documentation file was edited; generated browser profiles, database and reports are ignored artifacts. No source fix, commit or push was made.

### Fixes after the 9 November run

- **Row 3.** Cause: signing out called `socket.disconnect()` while the session was still set, so the
  disconnect handler treated it as a dropped connection and the next sign-in announced "Reconnected.".
  Fix: a client-initiated disconnect (`io client disconnect`) is ignored and the reconnect flags are reset on
  sign-out. The jsdom harness reproduces the failure at 7285098 and passes after the fix (28/28).
- **Row 15.** Cause: at 320 px the header account area did not wrap, and the room-creation label was forced
  onto one line beside an input with an intrinsic minimum width. Fix: the narrow header wraps, the label sits
  above the field, the input may shrink, and long names and headings wrap.
- **Regression tests.** `e2e/chat.spec.js` now checks that a 320 px viewport has no horizontal page overflow
  (signed out and signed in with a room open) and that a repeat sign-in announces the signed-in user. They
  run in the CI browser job.
- Rows 3 and 15 need re-running against the new head; row 14 and the manual and NVDA columns are still open.
