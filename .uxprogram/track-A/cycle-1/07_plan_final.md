# Final Plan A1: UX Structure, Flows, and Recovery

## Changelog against 04_plan.md
- **T01:** Added app/_lib/login-flow.ts to ALLOWED_PATHS, added relative path sanitation and open-redirect fallback check (AC3).
- **T02:** Added resilient fallback copy/selection handling when Clipboard or Web Share API is unavailable or denied (AC3).
- **T03:** Added client component app/_components/RevealCard.tsx to ALLOWED_PATHS, added acceptance criterion for interactive prompt chips (AC2), and clarified preservation of details.msg__more (AC4).
- **T04:** Added client component app/_components/ConfessionComposer.tsx to ALLOWED_PATHS, added live character meter check (AC3), shake constraint validation check (AC4), and automatic input focus on error (AC2).

## Note resolution table
| Note | Sev | Where | Proposal | Reason | Fix or action taken |
|---|---|---|---|---|---|
| E01 | S1 | T03 | ACCEPTED | Interactive prompt carousel requires a client component and explicit test criteria | Added app/_components/RevealCard.tsx to ALLOWED_PATHS and added AC2 checking prompt chip interaction |
| E02 | S1 | T04 | ACCEPTED | Live character meter and shake validation require a client component and explicit test criteria | Added app/_components/ConfessionComposer.tsx to ALLOWED_PATHS and added AC3/AC4 for live metering and shake |
| E03 | S1 | T01 | ACCEPTED | Auth redirection logic lives in login-flow.ts and requires open-redirect validation | Added app/_lib/login-flow.ts to ALLOWED_PATHS and added AC3 verifying non-relative targets fallback to /inbox |
| E04 | S2 | T03 | ACCEPTED | Multiple details tags exist on inbox page; moderation dropdown must be preserved | Clarified AC1 to specify replacement of details.reveal only, keeping details.msg__more in AC4 |
| E05 | S2 | T02 | ACCEPTED | Mobile browsers / in-app WebViews may reject or lack Web Share or Clipboard APIs | Added AC3 in T02 specifying accessible fallback UI preserving selectable URL |
| E06 | S2 | T04 | ACCEPTED | Next.js server error redirects do not move keyboard focus to invalid input | Added AC2 in T04 verifying automatic focus on invalid textarea when error param is present |

## Divergence resolutions
| Concept | Metric | Planner | Evaluator | Resolution |
|---|---|---|---|---|
| Dedicated Reveal Trigger Card with Visual Signposting | Distinctiveness | 4 | 2 | The evaluator noted that a standard trigger card is conventional rather than highly distinctive. Accepted evaluator score (2). The winning concept in this area is Interactive Reciprocal Commitment Card with Structured Prompt Carousel (Distinctiveness 5), which is being implemented in T03. |

## Final task schedule
1. A1-T01: Preserve destination path on signin and eliminate post-send dead end
2. A1-T02: Add 1-tap native Web Share and instant clipboard copy to empty inbox
3. A1-T03: Redesign mutual reveal into an elevated reciprocal card with prompt chips (Signature Element)
4. A1-T04: Add accessible inline form validation and live character count to send page
5. A1-T05: Spike: zero-click dynamic 9:16 story card generation with native blob share (Wild Spike)
