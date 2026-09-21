# Understanding A1

## State of the product
Confession is a robust, privacy-respecting confidential messaging application with a solid architectural foundation (Postgres 17, Next.js 15 App Router, Drizzle ORM, zero tracking). All 240 domain tests pass, and server-side anonymity constraints are strictly enforced at the database level. However, user-facing UX suffers from navigational dead-ends, lack of deep-link preservation when unauthenticated, discovery friction around the signature mutual-reveal mechanic, and an empty first-run experience that delays time-to-first-value for new account holders.

## Personas
- Layla (22, Student): Mobile Safari on iPhone, evening browsing. Wants to send an honest confession without identity exposure. High anxiety about privacy leaks. Context: ASSUMPTION.
- Karim (25, Designer): Android Chrome, daytime at work. Receives a confession in his inbox, curious about who sent it. Finds the mutual-reveal stake/question form confusing. Context: ASSUMPTION.
- Noor (19, First-timer): Joined via friend WhatsApp link. Low patience for manual URL copying, needs 1-tap Instagram/WhatsApp link sharing. Context: ASSUMPTION.

## Job stories
- When I have unspoken feelings for someone, I want to send an anonymous confession safely, so I can express myself honestly without social risk.
- When I receive a confession, I want to read it in a calm, clear interface, so I can understand the sender sentiment.
- When a confession moves me, I want to invite the sender to a mutual reveal with balanced questions, so we can unmask simultaneously.
- When I receive a mutual reveal offer, I want to understand what the recipient will share, so I can make an informed decision to accept or decline.
- When I first join, I want to easily share my personal link to my social channels, so my friends can start sending confessions immediately.

## Root causes
- RC-01: Navigation continuity gaps & dead ends (A1-P01, A1-P02, A1-P06)
- RC-02: Opaque mutual reveal mental model & buried discovery (A1-P03)
- RC-03: Passive first-run inbox state & high sharing friction (A1-P04)
- RC-04: Disconnected form error diagnostics & missing field focus (A1-P05)

## Opportunities
| Rank | ID | Root cause | Impact | Frequency | Reach | Confidence | Effort | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | RC-01 | Navigation continuity & dead-end recovery | 4 | 4 | 5 | 3 | 2 | 120.0 |
| 2 | RC-03 | 1-tap first-run link sharing & launchpad | 5 | 3 | 5 | 3 | 2 | 112.5 |
| 3 | RC-02 | Mutual reveal discovery, prompts & clarity | 4 | 4 | 4 | 3 | 3 | 64.0 |
| 4 | RC-04 | Accessible form validation & recovery | 3 | 2 | 3 | 3 | 1 | 54.0 |

## Design principles audit
- Absolute anonymity by construction: KEEP (core foundation).
- Sincere, unhurried Arabic voice: KEEP (dignified emotional tone).
- Hide actions inside native details tags: KILL (causes low discovery).
- Manual copy-paste link sharing: KILL (unnecessary friction on mobile).
