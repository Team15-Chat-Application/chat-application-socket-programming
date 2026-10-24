# Shared interface contract - proposed v0.1

Prepared for team review on 02 October 2026. This is a concrete proposal, not a
claim that teammates have approved it. `contracts/events.json` is the matching
event reference. Only HTTP health and the guarded diagnostic `system:ping` are
implemented today; the auth/room/message routes and events below are planned.

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
The auth owner must confirm the signing algorithm and secret/key configuration;
this setup does not choose or implement JWT signing.

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

Password hashing is Soham's shared helper integrated with Hrisheek's auth module:
bcrypt cost >=10. Login rate limiting is five attempts/minute/IP with HTTP 429
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
implemented by this setup.

## Messaging handoff

`message:send` takes `{roomId,content}`. Authorise the sender's membership,
validate/sanitise content on the server, then broadcast `message:received` to the
correct room. A successful sender acknowledgement follows successful broadcast.
The server supplies `messageId`, `senderId` and `createdAt`.

The SRS limit is 2000 characters; 2001 must be rejected. The team must settle
Unicode counting semantics consistently across Node, Python and tests before
implementation. Use one shared sanitisation policy with Soham's CHAT-SR-005 and
Yaswanth's CHAT-F-008. Display text safely in the future browser UI.

## Review decisions still needed

- [ ] Authentication owner confirms token claims, signing and revocation interface.
- [ ] Room and messaging owners accept event names and acknowledgement envelopes.
- [ ] Team agrees on member-count and room-name/lifecycle rules.
- [ ] Team agrees on Unicode length and sanitisation semantics.
- [ ] Changes are recorded in this document and the JSON reference together.
