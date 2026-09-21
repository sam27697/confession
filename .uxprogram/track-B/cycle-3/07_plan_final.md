# Plan final B3

## Evaluator notes addressed
- **B3-E01 (Outline offset on narrow viewports):** Accepted. Constrain `:focus-visible` outline-offset to 2px with `--ground-deep` halo separation, preventing edge-clipping on 390px mobile screens.
- **B3-E02 (Radial vignette rendering):** Accepted. Use `var(--citron-wash)` fading to `transparent` for smooth, non-banding alpha gradient transitions across OLED and standard display panels.
- **B3-E03 (Token adoption measurement):** Accepted. Measure token adoption via clean AST / comment-stripped CSS parser to guarantee accurate ratio tracking.

## Finalized task scope
1. **B3-T01 (Signature):** Unified high-contrast double-ring focus halo with offset token across interactive elements (`app/globals.css`).
2. **B3-T02:** Luminous compose well focus elevation with concentric inner glow on `/c/[slug]` (`app/c/[slug]/page.tsx`, `app/globals.css`).
3. **B3-T03:** Atmospheric dark-mode vignette framing with citron ambient wash on empty states on `/inbox` and `/sent` (`app/inbox/page.tsx`, `app/sent/page.tsx`, `app/globals.css`).
4. **B3-T04:** Comprehensive design token audit & codification across components (`app/globals.css`).
5. **B3-T05 (Spike):** Spike interactive parallax stardust starfield canvas on `ux/spike-B-c3-stardust-canvas`.

## Human checklist additions
- HC-33: Visual sharpness and non-obscuring clarity of keyboard focus halos (B3-T01)
- HC-34: Intimate visual warmth and tactile feedback of compose well focus elevation (B3-T02)
- HC-35: Atmospheric comfort and OLED depth perception in empty states (B3-T03)
- HC-36: Developer ergonomics and consistency of design tokens (B3-T04)
