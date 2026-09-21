# Explore B1
## Freshness
EVIDENCE: .uxprogram/logs/20260916-195711-b1-freshness.log | build and typecheck clean

## Handoff claims checked
| Claim | CONFIRMED or WRONG | Evidence |
|---|---|---|
| Visiting /c/[slug] while unauthenticated links to /?next=/c/[slug] and preserves destination | CONFIRMED | .uxprogram/logs/20260916-195613-b1-claim1-confirm.log |
| Clicking share button on empty /inbox opens native OS share sheet or copies link with feedback | CONFIRMED | .uxprogram/logs/20260916-195635-b1-claim2-confirm.log |
| Submitting empty confession on /c/[slug] triggers accessible error with role=alert and focus | CONFIRMED | .uxprogram/logs/20260916-195658-b1-claim3-confirm.log |

## Stack summary (cycle 1; later cycles list only changes)
- Next.js 15 (App Router), React 19, TypeScript 5.9
- Dark theme only; RTL default direction; deep indigo ground (#070512)
- Accent colors: acid-citron (#D6F25B) brand primary; dusty-rose (#E39BA8) reveal
- Typography: System Arabic typography (--font-ar) with strict weight hierarchy, zero letter-spacing
- Design system: pure CSS tokens without external CDN or web fonts; class layer in app/globals.css

## Screen inventory
| Route or screen | Source file | Walked | Before shots |
|---|---|---|---|
| /inbox | app/inbox/page.tsx | YES | .uxprogram/shots/B-c1/before/inbox/ |
| /c/[slug] | app/c/[slug]/page.tsx | YES | .uxprogram/shots/B-c1/before/send/ |
| /offer/[offerId] | app/offer/[offerId]/page.tsx | YES | .uxprogram/shots/B-c1/before/offer/ |
| /sent | app/sent/page.tsx | YES | .uxprogram/shots/B-c1/before/sent/ |
| / | app/page.tsx | YES | .uxprogram/shots/B-c1/before/home/ |

## Core goal walkthroughs
| Goal | Flow id | Taps | Decisions | Effort s | Friction | Evidence |
|---|---|---|---|---|---|---|
| send confession | send-confession | 2 | 2 | 13.60 | low | .uxprogram/logs/20260916-200059-b1-effort-calc.log |
| view inbox | view-inbox | 1 | 1 | 2.55 | low | .uxprogram/logs/20260916-200059-b1-effort-calc.log |
| offer mutual reveal | offer-mutual-reveal | 2 | 1 | 4.25 | medium | .uxprogram/logs/20260916-200059-b1-effort-calc.log |
| respond mutual reveal | respond-mutual-reveal | 1 | 1 | 3.05 | low | .uxprogram/logs/20260916-200059-b1-effort-calc.log |
| onboarding and terms | onboarding-terms | 1 | 1 | 3.05 | low | .uxprogram/logs/20260916-200059-b1-effort-calc.log |

## Instrument results
- Distinct colors in CSS: 96 (.uxprogram/logs/20260916-200045-b1-tokens-inventory.log)
- Distinct font sizes: 4 (.uxprogram/logs/20260916-200045-b1-tokens-inventory.log)
- Distinct radii: 16 (.uxprogram/logs/20260916-200045-b1-tokens-inventory.log)
- Token adoption in global CSS: 60.1% (.uxprogram/logs/20260916-200045-b1-tokens-inventory.log)

## Pain points
| ID | Where | Pain point | Measured | Evidence | From queue |
|---|---|---|---|---|---|
| BP-01 | /inbox & /sent | Inconsistent card elevation and surface depths without unified token | 3 surface vars mixed | .uxprogram/logs/20260916-200045-b1-tokens-inventory.log | no |
| BP-02 | buttons & chips | Missing tactile active scale transform and high-contrast focus rings | 0 active scale on secondary | .uxprogram/logs/20260916-200045-b1-tokens-inventory.log | no |
| BP-03 | app/globals.css | Lack of central tokens.md documentation mirrored with codebase tokens | tokens.md missing | .uxprogram/facts.md | no |
| BP-04 | RevealCard & chips | Chip tokens lack semantic hover/focus states and wash backgrounds | missing chip interaction | .uxprogram/logs/20260916-165504-a1-t03-checks-verified-clean.log | no |

## Backlog ideas re-checked
- Pre-formatted Social Story Cards with Quick-Copy Channels (Score: 4.15)
- Seamless In-Flow Auth & Launchpad Hub (Score: 3.90)
- Empathetic Arabic Linguistic Reflection Gate (Score: 3.45)
