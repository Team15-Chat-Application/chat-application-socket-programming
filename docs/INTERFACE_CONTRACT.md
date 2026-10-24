# Shared interface contract - proposed v0.3

Prepared for team review on 02 October 2026. This is a concrete proposal, not a
claim that teammates have approved it. `contracts/events.json` is the matching
event reference. Updated 20 October 2026: HTTP health, guarded `system:ping`,
room creation/join/leave/list, membership notifications and live catalogue updates
are implemented in both backends. A JWT verification adapter, login limiter and
sanitisation helpers are component-verified as of 22 October (356 regression tests
across both backends). Registration/login, session storage, messaging
and UI integration remain pending. See SOHAM_INTEGRATION_HANDOFF.md.

## Ownership and review

- Hrisheek: authentication module and adapter; review token/session decisions.
- Soham: room module, shared security coordination and CI/CD ownership.
- Yaswanth: messaging module; review broadcasts, acknowledgements and sanitisation.

All three must review the contract before it is marked agreed. Keep the existing
SRS/STP roles; this proposal does not invent additional project requirements.

## Common values

`userId`, `sessionId`, `roomId` and `messageId` are opaque server-issued strings.
Clients must not select their sender identity. Timestamps are UTC ISO 8601.
Success acknowledges `{ok:true,data:<result>}`. Failure acknowledges
`{ok:false,error:{code,message}}`; `message` is safe to show to a user and must
not include secrets or stack traces. Errors use the codes in the JSON reference.

## Authentication handoff

Proposed REST routes: `POST /api/auth/register`, `POST /api/auth/login` and
`POST /api/auth/logout`. Request credentials are `{username,password}`.
Registration returns a public user record with HTTP 201. Login returns a token,
its expiry and a public user record with HTTP 200. Logout invalidates the session
and returns HTTP 204. Passwords never appear in responses or logs.

Socket.IO handshake auth is `{token:<JWT>}`. Proposed JWT identity claims are
`sub` for user ID, `jti` for session ID, and `iat`/`exp` for issuance/expiry.
The prepared verifier proposes HS256 only, issuer `team15-chat`, audience
`chat-application`, a configured secret of at least 32 UTF-8 bytes, and required
`sub`, `jti`, `iat`, `exp`, `iss`, `aud` claims. Hrisheek must review this proposal
and supply real token issuance and session storage. The verifier has no default
secret and does not implement login or issue production tokens. Identity claims
contain 1-128 Unicode code points without unpaired surrogates. Time claims and
session expiresAt use integer Unix seconds within +/-9007199254740991. After a
potentially asynchronous lookup, token and session expiry are checked again.
Room join/leave revalidate after awaited transport operations before membership
mutation. These boundary clarifications retain the proposed v0.3 event format.

Primary server adapter:

```javascript
auth.authenticate({ token }) // resolves {userId,sessionId}, or throws AppError
auth.validate({ token, identity }) // resolves exactly true for a live valid session
```

Secondary server adapter uses the same dictionaries through synchronous
`authenticate(credentials)` and `validate(context)` methods. Re-check signature,
expiry and revocation on every event, not just the handshake. The primary dispatch
guard exists; the secondary diagnostic handler follows that rule. Every future
secondary handler must retain it. Invalid sessions are rejected and disconnected.

Password hashing helpers are implemented for Hrisheek's auth module to integrate:
`hashPassword(password, {cost})` / `verifyPassword(password, storedHash)` in Node,
`hash_password(password, cost=...)` / `verify_password(password, stored_hash)` in
Python. They return a hash string and boolean respectively, use random salts and
default to cost 12 (supported operational range 10-14). Store only the returned
hash. Invalid password inputs raise a safe VALIDATION_ERROR; malformed or
unsupported stored hashes return false. Passwords use strict UTF-8 with a 72-byte
maximum to avoid bcrypt truncation; they are not trimmed or normalised. The
helper accepts nonempty strings; Hrisheek applies the SRS password-strength rules
at the registration boundary. Neither helper logs credentials. Login rate limiting
is five attempts/minute/IP with HTTP 429
for excess attempts. Account lockout after five consecutive failures for 15
minutes is a separate auth requirement and must not be confused with rate limiting.

## Room handoff

| Client event | Payload | Proposed successful acknowledgement |
| --- | --- | --- |
| `room:create` | `{name}` | Room `{roomId,name,memberCount}` |
| `room:join` | `{roomId}` | Room snapshot |
| `room:leave` | `{roomId}` | `{roomId}` |
| `room:list` | `{}` | `{rooms:[Room]}` |

Only authenticated users create or join rooms. Yaswanth uses the same room IDs
with Socket.IO room broadcasts. Soham maintains the public room catalogue; do
not expose Socket.IO's per-socket internal rooms as application chat rooms.
Membership notifications use `room:membership`; catalogue updates use
`room:list-updated`. Missing rooms return NOT_FOUND; malformed inputs return
VALIDATION_ERROR. Disconnect cleanup must update membership and notifications.

Proposed count policy: distinct authenticated users per room, not socket count.
Multiple tabs keep one user present until their last socket leaves. Team review
must confirm this policy and room-name uniqueness/length/empty-room lifetime.
Those policies are not specified in the supplied requirements and are not
approved by the team yet. The current increment uses an in-memory
catalogue isolated per backend process. Names trim ASCII edge whitespace, then
must contain 1-64 Unicode code points without controls or unpaired surrogates.
Names are stripped of markup and escaped by the shared text sanitizer; safe UI
display and entity handling need review. Duplicate display names
are allowed and always get distinct server UUIDs. These are implementation
defaults for review, not additional SRS requirements. Creation does not join the
creator: `memberCount` is zero until an explicit `room:join`. The catalogue retains
empty rooms until process restart. `room:list` queries this catalogue, not the
Socket.IO internal socket channels. `room:list-updated` is emitted on connection,
creation and membership count changes to authenticated catalogue subscribers.
The first user socket joining a room emits one join notice; the final socket
leaving/disconnecting emits one leave notice to remaining room members. Repeated
joins/leaves are idempotent. A room join acknowledgement returns its snapshot;
history remains the history owner's integration work. Server transport channels
use `roomChannel(roomId)` / `room_channel(room_id)` with a `chat:room:` prefix.

## Messaging handoff

`message:send` takes `{roomId,content}`. Authorise the sender's membership,
validate/sanitise content on the server, then broadcast `message:received` to the
correct room. A successful sender acknowledgement follows successful broadcast.
The server supplies `messageId`, `senderId` and `createdAt`.

The SRS limit is 2000 characters; 2001 must be rejected. The prepared sanitisation
helper counts Unicode code points before stripping markup, rejects unpaired
surrogates and unsafe controls, strips all HTML tags and dangerous non-text
containers, and escapes remaining HTML-sensitive text. It rejects empty output.
Shared vectors live in contracts/input-vectors.json. Username validation rejects
anything outside 1-32 ASCII letters/digits/dot/underscore/hyphen instead of
silently renaming an account. These defaults need team review. Do not decode
entities and inject the result into HTML. Persistence still requires parameterised
operations; HTML sanitisation is not SQL-query protection.

## Review decisions still needed

24 October follow-up: room store/transport errors are rolled back together, with
disconnect if repair fails. Node caps outstanding room events at 64 per socket;
Python uses at most three 50 ms room-lock waits and revalidates outside the global
lock after contention. Saturation returns RATE_LIMITED. These operational bounds
are proposed defaults requiring review, not agreed SRS capacity promises.

Unknown authenticated events acknowledge NOT_FOUND. Expiry/revocation emits
system:error and disconnects; callbacks are not guaranteed after disconnect.
Keep fresh validation after a queue/transport wait. Store canonical sanitized
message output once; do not run the same escaping again when persisting history.
The UI owner must agree readable entity rendering without injecting decoded
untrusted HTML. Rendered-XSS acceptance and persistence remain pending.

Only POST /api/auth/login consumes the IP limit, including successful logins.
Registration, refresh/logout and socket handshakes are not automatically limited.
Adding those routes requires an explicit reviewed policy and tests. Credential
lockout remains a separate per-account requirement. Agree an explicit browser
origin policy before deploying a UI on a different origin. Default development
launchers are not evidence of a production origin/monitoring policy.

- [ ] Authentication owner confirms token claims, signing and revocation interface.
- [ ] Room and messaging owners accept event names and acknowledgement envelopes.
- [ ] Team agrees on member-count and room-name/lifecycle rules.
- [ ] Team agrees on Unicode length and sanitisation semantics.
- [ ] Changes are recorded in this document and the JSON reference together.
