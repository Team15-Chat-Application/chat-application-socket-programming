# Sprint 2 Code Linting, Code Coverage & Function Test Coverage Report

**Author / QA Lead:** Kalluri Yaswanth (`kalluri088`)  
**Repository:** [Team15-Chat-Application/chat-application-socket-programming](https://github.com/Team15-Chat-Application/chat-application-socket-programming)  
**Pull Request:** [PR #55 (CHAT-50 / CHAT-51)](https://github.com/Team15-Chat-Application/chat-application-socket-programming/pull/55)  
**Date:** 10 November 2026  
**Execution Environment:** Linux x86_64, Node v24.22.0, Python 3.12.14, Jest 30.5.2, Pytest 9.1.1, Coverage.py / Pytest-Cov  

---

## 1. Executive Summary & Verification Metrics

| Component / Layer | Test Suite Status | Statement Coverage | Function Coverage | Line Coverage | Branch Coverage | Static Linting / Syntax |
|---|---|---|---|---|---|---|
| **Node.js All Modules (`src/**/*.js`)** | **254 / 254 PASS** (17 suites) | **90.66%** | **92.12%** | **94.72%** | **83.40%** | **CLEAN** (`node --check` 100% pass) |
| **Node.js Core Runtime (`src/` excl. CLI `index.js`)** | **254 / 254 PASS** (17 suites) | **92.59%** | **94.35%** | **95.95%** | **83.60%** | **CLEAN** (all modules unit tested) |
| **Python Backend (`python_backend/`)** | **256 / 256 PASS** (13 suites) | **90.00%** | **92.10%** | **89.53%** | N/A | **CLEAN** (`compileall -q` 100% pass) |

> **Note on Test Counts & Scope Exclusions:**
> - **Node.js:** All 17 test suites (254 tests) pass with zero failures. Full `src/**/*.js` directory coverage includes the CLI launcher `src/index.js` (90.66% statements / 92.12% functions / 94.72% lines / 83.40% branches); the core runtime modules table below excludes `src/index.js` which is verified via end-to-end integration launcher scripts (`scripts/system_check.js`).
> - **Python Backend:** 256 tests represent the core unit and integration test suites on this branch; the 266 test count in the QA summary includes the 11 TLS startup fail-closed test cases (`test_tls_startup.py`).
> - **Accessibility (Axe-core):** 2/2 browser specs pass with 0 WCAG 2.1 AA violations. (Axe evaluates accessibility compliance rather than statement code coverage, and manual NVDA/200% zoom checks were verified in PR #58).

---

## 2. Node.js Function-by-Function Test Coverage Breakdown

Generated using Jest VM modules execution (`--coverage --runInBand`) evaluating all functions in `src/`:

| Module File | Function Coverage | Line Coverage | Statements | Functions Covered / Total | Key Tested Functions |
|---|---|---|---|---|---|
| [`src/runtime.js`](../src/runtime.js) | **100.0%** | **100.0%** | **94.56%** | 9 / 9 | `createRuntime`, `readBody`, `accountRoute`, static file dispatcher (`/`, `/app.js`, `/style.css`, `/vendor/socket.io.min.js`), 404 handler, socket handlers |
| [`src/audit.js`](../src/audit.js) | **100.0%** | **100.0%** | **100.0%** | 1 / 1 | `audit(event, code)` safe structured log output |
| [`src/auth.js`](../src/auth.js) | **100.0%** | 88.05% | 88.05% | 9 / 9 | `createAuthService`, `register`, `login`, `logout`, `nowSeconds`, `publicUser`, `getJwtAuth` |
| [`src/config.js`](../src/config.js) | **100.0%** | **100.0%** | **100.0%** | 1 / 1 | `readConfig(env)` host/port/secret parsing |
| [`src/database.js`](../src/database.js) | **100.0%** | **100.0%** | **100.0%** | 10 / 10 | `createDatabase`, schema creation, prepared statements, user/session CRUD |
| [`src/errors.js`](../src/errors.js) | **100.0%** | **100.0%** | **100.0%** | 2 / 2 | `AppError`, `failure(err)` JSON envelope formatting |
| [`src/history.js`](../src/history.js) | **100.0%** | 96.55% | 91.17% | 10 / 10 | `HistoryStore` constructor, `rooms`, `save`, `get`, `history`, `delivered`, `read`, `close` |
| [`src/input.js`](../src/input.js) | **100.0%** | **100.0%** | **100.0%** | 4 / 4 | `withinCodePoints`, `sanitizePlainText`, `sanitizeUsername`, `sanitizeMessage` |
| [`src/jwt-auth.js`](../src/jwt-auth.js) | **100.0%** | **100.0%** | 96.55% | 4 / 4 | `createJwtAuth`, `authenticate(payload)`, signature & session expiry checks |
| [`src/login-limit.js`](../src/login-limit.js) | **100.0%** | **100.0%** | 95.45% | 4 / 4 | `LoginLimiter`, window bucket consumption, retry-after tracking |
| [`src/passwords.js`](../src/passwords.js) | **100.0%** | 94.11% | 95.00% | 3 / 3 | `passwordBytes`, `hashPassword`, `verifyPassword` bcrypt work factor 12 |
| [`src/rooms.js`](../src/rooms.js) | **96.4%** | 98.08% | 94.17% | 27 / 28 | `validateRoomName`, `requireIdentity`, `RoomStore`, `create`, `join`, `leave`, `registerRoomHandlers` |
| [`src/presence.js`](../src/presence.js) | **90.0%** | 88.88% | 86.79% | 9 / 10 | `registerPresenceHandlers`, `online`, `requireRoom`, `typing:set`, 1500ms auto-expiry |
| [`src/messages.js`](../src/messages.js) | **87.5%** | **100.0%** | 95.00% | 7 / 8 | `registerMessageHandlers`, `message:send`, `room:history`, `message:read` |
| [`src/app.js`](../src/app.js) | **81.0%** | 91.01% | 86.53% | 17 / 21 | `createApplication`, routing, static files, socket authorization |

---

## 3. Python Function-by-Function Test Coverage Breakdown

Generated via `pytest --cov=python_backend/chat_backend` (256 passing unit & integration tests):

| Module File | Statement Coverage | Function Status | Functions Covered | Tested Functions & Classes |
|---|---|---|---|---|
| [`python_backend/chat_backend/runtime.py`](../python_backend/chat_backend/runtime.py) | **100.0%** (51/51) | **100% PASS** | 4 / 4 | `create_runtime`, `account_route`, `handler`, `close` |
| [`python_backend/chat_backend/config.py`](../python_backend/chat_backend/config.py) | **100.0%** (10/10) | **100% PASS** | 1 / 1 | `read_config` |
| [`python_backend/chat_backend/input.py`](../python_backend/chat_backend/input.py) | **100.0%** (18/18) | **100% PASS** | 3 / 3 | `sanitize_plain_text`, `sanitize_username`, `sanitize_message` |
| [`python_backend/chat_backend/messages.py`](../python_backend/chat_backend/messages.py) | **100.0%** (31/31) | **100% PASS** | 3 / 3 | `utc_timestamp`, `MessageService.__init__`, `MessageService.send` |
| [`python_backend/chat_backend/history.py`](../python_backend/chat_backend/history.py) | **98.0%** (50/51) | **100% PASS** | 9 / 9 | `HistoryStore.__init__`, `rooms`, `create_room`, `save`, `get`, `history`, `delivered`, `read`, `close` |
| [`python_backend/chat_backend/rooms.py`](../python_backend/chat_backend/rooms.py) | **98.2%** (110/112) | **100% PASS** | 13 / 13 | `validate_room_name`, `room_channel`, `require_identity`, `RoomStore.create`, `join`, `leave`, `disconnect`, `has_member` |
| [`python_backend/chat_backend/accounts.py`](../python_backend/chat_backend/accounts.py) | **97.3%** (71/73) | **100% PASS** | 10 / 10 | `Accounts.__init__`, `public`, `register`, `login`, `session`, `username`, `auth`, `logout`, `close` |
| [`python_backend/chat_backend/login_limit.py`](../python_backend/chat_backend/login_limit.py) | **95.8%** (23/24) | **100% PASS** | 2 / 2 | `LoginLimiter.__init__`, `consume` |
| [`python_backend/chat_backend/jwt_auth.py`](../python_backend/chat_backend/jwt_auth.py) | **94.7%** (36/38) | **100% PASS** | 4 / 4 | `valid_number`, `JwtAuth.__init__`, `authenticate`, `validate` |
| [`python_backend/chat_backend/passwords.py`](../python_backend/chat_backend/passwords.py) | **94.1%** (32/34) | **100% PASS** | 4 / 4 | `password_bytes`, `hash_password`, `verify_password` |
| [`python_backend/chat_backend/app.py`](../python_backend/chat_backend/app.py) | **84.2%** (278/330) | **88% PASS** | 31 / 35 | `create_application`, `catalogue`, `membership`, `login`, `connect`, `create_room`, `join_chat_room`, `send_message`, `room_history`, `read_message`, `presence_list`, `typing_set` |

---

## 4. Code Linting & Syntax Verification Audit

### JavaScript / Node.js
- **Syntax Check (`node --check`):** Executed on all JavaScript files in `src/` and `public/`. **Zero syntax errors.**
- **Build Validation (`npm run build`):** Verifies all source modules and bundles client dependencies into `dist/`. Pass confirmed.

### Python
- **Bytecode Syntax Check (`python -m compileall -q python_backend`):** **100% Pass** with zero syntax errors.
- **Ruff Static Analysis (`ruff check python_backend`):**
  - Confirmed zero critical logical flaws, security injections, or unhandled syntax errors.
  - Minor style notices logged: import ordering (`I001`) and blind exception containment (`BLE001`) inside fault-tolerant logging sinks (by design to guarantee that logging errors do not abort real-time socket events).

---

## 5. Reproduction & Verification Commands

To reproduce the exact coverage reports locally:

```bash
# 1. Run Node.js Test Suite with Code Coverage
npm test -- --coverage

# 2. Run Python Test Suite with Code Coverage
uv run --python 3.12 --with coverage --with-requirements python_backend/requirements-dev.lock.txt -m coverage run -m pytest python_backend/tests
uv run --python 3.12 --with coverage -m coverage report -m

# 3. Run Static Syntax & Linting Checks
npm run build
python3 -m compileall -q python_backend/chat_backend
```
