# Common Room — Team 15 Chat Application

A working browser chat application with equivalent Node/Socket.IO and Python/Flask-SocketIO backends. Register/sign in, create/join/leave rooms, exchange safe text messages, see online members/typing, receive unread badges, and recover the latest 50 messages after restart. SQLite stores accounts, revocable sessions, rooms, messages and per-recipient read receipts.

## Run

Requires Node **24**, Python **3.12** for the secondary backend, and Git. In PowerShell at the repository root:

```powershell
npm ci
npm run setup
npm start
```

Open **http://127.0.0.1:3000**, create an account, and use a second browser profile for another user. Setup creates an ignored `.env` with a random signing secret. Preserve it and `data/` across restarts; never commit either. No external database or native SQLite build toolchain is required.

For the equivalent Python backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python_backend/requirements-dev.lock.txt
.\scripts\run_flask.ps1
```

Open **http://127.0.0.1:5000**. These are independent alternative servers with separate default databases, not a horizontally scaled cluster or hosted production deployment.

## Verify

```powershell
npm run build
npm test
.\.venv\Scripts\python.exe -m pytest python_backend/tests -q
npm run browser:install
npm run test:browser
node scripts/system_check.js
node scripts/performance_check.js
.\.venv\Scripts\python.exe scripts/generate_test_tls.py
node scripts/tls_check.js
```

On 28 October 2026, **249 Node tests, 255 Python tests and 2 browser tests passed**. Actual network tests also passed against both launchers, including real account issuance and history/read receipts/logout revocation surviving process restart. Local receiver p90 was **10.44 ms** with 50 users and 100 concurrent WebSocket connections. These are scoped measurements, not WAN/monthly availability guarantees.

GitHub Actions builds/tests both backends on pushes and PRs, retains reports/build artifacts, and runs browser/accessibility, real network/restart, load and TLS checks. CI/CD owner: Jamula Soham Rao. Read hosted results at the actual PR/branch head; local results are separate evidence.

## Delivery

- [Setup, configuration and operations](docs/DEVELOPMENT.md)
- [Current architecture, traceability, evidence and limitations](docs/DELIVERY_2026_10_28.md)
- [Owner handoff and final review checklist](docs/FINAL_HANDOFF.md)
- [One-minute Sprint 1 outcome — recorded 28 October, late delivery](https://github.com/Team15-Chat-Application/chat-application-socket-programming/blob/CHAT-43-46-outcome-handoff/videos/sprint-1-outcome-2026-10-28.webm)
- [Two-minute Sprint 2 outcome — recorded 28 October](https://github.com/Team15-Chat-Application/chat-application-socket-programming/blob/CHAT-43-46-outcome-handoff/videos/sprint-2-outcome-2026-10-28.webm)
- [Technical execution evidence](docs/evidence/2026-10-28/)
- [GitHub Project](https://github.com/orgs/Team15-Chat-Application/projects/1)
- [Part 2 plan and proposed estimates](docs/PART_2_PLAN.md)
- [Historical deviation log](docs/DEVIATIONS.md)

The adopted calendar is Sprint 1 **19–23 October** and Sprint 2 **26–30 October 2026**. Earlier dated documents remain historical snapshots. The current delivery record supersedes their statements that authentication, persistence or the UI are missing. Human review, full accessibility sign-off, a full-month availability record and formal release/freeze remain distinct acceptance steps. No signatures or earlier completion dates are invented.
