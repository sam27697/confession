# Human checklist

## HC-01 Visual comfort and clarity of post-send launchpad (A1-T01)
STEPS:
1. Sign in as a test user and navigate to any recipient confession link /c/[slug].
2. Enter a confession and tap submit.
3. Observe the post-send screen layout, spacing, typography, and clear continuity options (such as direct links to /sent and copying own link).
EXPECTED: The post-send surface presents comfortable visual spacing, distinct hierarchy, legible Arabic typography, and clear non-dead-end action cues without layout jumps or cognitive clutter.
RESULT: 

## HC-02 Tactile responsiveness on mobile viewport (A1-T02)
STEPS:
1. Open empty inbox on a real touch device or mobile emulation.
2. Tap the share / copy button.
3. Observe tactile visual feedback, button state transition to "تم النسخ", and toast behavior.
EXPECTED: Instant visual confirmation (<100ms), comfortable touch target size (>=44x44px), smooth feedback, and fallback accessibility when clipboard is denied.
RESULT:

## HC-03 Dignity and clarity of Arabic reveal prompts (A1-T03)
STEPS:
1. Sign in to an account with a confession message in inbox.
2. Open the mutual reveal card and examine the structured prompts and suggestions.
3. Open an incoming reveal offer screen (/offer/[offerId]) and check the question vs stake preview card.
EXPECTED: Clear reciprocal mental model, respectful and culturally resonant Arabic copy, distinct visual separation between question and committed stake, zero confusion regarding when answers unlock.
RESULT:

## HC-04 Screen reader live announcement on constraint breach (A1-T04)
STEPS:
1. Navigate to /c/[slug] confession compose page with a screen reader enabled (NVDA/VoiceOver).
2. Attempt to submit an empty form, or inspect the error and live character constraint region.
3. Observe live region announcements and focus placement.
EXPECTED: Screen reader immediately announces error via role="alert" upon failure, focus shifts cleanly to the textarea, and character limit cues are perceivable.
RESULT:

## HC-06 Clarity and developer ergonomics of token naming hierarchy (B1-T01)
STEPS:
1. Inspect .uxprogram/tokens.md and compare against app/globals.css.
2. Review token categories, semantic aliases, and unit scales.
EXPECTED: Tokens are logically organized into 7 categories, use consistent semantic naming, and map 1:1 with CSS variable declarations.
RESULT:

## HC-07 Visual comfort and distinct spatial depth in dark mode (B1-T02)
STEPS:
1. Open /inbox, /sent, and /offer/[offerId] in a dark room on OLED and LCD screens.
2. Observe card surface layering, subtle inner hairlines, and background separation.
EXPECTED: Clear perception of elevation and depth across card containers without harsh contrasting borders or muddy black-on-black blending.
RESULT:

## HC-08 Tactile responsiveness and focus indicator visibility on physical devices (B1-T03)
STEPS:
1. Navigate interactive controls using keyboard (Tab / Shift-Tab) and observe focus rings.
2. Tap buttons and prompt chips on a touchscreen device.
EXPECTED: Focus rings display high-contrast double ring (2px dark / 4px citron) with sharp visibility; controls deliver subtle tactile depression on active tap.
RESULT:

## HC-09 Cultural dignity and aesthetic grace of Arabic typography layout (B1-T04)
STEPS:
1. Browse confession cards and compose form in Arabic on mobile and desktop viewports.
2. Observe asymmetrical notch orientation and vertical line-height spacing.
EXPECTED: Arabic typography breathes comfortably with 1.75 line-height; speech bubble notch is oriented to the bottom-left matching RTL speech direction.
RESULT:

## HC-10 Physical feel of haptic impulse on iOS and Android devices (B1-T05)
STEPS:
1. Open spike branch on Android Chrome and iOS Safari.
2. Actuate haptic trigger button.
EXPECTED: Android delivers crisp 10ms haptic tap; iOS degrades gracefully without throwing runtime errors.
RESULT:

## HC-11 Verification of draft preservation after browser backgrounding and restore (C1-T01)
STEPS:
1. Open confession compose page /c/[slug] and type an unfinished confession.
2. Switch apps, lock phone screen, or reload the page in browser.
3. Return to the page and verify whether the drafted text is restored intact.
EXPECTED: Confession text remains completely preserved in textarea without any loss of user input.
RESULT:

## HC-12 Verification of 1-tap prompt selection ease and fluid population (C1-T02)
STEPS:
1. Open inbox mutual reveal section.
2. Tap each of the suggestion prompt chips.
3. Verify that the question/stake inputs populate instantly with zero manual typing required.
EXPECTED: Single tap instantly fills the input field; focus transitions comfortably; no premature form submission occurs.
RESULT:

## HC-13 Subjective scanning speed and clarity of filtered sent messages (C1-T03)
STEPS:
1. Open /sent outbox with multiple sent confessions across different statuses.
2. Tap between "الكل", "معلّق", and "مكشوف" filter pills.
3. Verify that the displayed list instantly isolates the relevant status messages.
EXPECTED: Clean, immediate list filtering with zero page reload jitter; active tab clearly highlighted.
RESULT:

## HC-14 Visual subtlety and reassurance of draft status indicator in dark mode (C1-T04)
STEPS:
1. Type a confession on /c/[slug] and observe the subtle live draft save indicator.
2. Stop typing and watch for the transition to "تم الحفظ تلقائياً".
EXPECTED: Clear, calming reassurance of background save without intrusive flashing, distracting animations, or layout shift.
RESULT:

## HC-15 Visual warmth, celebratory feel, and non-intrusive layout of reciprocal inception callout (D1-T01)
STEPS:
1. Send a confession on /c/[slug] and observe the post-send confirmation screen.
2. Inspect the reciprocal box inception card, celebratory burst, and action links.
EXPECTED: Warm, culturally welcoming invitation to share personal secret link; unified single card layout with zero visual clutter or dead ends.
RESULT:

## HC-16 Tone of voice and inspiration sparks in empty states (D1-T02)
STEPS:
1. View an empty inbox and an empty outbox with zero messages.
2. Switch between filter tabs on outbox when no messages match the filter.
EXPECTED: Copy feels warmly Levantine rather than cold/sterile; prompt seeds provide clear creative inspiration to share or check back.
RESULT:

## HC-17 Typography legibility and social caption phrasing delight (D1-T03)
STEPS:
1. Open Story Card modal from inbox link block.
2. Cycle through the 6 expanded thematic prompt options and inspect the canvas preview.
3. Tap the companion social caption copy button and paste into a text field.
EXPECTED: Canvas typography wraps cleanly without clipping or footer collision; social caption text is engaging and ready for Instagram/Snapchat.
RESULT:

## HC-18 Dramatic anticipation and emotional payoff of mutual reveal resolution (D1-T04)
STEPS:
1. View a resolved mutual reveal confession in inbox and outbox.
2. Observe unmasked identity seal styling, symmetrical answer cards, and respect for prefers-reduced-motion.
EXPECTED: Ceremonial unmasking feels rewarding, dignified, and emotionally balanced between sender and recipient.
RESULT:

## HC-19 Smooth typing expansion feel of adaptive compose textarea (C2-T01)
STEPS:
1. Open /c/[slug] confession compose page on desktop and mobile browsers.
2. Type multi-line text extending beyond 5 lines up to 15 lines.
3. Observe textarea height expansion, line breathing room, and absence of internal scrollbars.
EXPECTED: Textarea expands smoothly in place according to content size without abrupt layout jumps, flickering, or inner scrollbar friction.
RESULT:

## HC-20 Cultural authenticity and composition acceleration of Levantine confession starter chips (C2-T02)
STEPS:
1. Open /c/[slug] confession compose page as an authenticated sender.
2. Tap each of the 1-tap confession starter prompt chips.
3. Verify the prompt text instantly populates the textarea without submitting the form or stuttering.
EXPECTED: Chips feel culturally natural in Levantine phrasing, instantly populate textarea on tap, focus remains comfortable, and draft autosave reflects the inserted text immediately.
RESULT:

## HC-21 Effortless 1-tap copy gesture on sent message cards (C2-T03)
STEPS:
1. Open /sent page with sent messages.
2. Tap the copy button on any sent message bubble.
3. Verify clipboard receives the message body and button updates state to "تم النسخ".
EXPECTED: 1-tap copy works instantly without requiring manual text selection or long-press gestures on touchscreens.
RESULT:

## HC-22 Form comfort and emotional nuance of contextual mutual reveal response starters (C2-T04)
STEPS:
1. Open a pending mutual reveal offer page /offer/[offerId] as the sender.
2. Tap each of the contextual response starter prompt chips.
3. Verify that the response textarea fills with the prompt text immediately without submitting the form prematurely.
EXPECTED: Response starter chips convey sincere reciprocity, fill the answer field instantly on 1 tap, and eliminate formulation anxiety.
RESULT:

## HC-23 Predictive Arabic completion latency and suggestion accuracy (C2-T05)
STEPS:
1. Open spike branch ux/spike-C-c2-predictive.
2. Type 2 characters of Arabic text in the compose textarea.
3. Observe candidate suggestions and measured lookup latency.
EXPECTED: Lookup resolves in under 1ms, suggestions align with Levantine phrasing.
RESULT:

## HC-24 Visual balance and text wrapping of Arabic quote on generated 9:16 story reaction card (D2-T01)
STEPS:
1. Open /inbox with received confessions.
2. Tap "شارك ردك بالستوري" on a confession card.
3. Observe rendered 9:16 vertical canvas graphic in preview modal and inspect companion caption copy.
EXPECTED: Story graphic presents high-contrast anonymous quote with balanced margins; companion social caption copies to clipboard on 1 tap.
RESULT:

## HC-25 Cultural tone and typography of daily spark banner in light and dark contexts (D2-T02)
STEPS:
1. Open /inbox across different days or simulated dates.
2. Observe daily rotating Levantine confession spark banner.
3. Tap the prompt copy trigger.
EXPECTED: Daily prompt feels culturally warm and engaging; copy confirmation delivers immediate feedback.
RESULT:

## HC-26 Emotional clarity of friend challenge wording and seamless clipboard copy (D2-T03)
STEPS:
1. Send a confession on /c/[slug] and inspect the post-send delivery card.
2. Locate the friend challenge section ("تحدى رفقاتك يصارحوا...").
3. Tap the group share copy link button.
EXPECTED: Copy button copies friend's link with clear group sharing context and affirmative visual feedback.
RESULT:

## HC-27 Warmth and non-distracting visual elegance of the unmasking glow (D2-T04)
STEPS:
1. View resolved mutual reveal cards on /sent and /inbox.
2. Inspect celebratory unmasking glow border and bilateral confirmation copy.
EXPECTED: Warm amber/citron ambient glow and affirmation celebrate mutual honesty without obscuring answer readability.
RESULT:

## HC-28 Feasibility of direct native file share vs clipboard fallback (D2-T05)
STEPS:
1. Open spike branch ux/spike-D-c2-reaction-card on mobile device.
2. Trigger reaction story share to test navigator.canShare({ files }).
EXPECTED: Native share sheet opens when supported; degrades gracefully to clipboard fallback on failure.
RESULT:

## HC-29 Visual clarity and emotional reassurance of data sovereignty card on /account/delete (A3-T01)
STEPS:
1. Sign in and navigate to /account/delete.
2. Observe structured two-column / grouped breakdown ("شو رح ينمحي" vs "شو بيضل").
3. Inspect elevated primary safe-return button ("رجوع بلا حذف - احتفظ بحسابي").
EXPECTED: Clear, dignified separation between erased items and preserved commitments; safe return action is thumb-friendly and psychologically reassuring.
RESULT:

## HC-30 Return navigation accessibility and visual comfort on /terms and /privacy (A3-T02)
STEPS:
1. Navigate to /terms and /privacy from in-app link or direct URL.
2. Locate top policy return navigation link.
3. Tap return button to navigate back.
EXPECTED: Return button provides clear, tactile feedback, >=44px touch target, and smoothly returns user to referring view or home.
RESULT:

## HC-31 Numerical legibility and contrast of tab volume badges (A3-T03)
STEPS:
1. View /inbox and /sent on mobile viewport with received and sent confessions.
2. Inspect numeric count badges on sub-navigation tabs.
3. Verify badge contrast, typography, and absence of horizontal overflow.
EXPECTED: Count pills are cleanly readable, high-contrast, and fit naturally inside tabs without layout distortion.
RESULT:

## HC-32 Tactile responsiveness and visual hierarchy of action breadcrumb header (A3-T04)
STEPS:
1. Navigate to /account/delete or /offer/[offerId].
2. Inspect top action breadcrumb header and back chevron.
3. Tap back link to return to origin view.
EXPECTED: Breadcrumb provides instant situational awareness and comfortable 1-tap exit.
RESULT:

## HC-33 Visual sharpness and non-obscuring clarity of keyboard focus halos (B3-T01)
STEPS:
1. Navigate the interface using keyboard (Tab / Shift-Tab) across buttons, links, inputs, and chips.
2. Inspect focus halo outline and offset separation against dark backgrounds.
EXPECTED: Focus rings display high-contrast double ring (2px dark separation / 2px citron halo) without clipping adjacent content.
RESULT:

## HC-34 Intimate visual warmth and tactile feedback of compose well focus elevation (B3-T02)
STEPS:
1. Open /c/[slug] confession compose page on mobile and desktop.
2. Tap or focus the textarea well.
EXPECTED: Textarea responds with subtle concentric citron-glow inner elevation and luminous border transition without layout shift.
RESULT:

## HC-35 Atmospheric comfort and OLED depth perception in empty states (B3-T03)
STEPS:
1. View empty /inbox and empty /sent lists.
2. Inspect ambient radial vignette framing on the empty state container.
EXPECTED: Container features soft ambient grounding that avoids stark empty appearance while preserving copy readability.
RESULT:

## HC-36 Developer ergonomics and consistency of design tokens (B3-T04)
STEPS:
1. Audit app/globals.css and verify replaced token values.
2. Verify token adoption scanner reports >= 50% adoption.
EXPECTED: Style definitions cleanly leverage token scale and zero orphan literals remain in active components.
RESULT:


