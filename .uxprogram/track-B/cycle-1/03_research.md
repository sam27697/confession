# Research B1: UI Visual and Interaction Design

## 1 Patterns per opportunity

### RC-B01: Central design tokens foundation (tokens.md v1)
- Token Taxonomy and Tiering: Established industry practice separates tokens into global/base tiers, semantic tiers, and component-scoped overrides. Documenting these in tokens.md creates a single source of truth that prevents drift between design specifications and implementation.
- Pure CSS Variable Architecture: Defining semantic CSS variables directly on :root without external CSS preprocessors eliminates runtime bundle bloat and guarantees instant client paint with zero hydration delay.

### RC-B02: Unified card surface hierarchy and elevation scale
- Dark Theme Tonal Surface Elevation: In dark mode, traditional drop shadows are nearly invisible against dark grounds. Material Design and Apple HIG recommend using lighter surface tones and subtle inner hairlines to express vertical elevation and separation from the page background.
- Surface Layering Progression: Ground deep to page ground to surface-1 to surface-2 to inset well. This consistent 5-layer hierarchy provides clear spatial depth without relying on harsh borders.

### RC-B03: Interactive micro-states, press scale and focus rings
- Tactile Active Press Scaling: Transforming interactive buttons by scale(0.97) on :active with an instant 90ms duration provides instant tactile acknowledgment on touchscreens, mimicking physical key actuation.
- Accessible Two-Tone Focus Rings: WCAG 2.2 and 1.4.11 require non-text focus indicators to have at least 3:1 contrast against both the component and the surrounding background. A double ring guarantees clear visibility on any dark surface.

### RC-B04: Arabic typographic rhythm and notch card polish
- Script-Specific Line-Height Tuning: Arabic script features complex ascenders, descenders, and diacritics that overlap or clip when forced into standard Latin line-heights. Setting body line-height to 1.75 provides the necessary vertical breathing room.
- Asymmetrical Speech Bubble Notch: Cutting one corner (bottom-left in RTL) to a tight 10px radius while maintaining 28px on the other three corners visually identifies the card as an anonymous spoken confession without adding extraneous SVG bubble tails.

## 2 Cross-industry transfers
- Horology luxury watch dials: Using deep obsidian and indigo matte backgrounds with micro-textured borders and acid-citron indicator hands to create an impression of precision and discretion.
- Japanese lacquerware (Urushi): Applying delicate subtle inner rim highlights rather than outer drop shadows to convey depth and preciousness in dark environments.
- Mechanical typewriter and keyboard switches: Translating physical key travel feedback into a subtle 3 percent tactile depression (transform: scale(0.97)) on control press.
- Audio mastering hardware and analog consoles: Applying damped rotary resistance and illuminated tactile toggle switches that confirm operational state without visual ambiguity.
- Architectural museum and gallery lighting: Utilizing ambient floor and wall wash scrims that gently define private viewing alcoves without harsh spotlight glare.

## 3 Laws and principles applied
- Weber-Fechner Law: Perception of surface depth in dark themes requires geometric steps in lightness and edge contrast rather than linear luminance increases.
- Fitts's Law: Touch targets must maintain minimum 48x48px boundaries with generous hit slop to prevent missed taps on mobile viewports.
- Gestalt Law of Common Region: Well-defined card boundaries with consistent hairlines firmly bind confession content, sender identity clues, and reveal actions into a cohesive mental unit.

## 4 Platform guidance
- W3C Design Tokens Community Group: Tokens should follow strict semantic naming conventions (category-property-variant-state) ensuring maintainability across platforms.
- Apple Human Interface Guidelines (Dark Mode): Avoid pure white text on pure black backgrounds; use layered dark surfaces with varying tonal luminance to establish hierarchy.
- WCAG 2.2 Non-Text Contrast (1.4.11): Visual boundaries of user interface components and states must maintain at least 3:1 contrast ratio against adjacent backgrounds.

## 5 Anti-patterns to avoid
- Full-page multi-hue background gradients that distract from intimate Arabic reading.
- Letter-spacing (tracking) applied to Arabic text, which severs connected cursive letterforms.
- Reliance on external web font CDNs that leak recipient reading behavior to third parties.
- Overuse of heavy bouncy animations that detract from the serious emotional weight of confidential confessions.

## 6 Nobody does this yet
- Asymmetrical RTL speech notch curvature that physically mirrors the directional departure point of spoken voice in Levantine Arabic.
- Zero-network privacy-hardened design system where 100 percent of visual depth, glows, and veils are pure CSS mathematical vectors with zero external assets.
- Distinct reciprocal reveal visual coding (dusty-rose strictly reserved for two-way identity unmasking, separated from citron primary interactions).

## 7 Risks and unknowns
- Mobile browser rendering variance of complex CSS radial veils across low-end GPU chipsets.
- Contrast verification of muted metadata text across OLED and LCD displays under direct sunlight.
- Parity synchronization between app/globals.css and the design token contract in tokens.md.

## References
- W3C Design Tokens Community Group (DTCG). (2024). Design Tokens Format Module Specification. [VERIFIED https://design-tokens.github.io/community-group/format/ 2026-09-16]
- Apple Inc. (2024). Human Interface Guidelines: Dark Mode and Color System. [VERIFIED https://developer.apple.com/design/human-interface-guidelines/dark-mode 2026-09-16]
- Google LLC. (2024). Material Design 3: Color roles, tonal palettes, and elevation in dark themes. [VERIFIED https://m3.material.io/styles/color/dark-theme 2026-09-16]
- Smashing Magazine. (2021). The Wonders Of Arabic Typography: Script Rules And Digital Implementation. [VERIFIED https://www.smashingmagazine.com/2021/04/wonders-arabic-typography/ 2026-09-16]
- Nielsen Norman Group (NNG). (2021). Microinteractions in User Experience: Feedback and Tactile States. [VERIFIED https://www.nngroup.com/articles/microinteractions/ 2026-09-16]
- W3C Web Accessibility Initiative (WAI). (2023). Understanding Success Criterion 1.4.11 Non-text Contrast. [VERIFIED https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html 2026-09-16]
