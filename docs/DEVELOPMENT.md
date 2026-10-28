# Development and operation

Current 28 October 2026. Use Node 24 and Python 3.12. Install locked dependencies with `npm ci` and `python -m pip install -r python_backend/requirements-dev.lock.txt` in a virtual environment. Node uses built-in SQLite, so Windows C++ build tools are unnecessary.

## Setup and launch

```powershell
npm ci
npm run setup
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python_backend/requirements-dev.lock.txt
npm run build
```

Run `npm start` (port 3000) or `.\scripts\run_flask.ps1` (5000). Both serve the browser at `/` and health at `/api/health`. Use separate browser profiles for separate users. JWTs remain in page memory; reloading requires sign-in. Accounts/rooms/messages/receipts persist; live membership resets. History returns the latest 50 messages in chronological insertion order. Older database records are retained.

`npm run start:built` runs the built Node server and copied assets. `npm run dev` watches source. Stop with Ctrl+C. Preserve `.env` and the database across restarts. Back up while stopped, retaining WAL/SHM files if present. Restoring with the same signing secret preserves unexpired sessions/revocations.

The Python PowerShell launcher reads whitelisted `.env` values. On Linux, export the locally generated `.env` values before `PYTHONPATH=python_backend .venv/bin/python -m chat_backend`. Only source trusted local configuration. Defaults are `data/chat.sqlite` and `data/flask.sqlite`. `NODE_DB_PATH`/`FLASK_DB_PATH` override them; `CHAT_DB_PATH` is a fallback. The backends are independent alternatives. Membership, rate limits and broadcasts remain process-local.

## Configuration / TLS

See `.env.example`. Setup generates a random `JWT_SECRET` when it is missing, preserving an existing secret and the rest of the configuration. A missing/short secret leaves development authentication unavailable. Never reuse isolated test secrets.

Set both `TLS_CERT_PATH` and `TLS_KEY_PATH` to enable TLS. Both launchers reject `NODE_ENV=production` without TLS and a secret of at least 32 bytes. Minimum protocol is TLS 1.2. Flask/Werkzeug remains a development server even when demonstrating TLS; production hosting, trusted certificates, workers, backups and monitoring require a deployment decision.

`scripts/generate_test_tls.py` uses OpenSSL (including Git for Windows' bundled version) for an ignored short-lived localhost certificate. The TLS check explicitly trusts only that certificate, verifies 1.2/1.3 and authenticated WSS, and rejects plaintext/legacy TLS. No system trust is changed or certificate verification disabled. Never publish the private key.

## Tests / reports

```powershell
npm test
.\.venv\Scripts\python.exe -m pytest python_backend/tests --junitxml=reports/python.xml
npm run browser:install
npm run test:browser
node scripts/system_check.js
node scripts/performance_check.js
.\.venv\Scripts\python.exe scripts/generate_test_tls.py
node scripts/tls_check.js
.\.venv\Scripts\python.exe scripts/smoke_startup.py --report reports/launcher-smoke.json
```

`system_check.js` starts both real launchers with isolated file databases, obtains HTTP credentials, sends WebSocket messages, restarts each process and checks history/receipts/revocation. Smoke separately checks health, invalid login, sixth-attempt 429 and unauthenticated rejection; that narrow result alone does not certify the product. Python suites include in-process clients and cross-runtime bcrypt checks; the system script adds actual Python WebSocket transport.

The browser suite uses real registration/login, two isolated users and axe-core WCAG 2.1 A/AA rules. It checks safe rendering, typing, receipts, unread badges, message length, logout, mobile login and keyboard focus. A manual assistive-technology/accessibility audit remains necessary.

Against an actual running instance:

```powershell
.\.venv\Scripts\python.exe scripts/monitor_uptime.py --url http://127.0.0.1:3000/api/health --seconds 60 --interval 5
```

Real JSONL observations and summary go under `reports/`. Short samples explicitly report monthly acceptance `NOT_ESTABLISHED`. Retain a full operational calendar-month record to evaluate 99.5% availability; never extrapolate a brief local sample.

## CI / contributions

The push/PR workflow installs pinned dependencies, builds both backends and runs unit/integration, real launcher/system, browser/accessibility, delivery/load and TLS checks. Reports and build artifacts are uploaded. Hosted results must be verified at the actual branch/PR head. Resolve failures at the actual head. Use genuine Jira keys in branches/commits/PRs and preserve authorship. Assigned members raise their own PRs; owners review/merge; QA Lead reviews test cases/execution. Requested review, automated review and green CI are not human approval. See `FINAL_HANDOFF.md`.


## Reproducible review fixture

Run `node scripts/seed_review.js --check` for the STP's isolated 10-user/5-room/200-message dataset and overwrite/path/password guards. The check also runs in Node CI. For an interactive fixture with a privately chosen dummy password, follow [OPERATIONS_REVIEW.md](OPERATIONS_REVIEW.md); existing databases are never replaced and seeded states are not transport/UAT proof.
