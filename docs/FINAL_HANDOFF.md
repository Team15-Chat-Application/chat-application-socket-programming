# Owner handoff and final acceptance

Prepared 28 October 2026. This is a review candidate, not a signature, approval, release or formal development freeze.

## Dependency order / authorship

1. `CHAT-22-sprint2-history`: history/receipt persistence and account database compatibility. Assistance is committed under Soham's genuine identity. Hrisheek, the assigned history owner, reviews and raises the PR into `main` using his own account. His earlier authentication contribution remains preserved in main.
2. `CHAT-26-sprint2-delivery`: Soham's presence/client/runtime integration, tests, CI and final documentation. Its PR targets the history handoff branch so each delta can be reviewed separately. After the parent merges, retarget/rebase as appropriate and rerun final CI.
3. `CHAT-43-46-outcome-handoff`: genuine one-/two-minute captures and playback evidence prepared under Soham's identity. Yaswanth, the outcome/QA owner, reviews and raises its PR into the integration branch under his own identity. Prepared assistance is not attributed to a teammate who did not perform it.

Repository owners review and merge. Yaswanth retains Test Plan QA Lead test-case/execution review. A request, green CI or an automated review is not human approval. Earlier approvals do not approve this new source.

## Reproduction and manual review

Follow `DEVELOPMENT.md` in a clean checkout. Inspect actual account writes for bcrypt hashes/parameterised SQL. Run both suites, the real account/network/restart test, browser, TLS and load checks. Use two browser profiles for room isolation, typing, unread, receipts and logout. Review the scoped technical evidence and rerun on different environments.

For TC-UX-01 manually check keyboard-only signup/login, room creation/join/leave, history, composing/sending and logout; visible focus, reflow/zoom, error announcements, contrast and screen-reader names/updates. Axe is supporting evidence, not the whole audit. Confirm the load report's local topology; measure any selected hosted environment separately.

## Final acceptance gates

- [ ] Assigned members raise prepared PRs under their own accounts; owners review/merge in dependency order.
- [ ] QA Lead records genuine test-case/result review and dispositions.
- [ ] Exact final merged commit passes hosted CI, including browser/system/TLS/load checks.
- [ ] Authentic videos are retained; Sprint 1's late delivery is explicit.
- [ ] Manual accessibility findings resolved or explicitly dispositioned.
- [ ] Original private-repository criterion reconciled with the owner's actual visibility decision. No access change or approved deviation is inferred.
- [ ] Availability evaluated over a full operational month; hosting/monitoring responsibility agreed. Brief local samples are insufficient.
- [ ] Product Owner/team records actual final accepted commit, deviations/defects and freeze date after review, without backdating/signature fabrication.

Ready implementation can coexist with genuine human/time/deployment gates. Keep criterion-specific status: monthly monitoring or video review does not automatically reopen accepted unit-test/CI/tracking work.
