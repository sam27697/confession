# Decision records

## D-001 2026-09-16 Setup Step 7
DECISION: Install playwright dev-dependency for automated UI verification
WHY: Hard Rule 5 and Setup Step 7 permit test-only dev dependencies. The ux_probe tool requires playwright for headless chromium rendering, geometry measurement, and axe-core accessibility auditing.
ALTERNATIVES: Manual inspection without automated probe (rejected: violates Hard Rule 1 proof requirements).
REVERSIBLE: yes, npm uninstall playwright
REVERSES: none

## D-002 2026-09-16 A1 Step 3
DECISION: Adopt 4 core design principles: Never break the flow, Mutual trust is balanced, One tap to share, Clear recovery at the point of action
WHY: Solves the concrete disputes identified in Step 1 exploration regarding authentication return paths, send confirmation dead-ends, mutual reveal discovery, and mobile link sharing.
ALTERNATIVES: Generic usability guidelines (rejected: lacks actionable constraints specific to confession/mutual-reveal).
REVERSIBLE: yes, can be evolved in later cycles.
REVERSES: none

## D-003 2026-09-17 D1 Step 3
DECISION: Adopt Principle 5: Reciprocal warmth over cold closure
WHY: Solves Track D disputes DP-03 and DP-04 where terminal states (empty inbox/outbox and post-send confirmation) were emotionally sterile and dead ends. Mandates celebratory reassurance and reciprocal pathways to invite users to create their own link.
ALTERNATIVES: Leave post-send as passive receipt; rely on standard blank empty states (rejected: harms viral loop and creates emotional coldness).
REVERSIBLE: yes, can be refined in future cycles.
REVERSES: none

## D-004 2026-09-17 D1 Step 14
DECISION: Standardize on Web Share API level 2 with companion caption copy over proprietary Instagram URL schemes
WHY: Spike D1-T05 demonstrated that mobile browser sandboxing prevents arbitrary web pages from passing image pasteboard data into instagram-stories://share without native bridges, whereas Web Share API provides 92%+ reliable coverage on mobile browsers with zero sandboxing risk.
ALTERNATIVES: Hardcode instagram-stories scheme without image payload (rejected: opens blank camera, degraded UX).
REVERSIBLE: yes.
REVERSES: none

## D-005 2026-09-17 A2 Step 3
DECISION: Adopt Principle 6: Safe exits and sovereign wayfinding
WHY: Solves A2-P01 and A2-P02 where /inbox and /sent existed in silos without persistent switching navigation, and the offer response screen lacked a non-destructive exit path back to the outbox.
ALTERNATIVES: Rely on browser back button only (rejected: breaks heuristic #3 and causes high abandonment/mistaken declines).
REVERSIBLE: yes.
REVERSES: none
## D-006 2026-09-17 B2 Step 3
DECISION: Adopt Principle 7: Token discipline before visual novelty
WHY: After A2 additions, raw literal values in new CSS classes (home-step__badge, home-step__text, compose-rule) plus undefined --dur-hover and --ease-standard tokens dropped token adoption from 60.1% to 44.9%. The token contract (tokens.md v1) already contains the correct values; the issue is discipline not coverage.
ALTERNATIVES: Accept raw literals as acceptable in new classes (rejected: creates entropy that compounds across cycles and defeats tokens.md v1 investment).
REVERSIBLE: yes.
REVERSES: none
## D-007 2026-09-17 C2 Step 3
DECISION: Focus Cycle C2 on zero-keystroke input inspiration, auto-expanding textarea geometry, and 1-tap outbox copying
WHY: Measures from effort_calc show send-confession requires 13.60s KLM with 40 manual keystrokes and high blank-canvas hesitation. Providing 1-tap starter chips and adaptive textarea sizing eliminates mobile scrolling strain and reduces cognitive effort without constraining expression.
ALTERNATIVES: Add character countdown bells or mandatory prompt wizards (rejected: adds pressure and increases interaction friction).
REVERSIBLE: yes.
REVERSES: none.
## D-008 2026-09-17 D2 Step 3
DECISION: Focus Cycle D2 on viral confession reaction sharing, daily Levantine community sparks, and celebratory unmasking payoff
WHY: While personal link sharing is supported by StoryCard, recipients in /inbox currently lack an anonymized reaction share loop to post received confessions to Instagram/WhatsApp stories. Coupling 1-tap reaction share cards with daily rotating Levantine sparks closes the viral loop and gives users recurring reasons to return.
ALTERNATIVES: Generic external social icons (rejected: lacks personalized emotional content; provides poor viral conversion).
REVERSIBLE: yes.
REVERSES: none.
