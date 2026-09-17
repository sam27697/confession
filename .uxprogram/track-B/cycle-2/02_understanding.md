# Understanding B2

## State of the product
Cycle B1 established the design token contract (tokens.md v1) and core visual foundation: card elevation depth, press-scale micro-interactions, Arabic typographic rhythm, and the asymmetric speech bubble notch. Cycles A2 and D1 added new CSS classes (app-nav, home-steps, home-step, home-step__badge, home-step__text, compose-rule, offer-actions) that partially break token adoption consistency. Two undefined tokens (--dur-hover, --ease-standard) are referenced but never declared, silently breaking transition timing. Overall token adoption rate has dropped from 60.1% to 44.9%. Cycle B2 targets: define missing motion tokens, adopt remaining raw literals to the token scale, and elevate the visual craft of the new A2 screens (sub-nav bar, home discovery walk, compose pill) to match the signature aesthetic.

## Personas
- Layla (22, Student): Mobile Safari on iPhone, evening browsing. Now navigates between inbox and sent via the new sub-nav bar; notices tab highlight feels visually weak on the deep indigo ground. Context: ASSUMPTION.
- Karim (25, Designer): Android Chrome. Examines discovery walk cards at first run; observes step badge font size uses a raw value breaking token consistency. Context: ASSUMPTION.
- Noor (19, First-timer): Low patience; expects animated compose length meter as she types; currently the pill updates silently with no visual transition. Context: ASSUMPTION.

## Job stories
- When I switch between inbox and sent, I want the active tab to display a clear citron indicator line or glow, so I can see at a glance where I am.
- When I open the home page as a first-timer, I want the three discovery steps to feel deliberately crafted and typographically consistent, so I trust the product.
- When I type my confession, I want the length constraint indicator to animate subtly when I reach the minimum, so I feel acknowledged and motivated to continue.

## Root causes
- RC-B201: --dur-hover and --ease-standard are used in 4 transition rules but are never defined in globals.css, causing silent fallback to browser default timings (BP-B201)
- RC-B202: A2 CSS classes (home-step__badge, home-step__text, compose-rule) use raw literals (0.875rem, 1.6, 2px 8px) instead of token references, reducing token adoption rate (BP-B202, BP-B203)
- RC-B203: Active tab indicator on .app-nav__tab--active relies only on background color change without a citron accent token or bottom indicator line, making wayfinding visually weak (BP-B204)
- RC-B204: Step badge visual hierarchy on the discovery walk uses citron-wash (opacity wash) which is insufficiently distinct from card surfaces at a glance (BP-B205)

## Opportunities
| Rank | ID | Root cause | Impact | Frequency | Reach | Confidence | Effort | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | RC-B201 | Define missing motion tokens and fix silent fallbacks | 5 | 5 | 5 | 5 | 1 | 625.0 |
| 2 | RC-B202 | Adopt raw literals to token scale in A2 classes | 4 | 5 | 5 | 5 | 1 | 500.0 |
| 3 | RC-B203 | Strengthen active tab indicator with citron accent | 4 | 5 | 5 | 4 | 1 | 400.0 |
| 4 | RC-B204 | Elevate step badge distinctiveness on discovery walk | 3 | 4 | 4 | 4 | 1 | 192.0 |

## Signature element
The **Asymmetrical Speech Bubble Notch** remains the signature element from B1. B2 extends the signature system: the active sub-nav tab will gain a citron bottom indicator as a secondary signature mark for spatial identity.
