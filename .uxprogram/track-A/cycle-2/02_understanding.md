# Understanding A2

## State of the product
Confession has completed Round 1 across all four UX tracks with 306 automated tests passing and verified anonymity and security guarantees. In Cycle A2, our structural UX lens identifies critical information architecture and wayfinding omissions: /inbox and /sent exist as isolated screens with no top-level navigation bar for active users; the mutual reveal offer response screen lacks a non-destructive cancellation path, forcing users to either accept or permanently decline; the unauthenticated landing page lacks a 3-step feature discovery walk; and the compose screen lacks proactive minimum-length feedback before submission.

## Personas
- Layla (22, Student): Mobile Safari on iPhone. Has received confessions in her inbox and sent several from her outbox. Gets frustrated having to re-navigate or retype URLs to check her sent status. Context: ASSUMPTION.
- Karim (25, Designer): Android Chrome. Received a mutual reveal offer. Wants to review his other messages first before deciding, but only sees 'وافق وجاوب' and 'لأ، مو هلق' (which permanently declines). Context: ASSUMPTION.
- Tariq (18, New visitor): Arrives at root URL / from friend bio link. Has never seen an anonymous confession platform and cannot tell how the service works before committing to sign-in. Context: ASSUMPTION.

## Job stories
- When I am actively receiving and sending confessions, I want to seamlessly switch between my inbox and my outbox, so I can track both incoming messages and outgoing offers without friction.
- When I receive a mutual reveal offer, I want to safely return to my outbox without prematurely declining the offer, so I can preserve my choice and decide when I am ready.
- When I visit the home page for the first time, I want to see how the anonymous confession and mutual unmasking loop works, so I can understand the service value before signing in.
- When I compose a confession, I want clear feedback on the required length before hitting submit, so I avoid validation errors.

## Root causes
- RC-A201: Navigational silos & broken wayfinding between active inbox and outbox views (A2-P01)
- RC-A202: Trapped decision architecture on mutual reveal offer response screen (A2-P02)
- RC-A203: Discovery void on unauthenticated home landing page for first-time visitors (A2-P03)
- RC-A204: Missing proactive input constraint guidance on confession composition (A2-P04)

## Opportunities
| Rank | ID | Root cause | Impact | Frequency | Reach | Confidence | Effort | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | RC-A201 | Global top-level navigation tab bar linking /inbox and /sent | 5 | 5 | 5 | 3 | 2 | 187.5 |
| 2 | RC-A202 | Safe cancellation & non-destructive back navigation on /offer/[offerId] | 4 | 3 | 3 | 3 | 1 | 108.0 |
| 3 | RC-A203 | 3-step visual feature discovery preview card on unauthenticated landing page | 4 | 4 | 4 | 3 | 2 | 96.0 |
| 4 | RC-A204 | Proactive minLength validation feedback on compose screen | 3 | 3 | 4 | 3 | 1 | 81.0 |

## Design principles audit
- Absolute anonymity by construction: KEEP (bedrock invariant).
- Sincere, unhurried Arabic voice: KEEP (cultural resonance).
- Reciprocal warmth over cold closure: KEEP (Principle 5 from D1).
- Isolated single-purpose screens without wayfinding: KILL (causes disorientation).
- Irreversible binary buttons disguised as neutral actions: KILL (violates user control and freedom).
