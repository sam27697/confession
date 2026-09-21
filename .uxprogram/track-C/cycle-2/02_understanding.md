# Understanding C2: Cognitive Ergonomics, Keystroke Elimination, and Form Comfort

## State of the product
The confession platform has established rock-solid visual foundations, unified design tokens, and stable navigation wayfinding.
However, physical typing load and cognitive hesitation remain primary friction points across core interactions.
Visitors arriving at /c/[slug] face a blank textarea requiring 40 manual keystrokes and 13.60s KLM effort to compose a confession.
Longer confessions induce disorienting inner vertical scrolling within the fixed-height textarea on mobile screens.
Senders reviewing confessions on /sent must resort to clumsy press-and-hold gestures to copy their sent text.
Offer responders on /offer/[offerId] face formulation anxiety when answering reciprocal stakes.

## Personas
1. **Lina (Hesitant Confessor)**: 21, smartphone on transit, limited time, self-conscious. Wants to express appreciation but experiences writer's block when staring at an empty input box. [ASSUMPTION]
2. **Kareem (Active Community Host)**: 25, posts link to Instagram stories daily. Receives 15+ confessions and frequently checks /sent to review what he previously sent to friends. [ASSUMPTION]
3. **Nour (Reciprocal Responder)**: 23, receives mutual reveal offer. Wants to reply with equal vulnerability but hesitates on wording. [ASSUMPTION]

## Job stories
1. **Send Confession**: When I open a friend's anonymous link, I want quick inspirational prompts and an unconstrained typing area, so I can send an honest message without writer's block or mobile scrolling strain.
2. **Review Sent Messages**: When I look at my sent confessions, I want a 1-tap copy action, so I can quickly save or quote my sent messages without clumsy text selection.
3. **Respond to Reveal Offer**: When evaluating a mutual reveal proposition, I want quick response suggestions, so I can answer with equal honesty without friction.

## Root causes
- RC-C201: Blank-canvas hesitation on confession compose screen; users lack contextual starter chips to ignite expression (CP-C201).
- RC-C202: Textarea fixed vertical geometry forces internal scrolling on longer confessions, obscuring earlier lines on mobile (CP-C202).
- RC-C203: Sent message cards lack dedicated 1-tap copy action, requiring manual tap-and-hold selection (CP-C203).
- RC-C204: Offer response screen presents empty answer input without quick conversational formulation sparks (CP-C204).

## Opportunities
| Rank | ID | Root cause | Impact | Frequency | Reach | Confidence | Effort | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | RC-C202 | Adaptive auto-expanding compose textarea with field-sizing content | 4 | 5 | 5 | 4 | 1 | 400.0 |
| 2 | RC-C201 | 1-tap inspirational confession starter chips on compose page | 5 | 5 | 5 | 4 | 2 | 250.0 |
| 3 | RC-C203 | 1-tap quick copy action on sent message cards | 3 | 4 | 4 | 4 | 1 | 192.0 |
| 4 | RC-C204 | Contextual response starter prompts on mutual reveal answer screen | 4 | 3 | 3 | 4 | 2 | 72.0 |

## Design principles implied
- **Principle 4 (Ambient reassurance over modal friction):** Keep. The live auto-save indicator quietly assures the user without modal alerts.
- **Principle 6 (Sovereign wayfinding over fragmented links):** Keep. The sub-nav bar provides clear spatial orientation.
- **Principle 7 (Token discipline before visual novelty):** Keep. All new components must adhere strictly to design tokens.
