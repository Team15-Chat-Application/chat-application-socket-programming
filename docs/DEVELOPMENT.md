# Development setup

The project supplies development servers, room creation/join/leave, live
membership/catalogue updates, bcrypt helpers, unit/integration tests and CI.
JWT verification, login limiting and sanitisation helpers are prepared for
security verification and owner integration. Login/registration, session storage,
messaging, persistence and the browser UI remain feature work. Both launchers
reject socket authentication by default.

## Runtime decision

Use Node.js 24 LTS and Python 3.12. Local validation uses Node 24.15.0 and Python
3.12; CI installs those same major/minor lines. The SRS specifies Node 18+ and
Python 3.10+. The STP's original Node 18/Python 3.10 environment is updated for this
development baseline: Node 18 is now end-of-life. Other Python versions are not
claimed tested. See https://nodejs.org/en/about/previous-releases.

## Fresh Windows checkout

Run these commands in PowerShell from the repository root, with Node 24, npm,
Python 3.12 and Git installed. No global Python packages are required.

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
python -m venv .venv
if ($LASTEXITCODE -ne 0) { throw 'venv creation failed' }
.\.venv\Scripts\python.exe -m pip install -r python_backend\requirements-dev.lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Node build failed' }
.\.venv\Scripts\python.exe -m compileall -q python_backend\chat_backend
if ($LASTEXITCODE -ne 0) { throw 'Python build failed' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Node tests failed' }
.\.venv\Scripts\python.exe -m pytest
if ($LASTEXITCODE -ne 0) { throw 'Python tests failed' }
```

`package-lock.json` and `requirements-dev.lock.txt` pin the installed dependency
versions. Use `npm ci`, not a fresh dependency resolution, for a clean checkout.
The Python input ranges are in `requirements-dev.txt`; refresh the lock deliberately
when upgrading. `.venv`, `.env`, `node_modules`, build files and reports are ignored.

## Start both servers

In one PowerShell terminal, from the repository root:

```powershell
npm start
```

In another terminal, from the same directory:

```powershell
.\scripts\run_flask.ps1
```

Health URLs:

- Node: http://127.0.0.1:3000/api/health
- Flask: http://127.0.0.1:5000/api/health

Both return the same `{ok,data}` envelope and identify themselves as a development
foundation. `npm run dev` watches Node source changes. `npm run start:built` runs
the syntax-checked copy under `dist/`. Stop the terminals with Ctrl+C.

The Flask launcher uses Werkzeug for local development only. The launchers do not
provide production TLS, deployment, or production-readiness evidence.

## Linux / CI equivalent

```bash
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r python_backend/requirements-dev.lock.txt
npm run build
.venv/bin/python -m compileall -q python_backend/chat_backend
npm test
.venv/bin/python -m pytest
PYTHONPATH=python_backend .venv/bin/python -m chat_backend
```

## Modules and extension points

| Location | Intended use |
| --- | --- |
| `src/app.js` | Primary HTTP/Socket.IO factory and safe dispatch boundary |
| `src/config.js` | Validated local host/port configuration |
| `src/rooms.js` | Named-room store and guarded Socket.IO create/list handlers |
| `src/jwt-auth.js` | Prepared HS256 verification adapter with fresh session lookup |
| `src/login-limit.js` | Sliding five-per-minute peer-IP login limit |
| `src/input.js` | Shared username/message/room text validation and sanitisation |
| `src/passwords.js` | Asynchronous bcrypt hash/verify helpers |
| `python_backend/chat_backend` | Secondary Flask-SocketIO factory and launcher |
| `contracts/events.json` | Proposed shared event names and envelopes |
| `docs/INTERFACE_CONTRACT.md` | Authentication, room and messaging handoffs |
| `tests/unit`, `tests/integration` | Jest unit and real-transport integration tests |
| `python_backend/tests` | Pytest unit, Flask-SocketIO in-process and Node/Python bcrypt interoperability tests |

Hrisheek supplies the authentication adapter; Soham supplies room handlers and
coordinates shared security helpers; Yaswanth supplies messaging handlers.
These follow the existing Jira allocation, which remains proposed until team
review. Legacy injected auth fixtures remain isolated transport fixtures. New
membership tests use the actual JWT verifier with signed test tokens and an
in-memory test session lookup; they do not implement registration/login or a
production session store. See SOHAM_INTEGRATION_HANDOFF.md for factory signatures.

Jest scripts enable Node's VM module support because the locked sanitizer uses
an ESM parser. This affects the test runner only; the Node 24 application uses
native module loading. Keep the locked dependency versions when reproducing CI.

The Python integration suite now requires Node and installed npm dependencies
because it verifies hashes across both runtimes. The Python CI job explicitly
installs Node 24 and runs `npm ci`. Pytest importlib mode allows unit/integration
files to share basenames without collection collisions. For targeted room/hash
checks and auth-owner integration signatures, see [04 October handoff](OCT_04_PROGRESS.md).

## CI ownership and delivery

CI/CD owner: **Jamula Soham Rao**, explicitly selected by the user on 02 October
2026. Workflow: `.github/workflows/ci.yml`. Every push and pull request installs
locked dependencies, builds/checks both components and runs all available unit
and integration tests. Test reports and successful build artifacts are uploaded.
Build/test failures fail the job and must be fixed before further development.

Delivery currently means downloadable development build artifacts. No deployment
destination has been chosen. Production deployment is a later explicit decision.

## How a teammate contributes

Create a branch containing the actual Jira key, commit code and its relevant
tests, open a PR, and link it in Jira. Use your own identity. Review the contract
before implementing event handlers and document any change to payloads.
Yaswanth (kalluri088) and Hrisheek (hrisheekkaraturi) currently have repository
read access and can use fork PRs under their own identities. Part 2 requires
the assigned member to raise the PR and repository owners to review and merge.
See [the current Part 2 calendar and backlog](PART_2_PLAN.md).
