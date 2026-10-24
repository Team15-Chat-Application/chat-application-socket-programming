# 04 October 2026 - Soham's development handoff

Implemented today's named-room creation task (CHAT-18 / CHAT-F-009 / TC-Room-01)
and, at the user's request, yesterday's bcrypt helper task
(CHAT-34 / CHAT-SR-002 / TC-Sec-02). The module delivery is ready for review;
full application acceptance depends on the real auth module and human review.

## Room creation

Both backends register guarded `room:create` and `room:list`. A valid session can
create `{name:"General"}` and receive `{ok:true,data:{roomId,name,memberCount:0}}`.
Another valid session can query `{}` and see that room. IDs are server UUIDs;
client-supplied room/user IDs are ignored. Each application instance owns its
catalogue, and returned snapshots cannot mutate stored records. Python's store
uses a lock for threaded creation. Invalid names leave the catalogue unchanged;
allocation failures return a safe error without secret details.

Current defaults, awaiting team review: trim ASCII edge whitespace, accept 1-64
Unicode code points, reject controls/unpaired surrogates, allow duplicate display
names with distinct IDs, retain empty rooms until restart. No membership is
created yet. Join/leave, member notifications, live list broadcasts, persistence
and the browser UI remain later tasks. Basic catalogue retrieval supports CHAT-18
acceptance; it does not complete CHAT-21's full live-list requirement.

## Password helpers

Node: `src/passwords.js`, asynchronous `hashPassword` and `verifyPassword`.
Python: `chat_backend.passwords`, `hash_password` and `verify_password`.
Default cost 12, supported operational range 10-14, random salt per hash.
Passwords are strict UTF-8, nonempty, at most 72 bytes, and are never trimmed,
normalised or logged. Longer values are rejected instead of truncated.
Malformed/plaintext/unsupported stored hashes fail verification. Hrisheek must
enforce the SRS registration password rules and store only the hash:

```javascript
const passwordHash = await hashPassword(password);
// Persist passwordHash only; never persist or log password.
const matches = await verifyPassword(password, storedUser.passwordHash);
```

```python
password_hash = hash_password(password)
# Persist password_hash only; never persist or log password.
matches = verify_password(password, stored_user['passwordHash'])
```

## Validation and traceability

Local validation on 04 October 2026 (Windows, Node 24.15.0, Python 3.12.10):

| Check | Result |
| --- | --- |
| Fresh locked `npm ci`, Node build | Passed |
| Node unit / integration | 55 / 12 passed (67 total) |
| Python dependency check and compile | Passed |
| Python unit / integration | 55 / 14 passed (69 total) |
| Real Node and Flask launcher HTTP health | Both passed |

136 tests passed overall; 104 are new cases beyond the 02 October baseline.
An initial combined Pytest collection failure caused by duplicate test basenames
was fixed with importlib mode; the combined suite then passed, followed by the
final separate CI suite commands above.

Local commands use the locked npm/Python dependencies. The room integration
suites cover cross-client visibility, invalid payloads, Unicode names, default
auth denial, session invalidation and safe allocation failures. Node uses actual
HTTP/Socket.IO transport; Flask uses its in-process test client. Unit tests also
cover isolated snapshots, duplicate names, ID collisions and threaded Python
creation. Password tests cover costs, fresh salts, correct/incorrect passwords,
72-byte ASCII/emoji boundaries, overlong/invalid input, NUL suffixes, safe failure
responses and no helper logs. Four interoperability cases use real Node
subprocesses and Python bcrypt to verify hashes in both directions.

Run the full suites from the repository root:

```powershell
npm ci
npm run build
npm test
.\.venv\Scripts\python.exe -m pip install -r python_backend\requirements-dev.lock.txt
.\.venv\Scripts\python.exe -m compileall -q python_backend\chat_backend
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe scripts\smoke_startup.py
```

GitHub CI installs locked dependencies, builds/checks both backends and executes
the unit/integration suites automatically. Actual commit, PR and passing run links
are recorded in the corresponding Jira/GitHub issues after execution; this file
does not treat the existence of a workflow as proof of a passed run.

These tests use explicit auth fixtures. Real JWT signing/validation, registration
storage, and a whole-application plaintext-log audit are still pending. Review
the shared policies and complete those integrations before declaring either SRS
requirement fully accepted. The 03 October work is delivered on 04 October;
commit history and evidence are not backdated.

Next scheduled work: CHAT-19 room joining, followed by leave/notifications and
live room-list updates, with their tests and CI checks alongside implementation.
