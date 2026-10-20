# Soham room and security integration handoff

Prepared 20 October 2026 for the existing assigned owners. This is a concrete
integration proposal, not evidence of their agreement or contribution.

## Authentication handoff for Hrisheek

Node exports `createJwtAuth({secret, findSession})` from `src/jwt-auth.js`.
Python exports `JwtAuth(secret=..., find_session=...)` from
`chat_backend.jwt_auth`. The verifier permits HS256 only, issuer `team15-chat`
and audience `chat-application`, and requires `sub`, `jti`, `iat`, `exp`, `iss`
and `aud`. Identity claims must be nonempty strings; issuance/expiry must be
integer Unix seconds. Configuration requires an external secret of at least
32 UTF-8 bytes. No production secret or signing fallback is supplied.

Session lookup receives `jti` and returns a record with `sessionId`, `userId`,
`expiresAt` in integer Unix seconds and explicit `revokedAt:null` for a live
session. Unknown, expired, revoked or mismatched records fail closed. The Node
lookup may return a promise; the Python lookup is synchronous. Logout must
persist revocation so the next event's lookup sees it. The helpers verify
signature, time, identity and revocation on every validation.

```javascript
const { createJwtAuth } = require('./jwt-auth');
const { createApplication } = require('./app');
const auth = createJwtAuth({
  secret: process.env.JWT_SECRET,
  findSession: sessionId => sessionRepository.findById(sessionId)
});
const application = createApplication({ auth, loginHandler: handleLogin });
```

The repository/session/login names in this example are owner-supplied integration
points, not existing implementations. A Node `loginHandler(req,res)` must finish
the HTTP response. The Flask factory accepts a zero-argument `login_handler`
that returns a Flask response. Both factories limit POST `/api/auth/login` before
calling it. Without the handler, the route remains unavailable (404 for the first
five attempts, then 429). The sixth attempt in a sliding minute is rejected with
RATE_LIMITED and Retry-After. Forwarded headers are ignored; use a reviewed
trusted-proxy/shared-store design before deploying multiple processes.

Use the existing bcrypt helpers for passwords and call
`sanitizeUsername` / `sanitize_username` at the credential boundary. This helper
rejects malformed names rather than silently changing a username; uniqueness
must still be enforced by registration persistence. Account lockout remains
separate from IP limiting. The default CLI launchers stay fail-closed until the
real adapter is wired in; do not replace that with fixture authentication.

## Messaging handoff for Yaswanth

Inject/reuse the same RoomStore instance used by the application factory. Node
exports `roomChannel(roomId)`; Python exports `room_channel(room_id)`. Broadcast
to that server-only transport channel, not to a raw room ID or client socket ID.
The application catalogue excludes Socket.IO's internal rooms. Use
`rooms.hasSocket(roomId,socket.id)` or `rooms.has_socket(room_id,request.sid)`
to require that this actual socket has joined before sending. Payload user IDs
cannot override the identity established from the verified token.

`room:join` returns `{roomId,name,memberCount}`. A user's first joined socket
causes one `room:membership` join event; their final leave/disconnect causes one
leave event to remaining members. Extra tabs and repeated operations do not
inflate counts. Catalogue subscribers are authenticated sockets and receive
`room:list-updated` on connection and relevant changes. Empty rooms remain until
restart. These are proposed defaults requiring team review.

Call `sanitizeMessage(content)` / `sanitize_message(content)` before persisting
or broadcasting messages. It accepts at most 2000 raw Unicode code points,
rejects malformed values, strips HTML tags and dangerous content containers,
escapes HTML-sensitive text, and rejects empty output. Preserve the escaped
value as data; do not decode it and inject it into HTML. Agree on readable UI
entity handling with the frontend owner. Shared examples are in
`contracts/input-vectors.json`. Use parameterised persistence operations;
HTML sanitisation alone does not protect SQL/NoSQL query construction.

The existing Node factory invokes `registerHandlers(io,socket)` after its
authentication middleware. Flask business handlers must retain the
validate-before-dispatch rule used in `app.py`; the catch-all protects unknown
events but does not wrap newly registered known handlers automatically.

## Review and evidence

Yaswanth remains QA Lead for test-case review. The room-routing probe in tests
is deliberately test-only: it is not a replacement for message:send, history,
delivery acknowledgements or the working-product video. The 21 October session
must extend security edge-case coverage and inspect real owner modules if they
are available. Refer to SPRINT_1_DAILY_EXECUTION.md for the dated plan and results.

Primary implementation references consulted: [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken),
[PyJWT](https://pyjwt.readthedocs.io/en/stable/api.html),
[sanitize-html](https://www.npmjs.com/package/sanitize-html) and
[nh3](https://nh3.readthedocs.io/en/stable/index.html).
