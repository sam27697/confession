# Week 26 - a long name no longer pushes the post-send screen off the phone

Frozen 2026-10-16 21:4x +04, before any code. Measured on staging, which runs
the same tarball as production since week 25 (`main` = `f8683b1`).

## §0 What was measured

### §0.1 The defect

Week 25 left one item open: on the screen a sender sees right after sending
(`/c/<slug>?sent=1`), the page was 2 to 21 px wider than a 360 px phone, "and
varies by account". Tonight it was traced.

Driven headless at 360x780 and 320x780 (`isMobile`, `hasTouch`) on
`stg.masaraha.provefair.app` with fresh dev-login accounts and ordinary
messages (`work/confession-app/probes/w26-names.mjs`). Recipient «عبد الرحمن
محمد الأحمد», sender `Mohammed Abdulrahman Alhashimi`, message «مرحبا، بدي
قلك شي من زمان». `document.documentElement.scrollWidth`:

| page | 360 | 320 |
|---|---|---|
| `/c/<slug>?sent=1` | **398** | **377** |
| `/inbox` empty, with a message, offered, resolved | 360 | 320 |
| `/c/<slug>` compose, `/sent` both states, `/offer/<id>`, `/account/delete` | 360 | 320 |

The post-send screen is the only one. Every sender lands on it after every
message, and its card is the growth loop: «أو تحدى رفقاتك يصارحوا {name}»
and a button to share the recipient's link. That button's label carries the
recipient's display name: «انسخ رابط {name} لتبعتوه بالغروب»
(`app/c/[slug]/page.tsx:158`). With a three-part Arabic name the label is
436 px wide in a 282 px button, the text runs off both sides of the card and
off the screen, and on a phone the browser zooms the whole page out to hold
it. The longer the recipient's name, the wider the page; that is week 25's
"varies by account".

### §0.2 Why

`.btn` sets `white-space:nowrap` (`app/globals.css`, the `.btn` rule), and
week 25's `overflow-wrap:anywhere` on `body` cannot act where wrapping is
forbidden. A full-width button (`.btn--block`) has nothing beside it to
protect, so its label refusing to wrap only ever spills.

Why week 25 saw it come and go: before `CopyLink` mounts, the same spot holds
the link as plain wrapping text, so the page is 360 until JavaScript runs.
A probe that measures in the first moments after the send sees 360; one that
waits sees the overflow. Measured both ways tonight
(`probes/w26-catch.mjs`, with and without `COMPOSE_WAIT`), and with the
element removed while every animation was frozen, the copy button is the
only element whose removal brings the page back to the viewport. The send
celebration's glyphs also report boxes past the right edge, but they sit in a
`position:fixed; overflow:hidden` layer and do not widen the page.

### §0.3 Every label, measured against its button

Rendered from captured DOM (§3) against this tree's `app/globals.css`.
`gap` is the space left each side of the label inside the border box.

| page | label | 360: gap | 320: gap |
|---|---|---|---|
| `/` | «تسجيل دخول بحساب غوغل» | 25.7 | **5.7** |
| `/` | «تسجيل دخول بفيسبوك» | 44.8 | 24.8 |
| `/account/delete` | «رجوع بلا حذف - احتفظ بحسابي» | 28.3 | **8.3** |
| post-send | «انسخ رابط هادي لتبعتوه بالغروب» | **4.7** | **-15.3** |
| post-send | «انسخ رابط خالد عبد الكريم الحسيني لتبعتوه بالغروب» | **-77.1** | **-97.1** |
| post-send | the same with a 60-character name and no space | -319.6 | -339.6 |
| everything else | | at least 40 | at least 20 |

Two consequences. First, labels already sit inside the button's 26 px side
padding today: the Google button at 360 has 25.7 px. Second, even a
four-letter name pushes the post-send label 15 px past its button at 320.

### §0.4 Candidates, rendered

Each candidate appended to the tree's stylesheet; eight fixtures at two
widths. "Same" means a full-page screenshot byte-identical to the tree's own.

| candidate | post-send page width | one-line labels that change |
|---|---|---|
| tree | 398 / 641 at 360; 378 / 621 at 320 | n/a |
| `.btn--block{white-space:normal}` | 360 / 320 | text spills out of the top and bottom of a 52 px pill (5 lines in 52 px) |
| wrap, keep 26 px side padding | 360 / 320 | **Google button goes to two lines at 360**, and at 320 Google, «رجوع بلا حذف» and two post-send buttons |
| wrap, 8 px side padding | 360 / 320 | at 320 Google and «رجوع بلا حذف» go to two lines |
| **wrap, 4 px side padding (§1)** | **360 / 320** | **none**; landing, offer and onboarding byte-identical at both widths |
| `overflow:hidden; text-overflow:ellipsis` | 360 / 320 | none, but the label is cut and the name is lost |

The only one-line pixels that move under §1 are the labels of two submit
buttons («ابعت», «احذف حسابي»): 0.25 px vertically (label top 15.5 to 15.25
px inside the button), from the line-height change rounding half-leading.
Nothing else on any fixture differs.

## §1 The change

The existing `.btn--block` rule in `app/globals.css` becomes:

    .btn--block{
      width:100%;
      height:auto;
      min-height:var(--control-h);
      padding:var(--space-2) var(--space-1);
      white-space:normal;
      text-wrap:balance;
      line-height:var(--lh-tight);
    }

with a comment saying why.

- A label that fits stays on one line, at the same 52 px, in the same place:
  centring does not depend on the padding while the text fits, so cutting the
  side padding to 4 px moves nothing that fits today (§0.4).
- A label wider than the button wraps instead of spilling, the button grows
  to hold it, and `text-wrap:balance` makes the lines about equal so the
  longest one stays clear of the pill's curved ends.
- Week 25's `overflow-wrap:anywhere` is inherited, so a name with no space
  breaks inside the button too.
- Inline buttons (`.btn` without `--block`: the header's logout, the link
  block's «انسخ الرابط» and «بطاقة الستوري», the chips) keep `nowrap`. They
  sit beside other controls, where wrapping would reflow a row.

No copy changes. The label keeps the recipient's name; what it says is not
this slice's decision.

## §2 Rejected

1. **`white-space:normal` alone.** The fixed `height:52px` stays, so a
   wrapped label spills out of the top and bottom of the pill (§0.4).
2. **Wrapping with the existing 26 px side padding.** Breaks the Google
   sign-in label onto two lines at 360, the most common phone width, on the
   first screen anyone sees. Measured (§0.4).
3. **Ellipsis.** Keeps one line by cutting the label; on this button what is
   cut is the name of the person the sender is being asked to share.
4. **Removing the name from the label.** Fixes this one button and leaves
   every other full-width button able to do the same with the next copy
   change. Also a copy decision this session does not own; the line above the
   button already names the person, so it is open to Sam if he wants it.
5. **`overflow-x:hidden` on the page.** Hides the scrollbar and leaves the
   label cut off at the screen edge (week 25 §2.1).
6. **Changing `.btn` for every button.** Inline buttons sit in rows; letting
   them wrap reflows the link block and the chips, which are not broken.
7. **Truncating display names at sign-in.** The name is the person's own;
   the layout is what is wrong.

## §3 The fixtures

`test/fixtures/w26/*.html`: the rendered DOM of eight pages, captured from
staging on 2026-10-16 by `work/confession-app/probes/w26-capture.mjs`, each
2.5 s after load so `CopyLink` has mounted and the celebration has gone,
with `<script>`, `<noscript>`, `.celebrate` and every stylesheet and preload
`<link>` removed.

| file | what |
|---|---|
| `landing.html` | `/`, signed out |
| `onboarding.html` | `/onboarding` for «هادي» |
| `compose.html` | `/c/<slug>` for «خالد عبد الكريم الحسيني» |
| `post-send-arabic-name.html` | `/c/<slug>?sent=1`, recipient «خالد عبد الكريم الحسيني» |
| `post-send-unbroken-name.html` | the same, recipient `w26-fx3-` and 52 `o` |
| `post-send-short-name.html` | the same, recipient «هادي» |
| `offer.html` | `/offer/<id>`, the sender's side |
| `account-delete.html` | `/account/delete` |

The accounts are staging dev-login accounts; the sender is `w26-fx3-sender`.

## §4 Acceptance (test/76-block-buttons.test.ts)

Written by a different author from the change, in a worktree that holds this
spec and the fixtures and never held the change. Runs under `npm test`, using
the `playwright` devDependency's Chromium, `isMobile`, `hasTouch`, at two
viewports: 360x780 and 320x780. Each fixture gets the tree's current
`app/globals.css` injected before `</head>`, as in `test/75`.

1. **The fixtures are real.** All eight files in §3 exist, none contains
   `<script`. Each `post-send-*` file contains exactly one element whose text
   starts «انسخ رابط» and ends «لتبعتوه بالغروب», and that text contains its
   recipient: «خالد عبد الكريم الحسيني», 52 consecutive `o`, «هادي».
2. **No page is wider than the screen.** For each fixture at each viewport:
   `document.documentElement.scrollWidth <= viewport width`. Sixteen items,
   each naming fixture and width.
3. **Every full-width label is inside its button.** For each `.btn--block`
   in each fixture at each viewport, a DOM `Range` over the button's contents
   has a bounding rect within the button's border box, 1 px tolerance, on all
   four sides, and the button's `scrollWidth <= clientWidth + 1`.
4. **Labels that fit stay as they are.** For every `.btn--block` in
   `landing`, `onboarding`, `compose`, `offer` and `account-delete`, and for
   the first two `.btn--block` («افتح صندوقك السري», «عرض الرسائل المرسلة»)
   in each `post-send-*` file, at both viewports: the button's height is
   52 px (±0.5) and its label is on one line (every client rect of the Range
   shares one `top`, ±2 px).
5. **The long label wraps, and the button holds it.** In
   `post-send-arabic-name` at 360, the copy button's label is on two or more
   lines and the button is taller than 52 px. In `post-send-unbroken-name` at
   both widths, the same, and item 3 holds for it.
6. **Inline buttons are untouched.** In `post-send-arabic-name`, every `.btn`
   that is not `.btn--block` has computed `white-space: nowrap`, and there is
   at least one such button (the header's logout).
7. **The browser is real.** If Chromium cannot be launched the file fails
   with the launch error. It does not skip.

Mutants, each must turn the file red (run by me, not the author):

- M1: the rule as it was (the old tree).
- M2: `.btn--block{width:100%;white-space:normal}` only.
- M3: §1 with the side padding left at 26 px (`padding-block` only).
- M4: §1 applied to `.btn` instead of `.btn--block`.
- M5: `.btn--block{width:100%;overflow:hidden;text-overflow:ellipsis}`.

On this box the Chromium matching `playwright@1.63` is under
`/home/asam/.cache/ms-playwright`; run with
`PLAYWRIGHT_BROWSERS_PATH=/home/asam/.cache/ms-playwright`.

## §5 The drive

After deploy, staging, fresh dev-login accounts: the post-send page at 360
and 320 with a three-part Arabic recipient name is no wider than the screen,
the copy button is tapped for real, and the landing page's buttons are still
one line. Production has no dev login: fetch its stylesheet from outside and
confirm it carries the new `.btn--block` rule, and confirm the route table
and `check-origins.mjs` as in week 25.

## §6 Amendment, 2026-10-16 21:5x, after the change was rendered

§0.4 says no one-line label changes under §1. One does: the post-send copy
button for the short name «هادي» at 360. Its label had 4.7 px each side of
the border box, which is 3.7 px inside the 1 px border, less than the 4 px
padding, so it now goes to two lines (52 to 69 px). Today it is one line
because it already runs into the padding. It is the button whose label
carries a name, and at 320 the same label spills 15 px today, so two lines is
where it lands for almost any name. Acceptance item 4 never covered this
button; nothing in §4 changes.
