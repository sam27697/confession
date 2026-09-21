# Research B3: High-Contrast Focus Visibility, Atmospheric Depth, and Luminous Well Micro-Interactions

## 1 Patterns per opportunity
- **RC-B301 (Keyboard Focus Indicator):** Double-ring `:focus-visible` halo. A 2px dark baseline inner gap (`--ground-deep` or `outline-offset: 2px`) followed by a 2px vibrant citron stroke (`--citron-500`) ensures clear luminance separation across both light backgrounds and deep indigo OLED dark surfaces without relying on browser defaults.
- **RC-B302 (Luminous Compose Well):** Concentric inner glow on active focus. Transitioning `--surface-inset` into a gently elevated focus well (`box-shadow: inset 0 0 0 1px var(--citron-500), 0 0 12px -2px var(--citron-glow)`) signals an active, welcoming canvas for intimate anonymous expression without causing layout shifts.
- **RC-B303 (Atmospheric Empty State Framing):** Subtle radial vignette backdrop. Layering an ambient radial gradient (`radial-gradient(ellipse at 50% 0%, var(--citron-wash) 0%, transparent 70%)`) above `--surface-1` grounds empty inbox and outbox views in dark themes, transforming cold vacant boxes into inviting discovery spaces.
- **RC-B304 (Design Token Discipline):** Codification of remaining component literals into semantic tokens (`--radius-card`, `--space-4`, `--size-caption`, `--text-muted`), raising global CSS token adoption toward 55%+.

## 2 Cross-industry transfers
- Modern code editors (VS Code / JetBrains): High-contrast 2px accent focus halos around active terminal splits and editor gutters provide immediate spatial orientation for power keyboard operators.
- Architectural exhibition galleries (Tate / Louvre): Spotlit plinths and soft halo backlighting focus visitor gaze onto singular featured artifacts while leaving the periphery in calming ambient darkness.
- Physical luxury stationery (Moleskine / Smythson): Indented ruled embossing and gold-gilded edges provide tactile and visual feedback when opening fresh journal pages.
- High-end audio mixing hardware (Teenage Engineering / SSL): Subtle rotary glow rings illuminate active potentiometers, indicating active focus without cluttering the control deck.
- Automotive night instrumentation (Porsche / Polestar): Contrast-boosted active dials on OLED cluster displays maintain high legibility and night-vision comfort through tailored ambient washes.

## 3 Laws and principles applied
- **Fitts's Law:** Interactive touch and focus boundaries must retain comfortable target sizes (>= 44x44px) and clear visual margins for effortless pointing and keyboard jumping.
- **Weber-Fechner Law:** Perceived contrast of a focus ring against a dark surface is logarithmic; a double-ring boundary (dark separation band plus vibrant accent) creates perceived pop even against variegated card backgrounds.
- **Principle 7 (Token discipline before visual novelty):** Every visual enhancement must derive from codified design tokens rather than ad-hoc hex values or hardcoded pixel numbers.
- **Gestalt Law of Common Region:** Atmospheric framing encircling empty state containers groups headline, icon, and call-to-action into a cohesive mental entity.

## 4 Platform guidance
- **WCAG 2.2 Success Criterion 2.4.7 (Focus Visible) & 2.4.11 (Focus Not Obscured):** Any keyboard-operable interface element must have a mode of operation where the keyboard focus indicator is visible and satisfies at least 3:1 contrast against adjacent background colors.
- **Apple Human Interface Guidelines (Focus and Selection):** Focus indicators should be crisp, follow the shape of the component, and use distinct outline colors with appropriate padding.
- **Google Material Design 3 (States & Elevation):** Focus state uses an explicit focus indicator outline (3px stroke or 2px outline with offset) paired with a 10% state layer wash to confirm selection.

## 5 Anti-patterns to avoid
- Relying on browser default focus rectangles (`outline: auto`): Browser defaults in dark themes render faint blue or gray hairlines that disappear against dark slate/indigo backgrounds.
- High-intensity blinking or strobing focus rings: Distracts from content readability and triggers sensory fatigue.
- Layout-shifting focus borders: Changing `border-width` on focus pushes surrounding elements, creating visual jitter. Use `box-shadow` or `outline` with `outline-offset` instead.
- Overpowering glowing text shadows on input: Blurs Arabic letterforms and damages character legibility.

## 6 Nobody does this yet
- Ambient Levantine nocturnal glow: An adaptive subtle radial gradient that mirrors Levantine evening warmth in dark mode, grounding anonymous secret sharing in intimate regional atmosphere.
- Bilateral double-ring focus halos specifically tuned for Arabic RTL typography: Symmetrically balanced focus halos that avoid clipping complex Arabic ascenders and descenders.
- Dual-depth compose well feedback: Textarea that physically deepens its inner shadow while simultaneously illuminating its border as characters are entered.

## 7 Risks and unknowns
- Risk: Outline clipping by parent elements with `overflow: hidden`. Mitigated: Using `outline-offset: 2px` or composite `box-shadow` that renders within safe bounds.
- Risk: Too much ambient glow distracting from core confession text. Mitigated: Restricting radial vignette washes to 10% opacity (`--citron-wash`).

## References
- W3C Web Accessibility Initiative (WAI). (2023). Understanding Success Criterion 2.4.7: Focus Visible. [VERIFIED https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html 2026-09-18]
- Mozilla Developer Network (MDN). (2024). :focus-visible CSS pseudo-class. [VERIFIED https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible 2026-09-18]
- UK Government Digital Service. (2024). GOV.UK Design System: Focus state styling and accessibility guidelines. [VERIFIED https://design-system.service.gov.uk/styles/focus-state/ 2026-09-18]
- Apple Inc. (2024). Human Interface Guidelines: Focus and Selection. [VERIFIED https://developer.apple.com/design/human-interface-guidelines/focus-and-selection 2026-09-18]
- Google LLC. (2024). Material Design 3: State layers, focus states, and elevation overlays. [VERIFIED https://m3.material.io/foundations/interaction/states 2026-09-18]
- Nielsen Norman Group (NNG). (2022). Keyboard-Only Users: Focus Indicators and Visual Clarity. [VERIFIED https://www.nngroup.com/articles/focus-indicators/ 2026-09-18]
