# Close A2
## Summary (at most 10 lines)
Track A (UX Structure and Flow) Cycle 2 addressed navigation wayfinding, safe exits, and onboarding clarity.
Introduced persistent dual-tab sub-navigation bar linking inbox and outbox views with active state indicators.
Added non-destructive return exit and explicit danger styling on mutual reveal offer response page.
Created 3-step feature discovery walk on unauthenticated home to orient new visitors on core mechanics.
Added proactive minimum length constraint indicator with dynamic count updates on confession compose screen.
Evaluated sandboxed guest confession playground simulator spike and recorded an evidence-backed DROP verdict.
All 16 acceptance criteria and 322 total test suite tests pass cleanly with zero AI authorship tells.

## Metrics
| Metric | Baseline | Best before | Now | Ratchet | Evidence |
|---|---|---|---|---|---|
| Core view dual-tab wayfinding | 0% | 0% | 100% | PASS | .uxprogram/logs/20260917-064827-a2-t01-checks-pass.log |
| Offer response non-destructive exit | 0 | 0 | 1 | PASS | .uxprogram/logs/20260917-065236-a2-t02-checks-pass.log |
| Unauthenticated home onboarding steps | 0 | 0 | 3 steps | PASS | .uxprogram/logs/20260917-065504-a2-t03-checks-pass.log |
| Compose length feedback indicator | none | none | proactive pill | PASS | .uxprogram/logs/20260917-065829-a2-t04-checks-pass.log |
| Total test suite pass count | 240 | 306 | 322 | PASS | .uxprogram/logs/20260917-070539-a2-review-gate.log |
| User effort seconds (send-confession) | 13.60s | 13.60s | 13.60s | PASS | .uxprogram/logs/20260917-070459-a2-review-effort.log |
| Dead ends on core routes | 0 | 0 | 0 | PASS | .uxprogram/logs/20260917-064827-a2-t01-checks-pass.log |
| Ethics gate violations | 0 | 0 | 0 | PASS | .uxprogram/logs/20260917-070539-a2-review-gate.log |
| Project gate | PASS | PASS | PASS | PASS | .uxprogram/logs/20260917-070539-a2-review-gate.log |

## Tasks shipped
- A2-T01: Persistent sub-navigation tab bar linking inbox and outbox views (commit 1df8ad5)
- A2-T02: Safe non-destructive return exit and clear danger phrasing on reveal offer (commit 139b3a5)
- A2-T03: 3-step feature discovery walk and value illustration on unauthenticated home (commit 3756745)
- A2-T04: Proactive minimum length guidance pill and dynamic feedback on compose screen (commit aae1775)

## Spikes and verdicts
- A2-T05: Spike sandboxed guest confession playground simulator on branch ux/spike-A-c2-playground (commit e123d4a). Verdict: DROP. Adding client-side playground simulator violates spec §9 island whitelist restrictions and introduces unnecessary script overhead without proving user value compared to clean static 3-step walk shipped in T03.

## Deferred notes and where they went
- none (0 deferred notes, 0 open notes)

## Decisions
- D-004: Added Principle 6: Safe exits and sovereign wayfinding.
- D-005: Standardized on lightweight server-rendered discoverability patterns over client-heavy interactive playgrounds.

## Lessons
- Clear sub-navigation between complementary user views (inbox and sent) drastically improves spatial orientation.
- Placing non-destructive back navigation cleanly outside POST forms completely eliminates accidental form submissions while providing psychological safety.

## Close gate logs
- Scope check: .uxprogram/logs/20260917-071256-a2-close-scope.log
- Authorship scan: .uxprogram/logs/20260917-071301-a2-close-authorship.log
- Negative space: .uxprogram/logs/20260917-071304-a2-close-negative.log
- Project gate: .uxprogram/logs/20260917-070539-a2-review-gate.log
