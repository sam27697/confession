# Final Plan A3: Data Sovereignty Transparency, Policy Wayfinding & Ambient Volume Recognition

## Changelog against 04_plan.md
- **T01:** Clarified in AC3 that the confirmation checkbox and irreversible delete button remain grouped within a dedicated form block below the data sovereignty balance card, with the safe exit prominently situated.
- **T02:** Specified in AC1 and AC2 that the in-app policy return navigation defaults to a stable fallback (/inbox for signed-in accounts, / for guests).
- **T03:** Added to AC1 and AC2 that numeric volume badges provide screen-reader accessibility via descriptive label context.

## Note resolution table
| Note | Sev | Where | Proposal | Reason | Fix or action taken |
|---|---|---|---|---|---|
| E01 | S2 | T01 | ACCEPTED | Elevated safe return button must not separate required checkbox from delete action | Explicitly grouped confirmation checkbox and delete button in dedicated form container below the card |
| E02 | S2 | T02 | ACCEPTED | Return link must navigate cleanly even when opened in a new tab without history | Configured return links to anchor to /inbox for signed-in users and / for guests |
| E03 | S2 | T03 | ACCEPTED | Screen readers reading tab labels need context for adjacent count numbers | Included accessible label context on navigation tab elements indicating message count |

## Divergence resolutions
| Concept | Metric | Planner | Evaluator | Resolution |
|---|---|---|---|---|
| none | none | none | none | Zero divergences of 2 or more points between planner and evaluator. |

## Final task schedule
1. A3-T01: Structured data sovereignty balance card with elevated safe exit on /account/delete (Signature Element)
2. A3-T02: In-app context-aware return navigation on /terms and /privacy
3. A3-T03: Inset numeric volume badges on inbox and outbox wayfinding tabs
4. A3-T04: Contextual action breadcrumb header with tactile safe return on /account/delete and /offer/[offerId]
5. A3-T05: Spike slide-over legal sheet drawer with gesture dismiss on ux/spike-A-c3-legal-sheet (Wild Spike)
