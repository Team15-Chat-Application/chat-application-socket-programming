# Deviation and implementation-decision log

Part 2 requires following the submitted SRS, SAD and Test Plan, documenting
departures and explaining them during the final demo. Updated 11 October 2026.
This log records actual decisions and open gaps, not an approved waiver or sign-off.

## Recorded decisions for review

| Source / baseline | Current decision | Reason / impact | Evidence | Review state |
| --- | --- | --- | --- | --- |
| STP original Node 18 / Python 3.10 environment; SRS minimum versions | Development/CI use Node 24 / Python 3.12 | Existing setup chose supported Node and reproducible runtime lines; retain exact tested versions in reports | DEVELOPMENT.md; PR #22; CI | Team review pending |
| SRS named-room creation; name uniqueness/length/lifecycle not specified | Names trim ASCII edge whitespace; 1-64 Unicode code points; duplicate names get distinct IDs; empty rooms retained until restart | Concrete implementation defaults; confirm UI and messaging expectations | INTERFACE_CONTRACT.md; OCT_04_PROGRESS.md; PR #23 | Proposed, not an additional SRS requirement |
| SRS bcrypt cost >=10; registration strength remains an auth responsibility | Shared helpers default to cost 12 (operational range 10-14), strict UTF-8 and 72-byte maximum | Prevent silent bcrypt truncation; real registration must enforce SRS credential rules and store only the hash | Password helper code and interoperability tests; PR #23 | Auth integration and team policy review pending |

## Acceptance gaps, not accepted deviations

- Authentication/JWT, remaining room/messaging features, persistence and the UI
  are not complete. Fixture-auth helper tests do not demonstrate full application
  acceptance or the working-product video requirement.
- Catalogue persistence, live membership/list updates and production deployment
  remain pending; no requirement is waived by the preparatory increment.
- Monthly 99.5% availability requires a real observation window. A short sprint
  report must state its duration and cannot be labelled a full-month SLA pass.
- Node integration uses actual HTTP/Socket.IO transport; Python integration uses
  the in-process client plus real Node subprocesses for bcrypt interoperability.
  Retain that distinction when reporting test coverage.

## Recording future changes

For each departure, record the exact SRS/SAD/STP clause, old and new behaviour,
reason, impact, linked issue/PR, test evidence and review/approval state. Obtain
genuine team/owner decisions and explain accepted changes in the final demo.
Do not fill approval/signature fields or mark acceptance without actual evidence.
