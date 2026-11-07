# Product Owner scope decision brief — 31 October 2026

Decision status: **Option A selected on 31 October 2026 under Soham's delegated Product Owner decision authority**. Soham replied "whatever u think is best" to the two concrete options. The assistant selected Option A based on the numbered SRS baseline, missing admin/private contracts and Yaswanth's recommendation. This records the authorized scope choice; it is not another person's signature, team/course approval or final release acceptance.

Yaswanth's actual 31 October review on PR #47 proposes Option A below. His review refers to a local `docs/ADMIN_PRIVATE_SCOPE_RECONCILIATION.md`; that file/branch is not published in the visible team or reviewer-fork refs and has not been inspected here. This is Soham's independently prepared decision brief, not a claim to reproduce or author Yaswanth's unpublished report.

## Source conflict to resolve

- Submitted SRS numbered requirements: 19 functional, 5 non-functional and 5 security requirements. The existing backlog/test matrix represents all 29.
- SAD sections 1.2, 3.2, 4.5 and 4.6 also describe admin controls and private conversations, with contracts still to be agreed.
- STP sections 1–2 include admin room management, monitoring and force logout, while its numbered requirement matrix does not allocate separate admin/private test IDs.
- Current build has shared named rooms and the numbered requirement implementation. It does not provide an admin panel or private 1-on-1 conversations. Automated test success does not prove these features exist.

## Concrete options

| Option | Decision to record | Consequence |
| --- | --- | --- |
| A — defer uncontracted admin/private features | Use the 29 numbered SRS requirements as this delivery's feature baseline; retain admin/private features as explicitly deferred future work. Record the departure from SAD/STP narrative scope, rationale, impacts and actual Product Owner/team decision. | No admin/private completion claim. Explain the documented scope deviation during the final demo; any required course acceptance remains genuine. |
| B — retain admin/private features as release requirements | Keep both in the current required delivery. Agree authorization roles/bootstrap, room lifecycle, monitoring/force-logout behavior, private-conversation access/history/receipts, owners and test cases before implementation. | Additional development and review remain; no final freeze until implemented/accepted or explicitly dispositioned. No new feature IDs, estimates or teammate ownership are invented by this brief. |

Both options preserve the numbered non-functional/security requirements. Neither option converts short local samples into a monthly uptime pass, replaces a manual accessibility audit, approves the TLS corrections, supplies missing member PRs, or backdates the 30 October deadline.

After Soham chooses, record his actual decision/date and any remaining team/course review in the deviation log and CHAT-51/48. Yaswanth retains authorship/responsibility for his actual reconciliation/QA report. A recorded Product Owner decision is not a fabricated signature from another reviewer.


## Recorded decision and remaining acceptance

Adopt Option A for this delivery: use the 29 numbered SRS requirements as the feature baseline and explicitly defer admin/private features described without agreed acceptance contracts. Retain the original SAD/STP scope and this departure in the deviation log; explain it during the final demo. Yaswanth must still supply/review his actual source reconciliation and testing-method disposition under CHAT-51. Genuine team/course review remains visible rather than being inferred from Soham's delegation.

The selected scope does not waive any of the 29 numbered requirements, monthly operational evidence, manual accessibility/Firefox checks, peer reviews, member-owned PRs, corrected-head CI or the actual final freeze. Completion after 30 October remains late work recorded with its real date.
