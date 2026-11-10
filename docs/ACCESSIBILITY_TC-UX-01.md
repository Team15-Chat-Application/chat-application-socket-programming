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
| 3 | After sign-in, focus lands on "Create a room"; "Signed in as …" is announced | | | Pass (real NVDA 2026.3 / Firefox 157.0, continuous speech): “Signed in as nvda alice 2.”; focus on Create a room. |
| 4 | Create a room and open another from the list with Enter/Space; current room is indicated | | | |
| 5 | Room buttons read as "# name, N members" and ", N unread" when there are unread messages | | | Pass (real NVDA 2026.3 / Firefox 157.0): “number NVDA Capture Project , 2 members” and “2 members , 1 unread”. |
| 6 | Opening a room does not read out the whole history; focus lands in the message box | | | Fail (real NVDA 2026.3 / Firefox 157.0): opening history spoke “History alpha one”, “History beta two” and “History gamma three”; focus then landed on Message. |
| 7 | Enter sends, Shift+Enter adds a line; a new incoming message is announced once | | | Pass (real NVDA 2026.3 / Firefox 157.0, continuous speech): “NVDA incoming singular message” occurred once in 8 seconds. |
| 8 | Receipts changing to Delivered/Read do not re-announce earlier messages | | | Pass (real NVDA 2026.3 / Firefox 157.0, continuous speech): Read caused no earlier-message speech during 8 seconds; no spoken phrase to quote. |
| 9 | Typing over 2000 characters: field marked invalid, reason announced, Send disabled | | | Pass (real NVDA 2026.3 / Firefox 157.0, controlled native boundary key): “Message is longer than 2000 characters. Shorten it to send.” and “invalid entry”; length 2001, Send disabled. |
| 10 | Message list can be focused and scrolled with arrow keys | | | |
| 11 | "Leave room": focus returns to that room in the list; "Left # …" announced | | | Pass (real NVDA 2026.3 / Firefox 157.0): “Left number NVDA Capture Project.”; focus returned to that room button. |
| 12 | Sign out with the keyboard; focus returns to Username | | | |
| 13 | Focus ring visible on every control, including on the dark room panel | | | |
| 14 | 200% browser zoom: no content lost or overlapping, no horizontal scrolling of text | Pass (equivalent viewport: 640×400 CSS px, DPR 2; no real Ctrl+Plus zoom) | Fail: room-list text clipped (equivalent viewport: 640×400 CSS px, DPR 2, Firefox pref retained; see method adjustment below) | |
| 15 | 320 px wide window (or 400% zoom): layout reflows to one column, all functions usable | | | |
| 16 | Stop the server briefly: "Connection lost. Reconnecting…" and then "Reconnected." announced | | | Pass (real NVDA 2026.3 / Firefox 157.0, continuous speech): “Connection lost. Reconnecting...” then “Reconnected.” after the real server interruption. |

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


## Re-run of rows 3 and 15 at 0c23af0

Date: **9 November 2026 (Asia/Calcutta)**. Tester: **Codex / Playwright keyboard automation**. Pulled explicitly with `git pull --ff-only origin CHAT-38-accessibility` after plain `git pull` reported no tracking branch; `git rev-parse --short HEAD` returned **0c23af0** before and after the run. Node: **v24.15.0**.

Setup matched the earlier isolated keyboard run: installed Chrome **157.0.8103.38**, headless with `channel: chrome` and `chromiumSandbox: true`; Playwright-managed Firefox **157.0** (build 1555), headless. Each browser had two separate contexts, a 1280 x 800 initial viewport and reduced-motion emulation. Versions were observed from the running browser API; About pages were not re-tested. A fresh temporary SQLite database and signing key were created for this re-run, shared sequentially by the Chrome and Firefox runs as before. The loopback server used previously unused **port 31339**. The existing app/database and open browser windows were not used.

Accounts were `alice_c_a11y` / `bob_c_a11y` in Chrome and `alice_f_a11y` / `bob_f_a11y` in Firefox, with the same test password length as the earlier run. App actions used only Tab/Shift+Tab, Enter, Space and keyboard text input; there were no clicks, field fills or DOM focus calls. The earlier project/other-room names, two-user membership, unread update and ten-message conversation state were recreated before the narrow-layout check.

| Row | Chrome | Firefox |
|---|---|---|
| 3: sign out and sign in again; check focus and exposed signed-in status | **Pass** | **Pass** |
| 15: 320 px viewport; reflow, room switching, message sending and room creation | **Fail** | **Pass** |

**Row 3 observations:** after the repeat sign-in, Chrome exposed `Signed in as alice_c_a11y.` and Firefox exposed `Signed in as alice_f_a11y.` in `#notice`. Both had focus on `#room-name` (Create a room). In both browsers, the notice had `role="status"` and `aria-live="polite"`; the final status was not replaced by `Reconnected.`. Chrome native accessibility-tree data and computed accessible snapshots were captured. As in the earlier run, Firefox used a computed accessible DOM snapshot and actual ARIA attributes; its native platform accessibility tree was not available. No screen-reader speech is claimed.

**Row 15 measurements:** resize the viewport to 320 x 800 with the project conversation open. Measure document-element `clientWidth` / `scrollWidth`, then use Space to open the other room, Enter to send a message, and the keyboard to create/open `Narrow room Chrome` or `Narrow room Firefox`. All three recorded keyboard actions completed in both browsers.

| Browser | Measurement point | clientWidth (px) | scrollWidth (px) | Workspace direction |
|---|---|---:|---:|---|
| Chrome | Before keyboard actions | 320 | 391 | column |
| Chrome | After keyboard actions | 320 | 566 | column |
| Firefox | Before keyboard actions | 320 | 320 | column |
| Firefox | After keyboard actions | 320 | 320 | column |

**Remaining failure — row 15, Chrome:** with the 320 px viewport, open the populated project room and measure the page, then switch rooms, send and create a room using the keyboard. Expected: column reflow and no horizontal page overflow (`scrollWidth <= clientWidth`). Observed: the workspace reflowed to a column and the actions worked, but scrollWidth was **391** before the actions and **566** afterward, with clientWidth **320**. The header account area now ended at x=305; this observation does not identify the cause of the remaining overflow. Firefox measured **320 / 320** before and after and passed the scoped check. Full-page screenshots were captured and inspected.

**Setup retry:** the first Firefox setup auto-login was rate-limited by the server (`RATE_LIMITED`, five login attempts per IP per 60 seconds), before either requested Firefox row ran. The account had already been created. After that window elapsed, a fresh Firefox session used keyboard sign-in, sign-out and repeat sign-in with that account, then recreated the room/message state. The rate limit was not disabled or changed; the incomplete setup attempt was not counted as a row failure.

Only rows 3 and 15 were evaluated for this re-run. The earlier results, manual table, all NVDA cells and QA sign-off were left unchanged. These remain scoped isolated keyboard observations, not a completed manual WCAG audit. Temporary raw observations are in `C:\Users\soham\AppData\Local\Temp\chat-a11y-0c23af0-o1pzOu` (`results.json`, `results-firefox-retry.json`, `Chrome-320px.png`, `Firefox-320px.png`); no other repository file was edited.

Cleanup: the isolated `npm start` server was stopped with **Ctrl+C**. A subsequent request to `http://127.0.0.1:31339/api/health` failed with **ECONNREFUSED**. No commit or push was made.

### Fix for the remaining Chrome row 15 failure

Cause: the visually hidden screen-reader text added in c67451e uses `position:absolute`, and the room
buttons and room list had no positioned ancestor. When room buttons scrolled out of the horizontal room list,
their hidden spans escaped the list's clipping and widened the page in Chrome. Reproduced in Chromium with the
client's HTML and CSS at 320 px: with six rooms the page grew to 822 px. Fix: the room list, room buttons and
rooms heading are positioned containers. With the fix the page stayed at 320 px with six rooms, and keyboard
focus on the last room scrolled the room list rather than the page. The Playwright regression now creates
three long-named rooms and checks for overflow after each. Row 15 in Chrome needs re-running at the new head.


## Chrome row 15 re-run at 82e6929

Date: **9 November 2026 (Asia/Calcutta)**. Tester: **Codex / Playwright isolated keyboard automation**. Ran `git pull --ff-only origin CHAT-38-accessibility`; `git rev-parse --short HEAD` returned **82e6929** before and after testing. Node: **v24.15.0**.

Setup matched the Chrome run at 0c23af0: installed Chrome **157.0.8103.38**, headless with `channel: chrome` and `chromiumSandbox: true`; two isolated browser contexts, a 1280 x 800 initial viewport and reduced-motion emulation. The Chrome version was observed from the running browser API; About Chrome was not re-tested. A new temporary SQLite database/signing key and previously unused loopback **port 31340** were used. The existing app/database and open browser windows were not used.

Using `alice_c_a11y` and `bob_c_a11y`, recreated the two-user room membership, unread update and ten-message project conversation from the earlier setup. Created `Sandbox Project Chrome` and `Sandbox Other Chrome`. Resized the viewport to **320 x 800**, measured document-element widths, opened the other room with **Space**, sent `320 px keyboard message Chrome` with **Enter**, and created/opened the third room, **`Narrow room Chrome with a long name for accessibility testing`** (61 characters). App interaction used only Tab/Shift+Tab, Enter, Space, arrow keys and keyboard text input; no clicks, locator fills or DOM focus calls.

**Result: Pass.** The workspace reflowed to one column. All three recorded keyboard actions completed, and there was no horizontal page overflow at either measurement point.

| Measurement point | clientWidth (px) | scrollWidth (px) | Rooms | Workspace direction |
|---|---:|---:|---:|---|
| Before keyboard actions, populated project room open | 320 | 320 | 2 | column |
| After switching room, sending and creating the third, long-named room | 320 | 320 | 3 | column |

A full-page screenshot was captured and inspected: the long conversation heading wrapped within the column. Raw observations and screenshot are temporary artifacts in `C:\Users\soham\AppData\Local\Temp\chat-a11y-82e6929-HL8mQt` (`results.json`, `Chrome-320px.png`). This records the same scoped row-15 keyboard/reflow check as the earlier re-run; it does not complete the full manual WCAG audit. Firefox, other rows, the manual table, NVDA notes and QA sign-off were not changed or evaluated by this run.

Cleanup: stopped the isolated `npm start` server with **Ctrl+C**. A subsequent health request to `http://127.0.0.1:31340/api/health` returned **ECONNREFUSED**. Only this documentation section was appended; no other repository file was edited, and no commit or push was made.


## Row 14 and NVDA run at e960ad6

Date: **10 November 2026 (Asia/Calcutta)**. Tester: **Codex**. `git pull --ff-only origin CHAT-38-accessibility` completed; `git rev-parse --short HEAD` was **e960ad6** before and after testing. Node **v24.15.0**. Only the requested main-table row-14 results/NVDA notes and this new section are changed; older execution records and QA sign-off remain historical.

### Isolation and versions

A fresh temporary SQLite database, a newly generated **96-hex-character JWT_SECRET** and unused loopback **127.0.0.1:31341** were used. The repository data/ folder and .env were not used. Because the repository npm start script includes --env-file-if-exists=.env, a temporary npm package launched the same absolute src/index.js entry point without any env-file option. No repository script or configuration was edited. The server login limit was retained; Part A used four logins across the two browsers, and later speech runs were paced across subsequent windows.

Browsers: installed **Chrome 157.0.8103.39** (channel chrome, browser sandbox enabled) and Playwright-managed **Firefox 157.0**. NVDA executable ProductVersion: **2026.3**, FileVersion **2026.3.0.58174**; Guidepup portable bundle **0.2.1-2026.3**. Tools: **@guidepup/guidepup 0.40.0**, **@guidepup/setup 0.29.3**. Browser versions came from the running-browser API and NVDA version from executable metadata; browser About pages were not re-tested.

WindowsSandbox.exe was absent, no NVDA installation/running process was found initially, and the host registry reported Windows 10 Home / Core. After the user explicitly approved temporary host NVDA/Guidepup setup, the tools and portable NVDA assets were installed below the test temporary folder. The inspected Guidepup Windows setup path was a no-op; host security/startup settings were not changed. Windows Sandbox was not launched. [Guidepup](https://github.com/guidepup/guidepup) drove native keyboard commands; speech was recorded from the real NVDA remote SPEAK stream, not inferred from ARIA or expected output.

### Row 14 method and result

**Actual workflow method: equivalent viewport, not real browser zoom.** Chrome used viewport **640×400** with deviceScaleFactor **2**. The supplied Firefox recipe (viewport 1280×800 plus layout.css.devPixelsPerPx="2.0") was tried first but actually returned **innerWidth=1280 and devicePixelRatio=1**: Playwright overrode the preference. An explicit DPR 2 with that viewport still returned innerWidth=1280. Firefox was therefore tested with the preference retained plus an explicit **640×400 / DPR 2** context. Before app testing, both browsers were observed at **window.innerWidth=640**, **window.innerHeight=400**, **devicePixelRatio=2**. This adjustment establishes the requested layout geometry but is a departure from the literal Firefox launch recipe.

All app steps used only keyboard navigation/text input: register, explicitly sign in after signing out, create two rooms, send a message with Enter, open the other room with Space, leave it and sign out. The long room name was **Accessibility review room for 200 percent zoom checks** (53 characters). Every step completed in both browsers. Full-page screenshots were captured for sign-in and room-open states in each browser, and inspected alongside control/text bounding boxes. Vertical scrolling was permitted. Native Guidepup Ctrl+Equals and Ctrl+NumPadPlus were also tried in separate visible disposable windows (including a native, non-emulated viewport); none established a twofold DPR change/halved layout width. Those attempts are not claimed as successful real 200% zoom.

| Browser / method | State | clientWidth (px) | scrollWidth (px) | Overlap / clipping observed | Row 14 |
|---|---|---:|---:|---|---|
| Chrome — equivalent viewport 640×400 / DPR 2 | sign-in | 640 | 640 | No overlapping or clipped visible text/control found | Pass |
| Chrome — equivalent viewport 640×400 / DPR 2 | room-open | 640 | 640 | No overlapping or clipped visible text/control found | Pass |
| Firefox — equivalent viewport 640×400 / DPR 2 | sign-in | 640 | 640 | No overlapping or clipped visible text/control found | Fail |
| Firefox — equivalent viewport 640×400 / DPR 2 | room-open | 640 | 640 | Partially clipped room-list text/control; no overlapping boxes | Fail |

**Failure: row 14, Firefox room-open state.** Steps: after the Chrome workflow, use the separate Firefox profile in the shared fresh test database; register/sign in, create Second room Firefox and the 52-character long room, send a message and inspect the open-room state. The catalogue contained four rooms (including the two created in Chrome). Expected: no horizontally clipped control/text at the zoom-equivalent geometry. Observed: page width stayed **640 / 640**, but Second room Firefox was partially cut off by the horizontally scrolling room list. Its label text box extended from **x=580.88 to x=714.40** while the room-list clipping edge was **x=616**; its button extended to **x=737.83**. The full-page screenshot visibly cuts the label. All keyboard actions still completed, and no overlapping boxes were found. This result is tied to that catalogue state; it does not establish a browser-exclusive defect.

Bounding-box review excluded visually hidden accessibility text and an initial scanner artifact that compared an input control border box with its own content clip. The actual ancestor-clipping findings were retained; no overlap/clipping finding was converted into a pass without review. Raw and reviewed diagnostics are both retained.

### NVDA speech results — Firefox

Primary profile: a real visible Firefox window with **nvda_alice2**. Second user **nvda_bob2** used a separate headless Firefox process/profile to generate messages/receipts using keyboard events. Primary navigation and activation used Guidepup native keys; small text preparation used keyboard text APIs. Each quoted phrase below is an actual substring from the continuous NVDA SPEAK stream. Eight-second negative/once-only observations are bounded to those windows; no claim is made about later speech.

| TC-UX-01 row | Result | Captured spoken phrase / observation |
|---|---|---|
| 3 | Pass — real NVDA 2026.3 / Firefox 157.0 | “Signed in as nvda alice 2.”; focus was #room-name (Create a room). |
| 5 | Pass — real NVDA 2026.3 / Firefox 157.0 | “number NVDA Capture Project , 2 members, button, focused”; later “number NVDA Capture Project , 2 members , 1 unread, button, focused”. NVDA pronounced # as number. |
| 6 | Fail — real NVDA 2026.3 / Firefox 157.0 | Opening the room spoke all four saved messages, including “Unread first NVDA message”, “History alpha one”, “History beta two” and “History gamma three”; then “Message, edit, multi line”. Focus was Message. |
| 7 | Pass — real NVDA 2026.3 / Firefox 157.0 | “nvda bob 2 04:41 PM NVDA incoming singular message”; the message body occurred once in the eight-second continuous capture. |
| 8 | Pass — real NVDA 2026.3 / Firefox 157.0 | No speech was captured during the eight seconds after Delivered changed to Read; no earlier message was re-read. There is no spoken phrase to quote for this expected silence. |
| 9 | Pass — real NVDA 2026.3 / Firefox 157.0 | “Message is longer than 2000 characters. Shorten it to send.”; “invalid entry”. Checked length 2001, aria-invalid=true, Send disabled and Firefox/message focus retained. |
| 11 | Pass — real NVDA 2026.3 / Firefox 157.0 | “Left number NVDA Capture Project.”; focus returned to that room button. |
| 16 | Pass — real NVDA 2026.3 / Firefox 157.0 | “Connection lost. Reconnecting...” followed by “Reconnected.” after Ctrl+C, at least five seconds down and a restart of the same isolated server. |

**Failure: NVDA row 6.** Steps: while the primary user is in NVDA Capture Other, have the second user send four messages in NVDA Capture Project; focus its room button and open it with Enter. Expected: focus lands on Message without reading the saved backlog. Observed: focus did land on Message, but NVDA spoke the sender/time and all four stored message bodies before announcing the Message field. The continuous log contains all four bodies within the eight-second observation window.

### Capture checks, retries and limits

An initial harness used Guidepup command-scoped spokenPhraseLog(), which does not continuously retain asynchronous speech between commands. Its empty asynchronous logs were rejected as inconclusive. The definitive run added a continuous listener to Guidepup’s actual NVDA remote SPEAK events. Row 3’s raw literal matcher also rejected the username’s spoken spacing (nvda alice 2 versus nvda_alice2); the recorded speech and correct focus establish the reviewed Pass, without changing the quote.

Row 9 was repeated because a burst attempt included unrelated Windows Search speech, and a subsequent synthetic text-preparation attempt did not establish the checked boundary. The final valid attempt used native keyboard batches of 100 characters, verified each cumulative count through 2000 and checked document.hasFocus() plus Message focus. It then typed one native x through NVDA and continuously captured eight seconds. The before/after lengths were **2000 / 2001**, focus stayed Message in the foreground, and the reason plus invalid-entry speech were captured. Only that controlled attempt determines the final row-9 result.

Real Ctrl+Plus 200% zoom was **not established**; row-14 results are explicitly for equivalent-viewport layout. Firefox’s literal requested viewport/preference recipe was **not reproduced as intended**, and its adjusted context is stated above. Firefox is the Playwright-managed distribution, not the user’s existing profile. Screen-reader audio was not independently evaluated by a human; the evidence is NVDA’s emitted spoken-phrase stream. No full WCAG conformance or Yaswanth QA sign-off is implied.

### Evidence and cleanup

Temporary evidence directory: `C:\Users\soham\AppData\Local\Temp\chat-a11y-e960ad6-GzSZcG`. Files include `row14-results.json` (raw), `row14-reviewed.json`, `Chrome-sign-in.png`, `Chrome-room-open.png`, `Firefox-sign-in.png`, `Firefox-room-open.png`, `nvda-results-continuous.json`, `nvda-continuous-speech.jsonl`, `nvda-row9-native-boundary.json`, `native-zoom-results.json`, `native-zoom-numpad-results.json` and `final-reviewed-results.json`. Earlier invalid attempts are retained separately and are not final pass/fail evidence.

The isolated server was stopped with **Ctrl+C**; a final request to port 31341 failed with **ECONNREFUSED**. Portable NVDA was stopped, all disposable test browser windows were closed, and the final process check found no nvda/firefox process. No Windows Sandbox existed to close. Temporary tools/evidence remain in the stated temporary folder. Only this documentation file was edited in the repository; no source/configuration edit, commit or push was made.

### Fixes after the row 14 and NVDA run

- **NVDA row 6.** Cause: the log was rebuilt under `aria-busy`, and clearing `aria-busy` made Firefox report the
  whole log as changed, so NVDA read the saved messages; focus also moved to Message only after the presence
  round trip. Fix: the log is rebuilt with `aria-live="off"`, focus moves to Message immediately, and polite
  announcements are restored 750 ms later. The jsdom harness checks this (30/30) and the CI browser test now
  records the attribute sequence (`off`, then `polite`) when a room is opened.
- **Row 14, Firefox.** Cause: on narrow screens the room list was a horizontally scrolling strip, so a button at
  its edge was partly cut off. Fix: at 640 px and below the room buttons wrap onto new lines and long names wrap
  instead of being truncated. Checked in Chromium with four rooms including two very long names: at 640x400 and
  at 320 px every room button is fully inside the list, nothing is truncated and there is no horizontal overflow.
  The CI browser test now checks for clipped rooms at 320 px and at 640x400.
- Rows 6 (NVDA) and 14 (Firefox) need re-running at the new head.
