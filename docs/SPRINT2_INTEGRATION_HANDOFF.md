# Sprint 2 integration handoff (8 November 2026)

Prepared by Soham for Hrisheek (owner of CHAT-22, CHAT-23, CHAT-24, CHAT-25, CHAT-31).

## Why main is red

On 7 November, merge 8555c53 combined two separate implementations of message
history and delivery status:

- PR #53 (Hrisheek): `src/database.js` message tables and a `MessageService` that
  takes `database` and emits `message:delivered`, `message:history`, `message:read`.
- CHAT-26 branch (Soham): `src/history.js` (`HistoryStore`) and a `MessageService`
  that takes `history` and emits `message:status`, `room:history`.

The merge kept Soham's `src/messages.js` but Hrisheek's schema and tests. Both
create a `messages` table in the same SQLite file, so the server fails to start
(`no such column: seq`), and the PR #53 tests fail (CI runs #76 and #77).

## Proposed decision: keep the contract protocol

`contracts/events.json`, the browser client (`public/`) and the Flask backend
(`python_backend/chat_backend/history.py`) all use `message:status`,
`room:history` and the `seq`/`status` schema. Keeping that protocol preserves
Node/Flask parity. PR #53's tests capture the right requirements and should move
over to it. **This needs Hrisheek's agreement before it is merged.**

## What branch `sprint2-integration` already does

1. Undoes the two revert commits, so all of the 7 November merge content is present.
2. Merges `origin/CHAT-26-sprint2-delivery`, including a6b78bf, d1d0662 and 27eef79
   that 8555c53 missed.
3. Creates `HistoryStore` before `createDatabase` in `src/runtime.js`, so the shared
   `messages` table has the contract schema. `database.js` then only adds its
   `delivery_status` column. No change to `src/database.js`.

Verified locally: the server starts on a real file, and the Node half of
`scripts/system_check.js` passes (real HTTP login, WebSocket chat, 55 persisted
messages, last 50 after restart, read receipt, logout revocation). Unit: 195/196
pass. Integration: everything except the PR #53 cases below.

## Remaining work for Hrisheek: port 11 tests to the contract

| PR #53 test expects | Contract equivalent |
|---|---|
| `new MessageService({ rooms, database })` | `const history = new HistoryStore(':memory:')`, `rooms = new RoomStore({ repository: history })`, `new MessageService({ rooms, history })`. Rooms must use the repository, because `messages.room_id` references `rooms`. |
| `message:history` request | `room:history`. The acknowledgement is the same: `{ ok, data: { roomId, messages } }`, newest 50 in chronological order. |
| `message:delivered` broadcast | `message:status` broadcast with the full message and `status: 'Delivered'`. The send acknowledgement also returns that message. |
| `message:read` broadcast | Request is still `message:read`. The notification arrives as `message:status` with `status: 'Read'` and `readBy: [{ userId, readAt }]`. |
| `database.getRecentMessages`, `findMessageById` | `history.history(roomId)`, `history.get(messageId)` |
| `database.getMessageReadReceipts` | `history.get(messageId).readBy` |
| status `pending` / `delivered` | `Sent` / `Delivered` / `Read` |
| unit: `database.saveMessage` called once | `history.save` called once (or the stored message is returned) |

Existing behaviour already matches the requirements: senders reading their own
message get `FORBIDDEN`, non-members get `FORBIDDEN`, duplicate reads keep one
receipt, and reading before delivery gives `VALIDATION_ERROR`.

Failing now: `tests/integration/messaging.test.js` (3 CHAT-23, 3 CHAT-24, 5 CHAT-25)
and `tests/unit/messages.test.js` ("payload fields cannot forge them"). The two
"suite failed to run" entries reported against `runtime.test.js` in a full run
are leaked `message:read` timers from `messaging.test.js` and disappear once it
is ported.

Open choice for Hrisheek: the message functions and `message_reads` table in
`src/database.js` are no longer used by the running app. Keep them or remove them.
