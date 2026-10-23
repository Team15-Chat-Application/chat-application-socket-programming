# Messaging integration review - 23 October 2026

> Subsequent user-requested integration update: Soham prepared a separately
> attributed fix for the Node broadcast error and retained the new Python
> live_room_events mutation guard in messaging. New negative tests first failed
> for both broadcast failure and message expiry during a shared-lock wait, then
> passed after the changes. The original exact-head review below is historical;
> publication, current-head CI and merge evidence are recorded separately.

Reviewed owner-submitted PR #45 by Yaswanth (`kalluri088`), exact head
`9af2ad20f07b2e33d1b578d62d0d7818d45b035a`, targeting Soham's PR #44 branch.
The original owner commits and dates are preserved. No owner PR was changed,
merged, approved or represented as a teammate contribution by this review.

## Actual validation

An isolated detached checkout of the exact head passed **227 Node + 232 Python =
459 tests**, both build/check steps and actual Node/Flask default-launcher smoke
checks. PR CI run 39824321298 also passed on that exact head. Node uses real
HTTP/Socket.IO listeners; Flask integration uses its in-process client. Signed
fixture tokens exercise real verification but do not demonstrate login/issuance.

A separate, explicitly unpublished candidate overlay adds Soham's shared Python
guard fix and its regression to the PR head. All **233 Python tests passed** in
that overlay; its Node source is unchanged from the 227-test run. This supports
compatibility, not a merge or exact-commit CI claim for the dirty overlay.

## Owner action: broadcast error handling (P2)

In `src/messages.js`, `registerMessageHandlers` catches failures from
`service.send`, but the subsequent `io.to(...).emit(...)` is outside the catch.
A deterministic fault injection with a broadcaster that throws produces:

```json
{"faultInjection":"broadcast adapter throws","exceptionEscapedHandler":true,"acknowledgement":null}
```

The unexpected error escapes the event handler instead of returning the safe
INTERNAL_ERROR envelope. A successful acknowledgement must not be sent when
broadcast dispatch fails. The Python messaging handler already catches unexpected
exceptions and returns its safe envelope. Yaswanth should keep Node dispatch in
the error boundary and add a negative test that makes the broadcaster throw,
asserts no escaping exception/no success acknowledgement, and checks generic
error output without private adapter details. This finding was reproduced in a
local review probe; it was not submitted as a human review or posted to a teammate.

Suggested structure for owner implementation:

```javascript
try {
  const message = service.send(socket.data.identity, socket.id, payload);
  io.to(roomChannel(message.roomId)).emit('message:received', message);
  respond({ ok: true, data: message });
} catch (error) {
  respond(failure(error));
}
```

## Shared dependency fixed on Soham's branch

The existing Python guard validated a signed JWT before waiting for the shared
room lock. Another socket could hold that lock until the token expired; the
waiting request then mutated the store. The new deterministic two-thread,
controlled-clock regression reproduced that failure before the fix. The guard
now acquires the context and shared room locks in the existing order before
validation. Handler re-entry is safe because the locks are reentrant. Room
operations already serialized on that lock; ping/unknown guarded dispatch now
waits there too. Measure performance once a real product is available.

The new test is python_backend/tests/integration/test_guard_queue.py. It passes
on Soham's fixed branch and in the unpublished PR #45 overlay. The owner PR must
consume the updated shared base or an approved integration must retain this fix.
Do not merge the owner PR before required human review or silently rewrite it.

## Acceptance still open

- No Hrisheek auth/session PR was available at the live read-back. Registration,
  login/issuance, account lockout, real logout/revocation and usable UI remain missing.
- The room/message wiring, membership checks, server identity, length and sanitizer
  call sites now exist in the owner PR. Treat those components as available for
  review, rather than saying no messaging implementation exists anywhere.
- TC-Msg-01's 200 ms normal-load p90 acceptance target has not been measured.
- Real user-to-user acceptance, UI escaping behavior, QA/test-case review and owner
  approvals remain open. No human reviews were submitted on #44 or #45 at read-back.
- Yaswanth's CHAT-43 comment on 23 October explicitly confirms no video was recorded
  or uploaded. The recording is blocked by auth integration and a demo-client owner.

Actual local validation reports and the guard-only overlay patch are retained under
ignored reports/pr45-review. The temporary detached checkout was removed after
validation; the owner commits remain accessible through the fetched PR ref.
