# Sprint 1 tracking and contribution handoff - 23 October 2026

CHAT-42 coordinator and CI/CD implementation owner: **Jamula Soham Rao**
(`JSohamRao`). This records actual evidence for review. Scope and estimates remain
proposed; no team agreement, human approval or product acceptance is inferred.

## CHAT-42 acceptance evidence

| Criterion | Delivered evidence |
| --- | --- |
| Align Jira and GitHub without duplicate work items | [Project 1](https://github.com/orgs/Team15-Chat-Application/projects/1) is linked to the designated repository. The [tracking audit](SPRINT_1_TRACKING_AUDIT.json) verifies all 21 unique Sprint 1 items against live Jira/Project observations. |
| Identifiable owners, linked issues, criteria and requirement/test IDs | Audit contains each GitHub issue URL, Jira key, matching owner/status, acceptance-criteria presence, positive proposed estimate and 23 October due date. All 16 allocated functional/security requirements map to submitted test IDs in [traceability](SPRINT_1_TRACEABILITY.md); five support items use support criteria. |
| Real Jira identifiers in development activity | Soham branches/feature commits/PRs use CHAT keys. Yaswanth's PR #45 and feature commits use CHAT-14/15/16/17; its existing branch `sprint-1/yaswanth` lacks a CHAT key. Record this convention deviation; do not rename another owner's branch or claim Jira Development indexing was verified. |
| Genuine member identities | GitHub API identifies Soham as author of #22/#23/#43/#44 and Yaswanth as author of #45 and its messaging commits. No Hrisheek auth PR or submitted human review was available. Missing contributions/reviews are recorded as missing. |
| Keep run/test instructions, traceability and defects current | [README](../README.md), [development commands](DEVELOPMENT.md), [daily execution](SPRINT_1_DAILY_EXECUTION.md), traceability, [integration handoff](SOHAM_INTEGRATION_HANDOFF.md), [defect handoff](PR45_INTEGRATION_REVIEW.md) and [demo checklist](SPRINT_1_REVIEW_DEMO.md). |
| Contribution, check and blocker links | Actual evidence below, with specific owner actions. Tracking an incomplete deliverable does not certify it complete. |
| Record CI/CD owner | Soham; `.github/workflows/ci.yml`, push/PR jobs, reports and build artifacts. CHAT-41 is In Review. |

The audit snapshot was taken before CHAT-42's review transition. Preserve its
observed In Progress value as history. The delivered tracking work can enter
review while missing owner modules and approvals remain explicit. Done still
requires the applicable genuine review; this document is not that review.

## Actual contributions and review evidence

| Member | Evidence | Outstanding boundary |
| --- | --- | --- |
| Soham | [#22 setup/CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/pull/22), [#23 room creation/bcrypt](https://github.com/Team15-Chat-Application/chat-application-socket-programming/pull/23), [#43 planning](https://github.com/Team15-Chat-Application/chat-application-socket-programming/pull/43), [#44 rooms/security](https://github.com/Team15-Chat-Application/chat-application-socket-programming/pull/44). Feature commits: `b3275a5` rooms, `3d31f4b` security, `4220d17` launcher evidence and `407155e` expiry-race fix. | No submitted human review on these PRs. Feature acceptance depends on real auth/client integration. |
| Yaswanth | Owner [PR #45](https://github.com/Team15-Chat-Application/chat-application-socket-programming/pull/45): [5005689 messaging](https://github.com/Team15-Chat-Application/chat-application-socket-programming/commit/50056894ff133a89267ba2efa32f04b860c98863), [4ed4e18 decisions](https://github.com/Team15-Chat-Application/chat-application-socket-programming/commit/4ed4e187f5ec929b4633158dc68769a87c4ea140), [fa58e8c validation](https://github.com/Team15-Chat-Application/chat-application-socket-programming/commit/fa58e8cea7deec942697e9b97e43071e2302c00d). | Unmerged; Node broadcast-error finding remains. QA/test-case review and authentic video are not complete. |
| Hrisheek | Allocated CHAT-10/11/12/13 and CHAT-39, linked individually in the audit. No owner-submitted authentication/session PR was available in the live repository PR list. | Supply actual registration, credential/login/JWT issuance, account lockout, live session lookup/logout revocation and tests under his own identity. No absent contribution is attributed. |

Soham's implementation passed **174 Node + 183 Python = 357 tests**, builds and
real default-launcher probes. Exact implementation `407155e` passed
[push CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39956171367)
and [PR CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39956178311).
Subsequent documentation head `1dd775e` passed
[push CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39956758070)
and [PR CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39956766243).
Later commits have their own PR checks; these links do not certify later SHAs.

PR #45 exact `9af2ad2` passed 227 Node + 232 Python tests and
[CI](https://github.com/Team15-Chat-Application/chat-application-socket-programming/actions/runs/39824321298).
Its unpublished Python guard overlay passed 233 tests. That overlay is not a
merged commit, human review or product acceptance.

## Soham's remaining review and integration boundaries

CHAT-18/19/20/21, CHAT-34/35/36/37 and CHAT-41 have implementation/test evidence
and are In Review. CHAT-42's tracking package is now prepared for review.
No new Soham-owned defect or review comment was available at read-back after
the expiry-race fix. Pending actions depend on actual owner deliveries/reviews:

1. Hrisheek provides auth/session entry points from SOHAM_INTEGRATION_HANDOFF.md.
2. Yaswanth fixes PR #45's Node broadcast error and retains the updated Python
   guard; its owner branch remains untouched by this handoff.
3. The team agrees a demo-client owner and runs real two-user acceptance,
   including logout/revocation, XSS rendering and TC-Msg-01 p90 timing.
4. Yaswanth performs actual QA/test-case review; repository owners review/merge
   the dependent stack and owner modules. Run checks on the integrated commit.
5. Yaswanth coordinates the real one-minute video, repository upload and playback
   verification. CHAT-43's In Review label is not evidence that a video exists.

Record resulting evidence and any feedback fixes at their real dates. Do not
close pending features, backdate reviews or silently take over owner PRs.
Preparation CHAT-9/44 remains separate; CHAT-45 is optional owner practice.
Sprint 2 scope and scheduling are unchanged. The Sprint 1 automation was stopped
after its final scheduled run; this checkpoint follows the user's new instruction.
