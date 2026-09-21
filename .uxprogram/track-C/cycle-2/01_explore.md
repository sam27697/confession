# Explore C2: Cognitive Ergonomics, Keystroke Elimination, and Form Comfort

FRESHNESS: .uxprogram/logs/20260917-115049-c2-freshness.log
CLAIMS_CONFIRMED:
- Claim 1 confirmed: .uxprogram/logs/20260917-115056-c2-claim1-confirm.log
- Claim 2 confirmed: .uxprogram/logs/20260917-115105-c2-claim2-confirm.log
- Claim 3 confirmed: .uxprogram/logs/20260917-115111-c2-claim3-confirm.log

## Lens: Track C (Effort, Ergonomics & Cognitive Load)
Focus: Minimize user physical keystrokes and mental decisions across primary goals; eliminate blank-canvas hesitation; reduce mobile typing and scrolling strain; preserve zero layout shift.

## Screen inventory
| Route or screen | Source file | Walked | Before shots |
|---|---|---|---|
| /inbox | app/inbox/page.tsx | YES | .uxprogram/shots/C-c2/before/inbox/ |
| /c/[slug] | app/c/[slug]/page.tsx | YES | .uxprogram/shots/C-c2/before/send/ |
| /offer/[offerId] | app/offer/[offerId]/page.tsx | YES | .uxprogram/shots/C-c2/before/offer/ |
| /sent | app/sent/page.tsx | YES | .uxprogram/shots/C-c2/before/sent/ |
| / | app/page.tsx | YES | .uxprogram/shots/C-c2/before/home/ |

## Core goal walkthroughs
| Goal | Flow id | Taps | Decisions | Effort s | Friction | Evidence |
|---|---|---|---|---|---|---|
| send confession | send-confession | 2 | 2 | 13.60 | high | .uxprogram/logs/20260917-115121-c2-effort.log |
| view inbox | view-inbox | 1 | 1 | 2.55 | low | .uxprogram/logs/20260917-115121-c2-effort.log |
| offer mutual reveal | offer-mutual-reveal | 2 | 1 | 4.25 | medium | .uxprogram/logs/20260917-115121-c2-effort.log |
| respond mutual reveal | respond-mutual-reveal | 1 | 1 | 3.05 | low | .uxprogram/logs/20260917-115121-c2-effort.log |
| onboarding and terms | onboarding-terms | 1 | 1 | 3.05 | low | .uxprogram/logs/20260917-115121-c2-effort.log |

## Pain points
| ID | Where | Pain point | Measured | Evidence | From queue |
|---|---|---|---|---|---|
| CP-C201 | /c/[slug] | Blank canvas cognitive paralysis: senders face empty textarea requiring 40 manual keystrokes | 40 keystrokes, 13.60s KLM | .uxprogram/logs/20260917-115121-c2-effort.log | no |
| CP-C202 | /c/[slug] | Fixed textarea height causes cramped inner scrolling on longer messages on mobile | fixed rows=4 with overflow | app/c/[slug]/page.tsx | no |
| CP-C203 | /sent | Lack of 1-tap copy action on sent messages requires manual tap-hold selection | 0 copy actions | app/sent/page.tsx | no |
| CP-C204 | /offer/[offerId] | Offer responder must type freeform response from scratch without prompt suggestions | freeform typing | app/offer/[offerId]/page.tsx | no |

## Backlog ideas re-checked
- Static Form Labels with Copyable Question Prompt Snippets (Score: 3.75) | runner-up for reveal-inception C1
- Chronological Pagination with Next/Prev Page Links (Score: 3.75) | runner-up for outbox-ergonomics C1
- Manual Draft Save Button with Status Badge (Score: 3.75) | runner-up for draft-persistence C1
- Static Text Disclaimer Below Form Noting Unsaved Status Risk (Score: 3.10) | runner-up for ambient-reassurance C1
- Dynamic Auto-Expanding Textarea with Content Sizing (Score: 4.30) | Track C candidate
