# Response to Yaswanth's blocking review — 31 October 2026

Yaswanth (`kalluri088`) submitted a genuine **CHANGES_REQUESTED** review on PR #47 at `577a69e` on 31 October. It is not an approval. The corrections below are implemented by Soham in response to that review and require re-review on the new head.

The review mentions locally prepared fixes on `sprint-2/yaswanth-qa-tls`. That ref was not available in the visible team repository or reviewer fork when checked. No unpublished teammate commit was copied, attributed to Soham or claimed merged. These are independently implemented corrections; Yaswanth retains credit for the real findings/review and for his actual unpublished work.

## Findings and corrections

| Review finding | Corrected behavior | Executable evidence |
| --- | --- | --- |
| Python checked only NODE_ENV for production | Shared `tls_config.read_tls_config` treats either NODE_ENV or FLASK_ENV equal to `production` as production, including conflicting development/production flags. TLS paths and a secret of at least 32 UTF-8 bytes are required before database creation. | `python_backend/tests/unit/test_tls_startup.py`; actual Flask CLI rejection check |
| A lone TLS certificate/key could fall back to plaintext | Either path requires both in every mode. The launcher validates/loads TLS before creating the runtime/listening, with minimum TLS 1.2. | Unit launcher/factory cases and real certificate-only/key-only subprocess refusal, with no database created |
| CSP allowed plaintext WebSocket connections in TLS mode | Both runtime clients advertise `connect-src 'self' wss:` when configured for TLS. Local plaintext development retains ws/wss support. | Actual Node/Flask HTTPS response-policy assertions in TLS scripts |
| Node logout cleanup matched token bytes | Authenticate the logout token to its database-backed session, revoke it, then immediately disconnect every socket for that verified session ID. Distinct logins remain connected. | Actual HTTP/Socket.IO regression with two differently encoded signed tokens for one persisted session and another independent login |

The Python PowerShell launcher reads the explicit FLASK_ENV flag from local configuration. Plaintext system/smoke test subprocesses explicitly select test mode for both runtime flags, preserving isolation from the user's production environment.

## Actual local verification

- New TLS-startup regression module: **8 failed / 3 passed before correction; 11/11 passed afterward**.
- Full Node suite: **252/252** across 17 suites; full Python suite: **266/266**.
- Both real HTTPS/WSS listeners: TLS 1.3 and explicit TLS 1.2 negotiate; plaintext/legacy TLS rejected; authenticated WSS and TLS-mode CSP checks pass.
- Real Flask subprocesses reject FLASK_ENV-only plaintext production and either partial TLS path without opening the application database.
- The generated test certificate is short-lived, explicitly trusted only by test clients and never added to global trust. No database, signing secret, token or private key is committed.

Current CI must pass on the published corrected head, including the new actual Flask TLS/WSS step. Old green checks and the local results above do not change Yaswanth's human review state. The localhost checks do not certify an arbitrary external WSGI host, a public production certificate or monthly availability; deployment operators still have to configure and verify the actual service.

## Scope and late completion

Soham delegated the concrete scope choice on 31 October. Option A was selected: retain the 29 numbered SRS requirements as this delivery's feature baseline and explicitly defer uncontracted admin/private features. See `OCT31_SCOPE_DECISION_BRIEF.md`; this is a documented departure from SAD/STP narrative scope, not a claim that those features exist or that other reviewers/course staff approved it.

The official Sprint 2 window ended 30 October. These changes and the actual decision are dated 31 October; no commit, test, review, sprint completion or freeze is backdated. Hrisheek's history PR, Yaswanth's video PR, corrected-head reviews, remaining QA/accessibility evidence, operational-month acceptance and final merged-head CI remain real gates before release/freeze.
