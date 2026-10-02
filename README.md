# chat-application-socket-programming
Real-time Chat Application using Socket Programming, WebSockets, Node.js and Flask-SocketIO developed as a Software Engineering mini-project.

## Sprint 1

Sprint 1 runs from **2 to 20 October 2026**. The proposed increment covers authentication, room messaging, room management and their required security controls.

- [Sprint 1 plan, responsibilities and review evidence](docs/SPRINT_1.md)
- [Sprint 1 issues and milestone](https://github.com/Team15-Chat-Application/chat-application-socket-programming/milestone/1)
- [Jira board](https://jsohamrao.atlassian.net/jira/software/projects/CHAT/boards/35)

Development, unit/integration testing, Git/GitHub tracking and automatic build/test CI/CD progress together. Feature scope remains proposed pending reconciliation with the approved plan.

## Run locally

The development foundation now includes a Node/Socket.IO primary backend, a Flask-SocketIO secondary backend, startup/transport tests and push/PR CI. Authentication, rooms, messaging, persistence and the chat UI are still planned. Socket authentication is denied until the real authentication module is supplied.

- [Complete setup and PowerShell commands](docs/DEVELOPMENT.md)
- [Shared interface proposal for team review](docs/INTERFACE_CONTRACT.md)
- [Today's setup and validation boundaries](docs/DAY_1_SETUP.md)

After installing the locked dependencies, start Node with `npm start` and Flask with `scripts/run_flask.ps1` in separate terminals. Health endpoints are `http://127.0.0.1:3000/api/health` and `http://127.0.0.1:5000/api/health`. These are local development servers.

CI/CD owner: **Jamula Soham Rao**. The workflow builds both components and runs their available unit/integration tests on every push and pull request, retaining reports and development artifacts. Production deployment is not configured.
