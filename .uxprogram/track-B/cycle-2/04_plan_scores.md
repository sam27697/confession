# Plan scores B2

## Scores
| Area | Concept | Tier | Impact | Principles | Distinctiveness | Effort | Safety | Maintainability | Weighted | Reason |
|---|---|---|---|---|---|---|---|---|---|---|
| motion-tokens | Fallback Timing Declarations in Transition Rules | Safe | 3 | 4 | 2 | 5 | 5 | 5 | 3.75 | Defines local CSS transition fallbacks but leaves global root tokens incomplete |
| motion-tokens | Formalized Global Motion Tokens Contract in :root | Bold | 5 | 5 | 4 | 5 | 5 | 5 | 4.85 | Explicitly defines --dur-hover and --ease-standard in :root and tokens.md eliminating silent fallbacks globally |
| motion-tokens | Dynamic Physics-Based Spring Timing Engine in CSS | Wild | 3 | 3 | 5 | 2 | 3 | 2 | 3.05 | Complex spring simulation requires client-side animation runtime or oversized cubic-bezier matrices |
| token-adoption | Spot Replacement of Font-Size in Home Steps | Safe | 3 | 4 | 2 | 5 | 5 | 5 | 3.75 | Addresses only the single 0.875rem literal while leaving line-height and padding raw |
| token-adoption | Comprehensive A2 Component Tokenization & Strict Adoption Sweep | Bold | 5 | 5 | 4 | 4 | 5 | 5 | 4.70 | Replaces all raw literals in home-step, compose-rule, and app-nav with semantic tokens restoring token adoption |
| token-adoption | Automated CSS AST Token Linter in Pre-commit Pipeline | Wild | 4 | 5 | 5 | 4 | 4 | 4 | 4.35 | Static pre-commit AST scanner checking for raw literals and undefined variables; within 10 percent of winner requiring spike |
| active-nav-indicator | Color Inversion and Underline on Active Tab | Safe | 3 | 4 | 3 | 5 | 5 | 5 | 3.90 | Basic text underline on active tab lacks pill container depth and signature polish |
| active-nav-indicator | Luminous Citron Active Tab Pill with Bottom Accent Hairline | Bold | 5 | 5 | 5 | 4 | 5 | 5 | 4.85 | Enhances active tab with subtle citron glow, 2px bottom accent indicator, and surface-2 elevation |
| active-nav-indicator | Bilateral Sliding Liquid Motion Navigation Island | Wild | 3 | 3 | 5 | 2 | 2 | 2 | 2.95 | Requires complex client-side layout measurement and DOM morphing that breaks without JavaScript |
| discovery-step-hierarchy | Simple Number Prefix and Plain Text Weight | Safe | 3 | 4 | 2 | 5 | 5 | 5 | 3.75 | Removes badge container entirely in favor of plain numbered list feeling unpolished and generic |
| discovery-step-hierarchy | Solid Citron Step Roundels with High-Contrast Inverted Numerals | Bold | 5 | 5 | 4 | 5 | 5 | 5 | 4.85 | Replaces low-contrast citron-wash with solid citron background and high-contrast text-on-accent |
| discovery-step-hierarchy | Interactive Perspective 3D Carousel for Onboarding Cards | Wild | 2 | 2 | 4 | 2 | 3 | 2 | 2.40 | Heavy 3D tilt effects cause disorientation on mobile viewports and crowd Arabic text readability |
