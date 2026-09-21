# Final Plan A2: Navigation Wayfinding, Safe Decision Exits, Onboarding Discovery & Input Constraints

## Changelog against 04_plan.md
- **T01:** Clarified responsive flexible layout rules in AC3 ensuring zero horizontal overflow on viewports down to 320px width.
- **T02:** Specified in AC1 that the non-destructive back return to /sent must be a clean anchor link (<a href='/sent'>) outside the form blocks.
- **T04:** Specified in AC1 that the live constraint feedback pill maintains stable layout footprint to prevent cumulative layout shift (CLS).

## Note resolution table
| Note | Sev | Where | Proposal | Reason | Fix or action taken |
|---|---|---|---|---|---|
| E01 | S2 | T01 | ACCEPTED | Small viewports (320px) could encounter horizontal scroll if tab styling is rigid | Updated AC3 in T01 to require flexible sizing, min 44px touch targets, and zero horizontal overflow |
| E02 | S2 | T02 | ACCEPTED | Return exit must be a clean navigation link to avoid triggering POST form submissions | Updated AC1 in T02 to require an explicit <a href="/sent"> anchor placed outside form containers |
| E03 | S2 | T04 | ACCEPTED | Constraint feedback indicator must not cause layout shift when transitioning | Updated AC1 in T04 to require stable layout footprint preventing cumulative layout shift (CLS) |

## Divergence resolutions
| Concept | Metric | Planner | Evaluator | Resolution |
|---|---|---|---|---|
| none | none | none | none | Zero divergences of 2 or more points between planner and evaluator. |

## Final task schedule
1. A2-T01: Persistent sub-navigation tab bar linking inbox and outbox views (Signature Element)
2. A2-T02: Safe non-destructive return exit and clear danger phrasing on reveal offer
3. A2-T03: 3-step feature discovery walk and value illustration on unauthenticated home
4. A2-T04: Proactive minimum length guidance pill and dynamic feedback on compose screen
5. A2-T05: Spike sandboxed guest confession playground simulator (Wild Spike)