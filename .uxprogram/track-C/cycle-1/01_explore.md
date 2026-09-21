# Explore C1: Effort, Comfort, and Cognitive Load

FRESHNESS: .uxprogram/logs/20260916-211713-c1-freshness.log
CLAIMS_CONFIRMED:
- Claim 1 confirmed: .uxprogram/logs/20260916-211641-c1-claim1-confirm.log
- Claim 2 confirmed: .uxprogram/logs/20260916-211651-c1-claim2-confirm.log
- Claim 3 confirmed: .uxprogram/logs/20260916-211702-c1-claim3-confirm.log

## Lens: Track C (Effort, Ergonomics & Cognitive Load)
Focus: Minimize user physical keystrokes and mental decisions across primary goals; eliminate data loss upon accidental interruption; ensure zero layout shifts.

## Screen inventory
| Route or screen | Source file | Walked | Before shots |
|---|---|---|---|
| /inbox | app/inbox/page.tsx | YES | .uxprogram/shots/C-c1/before/inbox/ |
| /c/[slug] | app/c/[slug]/page.tsx | YES | .uxprogram/shots/C-c1/before/send/ |
| /offer/[offerId] | app/offer/[offerId]/page.tsx | YES | .uxprogram/shots/C-c1/before/offer/ |
| /sent | app/sent/page.tsx | YES | .uxprogram/shots/C-c1/before/sent/ |
| / | app/page.tsx | YES | .uxprogram/shots/C-c1/before/home/ |

## Core goal walkthroughs
| Goal | Flow id | Taps | Decisions | Effort s | Friction | Evidence |
|---|---|---|---|---|---|---|
| send confession | send-confession | 2 | 2 | 13.60 | high | .uxprogram/logs/20260916-211852-c1-effort-calc.log |
| view inbox | view-inbox | 1 | 1 | 2.55 | low | .uxprogram/logs/20260916-211852-c1-effort-calc.log |
| offer mutual reveal | offer-mutual-reveal | 2 | 1 | 4.25 | medium | .uxprogram/logs/20260916-211852-c1-effort-calc.log |
| respond mutual reveal | respond-mutual-reveal | 1 | 1 | 3.05 | low | .uxprogram/logs/20260916-211852-c1-effort-calc.log |
| onboarding and terms | onboarding-terms | 1 | 1 | 3.05 | low | .uxprogram/logs/20260916-211852-c1-effort-calc.log |

## Interruption and recovery baseline
- **Compose Draft Interruption:** On `/c/[slug]`, if user refreshes, switches tabs, or receives an incoming call during composition, 100% of typed draft content is permanently lost.
- **Mutual Reveal Selection Friction:** Prompt suggestion chips in `RevealCard` display suggestions as passive text spans rather than 1-tap interactive auto-fill selectors, requiring manual typing into inputs.
- **Outbox Cognitive Load:** Sent messages on `/sent` render as an unorganized flat list without instant state filtering.

## Pain points
| ID | Where | Pain point | Measured | Evidence | From queue |
|---|---|---|---|---|---|
| CP-01 | /c/[slug] | Accidental refresh or tab backgrounding permanently discards typed confession draft | 100% draft loss on refresh | .uxprogram/facts.md | no |
| CP-02 | /inbox (RevealCard) | Prompt suggestion chips do not auto-fill question and stake inputs on tap | 40 extra keystrokes required | .uxprogram/logs/20260916-211852-c1-effort-calc.log | no |
| CP-03 | /sent | Lack of quick filter by status creates cognitive scanning friction on long outboxes | 0 filter controls | app/sent/page.tsx | no |
| CP-04 | /c/[slug] | Absence of visual auto-save confirmation leaves user uncertain of draft safety | 0 draft status indicator | app/c/[slug]/page.tsx | no |

## Backlog ideas re-checked
- Local Draft Auto-Persistence & Session Restore (Score: 4.40)
- Optimistic Offline Queue with Reconnect Syncer (Score: 4.20)
- Pre-formatted Social Story Cards with Quick-Copy Channels (Score: 4.15)
- Seamless In-Flow Auth & Launchpad Hub (Score: 3.90)
- Empathetic Arabic Linguistic Reflection Gate (Score: 3.45)
