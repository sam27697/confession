# Explore B2
## Freshness
EVIDENCE: .uxprogram/logs/20260917-102234-b2-freshness.log | build and typecheck clean

## Handoff claims checked
| Claim | CONFIRMED or WRONG | Evidence |
|---|---|---|
| Navigating to /inbox or /sent renders a persistent dual-tab navigation bar with Arabic labels showing the active tab with aria-current and an active highlight token | CONFIRMED | .uxprogram/logs/20260917-102411-b2-claim1-confirm.log |
| Opening /offer/[offerId] as a logged-in recipient displays a permanent back link to /sent outside the response form plus a clearly styled danger decline button with irreversible wording | CONFIRMED | .uxprogram/logs/20260917-102420-b2-claim2-confirm.log |
| Opening the root path / as an unauthenticated visitor renders exactly 3 numbered discovery steps before the login form each with a step badge and a distinct mechanic explanation | CONFIRMED | .uxprogram/logs/20260917-102429-b2-claim3-confirm.log |

## Stack summary (changes since B1)
- B1 established: tokens.md v1, card elevation depth tokens, press-scale micro-interactions, Arabic 1.75 line-height, asymmetric speech notch
- A2 added: .app-nav / .app-nav__tab sub-navigation bar, .home-hero / .home-steps / .home-step discovery walk classes, .compose-rule constraint pill, .offer-actions action group
- Current token adoption: 44.9% (was 60.1% before A2; A2 classes introduced raw literals that reduced ratio)
- CSS variables defined: 151; variables referenced but undefined: --dur-hover, --ease-standard, --bit-delay, --bit-drift, --bit-left, --bit-spin

## Screen inventory
| Route or screen | Source file | Walked | Notes |
|---|---|---|---|
| /inbox | app/inbox/page.tsx | YES | sub-nav bar added A2-T01; card surface from B1 |
| /sent | app/sent/page.tsx | YES | sub-nav bar added A2-T01; empty state warmth from D1 |
| /c/[slug] | app/c/[slug]/page.tsx | YES | compose-rule pill from A2-T04 |
| /offer/[offerId] | app/offer/[offerId]/page.tsx | YES | safe exit anchor and danger button from A2-T02 |
| / | app/page.tsx | YES | 3-step home-steps walk from A2-T03 |

## Core goal walkthroughs
| Goal | Flow id | Taps | Decisions | Effort s | Friction | Evidence |
|---|---|---|---|---|---|---|
| send confession | send-confession | 2 | 2 | 13.60 | low | .uxprogram/logs/20260917-102247-b2-effort.log |
| view inbox | view-inbox | 1 | 1 | 2.55 | low | .uxprogram/logs/20260917-102247-b2-effort.log |
| offer mutual reveal | offer-mutual-reveal | 2 | 1 | 4.25 | medium | .uxprogram/logs/20260917-102247-b2-effort.log |
| respond mutual reveal | respond-mutual-reveal | 1 | 1 | 3.05 | low | .uxprogram/logs/20260917-102247-b2-effort.log |
| onboarding and terms | onboarding-terms | 1 | 1 | 3.05 | low | .uxprogram/logs/20260917-102247-b2-effort.log |

## Instrument results
- Distinct colors in CSS: 32 (.uxprogram/logs/20260917-102352-b2-tokens-scan.log)
- Distinct font-sizes: 5 (.uxprogram/logs/20260917-102352-b2-tokens-scan.log)
- Distinct border-radii: 17 (.uxprogram/logs/20260917-102352-b2-tokens-scan.log)
- CSS variables defined: 151 (.uxprogram/logs/20260917-102352-b2-tokens-scan.log)
- Token adoption (values using var(--...)): 44.9% - down from 60.1% due to A2 raw literals (.uxprogram/logs/20260917-102352-b2-tokens-scan.log)

## Pain points
| ID | Where | Pain point | Measured | Evidence | From queue |
|---|---|---|---|---|---|
| BP-B201 | app/globals.css | --dur-hover and --ease-standard are used in transitions but never defined; they silently fall back to the browser default causing inconsistent animation timing | 4 transition rules broken | .uxprogram/logs/20260917-102352-b2-tokens-scan.log | no |
| BP-B202 | .home-step__badge | font-size uses raw 0.875rem literal instead of var(--size-caption) from the token scale | 1 raw literal | .uxprogram/logs/20260917-102352-b2-tokens-scan.log | no |
| BP-B203 | .home-step__text | line-height uses raw 1.6 literal instead of var(--lh-tight) or var(--lh-body) from the token scale | 1 raw literal | .uxprogram/logs/20260917-102352-b2-tokens-scan.log | no |
| BP-B204 | .app-nav__tab--active | active tab indicator uses only background color change but lacks a bottom indicator or glow ring using token system; visually weak on dark surface | no token highlight | .uxprogram/logs/20260917-102411-b2-claim1-confirm.log | no |
| BP-B205 | .home-step__badge | badge visual weight (citron-wash background) reads as decorative only; step numbering is unclear at a glance on first render | weak step hierarchy | .uxprogram/logs/20260917-102429-b2-claim3-confirm.log | no |
| BP-B206 | .compose-rule | constraint pill uses fixed padding 2px 8px and font-size via var(--type-micro) but no interaction feedback on character count change; counter is static text not dynamic | static display | .uxprogram/logs/20260917-102411-b2-claim1-confirm.log | no |

## Backlog ideas re-checked
- Unified Segmented Control with Real-Time Activity Badge Counters on Inbox and Outbox Tabs (Bold concept from A2 backlog)
- Static CSS Variable Reference Sheet (Score: 3.95) | B1 runner-up
- Standard Hover and Focus Outline Styling (Score: 3.75) | B1 runner-up
