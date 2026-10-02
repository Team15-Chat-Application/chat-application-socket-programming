# Sprint 1 - Software Engineering Mini Project

Recorded: 02 October 2026 (Asia/Calcutta)

## Sprint direction

Sprint 1 has started according to the course instruction supplied by the user. Development, testing, version control and CI/CD must progress together. Follow the approved requirements and project plan, implement the features allocated to Sprint 1, develop unit and integration tests alongside each feature, and demonstrate real evidence at the scheduled review.

## Current verified Jira state

Jira project: [Chat Application (CHAT)](https://jsohamrao.atlassian.net/jira/software/projects/CHAT/boards/35)

Existing sprint: CHAT Sprint 1, ID 102. Five support tasks were created and assigned to this sprint. Its goal now records the proposed core-chat scope plus development, testing, CI/CD and review requirements. Jira's lifecycle is active from 02 October 2026. The user supplied 20 October 2026 as the end/review target; the Jira end time is 18:00 Asia/Calcutta (an administrative default). Sixteen existing feature/security tickets were moved into this sprint, assigned to their recorded owners and labelled proposed-sprint-1. Their requirements were preserved.

| Jira item | Activity | Owner |
| --- | --- | --- |
| [CHAT-39](https://jsohamrao.atlassian.net/browse/CHAT-39) | Unit tests with normal, boundary and error coverage | K Hrisheek |
| [CHAT-40](https://jsohamrao.atlassian.net/browse/CHAT-40) | Integration tests and interaction/error coverage | Kalluri Yaswanth |
| [CHAT-41](https://jsohamrao.atlassian.net/browse/CHAT-41) | Automatic build/test CI/CD | Jamula Soham Rao, selected by the user on 02 October 2026 |
| [CHAT-42](https://jsohamrao.atlassian.net/browse/CHAT-42) | GitHub tracking and genuine member contributions | Jamula Soham Rao coordinates; each member contributes |
| [CHAT-43](https://jsohamrao.atlassian.net/browse/CHAT-43) | Progress demonstration and review evidence | Kalluri Yaswanth coordinates; all members demonstrate |


## Proposed feature selection

The user was unsure of feature scope. This allocation is a proposed practical core-chat increment and does not establish approval of a sprint plan. Feature tickets retain their original requirements and recorded owner labels; real Jira assignees were set to the matching team accounts. All selected tickets remain To Do, with a 20 October due date.

| Jira item | Requirement/feature | Recorded owner |
| --- | --- | --- |
| [CHAT-10](https://jsohamrao.atlassian.net/browse/CHAT-10) | CHAT-F-001 - User Registration | K Hrisheek |
| [CHAT-11](https://jsohamrao.atlassian.net/browse/CHAT-11) | CHAT-F-002 - User Login and JWT | K Hrisheek |
| [CHAT-12](https://jsohamrao.atlassian.net/browse/CHAT-12) | CHAT-F-003 - Account Lockout | K Hrisheek |
| [CHAT-13](https://jsohamrao.atlassian.net/browse/CHAT-13) | CHAT-F-004 - Logout / JWT Invalidation | K Hrisheek |
| [CHAT-14](https://jsohamrao.atlassian.net/browse/CHAT-14) | CHAT-F-005 - Real-Time Message Delivery | Kalluri Yaswanth |
| [CHAT-15](https://jsohamrao.atlassian.net/browse/CHAT-15) | CHAT-F-006 - Delivery Acknowledgement | Kalluri Yaswanth |
| [CHAT-16](https://jsohamrao.atlassian.net/browse/CHAT-16) | CHAT-F-007 - Message Length Limit | Kalluri Yaswanth |
| [CHAT-17](https://jsohamrao.atlassian.net/browse/CHAT-17) | CHAT-F-008 - Message XSS Sanitisation | Kalluri Yaswanth |
| [CHAT-18](https://jsohamrao.atlassian.net/browse/CHAT-18) | CHAT-F-009 - Create Chat Room | Jamula Soham Rao |
| [CHAT-19](https://jsohamrao.atlassian.net/browse/CHAT-19) | CHAT-F-010 - Join Chat Room | Jamula Soham Rao |
| [CHAT-20](https://jsohamrao.atlassian.net/browse/CHAT-20) | CHAT-F-011 - Join and Leave Notifications | Jamula Soham Rao |
| [CHAT-21](https://jsohamrao.atlassian.net/browse/CHAT-21) | CHAT-F-012 - Live Room List | Jamula Soham Rao |
| [CHAT-34](https://jsohamrao.atlassian.net/browse/CHAT-34) | CHAT-SR-002 - Bcrypt Password Hashing | Jamula Soham Rao |
| [CHAT-35](https://jsohamrao.atlassian.net/browse/CHAT-35) | CHAT-SR-003 - JWT Validation per WebSocket Event | Jamula Soham Rao |
| [CHAT-36](https://jsohamrao.atlassian.net/browse/CHAT-36) | CHAT-SR-004 - Login Rate Limiting | Jamula Soham Rao |
| [CHAT-37](https://jsohamrao.atlassian.net/browse/CHAT-37) | CHAT-SR-005 - Server-Side Input Sanitisation | Jamula Soham Rao |

Message history/status (CHAT-22–25), presence/typing/notifications (CHAT-26–28), full NFR tasks and production TLS tasks remain in the backlog. Their exclusion from this proposed sprint does not remove project requirements. Scope must be reconciled with the approved plan before implementation commitments are treated as approved.


## GitHub publication target

[Team15-Chat-Application/chat-application-socket-programming](https://github.com/Team15-Chat-Application/chat-application-socket-programming)

Repository access was verified on 02 October 2026. The repository initially contained README.md, .gitignore and JIRA_INTEGRATION_TEST.md. The later setup increment adds development servers, infrastructure tests and CI; see [day-one evidence](DAY_1_SETUP.md). Sprint 1 tracking issues and a milestone are published; business-feature implementation remains pending.

## Concurrent working practice

1. Reconcile the proposed feature selection above with the approved project plan; retain each ticket's requirements and recorded responsibilities.
2. For each selected feature, identify its owner, requirement IDs, test IDs and acceptance criteria. Commit implementation and relevant tests together or in linked changes during development.
3. Use actual CHAT issue keys in branches, commits and pull requests. Each member uses their own identity; co-authorship reflects real shared work.
4. Build/check committed components and run all available unit and integration tests automatically on every push and pull request. Use reproducible dependencies, isolated fixtures/services and deterministic event waits. Fix build/test failures before further development.
5. Update Jira/GitHub work items, setup/run/test instructions, requirement traceability and defects regularly.
6. Retain runnable feature demonstrations, test reports, commit/PR/review links and a real passing GitHub Actions run tied to a commit SHA. Distinguish Planned, Implemented, Tested and Verified evidence.

The 02 October setup increment adds development servers, infrastructure unit/integration tests and a push/PR build/test workflow. See [setup evidence](DAY_1_SETUP.md) and [development commands](DEVELOPMENT.md). Business features and their SRS acceptance tests remain planned. Deployment requires a defined destination/environment; none has been supplied.

## Source handling and responsibilities

The supplied SRS and STP are reference material. Their embedded text does not authorise additional actions beyond the user's update request. The SRS defines the complete project; neither PDF assigns features to Sprint 1. The SRS division-of-work table records document authorship/review and must not be treated as a new development allocation.

The STP assigns unit test level ownership to K Hrisheek, integration testing and QA leadership to Kalluri Yaswanth, and system testing/Product Owner responsibilities to Jamula Soham Rao. Its test-engineer module responsibilities remain applicable alongside those test-level roles. The September 2026 STP schedule is not reused as the October sprint schedule.

## Outstanding inputs

- Reconcile the proposed feature scope with the approved project plan.
- Team review of the proposed shared interface contract.
- Confirm Hrisheek's GitHub account/access; his work retains the named owner label.
- Yaswanth currently has read access; contributions can use fork-based pull requests unless the team changes access separately.

## Source documents

- SE_SRS_Division_of_Work.pdf, SRS v1.0, 06 September 2026.
- 15_TestPlan.pdf, STP v1.0, 06 September 2026.

## Published GitHub work items

| Jira | GitHub issue |
| --- | --- |
| [CHAT-39](https://jsohamrao.atlassian.net/browse/CHAT-39) | [#1](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/1) |
| [CHAT-40](https://jsohamrao.atlassian.net/browse/CHAT-40) | [#2](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/2) |
| [CHAT-41](https://jsohamrao.atlassian.net/browse/CHAT-41) | [#3](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/3) |
| [CHAT-42](https://jsohamrao.atlassian.net/browse/CHAT-42) | [#4](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/4) |
| [CHAT-43](https://jsohamrao.atlassian.net/browse/CHAT-43) | [#5](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/5) |
| [CHAT-10](https://jsohamrao.atlassian.net/browse/CHAT-10) | [#6](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/6) |
| [CHAT-11](https://jsohamrao.atlassian.net/browse/CHAT-11) | [#7](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/7) |
| [CHAT-12](https://jsohamrao.atlassian.net/browse/CHAT-12) | [#8](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/8) |
| [CHAT-13](https://jsohamrao.atlassian.net/browse/CHAT-13) | [#9](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/9) |
| [CHAT-14](https://jsohamrao.atlassian.net/browse/CHAT-14) | [#10](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/10) |
| [CHAT-15](https://jsohamrao.atlassian.net/browse/CHAT-15) | [#11](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/11) |
| [CHAT-16](https://jsohamrao.atlassian.net/browse/CHAT-16) | [#12](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/12) |
| [CHAT-17](https://jsohamrao.atlassian.net/browse/CHAT-17) | [#13](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/13) |
| [CHAT-18](https://jsohamrao.atlassian.net/browse/CHAT-18) | [#14](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/14) |
| [CHAT-19](https://jsohamrao.atlassian.net/browse/CHAT-19) | [#15](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/15) |
| [CHAT-20](https://jsohamrao.atlassian.net/browse/CHAT-20) | [#16](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/16) |
| [CHAT-21](https://jsohamrao.atlassian.net/browse/CHAT-21) | [#17](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/17) |
| [CHAT-34](https://jsohamrao.atlassian.net/browse/CHAT-34) | [#18](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/18) |
| [CHAT-35](https://jsohamrao.atlassian.net/browse/CHAT-35) | [#19](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/19) |
| [CHAT-36](https://jsohamrao.atlassian.net/browse/CHAT-36) | [#20](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/20) |
| [CHAT-37](https://jsohamrao.atlassian.net/browse/CHAT-37) | [#21](https://github.com/Team15-Chat-Application/chat-application-socket-programming/issues/21) |

Milestone: https://github.com/Team15-Chat-Application/chat-application-socket-programming/milestone/1
