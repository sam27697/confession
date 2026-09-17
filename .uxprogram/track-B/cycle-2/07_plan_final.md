# Final Plan B2: Motion Token Contracts, Strict Token Adoption, and Navigation State Craft

## Changelog against 04_plan.md
- **T01:** Confirmed that active touch press transforms remain bounded by --dur-instant (90ms) and are not delayed by --dur-hover (150ms).
- **T02:** Verified that compose-rule padding changes preserve stable inline geometry and prevent vertical wrapping on narrow 320px screens.
- **T03:** Implemented active tab indicator using an inset box-shadow (inset 0 -2px 0 var(--citron-500)) rather than border-bottom to guarantee zero layout height shift on tab switch.

## Note resolution table
| Note | Sev | Where | Proposal | Reason | Fix or action taken |
|---|---|---|---|---|---|
| E01 | S2 | T01 | ACCEPTED | Mobile touch tap feedback requires instantaneous feel (<100ms) | Verified --press-scale transitions use --dur-instant (90ms) independently of --dur-hover |
| E02 | S2 | T02 | ACCEPTED | Could cause line wrapping on narrow 320px mobile viewports | Updated AC3 in T02 to verify zero wrapping and stable footprint on 320px viewports |
| E03 | S2 | T03 | ACCEPTED | Adding border changes computed height unless compensated by transparent border or inset box-shadow | Updated AC1 in T03 to specify inset box-shadow (box-shadow: inset 0 -2px 0 var(--citron-500)) |

## Divergence resolutions
| Concept | Metric | Planner | Evaluator | Resolution |
|---|---|---|---|---|
| none | none | none | none | Zero divergences of 2 or more points between planner and evaluator. |

## Final task schedule
1. B2-T01: Formalize global motion tokens contract in :root and tokens.md
2. B2-T02: Comprehensive A2 component tokenization and strict adoption sweep
3. B2-T03: Luminous citron active tab pill with bottom accent hairline (Signature Element)
4. B2-T04: Solid citron step roundels with high-contrast inverted numerals on discovery walk
5. B2-T05: Spike automated CSS AST token linter in pre-commit pipeline (Wild Spike)
