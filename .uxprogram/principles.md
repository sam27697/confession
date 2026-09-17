# Design principles

## 1. Never break the flow
RULE: Every action finishes with a clear next step and preserves user destination context.
IN PRACTICE: Unauthenticated users visiting a confession link preserve their target via ?next= during signin. After sending a confession, offer direct pathways to view sent history in /sent or copy the link.
ANTI-EXAMPLE: Bouncing a user to / on signin without redirecting back to /c/[slug], or displaying a send confirmation with zero next actions.
SETTLES: A1-P01 and A1-P02 (dead-end on send and authentication destination loss).

## 2. Mutual trust is balanced
RULE: Reciprocal revelation requires equal clarity and simultaneous unmasking without hidden mechanics.
IN PRACTICE: The mutual reveal interface presents the reciprocal question and stake prominently with clear explanations of what is exposed, rather than burying it inside an unstyled details dropdown.
ANTI-EXAMPLE: Hiding «صارحني بدورك» inside a collapsed disclosure widget where users cannot discover what the mechanic commits them to.
SETTLES: A1-P03 (low discovery of mutual reveal mechanic).

## 3. One tap to share
RULE: Distributing a confession link must never require manual URL text selection on touch screens.
IN PRACTICE: The inbox and share card provide a prominent 1-tap action integrating the Web Share API on mobile and instant clipboard copy with affirmative feedback.
ANTI-EXAMPLE: Presenting a plain input box with a URL and expecting mobile users to long-press and select text.
SETTLES: A1-P04 (empty inbox first-run distribution friction).

## 4. Clear recovery at the point of action
RULE: Errors must associate directly with the affected input and guide immediate resolution.
IN PRACTICE: Form validation errors use aria-describedby and focus the invalid field rather than showing disconnected top-level banners.
ANTI-EXAMPLE: Displaying a distant error banner at the top of the viewport with ?error=short while the textarea remains unmarked.
SETTLES: A1-P05 (form error diagnostics).

## 5. Reciprocal warmth over cold closure
RULE: Every emotional terminal state must celebrate human vulnerability and open a natural reciprocal pathway.
IN PRACTICE: Post-send confirmation celebrates message dispatch with a warm celebratory moment and invites the sender to open their own secret box to experience the loop reciprocally, while empty states provide inspirational Levantine prompt seeds rather than barren dead ends.
ANTI-EXAMPLE: Showing a sterile one-line receipt notice «الرسالة وصلت.» without next steps, or a blank empty state «ما عندك رسائل بعد» that leaves the user with nothing to do.
SETTLES: DP-03 and DP-04 (cold empty states and dead-end send catharsis).

## 6. Safe exits and sovereign wayfinding
RULE: Every screen must provide an obvious, non-destructive return path, and primary views must maintain persistent two-way wayfinding.
IN PRACTICE: The mutual reveal offer screen provides a clear non-destructive back link to /sent so users can reflect without prematurely declining, and core views (/inbox and /sent) share an intuitive navigation tab bar enabling seamless switching.
ANTI-EXAMPLE: An offer response screen whose only exit other than accepting is irreversible decline «لأ، مو هلق», or an inbox with zero navigation link to access sent confessions.
SETTLES: A2-P01 and A2-P02 (navigation disconnect between inbox/sent and trapped offer decision screen).
## 7. Token discipline before visual novelty
RULE: Every color, size, spacing, radius, duration, and easing value must reference a CSS custom property from the token contract before any raw literal is accepted.
IN PRACTICE: Before adding any new CSS rule, verify that every value references var(--...). Raw literals are permitted only as token default values inside :root{}, not as inline style decisions in component rules.
ANTI-EXAMPLE: Adding font-size:0.875rem or line-height:1.6 inside a component class while var(--size-caption) and var(--lh-tight) exist in the token contract.
SETTLES: B2-RC201 and B2-RC202 (raw literal drift after A2 additions reducing token adoption from 60.1% to 44.9%).
