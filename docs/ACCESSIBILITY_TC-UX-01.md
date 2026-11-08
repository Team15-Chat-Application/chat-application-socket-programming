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

Tested head: ______  Date: ______  Tester: ______  QA review (Yaswanth): ______
