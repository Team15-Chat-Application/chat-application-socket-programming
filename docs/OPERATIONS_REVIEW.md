# Operational and review runbook

Prepared by Soham, 28 October 2026. Covers the runnable local product and preparation for operational acceptance; no hosted deployment, full-month SLA or human sign-off is claimed.

## Isolated Test Plan fixture

The STP environment specifies 10 dummy users, 5 rooms and 200 messages. The new tool prepares exactly that dataset under ignored `reports/review-fixtures/`. It uses actual registration/bcrypt storage, verifies a login/revocation round trip and seeds explicit synthetic message/receipt states. It refuses an existing filename and restricts names to that fixture directory. It never replaces `data/` or prints passwords/tokens.

Run the automated preparation/guard check:

```powershell
node scripts/seed_review.js --check
```

This writes a scoped `reports/seed-review.json`; its random-password fixture is for the automated check. To create a separate fixture you can log into, choose and retain a private dummy password without putting it in shell history:

```powershell
$fixturePassword = Read-Host 'Choose a password for isolated dummy accounts' -AsSecureString
$env:REVIEW_SEED_PASSWORD = ([pscredential]::new('fixture', $fixturePassword)).GetNetworkCredential().Password
try { node scripts/seed_review.js --name review.sqlite }
finally { Remove-Item Env:REVIEW_SEED_PASSWORD -ErrorAction SilentlyContinue }
$env:NODE_DB_PATH = 'reports/review-fixtures/review.sqlite'
$env:NODE_PORT = '3001'
npm start
```

Open `http://127.0.0.1:3001`. Sign in as `seed_user_01` through `seed_user_10` using the dummy password you chose. Stop with Ctrl+C; clear the two environment overrides before returning to your normal server:

```powershell
Remove-Item Env:NODE_DB_PATH, Env:NODE_PORT -ErrorAction SilentlyContinue
```

Existing fixture files are preserved; choose a fresh `--name` for another run. Never use dummy credentials/data as a production installation. Fixture status labels are test data, not evidence that those 200 messages traversed WebSockets.

## Review and defect reproduction

Follow DEVELOPMENT.md and the current PR checks. Source owners independently review current changes under their own identities. Run both backend suites, real system/restart, browser, performance and TLS scripts. The seed check is part of the Node CI job. New Node lockout cases in `tests/unit/auth.test.js` control bcrypt interleaving to cover lost failure increments after expiry and a fresh lock appearing during a valid comparison; they failed on the original code and now pass.

File defects with exact requirement/test ID, commit, environment, steps, expected/actual behavior and severity. Record authentic fixes/retests and genuine reviewer outcomes. Yaswanth owns final QA synthesis under CHAT-50. Hrisheek supplies independent review and manual/Firefox accessibility evidence under CHAT-38/52. Full browser compatibility, assistive technology, admin/private functionality and unexecuted scanning tools are not silently certified by Chromium/axe.

## Availability and TLS evidence

Select an actual service and observation owner before evaluating monthly availability. Keep the original requirement and genuine team/course decisions visible if the review date precedes a complete operational month. Do not extend six healthy samples to a 99.5% monthly pass.

Against the chosen running instance, collect real observations:

```powershell
.\.venv\Scripts\python.exe scripts/monitor_uptime.py --url http://127.0.0.1:3000/api/health --seconds 60 --interval 5
```

The bounded command demonstrates the sampler; use an appropriately operated monitoring process for the agreed full window. Retain JSONL samples, actual start/end dates, sample gaps, failures, maintenance exclusions and deployment changes. Compare coverage and failures against the calendar month before calculating an accepted SLA. Current summary deliberately reports `monthlyAcceptance: NOT_ESTABLISHED`. Process restarts and unobserved intervals must not be reported as healthy. A hosting/service decision is still required; no recurring monitor or paid deployment is silently created.

For a real production listener, configure an appropriate certificate/key and private signing secret; both runtimes enforce minimum TLS 1.2 and fail-closed startup. Validate the deployed certificate chain and actual HTTP/WebSocket rejection behavior from an independent client. The supplied short-lived localhost certificate explicitly tests local TLS/WSS, not public-CA deployment. Multi-worker broadcasts/membership and shared proxy/IP limiting require separate design decisions.

## Backup, secrets and final freeze

Keep `.env`, databases, WAL/SHM files and private keys out of Git/artifacts. Stop the selected server before a file backup and preserve the corresponding database state and signing configuration securely. Test restoration against an isolated copy; do not replace a live database to demonstrate it. Secret rotation invalidates prior JWT signatures; do not promise session preservation across an unrelated new key.

After genuine reviews and defect/scope decisions, merge the member-owned history/video work and integration candidate in the documented order. Verify all jobs on the actual final merged commit. Record that commit, authentic approval references, remaining explicit deviations, final documents/videos and actual freeze date. CHAT-48 stays open until that happens; a prepared checklist is not a release approval.
