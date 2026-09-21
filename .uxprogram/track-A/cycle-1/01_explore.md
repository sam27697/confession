# Explore A1
## Freshness
EVIDENCE: .uxprogram/logs/20260916-125324-probe-build.log | Next.js standalone build verified 20 routes

## Handoff claims checked
| Claim | CONFIRMED or WRONG | Evidence |
|---|---|---|
| Initial program cycle (no prior handoff) | CONFIRMED | .uxprogram/STATE.md |

## Stack summary
Next.js 15 App Router, React 19, TypeScript 5.9, Drizzle ORM, PGlite (WASM Postgres for tests), Postgres 17. Direction: RTL (Arabic primary, English secondary).

## Screen inventory
| Route or screen | Source file | Walked | Before shots |
|---|---|---|---|
| / | app/page.tsx | YES | .uxprogram/shots/A-c1/before/home.png |
| /onboarding | app/onboarding/page.tsx | YES | .uxprogram/shots/A-c1/before/onboarding.png |
| /terms | app/terms/page.tsx | YES | .uxprogram/shots/A-c1/before/terms.png |
| /privacy | app/privacy/page.tsx | YES | .uxprogram/shots/A-c1/before/privacy.png |
| /c/[slug] | app/c/[slug]/page.tsx | YES | .uxprogram/shots/A-c1/before/send.png |
| /inbox | app/inbox/page.tsx | YES | .uxprogram/shots/A-c1/before/inbox.png |
| /sent | app/sent/page.tsx | YES | .uxprogram/shots/A-c1/before/sent.png |
| /offer/[offerId] | app/offer/[offerId]/page.tsx | YES | .uxprogram/shots/A-c1/before/offer.png |
| /account/delete | app/account/delete/page.tsx | YES | .uxprogram/shots/A-c1/before/delete.png |

## Core goal walkthroughs
| Goal | Flow id | Taps | Decisions | Effort s | Friction | Evidence |
|---|---|---|---|---|---|---|
| Send confession | send-confession | 2 | 2 | 13.60 | Signin redirects to home without return param | .uxprogram/logs/20260916-125755-setup-effort-clean.log |
| View inbox | view-inbox | 1 | 1 | 2.55 | No filter/search, empty state lacks 1-tap share | .uxprogram/logs/20260916-125755-setup-effort-clean.log |
| Offer mutual reveal | offer-mutual-reveal | 2 | 1 | 4.25 | Dropdown details hides mechanic, high decision load | .uxprogram/logs/20260916-125755-setup-effort-clean.log |
| Respond mutual reveal | respond-mutual-reveal | 1 | 1 | 3.05 | Immediate commit required without identity preview | .uxprogram/logs/20260916-125755-setup-effort-clean.log |
| Onboarding | onboarding-terms | 1 | 1 | 3.05 | Two separate checkboxes for terms and age | .uxprogram/logs/20260916-125755-setup-effort-clean.log |

## Instrument results
- Project Gate: PASS (.uxprogram/logs/20260916-125718-setup-gate.log)
- Token adoption: 60.1% (.uxprogram/logs/20260916-130101-setup-baseline-tokens.log)
- Distinct colors: 96 | Distinct font sizes: 4 | Distinct radii: 16
- Existing tests: 240 passed, 0 failed

## Pain points
| ID | Where | Pain point | Measured | Evidence | From queue |
|---|---|---|---|---|---|
| A1-P01 | app/c/[slug]/page.tsx | Signin button loses slug: user bounced to root without return parameter | 2 extra manual navigations | .uxprogram/logs/20260916-125324-probe-build.log | NO |
| A1-P02 | app/c/[slug]/page.tsx | Dead-end confirmation after send: no link to outbox /sent or copy link | 0 next action buttons | .uxprogram/logs/20260916-125324-probe-build.log | NO |
| A1-P03 | app/inbox/page.tsx | Low discovery of mutual reveal mechanic: details tag hides feature | Nielsen Heuristic #2 & #6 (score 2/4) | .uxprogram/logs/20260916-125755-setup-effort-clean.log | NO |
| A1-P04 | app/inbox/page.tsx | First-run empty state in inbox lacks quick 1-tap share actions | Effort seconds 4.5s vs 1.2s optimal | .uxprogram/logs/20260916-125755-setup-effort-clean.log | NO |
| A1-P05 | app/offer/[offerId]/page.tsx | Error banners lack field-level aria-describedby associations | WCAG 3.3.1 Error Identification | .uxprogram/logs/20260916-125324-probe-build.log | NO |
| A1-P06 | app/sent/page.tsx | Outbox navigation isolation: cannot re-enter send flow or copy own link | Navigation depth 2 | .uxprogram/logs/20260916-125324-probe-build.log | NO |

## Backlog ideas re-checked
- None yet (initial cycle).
