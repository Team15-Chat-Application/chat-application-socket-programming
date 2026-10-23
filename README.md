# chat-application-socket-programming
Real-time Chat Application using Socket Programming, WebSockets, Node.js and Flask-SocketIO developed as a Software Engineering mini-project.

## Part 2 delivery

The adopted Part 2 calendar sets backlog/estimates due **12 October**, optional practice **12-16 October**, **Sprint 1 on 19-23 October** and **Sprint 2 on 26-30 October 2026**. Existing October 2-4 work remains preparatory history. Scope and point estimates remain proposed for team review.

- [Sprint 1 plan, responsibilities and review evidence](docs/SPRINT_1.md)
- [Part 2 plan, full backlog, points and deliverables](docs/PART_2_PLAN.md)
- [20-23 October daily execution and verified progress](docs/SPRINT_1_DAILY_EXECUTION.md)
- [Linked GitHub Project](https://github.com/orgs/Team15-Chat-Application/projects/1)
- [Sprint 2 milestone](https://github.com/Team15-Chat-Application/chat-application-socket-programming/milestone/3)
- [Sprint 1 requirement/test traceability](docs/SPRINT_1_TRACEABILITY.md)
- [Sprint 1 contribution and tracking review package](docs/SPRINT_1_CONTRIBUTIONS.md)
- [Final regression, review and demo checklist](docs/SPRINT_1_REVIEW_DEMO.md)
- [Working-product video checklist](docs/SPRINT_VIDEO_CHECKLIST.md)
- [Deviation log](docs/DEVIATIONS.md)
- [Sprint 1 issues and milestone](https://github.com/Team15-Chat-Application/chat-application-socket-programming/milestone/1)
- [Jira board](https://jsohamrao.atlassian.net/jira/software/projects/CHAT/boards/35)

Development, unit/integration testing, Git/GitHub tracking and automatic build/test CI/CD progress together. Feature scope remains proposed pending reconciliation with the approved plan.

## Run locally

The project includes Node/Socket.IO and Flask-SocketIO backends, room creation/join/leave, distinct-user membership counts, room notices, authenticated live catalogue updates, shared bcrypt helpers, unit/integration tests and push/PR CI. The room/security branch passed 174 Node and 183 Python tests on 23 October, including the Python expiry-during-lock-wait regression. Yaswanth's unmerged messaging PR #45 is separately validated and has an outstanding broadcast-error finding. Registration/login, live session issuance/revocation and a usable chat client remain missing; the default launchers deny socket authentication until a real adapter is supplied. Message history/persistence remains proposed Sprint 2 scope. Component checks do not establish working-product acceptance.

- [Complete setup and PowerShell commands](docs/DEVELOPMENT.md)
- [Shared interface proposal for team review](docs/INTERFACE_CONTRACT.md)
- [Authentication and messaging integration handoff](docs/SOHAM_INTEGRATION_HANDOFF.md)
- [02 October setup evidence](docs/DAY_1_SETUP.md)
- [04 October room creation and bcrypt handoff](docs/OCT_04_PROGRESS.md)

After installing the locked dependencies, start Node with `npm start` and Flask with `scripts/run_flask.ps1` in separate terminals. Health endpoints are `http://127.0.0.1:3000/api/health` and `http://127.0.0.1:5000/api/health`. These are local development servers.

CI/CD owner: **Jamula Soham Rao**. The workflow builds both components and runs their available unit/integration tests on every push and pull request, retaining reports and development artifacts. Production deployment is not configured.
