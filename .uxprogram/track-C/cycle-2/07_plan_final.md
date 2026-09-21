# Final Plan C2: Cognitive Ergonomics, Keystroke Elimination, and Form Comfort

## Changelog against 04_plan.md
- **T01:** Incorporated note C2-PE01: Enforce explicit fallback min-height: 120px and standard textarea box model in app/globals.css for browsers lacking field-sizing: content support.
- **T02:** Incorporated note C2-PE02: Explicitly assign type="button" and data-starter-prompt attribute on all prompt chip elements to guarantee zero accidental form submits.
- **T03:** Incorporated note C2-PE03: Wrap navigator.clipboard.writeText in try/catch and error fallback handling for non-secure contexts or webviews.

## Note resolution table
| Note | Sev | Where | Proposal | Reason | Fix or action taken |
|---|---|---|---|---|---|
| C2-PE01 | S2 | T01 | ACCEPTED | field-sizing needs robust min-height fallback for older browser engines | Explicit min-height: 120px and box model in CSS |
| C2-PE02 | S2 | T02 | ACCEPTED | Buttons inside forms default to submit if type is omitted | Explicitly enforced type="button" on all chip elements |
| C2-PE03 | S2 | T03 | ACCEPTED | Clipboard API may reject in non-secure or restricted contexts | Wrapped writeText in try/catch with fallback notification |

## Divergence resolutions
| Concept | Metric | Planner | Evaluator | Resolution |
|---|---|---|---|---|
| None | - | - | - | Planner and Evaluator converged on identical winning concepts across all 4 areas with 0 divergences >= 2 points |

## Final task schedule
1. C2-T01: Adaptive auto-expanding textarea with native CSS content sizing and min/max clamp (Score: 5.00, Signature Element)
2. C2-T02: 1-tap Levantine confession starter chips with zero-keystroke textarea population on /c/[slug] (Score: 4.85)
3. C2-T03: 1-tap outbox message copy button with affirmative toast confirmation on /sent (Score: 4.85)
4. C2-T04: Contextual response starter prompts on mutual reveal answer screen on /offer/[offerId] (Score: 4.85)
5. C2-T05: Spike client-side predictive Arabic sentence completion engine (Score: 4.45, Wild Spike)
