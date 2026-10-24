# Part 2 delivery plan

Adopted and synchronized on 11 October 2026 (Asia/Calcutta). Source:
SE_Mini_Project_Delivereables_Part-2.pdf, page 1. This calendar supersedes the
earlier October 20 target. The original October 2-4 commits and review history
remain authentic preparatory contributions.

[GitHub Project](https://github.com/orgs/Team15-Chat-Application/projects/1) |
[Jira board](https://jsohamrao.atlassian.net/jira/software/projects/CHAT/boards/35)

## Calendar and outcome evidence

| Phase | Dates | Outcome | Jira sprint |
| --- | --- | --- | --- |
| Backlog preparation | Due 12 October | Linked GitHub Project, full SRS FR/NFR backlog, points, owners and two planned sprints | 102 |
| Optional dry run | 12-16 October | Rehearse environment, genuine PRs, owner review and CI | 102 |
| Sprint 1 | 19-23 October | Working core-chat product; one-minute outcome video uploaded to repo | 135 (future) |
| Sprint 2 | 26-30 October | Working product; two-minute outcome video; final docs and development freeze | 136 (future) |

Backlog changes are still allowed on 19 October. Sprint start/end hours in Jira
are administrative defaults (09:00/18:00 IST), not hours specified by the PDF.
Preparation sprint 102 keeps its actual October 2 start and remains active through
October 16; it was renamed instead of erasing or closing its history.

## Scope, estimates and ownership

All 29 SRS requirements are represented: 19 functional, 5 non-functional and
5 security. There are 40 estimated backlog/deliverable items overall; Jira's eight
epics remain grouping containers. Preparation has 3 items / 7 points, Sprint 1
has 21 items / 68 points and Sprint 2 has 16 items / 54 points.

The 1/2/3/5/8 estimates and allocations are PROPOSED for team review. They are
relative implementation/test/integration estimates, not hours, known velocity or
an approved capacity commitment. Reconcile them with team availability by the
allowed October 19 planning adjustment. Existing recorded development owners
were preserved; the SRS document-author table was not used as a new allocation.
New delivery coordinators follow the existing QA/Product Owner responsibilities.

| Jira | Backlog item | Responsible member | Proposed points | Phase | Due |
| --- | --- | --- | --- | --- | --- |
| [CHAT-9](https://jsohamrao.atlassian.net/browse/CHAT-9) | Initial project and repository setup | Jamula Soham Rao | 2 | Preparation | 2026-10-12 |
| [CHAT-10](https://jsohamrao.atlassian.net/browse/CHAT-10) | CHAT-F-001 - User Registration | K Hrisheek | 5 | Sprint 1 | 2026-10-23 |
| [CHAT-11](https://jsohamrao.atlassian.net/browse/CHAT-11) | CHAT-F-002 - User Login and JWT | K Hrisheek | 5 | Sprint 1 | 2026-10-23 |
| [CHAT-12](https://jsohamrao.atlassian.net/browse/CHAT-12) | CHAT-F-003 - Account Lockout | K Hrisheek | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-13](https://jsohamrao.atlassian.net/browse/CHAT-13) | CHAT-F-004 - Logout / JWT Invalidation | K Hrisheek | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-14](https://jsohamrao.atlassian.net/browse/CHAT-14) | CHAT-F-005 - Real-Time Message Delivery | Kalluri Yaswanth | 8 | Sprint 1 | 2026-10-23 |
| [CHAT-15](https://jsohamrao.atlassian.net/browse/CHAT-15) | CHAT-F-006 - Delivery Acknowledgement | Kalluri Yaswanth | 2 | Sprint 1 | 2026-10-23 |
| [CHAT-16](https://jsohamrao.atlassian.net/browse/CHAT-16) | CHAT-F-007 - Message Length Limit | Kalluri Yaswanth | 1 | Sprint 1 | 2026-10-23 |
| [CHAT-17](https://jsohamrao.atlassian.net/browse/CHAT-17) | CHAT-F-008 - Message XSS Sanitisation | Kalluri Yaswanth | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-18](https://jsohamrao.atlassian.net/browse/CHAT-18) | CHAT-F-009 - Create Chat Room | Jamula Soham Rao | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-19](https://jsohamrao.atlassian.net/browse/CHAT-19) | CHAT-F-010 - Join Chat Room | Jamula Soham Rao | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-20](https://jsohamrao.atlassian.net/browse/CHAT-20) | CHAT-F-011 - Join and Leave Notifications | Jamula Soham Rao | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-21](https://jsohamrao.atlassian.net/browse/CHAT-21) | CHAT-F-012 - Live Room List | Jamula Soham Rao | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-22](https://jsohamrao.atlassian.net/browse/CHAT-22) | CHAT-F-013 - Message Persistence | K Hrisheek | 5 | Sprint 2 | 2026-10-30 |
| [CHAT-23](https://jsohamrao.atlassian.net/browse/CHAT-23) | CHAT-F-014 - Retrieve Last 50 Messages | K Hrisheek | 3 | Sprint 2 | 2026-10-30 |
| [CHAT-24](https://jsohamrao.atlassian.net/browse/CHAT-24) | CHAT-F-015 - Delivered Status | K Hrisheek | 2 | Sprint 2 | 2026-10-30 |
| [CHAT-25](https://jsohamrao.atlassian.net/browse/CHAT-25) | CHAT-F-016 - Read Status | K Hrisheek | 3 | Sprint 2 | 2026-10-30 |
| [CHAT-26](https://jsohamrao.atlassian.net/browse/CHAT-26) | CHAT-F-017 - Online Presence | Jamula Soham Rao | 3 | Sprint 2 | 2026-10-30 |
| [CHAT-27](https://jsohamrao.atlassian.net/browse/CHAT-27) | CHAT-F-018 - Typing Indicator | Jamula Soham Rao | 2 | Sprint 2 | 2026-10-30 |
| [CHAT-28](https://jsohamrao.atlassian.net/browse/CHAT-28) | CHAT-F-019 - In-App Notification | Jamula Soham Rao | 3 | Sprint 2 | 2026-10-30 |
| [CHAT-29](https://jsohamrao.atlassian.net/browse/CHAT-29) | CHAT-NF-001 - Message Latency Performance | Jamula Soham Rao | 5 | Sprint 2 | 2026-10-30 |
| [CHAT-30](https://jsohamrao.atlassian.net/browse/CHAT-30) | CHAT-NF-002 - Monthly Availability | Jamula Soham Rao | 3 | Sprint 2 | 2026-10-30 |
| [CHAT-31](https://jsohamrao.atlassian.net/browse/CHAT-31) | CHAT-NF-003 - Concurrent WebSocket Load | K Hrisheek | 5 | Sprint 2 | 2026-10-30 |
| [CHAT-32](https://jsohamrao.atlassian.net/browse/CHAT-32) | CHAT-NF-004 - TLS Enforcement | Kalluri Yaswanth | 5 | Sprint 2 | 2026-10-30 |
| [CHAT-33](https://jsohamrao.atlassian.net/browse/CHAT-33) | CHAT-SR-001 - Enforce TLS for HTTP and WebSocket | Jamula Soham Rao | 3 | Sprint 2 | 2026-10-30 |
| [CHAT-34](https://jsohamrao.atlassian.net/browse/CHAT-34) | CHAT-SR-002 - Bcrypt Password Hashing | Jamula Soham Rao | 2 | Sprint 1 | 2026-10-23 |
| [CHAT-35](https://jsohamrao.atlassian.net/browse/CHAT-35) | CHAT-SR-003 - JWT Validation per WebSocket Event | Jamula Soham Rao | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-36](https://jsohamrao.atlassian.net/browse/CHAT-36) | CHAT-SR-004 - Login Rate Limiting | Jamula Soham Rao | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-37](https://jsohamrao.atlassian.net/browse/CHAT-37) | CHAT-SR-005 - Server-Side Input Sanitisation | Jamula Soham Rao | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-38](https://jsohamrao.atlassian.net/browse/CHAT-38) | CHAT-NF-005 - WCAG 2.1 AA Accessibility | K Hrisheek | 5 | Sprint 2 | 2026-10-30 |
| [CHAT-39](https://jsohamrao.atlassian.net/browse/CHAT-39) | Sprint 1 - Develop unit test cases alongside implementation | K Hrisheek | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-40](https://jsohamrao.atlassian.net/browse/CHAT-40) | Sprint 1 - Develop integration test cases alongside implementation | Kalluri Yaswanth | 5 | Sprint 1 | 2026-10-23 |
| [CHAT-41](https://jsohamrao.atlassian.net/browse/CHAT-41) | Sprint 1 - Configure automatic build and test CI/CD pipeline | Jamula Soham Rao | 3 | Sprint 1 | 2026-10-23 |
| [CHAT-42](https://jsohamrao.atlassian.net/browse/CHAT-42) | Sprint 1 - Maintain GitHub tracking and identifiable team contributions | Jamula Soham Rao | 2 | Sprint 1 | 2026-10-23 |
| [CHAT-43](https://jsohamrao.atlassian.net/browse/CHAT-43) | Sprint 1 - Demonstrate working product and upload one-minute outcome video | Kalluri Yaswanth | 2 | Sprint 1 | 2026-10-23 |
| [CHAT-44](https://jsohamrao.atlassian.net/browse/CHAT-44) | Part 2 - Complete GitHub Project, full backlog and story-point estimates | Jamula Soham Rao | 3 | Preparation | 2026-10-12 |
| [CHAT-45](https://jsohamrao.atlassian.net/browse/CHAT-45) | Part 2 - Optional sprint dry run and environment rehearsal | Kalluri Yaswanth | 2 | Preparation | 2026-10-16 |
| [CHAT-46](https://jsohamrao.atlassian.net/browse/CHAT-46) | Sprint 2 - Record two-minute working-product outcome video | Kalluri Yaswanth | 2 | Sprint 2 | 2026-10-30 |
| [CHAT-47](https://jsohamrao.atlassian.net/browse/CHAT-47) | Part 2 - Complete project documents, traceability and deviation log | Jamula Soham Rao | 3 | Sprint 2 | 2026-10-30 |
| [CHAT-48](https://jsohamrao.atlassian.net/browse/CHAT-48) | Part 2 - Final acceptance review and development freeze | Jamula Soham Rao | 2 | Sprint 2 | 2026-10-30 |

## Contribution, review and acceptance

The assigned member raises their PR under their own identity. GPT assistance is
allowed. Repository owners review and commit/merge PRs. Yaswanth remains QA Lead
for test-case review; Hrisheek owns unit-test level work; Soham owns CI/CD and
coordinates Product Owner acceptance with the team. Both Hrisheek and Yaswanth
currently have repository read access and can contribute through fork PRs; their
GitHub issue assignments are now set to their actual accounts.

PR #22 (setup) and PR #23 (room creation/bcrypt) remain open, with Yaswanth's
reviews requested and no review submitted as of this update. Do not treat CI or
a reviewer request as approval. Their merge order remains #22 then #23, after
review, with #23 retargeted to main after #22 merges. Planning documentation is a
separate dependent PR; no implementation PR is merged by this tracking update.

Development, tests, version control and CI remain concurrent. The existing
workflow checks both backends on push and PR events. Room creation/bcrypt helpers
are implemented and tested with explicit auth fixtures; real auth integration,
remaining modules and the integrated working-product demo are still pending.

Follow the submitted SRS, SAD and Test Plan. Record changes in
[the deviation log](DEVIATIONS.md) and explain them at the final demo. Use
[the outcome-video checklist](SPRINT_VIDEO_CHECKLIST.md) for authentic recordings.
Monthly availability cannot be established from a five-day sprint alone; report
actual monitoring duration and preserve the full NFR as an outstanding criterion.

## Tracking verification

Jira and GitHub API read-back verified all 40 point values, assignees, phases and
due dates, plus the Project/repository link and October 23/30 milestone dates.
Work statuses and source requirements were preserved; no new feature completion,
human approval, video or freeze is claimed. CHAT-44 is ready for planning review.
Team agreement on scope and point estimates is still required.
