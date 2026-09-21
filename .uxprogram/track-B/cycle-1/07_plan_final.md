# Final Plan B1: UI Visual Foundation, Design Tokens, and Micro-Interactions

## Changelog against 04_plan.md
- **T01:** Incorporated note B1-PE01: 	okens.md explicitly documents system Arabic fallbacks (Tahoma, Arial, sans-serif) to ensure consistent rendering across non-Apple platforms.
- **T03:** Incorporated note B1-PE02: Added acceptance criterion ensuring --press-scale: 1 is enforced under @media (prefers-reduced-motion: reduce) to prevent unwanted motion jumps for sensitive users.

## Note resolution table
| Note | Sev | Where | Proposal | Reason | Fix or action taken |
|---|---|---|---|---|---|
| B1-PE01 | S2 | T01 | ACCEPTED | Token contract must specify system Arabic fallbacks for Windows and Linux | Added explicit fallbacks (Tahoma, Arial, sans-serif) to 	okens.md typography specification |
| B1-PE02 | S3 | T03 | ACCEPTED | Tactile press-scale transitions must respect reduced motion preferences | Added AC verifying --press-scale: 1 under @media (prefers-reduced-motion: reduce) in globals.css |

## Divergence resolutions
| Concept | Metric | Planner | Evaluator | Resolution |
|---|---|---|---|---|
| None | - | - | - | Planner and Evaluator converged on identical winning concepts across all 4 areas with zero winner divergences |

## Final task schedule
1. B1-T01: Create and codify central tokens.md version 1 mirrored with codebase tokens (Foundation)
2. B1-T02: Elevate card surface hierarchy, borders, and depth across inbox, outbox, and offer screens
3. B1-T03: Add tactile press-scale transitions and accessible high-contrast focus rings to controls
4. B1-T04: Polish Arabic typography line-heights and asymmetric speech bubble notch styling (Signature Element)
5. B1-T05: Spike: fluid haptic web-vibration feedback engine on mobile touch interactions (Wild Spike)
