# Week 13 — the landing page, rebuilt on the design system

**Frozen 2026-09-14 21:5x +04, before any code.** Written from measurements
taken against the *running* production and staging systems at 2026-09-14
21:3x–21:5x, not from reading the source.

---

## §0 What was measured, and why this is a slice at all

Weeks 11 and 12 put the commissioned design system
(`design/masaraha-design-system/`) on the app as a CSS skin and then did
per-screen passes over the inbox, the send page and the sent list. Tonight the
whole product was driven end to end over the public internet at a phone
viewport (390×844, `chromium`, real DNS, real certificate) — dev login, terms
acceptance, link, a confession sent from a second account, a reveal offer
opened, accepted, and both answers unlocked. **The mechanic works and the
skinned screens are good.** Eighteen screenshots were taken and looked at.

Two surfaces are not on the design system, and both of them are in the signup
funnel — the first two screens a person who taps a shared link ever sees.

### §0.1 Finding A — `/` has no heading, and its body copy is set larger than every heading in the app

Measured on `https://confession.fayad.app/` at 390×844 and again at 360×640:

```
h1 count in <main>        : 0
hero element              : P
computed font-size        : 34px
computed white-space      : pre-line
hero block height         : 430px   (of an 844px viewport)
```

For comparison, on the same production build:

```
h1 on /c/<slug>           : 26px     (--type-title, the app's screen title)
body copy on /c/<slug>    : 17px     (--type-body)
```

So the landing page's explanatory paragraph — 137 characters of prose — renders
at `--type-display` (34px), **one full step above every real `<h1>` in the
app**, and the token's own definition in `app/globals.css` says what it is
for:

```css
--size-display:34px;      /* screen hero */
```

`app/page.tsx` is still the week-3 placeholder. Three sentences with three
different jobs live inside a single `<p>`, separated by `{'\n'}` literals:

1. `تطبيق مصارحة سرية.` — the product's positioning sentence, the one Sam
   ruled on 2026-08-25 («منكتب فقط تطبيق مصارحة سرية متل اي شي تاني على
   فيسبوك»). This is a heading and is being rendered as the first line of a
   paragraph.
2. `الناس تقدر تبعتلك أي شي وهي متخفية عنك...` — the explainer. Body copy.
3. `سجل دخول تبلش.` — an instruction about the button underneath it. Not a
   claim about the product at all.

Week 11 did not fix the markup; it bent the stylesheet to fit it, and said so
in the rule's own comment:

```css
/* the landing pitch: the hero of the one screen that carries a bare
   paragraph directly inside `.veil` with no heading before it. */
.veil > p:first-child{ font:var(--type-display); ... white-space:pre-line; }
```

Two things follow. The hierarchy on the app's front door is inverted — nothing
on the screen is more prominent than anything else, because all of it is
display type. And the selector is structural rather than intentional: it fires
on *any* page whose first child inside `.veil` happens to be a `<p>`, so the
next screen built that way silently inherits a 34px hero it did not ask for.

**The consequence that costs money.** The entire distribution loop Sam decided
on 2026-08-28 (item 19) is: a link in a Facebook post or story → a phone opens
it → the person signs in. On a 360×640 viewport — an ordinary low-end Android,
which is most of the audience — the only call to action on the page measures:

```
CTA top    : 590px
CTA bottom : 642px
viewport   : 640px
```

**The login button's bottom edge is outside the viewport.** Not catastrophically
— it is reachable with a scroll — but the single conversion action of the whole
product is clipped at the fold on the phone class it was designed for, and the
430px of display-type prose above it is why.

### §0.2 Finding B — the terms card on `/onboarding` shows a fifth of the terms with no scroll affordance

Measured on staging with a real signed-in pending identity:

```
card scrollHeight  : 2056px
card clientHeight  : 437px
computed max-height: 438.88px
computed overflow-y: auto
clauses (ar / en)  : 7 / 7
page scrollHeight  : 844px   (= viewport; the page itself does not scroll)
```

So about 21% of the terms is visible, the box does scroll, and **nothing on the
screen says so.** There is no fade, no shadow, no scrollbar rendered by the
platform in this state. A user can accept seven clauses having seen four.

This is not a cosmetic point. Sam's moderation answer of 2026-08-22 is the
whole of the product's abuse position — «نحن لما منخليه يسجل الحساب منحط شروط
وقواعد لازم يوافق عليها وأي اساءة بتكون على مسؤوليته» — and it is only as
strong as the acceptance it rests on. Clauses 5 (18+), 6 (deletion) and 7 (what
survives deletion) are all below the fold of that box.

The design system already ships the token for this job and **nothing uses it**:

```css
--veil-fade-bottom:linear-gradient(180deg,rgba(21,15,14,0) 0%,var(--ground) 88%);
```

---

## §1 Scope

Two surfaces, both in the signup funnel. Nothing else changes.

1. `app/page.tsx` + its rules in `app/globals.css` — the landing page.
2. `app/onboarding/page.tsx` + its rules in `app/globals.css` — the scroll
   affordance on the terms card only.

**Out of scope, named so nobody widens the slice:** the inbox, the send page,
the sent list, the offer page, `/terms`, `/privacy`, `/account/delete`, the
admin surfaces, any database change, any copy change to the terms themselves,
and any change to what is stored or logged.

---

## §2 The copy rule, and it is absolute

**No word of the landing page's user-facing text is added, removed, reworded or
reordered.** The three sentences in §0.1 ship byte for byte as they are today.
What changes is which element carries each one.

The reason is not caution for its own sake. Sentence 1 is Sam's positioning
decision of 2026-08-25, quoted in `work/confession-app/BRIEF.md`, and this
slice is a typography repair with no standing to touch it.

Two new strings *are* permitted, because they are UI affordance and not product
claims, and neither makes a claim about the service:

- §4.2's scroll hint on the onboarding terms card.

That is the complete list. One string.

---

## §3 The landing page — required structure

`app/page.tsx` renders, inside `<div className="veil enter">`:

### §3.1 A real heading

```jsx
<h1>تطبيق مصارحة سرية.</h1>
```

An `<h1>` element. Sentence 1, unchanged, including its full stop.

### §3.2 The explainer as body copy

```jsx
<p className="landing-pitch">الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.</p>
```

Sentence 2, unchanged, in its own `<p>` with an explicit class. It is prose and
it is set as prose.

### §3.3 The instruction moves to where its verb points

Sentence 3, `سجل دخول تبلش.`, is an instruction about the button. It moves
*inside* the `.card--citron` block, above the Facebook button, as a
`<p className="hint">`. Unchanged text. It stops being a third display-size
claim about the product and becomes the label of the action it describes.

### §3.4 No literal newlines

The `{'\n'}` literals go. Three elements do not need a whitespace mode to look
like three elements.

### §3.5 Everything else on the page is untouched

The deleted-account notice, the dev-login form, the terms/privacy footer links,
the `resolveActiveViewerAccountId` guard and its `/inbox` redirect: all
unchanged, including the spec §8.3 comment explaining why the guard reads the
database and not the cookie.

---

## §4 CSS — required changes in `app/globals.css`

### §4.1 The structural selector is retired

`.veil > p:first-child` is **deleted**. The display treatment it carried — the
citron-to-white gradient text fill and `--type-display` — moves onto the
landing page's `h1` through an intentional selector, not a positional one.

The landing `h1` therefore needs a hook. Use a class on the page's own wrapper
(`landing` on the `.veil` div is the cheapest) so the rule reads
`.landing h1 { ... }` — an element chosen because it is that screen's heading,
not because it happened to be first.

`white-space: pre-line` is deleted with the rule. §3.4 removes its only reason
to exist, and leaving it would let a stray newline in a future edit silently
become a line break again.

**Prove the deletion is safe, do not assume it.** Three other surfaces open a
`.veil`: `/offer/[offerId]` (`<h1>` first), `/c/[slug]` enabled
(`<div className="send-hero">` first) and `/c/[slug]` disabled
(`<div className="notice">` first). None of them is a `<p>` first, so none of
them is currently taking this rule — but the acceptance file asserts it rather
than trusting this sentence.

### §4.2 The terms card gets an affordance

The onboarding terms card (`.card--inset`) keeps its `max-height` and its
`overflow-y: auto` — a scroll box is the right pattern and the alternative in
§6.2 is worse. It gains two things:

1. A bottom fade drawn with `--veil-fade-bottom`, the token the design system
   shipped for this and that nothing currently uses. It must sit above the
   scrolling content and must not intercept pointer or touch events
   (`pointer-events: none`), or it becomes a dead strip a thumb cannot scroll
   through.
2. One line of hint copy beneath the card, in the existing `.hint` style:

   ```
   مرّر لتقرا كل الشروط.
   ```

   Levantine, no emoji, no em-dash, ends with a full stop. It states a fact
   about the box and makes no claim about the service.

The fade must not be visible when the box is not scrollable. If that cannot be
done in CSS alone without JavaScript, the fade ships unconditionally and the
reason is written into the rule's comment — the card is scrollable on every
viewport this app supports, because the terms are 2056px long in Arabic and
English at any width a phone has.

### §4.3 The class-inventory invariant still holds

Week 11's acceptance item (globals.css §2.1: every class used under `app/` is
defined exactly once, and every class defined is used) is **not** weakened by
this slice. `landing`, `landing-pitch` and whatever the fade needs are all used
and all defined once. If the existing test enforcing that turns red, the fix is
in this slice's code, never in that test.

---

## §5 What must measurably be true afterwards, from outside

These are the claims the session's report may make, and each names how it is
measured. A claim without its measurement is not shipped.

1. `GET https://confession.fayad.app/` answers **200** over the real
   certificate, via `bin/asam.sh check`.
2. On a **360×640** viewport, the primary call to action's bounding rect is
   **entirely within the viewport** — `bottom <= 640` — measured with a real
   headless browser against the production hostname, not computed from CSS.
3. `document.querySelectorAll('main h1').length === 1` on `/`.
4. The computed `font-size` of that `h1` is `34px` and the computed
   `font-size` of `.landing-pitch` is `17px`. The hierarchy is inverted today;
   afterwards the heading is the largest thing on the screen and the prose is
   prose.
5. The three sentences of §2 appear on the page, byte for byte, with no
   character added or removed.
6. On `/onboarding`, the terms card is still `overflow-y: auto` with its
   content taller than its box (the affordance is added; nothing is truncated
   to make the box fit), and the hint line of §4.2 is present in the DOM.
7. `npm run typecheck` exits 0 and the full suite passes with **zero**
   failures, re-run by the master and not taken from any agent's report.

---

## §6 Rejected alternatives, written down

### §6.1 Rejected — reword the landing copy into a shorter hero

The obvious "fix" is to cut sentence 2 down to something that fits at display
size. Refused. Sentence 1 is Sam's own positioning ruling, and sentences 2 and
3 are the only place in the product that explains the mutual-reveal mechanic
to someone who has never seen it. A typography defect does not license a copy
rewrite, and a session that rewrites product copy while claiming to fix layout
is doing two things and reporting one.

### §6.2 Rejected — remove the terms card's `max-height` and let the page scroll

This would show all seven clauses with no affordance needed. Refused: the
accept checkboxes and the «موافق» button would then sit roughly 2000px below
the fold on a phone, so the screen's *action* disappears instead of its text.
That is the same defect as §0.1, moved.

### §6.3 Rejected — require scroll-to-bottom before enabling the checkbox

The strongest consent design, and genuinely tempting given §0.2's argument. Not
in this slice, for two reasons. It needs JavaScript on the critical path of
account creation, which the layout's own comment says the signup chrome
deliberately avoids («plain anchors and a plain submit button, both of which
work with JavaScript off»). And it changes the *consent flow*, which rests on
Sam's moderation ruling — that is a product decision to put to him, not a
typography repair to slip in. Recorded here as the open question it is.

### §6.4 Rejected — keep `.veil > p:first-child` and just add an `h1` above it

Cheapest possible change: add the heading and let the selector stop matching.
Refused because it leaves a 34px display rule armed and pointed at a structural
accident. The next screen that opens with a paragraph inherits it silently, and
nothing in the file would explain why.

---

## §7 Process rules for this slice

- The agent that writes the implementation does not write the acceptance file,
  and the acceptance file's author does not read the implementation. Week 7 §9
  is the precedent for why: two agents sharing a working tree destroyed each
  other's work. **Separate git worktrees, one per agent.**
- The acceptance file is written from this document. If an item in it cannot
  be satisfied by any implementation, the item is amended here in writing with
  its reason (the week-10 §6.1 precedent), and **the code is not bent to suit
  a broken test, nor the test to suit whatever the code does.**
- Staging first, then production. Both verified from outside with
  `bin/asam.sh check`, and §5 item 2 re-measured with a browser against the
  production hostname after promotion.
