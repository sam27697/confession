# Understanding B1

## State of the product
Following Cycle A1, Confession has strong structural flows, non-dead-end navigation, 1-tap sharing, and accessible form recovery. However, from the UI craft, interaction design, and token hierarchy lens, the design system lacks a codified central 	okens.md contract. Several interactive components (secondary buttons, prompt chips) lack complete micro-interaction feedback (focus rings, hover lift, tactile active press scale), and card elevations across /inbox, /offer, and /sent exhibit minor surface-depth variance. Cycle B1 builds this foundation, formalizing 	okens.md version 1, completing component state transitions, and establishing the visual direction.

## Personas
- Layla (22, Student): Mobile Safari on iPhone, evening browsing. Expects comfortable reading in dark mode without harsh contrast glare or muddy surfaces. Context: ASSUMPTION.
- Karim (25, Designer): Android Chrome. Appreciates deliberate visual hierarchy, crisp card outlines, and consistent elevation tokens. Context: ASSUMPTION.
- Noor (19, First-timer): Low patience for sluggish or flat UI; expects instant tactile feedback on touch (<100ms) with visible active press scaling. Context: ASSUMPTION.

## Job stories
- When I read confidential messages at night, I want deep indigo surfaces with clear typography contrast, so I can read comfortably without eye strain.
- When I tap buttons or prompt chips, I want immediate tactile press-scale feedback and clear focus states, so I have confidence in my actions.
- When I review confession cards across different viewports, I want consistent card radius, elevation shadows, and Arabic line-height air, so the experience feels cohesive and dignified.

## Root causes
- RC-B01: Missing central token contract (	okens.md) & unaligned token adoption across components (BP-03)
- RC-B02: Inconsistent card surface hierarchy, borders, and elevation depths (BP-01)
- RC-B03: Incomplete interactive micro-states (hover, focus ring, active press-scale) on secondary controls and chips (BP-02, BP-04)
- RC-B04: Arabic typographic rhythm and line-height tuning across varied card viewports (BP-04)

## Opportunities
| Rank | ID | Root cause | Impact | Frequency | Reach | Confidence | Effort | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | RC-B01 | Central design tokens foundation (	okens.md v1) | 5 | 5 | 5 | 5 | 2 | 312.5 |
| 2 | RC-B03 | Interactive micro-states, press scale & focus rings | 4 | 5 | 5 | 4 | 2 | 200.0 |
| 3 | RC-B02 | Unified card surface hierarchy & elevation scale | 4 | 4 | 4 | 4 | 2 | 128.0 |
| 4 | RC-B04 | Arabic typographic rhythm & notch card polish | 3 | 4 | 4 | 4 | 2 | 96.0 |

## Visual direction board
1. **Direction 1 (Safe): Pure System Clean**
   - Palette: Neutral slate dark ground (#0f172a), crisp white text, monochrome accents.
   - Type pairing: System Arabic, standard weights, flat cards.
   - Reference mood: Clean native utility application.
2. **Direction 2 (Bold - Selected Direction): Deep Indigo & Acid Citron**
   - Palette: Deep midnight indigo ground (#070512), acid-citron primary (#D6F25B), dusty-rose reveal (#E39BA8).
   - Type pairing: System Arabic with heavy weight contrast (Bold/Black headers, Medium body), zero tracking.
   - Shape language: Asymmetric speech bubble notch (--radius-bubble), pill buttons, inset fields.
   - Motion personality: Calm, snappy (150ms-220ms ease-out), tactile press scale (0.97).
   - Reference mood: Modern, confidential, intimate, bold Arabic editorial design.
3. **Direction 3 (Wild): Intimate Dark Atmospheric Veil**
   - Palette: Pure black ground (#000000), multiple multi-hue colored gradients, heavy drop shadows.
   - Type pairing: High contrast stylized display fonts, animated borders.
   - Reference mood: Cyberpunk confidential social network.

Winner: **Direction 2 (Deep Indigo & Acid Citron)**.

## Signature element
The **Asymmetrical Speech Bubble Notch** (--radius-bubble: var(--radius-lg) var(--radius-lg) var(--radius-notch) var(--radius-lg)), cutting the bottom-left corner in RTL where voice leaves the bubble, paired with the elevated reciprocal reveal card.
