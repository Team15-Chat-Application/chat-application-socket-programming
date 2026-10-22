# Sprint 1 review and working-product demo checklist

Prepared 22 October for the 23 October outcome. Owners and policies remain
proposed pending genuine team agreement. No recording or product acceptance
exists in this checklist. The course window is 19-23 October; actual Jira
activation was 22 October and must be explained as an administrative delay.

## Current readiness gate

- [x] Room/security component implementation and normal/boundary/negative tests.
- [x] Real default-launcher health, unavailable-login, rate-limit and socket-denial probes.
- [x] Reproducible component commands and requirement/test mapping prepared.
- [ ] Obtain and inspect Hrisheek's own authentication/session PR and tests.
- [ ] Obtain and inspect Yaswanth's own messaging PR and tests.
- [ ] Wire real login/JWT issuance/revocation and actual message handlers into launchers.
- [ ] Supply a usable browser/demo client, with an agreed owner and real credentials.
- [ ] Run integrated acceptance, review test cases and resolve defects.
- [ ] Obtain genuine repository-owner reviews before merging the dependency stack.
- [ ] Record, upload and verify the real one-minute working-product video.

Do not replace missing login with a test token generator, bypass auth guards or
use test:room-probe as message delivery. A green component run is useful evidence
but does not open the recording/acceptance gate. If networking is unavailable,
record remote review/PR checks as unavailable rather than assuming no new work.

## Repeatable verification before the product demo

From the repository root in PowerShell, with the locked dependencies installed:

```powershell
.\scripts\verify_sprint1.ps1
```

This builds both components, runs Jest/Pytest, checks actual launchers on isolated
loopback ports, checks whitespace and writes fresh evidence to reports/sprint1.
It also records the checkout commit and whether it was dirty. It does not install
packages, alter accounts, merge PRs or certify the product. Stop on any failure.
The launcher smoke intentionally expects unavailable auth; when a genuine owner
module is wired in, replace that baseline check with real auth acceptance before
running/filming the product. Do not weaken the assertion merely to obtain green CI.

For the real product, use owner-supplied entry points and documented configuration
from the reviewed commit. Current npm start / scripts/run_flask.ps1 launch only
the fail-closed development baseline. Choose one actual backend per recording;
separate Node and Flask implementations must not be presented as a shared data store.

## Integrated cases to execute when owners deliver

| Case | Procedure | Expected evidence | Current result |
| --- | --- | --- | --- |
| Normal auth | Register two unique demo users, reject duplicate registration; login with correct and wrong passwords | Safe responses, bcrypt hashes, real JWT/session records, no secrets in screenshots | B: auth module absent |
| Lockout boundary | Five consecutive failed logins, attempt during 15-minute lock, retry at expiry | Account rule passes independently of peer-IP limiter; use controlled test time in tests, not a fake video | B: owner module absent |
| Normal room/chat | Login A/B in two separate sessions, A creates/joins room, B joins and sends a real message | Live list/counts, join notice, A receives, B receives acknowledgement after broadcast | B: auth/message/client integration absent |
| Isolation/identity | C remains outside; forge sender ID and unknown/internal room ID | No unauthorized delivery or identity override; safe errors | B: real messaging absent; component routing checks pass |
| Input boundaries | Send 2000 and reject 2001 raw Unicode code points; repeat with emoji and malformed inputs | No broadcast for rejected content; valid content survives | B: message call site absent; helper checks pass |
| XSS | Send script/encoded markup in an isolated demo room | Safe text at sender/receiver, no script execution or entity decoding into HTML | B: messaging/UI absent; helper corpus passes |
| Session lifecycle | Logout B; try old token against room/message/unknown events; repeat expiry/tampering | Rejected/disconnected before mutation; live lookup observes revocation | B: actual logout/issuance absent; verifier checks pass |
| Multiple tabs | Open B's second tab; leave first, then final tab | One distinct member until final departure, one final leave notice | B: real client/auth absent; component tests pass |
| HTTP rate limit | Six attempts from same peer in a sliding minute; independent second peer | Five admitted to handler, sixth HTTP 429/Retry-After; spoofed XFF cannot bypass | B: real login absent; limiter and actual baseline launcher checks pass |
| Delivery timing | Measure real TC-Msg-01 normal-load sends with elapsed monotonic timing | Record hardware, backend, sample count and p90; target <=200 ms | B: business message handler absent |

For each executed case retain actual date/time, backend, commit, test report,
result, defect/reproduction link if failed, and human reviewer. Re-run only the
cases affected by fixes plus the relevant regression suite; do not invent results.

## One-minute recording sequence - Yaswanth coordinates

Only begin after the real product readiness gate passes:

| Video time | Actual action |
| --- | --- |
| 0-10 seconds | Identify Sprint 1, real commit/backend and show two real signed-in users |
| 10-25 seconds | Create/join a room; show live list/count and join notification |
| 25-45 seconds | Send a normal message; show receipt on the other user and sender acknowledgement |
| 45-55 seconds | Leave/logout and show the resulting membership/session behavior |
| 55-60 seconds | State delivered scope and any genuine limitations |

Use intentional demo data. Do not capture passwords, raw JWTs, signing secrets or
private sessions. The exact sequence is a rehearsal proposal, not footage. If a
feature is incomplete, state that fact rather than showing a fabricated result.

## Review, publication and close-out

- [ ] Yaswanth reviews test cases and records actual QA findings.
- [ ] Module owners review the shared contract and pending policy decisions.
- [ ] Repository owners review #22 -> #23 -> #43 -> #44 and owner feature PRs;
  retarget dependent branches only as required after actual approved merges.
- [ ] Verify build/tests and smoke evidence on the exact final integrated commit.
- [ ] Reconcile SPRINT_1_TRACEABILITY.md, defects, real contributions and Jira/Project statuses.
- [ ] Link the actual test summary and genuine sign-off; leave unsupported items In Review/blocked.
- [ ] Record one minute of genuine execution and upload the file to the repository.
- [ ] Verify playback/access, actual duration, file path, commit and CHAT-43 evidence.
- [ ] Record missing scope/deviations for the final demo; do not silently waive the SRS.

No teammate is messaged or assigned new work by this checklist. No review,
acceptance, merge or video upload is claimed without verified evidence.
