# Understanding B3

## State of the product
Confession has completed Round 2 and Track A Cycle 3 with 388 automated tests passing across the suite. The application delivers robust data sovereignty, fluid compose expansion, viral story generation, and clear navigation wayfinding. In Track B Cycle 3, our UI and visual craft lens addresses focus visibility, atmospheric spatial depth, compose well micro-interactions, and token consolidation.

## Personas
- Ziad (22, Keyboard / Power User): Navigates the web primarily via keyboard and switch controls. Currently finds interactive focus rings subtle or missing against dark backgrounds on buttons and links, needing clear, high-contrast double-ring halos to navigate confidently.
- Reem (20, Mobile Safari / Compose): Composes intimate anonymous confessions late at night on an OLED iPhone. Wants the compose textarea to feel responsive, tactile, and warmly illuminated as she begins typing.
- Fadi (24, Returning Host): Opens his empty inbox on desktop and mobile. Wants the empty state container to feel atmospheric, warmly grounded, and intentionally crafted rather than like a blank error box.

## Job stories
- When I navigate using keyboard or assistive controls, I want prominent high-contrast focus rings, so I immediately see which interactive control is active.
- When I focus the confession textarea, I want a luminous feedback state with subtle citron glow, so I feel invited into an intimate, focused writing space.
- When I view an empty inbox or sent list, I want atmospheric surface framing, so the interface feels warm and welcoming even before messages arrive.

## Root causes
- RC-B301: Inconsistent focus ring visibility across buttons, links, inputs, and chips on dark surfaces (BP-B301).
- RC-B302: Lack of luminous focus well transition on compose textarea in /c/[slug] (BP-B302).
- RC-B303: Flat surface-1 styling in empty states without atmospheric ambient depth (BP-B303).
- RC-B304: Residual hardcoded CSS literals in recent components reducing token adoption ratio (BP-B304).

## Opportunities
| Rank | ID | Root cause | Impact | Frequency | Reach | Confidence | Effort | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | RC-B301 | Unified high-contrast :focus-visible double-ring halo across all interactive elements | 5 | 5 | 5 | 3 | 1 | 375.0 |
| 2 | RC-B302 | Luminous compose well focus elevation with subtle citron inner glow on /c/[slug] | 4 | 5 | 5 | 3 | 1 | 300.0 |
| 3 | RC-B303 | Atmospheric ambient depth framing and vignette backdrop for empty states on /inbox and /sent | 4 | 4 | 4 | 3 | 2 | 96.0 |
| 4 | RC-B304 | Token consolidation replacing raw literals with codified design tokens | 3 | 5 | 5 | 3 | 1 | 225.0 |

## Design principles audit
- Absolute anonymity by construction: KEEP (bedrock invariant).
- Sincere, unhurried Arabic voice: KEEP (cultural resonance).
- Reciprocal warmth over cold closure: KEEP (Principle 5 from D1).
- Safe exits and sovereign wayfinding: KEEP (Principle 6 from A2).
- Flat, muddy interactive states: KILL (violates visual clarity and tactile responsiveness).
- Harsh browser-default focus rectangles: KILL (violates dark mode aesthetic polish and WCAG 2.4.11).
