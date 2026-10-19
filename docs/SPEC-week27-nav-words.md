# Week 27 - the header no longer splits its own words on a phone

Frozen 2026-10-19 22:0x +04, before the change is written. Author of the
change and author of the acceptance file are different (§4).

## §0 What was measured

### §0.1 The defect

On staging (`a17fc32`, the same tarball as production), headless Chromium,
`isMobile`, fresh dev-login accounts, every signed-in page, five widths
(`work/confession-app/probes/w27-midword.mjs`). A word counts as split when
its own glyphs land on more than one line box.

- **«صندوقك» in the header is split on every signed-in page at 360 and 320**:
  two lines at 360 («صندو» over «ك»), three at 320. **«بعتها» is split at
  320.** At 280 both are five lines and the header is 136 px tall. At 375 and
  above the header is one row and nothing is split.
- 360 is the most common Android width; 320 and 280 are what a 360 phone
  reports with a larger display size, and 280 is the Galaxy Fold cover screen.
- Separately, on `/inbox` at 320 the «بطاقة الستوري ✨» button's label is
  wider than the button (scrollWidth 115 in a 113 px box; 105 in 93 at 280),
  and its first letter and the sparkle are cut at the edges. Week 26 recorded
  this as a 4 px spill.

Every other split the probe found is a long unbroken token (the link itself,
a 12-character slug, a dev-login name with no space) or a break after a
slash («ندمانة/ندمان»), all of which are the intended behaviour of week 25.

### §0.2 Why

Week 25 put `overflow-wrap:anywhere` on `body` so one long word in a message
cannot widen a page. `anywhere` also lowers the min-content width of every
flex item, so in the header's nav, which does not have room for both labels
and the logout button below 375 px, the browser shrinks the labels below the
width of their own words and breaks the words. Measured with the rule
switched off in the page: the nav labels are whole, and nothing overflows
down to 320. The nav labels are fixed copy, never user text, so the rule
buys them nothing.

The link block's two buttons share a row with `flex:1;min-width:0` and are
`.btn` (`white-space:nowrap`) with `.btn--sm`'s 14 px side padding, so a label
that does not fit is cut, not wrapped.

### §0.3 Candidates, rendered in the live page

Injected into staging's `/inbox`, widths 280, 300, 320, 340, 360, 375, 390,
412 (`probes/w27-proto.mjs`):

| candidate | 280 | 320 | 360 | 375+ |
|---|---|---|---|---|
| none (today) | words split, header 136 | split, 97 | «صندوقك» split, 77 | one row, 58 |
| `.nav__item{overflow-wrap:normal}` only | **page 320 wide on a 280 screen** | whole, 77 | whole, 77 | identical |
| `.nav__item{white-space:nowrap}` | overflow | **page 343 on 320** | 58 | identical |
| `overflow-wrap:normal` + `.nav{flex-wrap:wrap}` | whole, 102 | whole, 102 | whole, 102 | **pixel-identical** |

The last row is §1: no word split, no overflow at any width, and from 375 up
the header is pixel-identical to today. Below 375 the logout button moves to a
second row inside the header instead of crushing the labels.

For the link block, cutting the side padding alone does not stop the cut at
320 (the label plus its sparkle still runs past the edge); letting the label
wrap at its space with 4 px padding, as week 26 did for `.btn--block`, puts
«بطاقة / الستوري ✨» on two lines at 320 and below, and at 360 and above both
labels stay on one line at 40 px. The only pixels that move at 340 to 390 are
the sparkle glyph, by under 5 px, now fully inside the button; at 412 the
block is pixel-identical.

## §1 The change

`app/globals.css` only. No markup, no copy.

```css
.nav{ ... flex-wrap:wrap; justify-content:flex-end; }   /* was flex-wrap:nowrap */
.nav__item{ ... overflow-wrap:normal; }
.linkblock__buttons .btn{
  height:auto;
  padding:var(--space-2) var(--space-1);
  white-space:normal;
  overflow-wrap:normal;
  text-wrap:balance;
}
```

`.nav` is also the admin header's nav (`app/admin/layout.tsx`); its two labels
are fixed copy and take the same rule.

## §2 Rejected

1. **`overflow-wrap:normal` on the nav labels alone.** Measured: the header
   no longer fits at 280 and the page becomes 320 px wide.
2. **`white-space:nowrap` on the nav labels.** Measured: the page is 343 px
   wide on a 320 screen.
3. **Undoing week 25's rule on `body` and scoping it to message text.** Week
   25 §2 item 2 rejected exactly that, on the risk of the next surface that
   forgets it. §1 opts fixed chrome out instead, which fails safe: a label we
   wrote that is too long wraps at its spaces or moves to the next row.
4. **Smaller nav padding or a breakpoint tuned to the measured widths.** The
   app ships no web font (design system readme), so label widths are the
   phone's own Arabic font and differ by device; a breakpoint tuned on this
   box's Chromium is a guess on everyone else's. Wrapping does not depend on
   the font.
5. **Hiding the logout button or shortening its label below 375.** Copy and
   design, so it is Sam's, and wrapping already fits.
6. **Stacking the link block's two buttons (`flex-wrap:wrap` on the row).**
   Measured: at 360 the two labels need exactly the row's width, so the row
   wraps there too and changes the most common width for nothing.
7. **Ellipsis on the link block's buttons.** Cuts «الستوري» off the button
   that says what it does.

## §3 The fixtures

New, `test/fixtures/w27/*.html`, captured from staging on 2026-10-19 by
`work/confession-app/probes/w27-capture.mjs` with week 26's method (2.5 s
after load, `<script>`, `<noscript>`, `.celebrate`, stylesheets and preload
links removed). Accounts `w27-fx-owner-*` and `w27-fx-sender-*`.

| file | what |
|---|---|
| `inbox-empty.html` | `/inbox`, owner, no messages |
| `inbox-message.html` | `/inbox`, owner, one message |
| `sent.html` | `/sent`, sender, one message |

Reused, unchanged, from `test/fixtures/w26/`: `landing.html` (signed out, one
nav label «تسجيل دخول»), `onboarding.html`, `compose.html`,
`post-send-arabic-name.html`, `offer.html`, `account-delete.html`.

## §4 Acceptance (test/77-nav-words.test.ts)

Written by a different author from the change, in a worktree that holds this
spec and the fixtures and never held the change. Runs under `npm test`, using
the `playwright` devDependency's Chromium, `isMobile`, `hasTouch`, at five
viewports, height 780: **280, 320, 360, 375, 412**. Each fixture gets the
tree's current `app/globals.css` injected before `</head>`, as in `test/75`
and `test/76`. "Word" below means a maximal run of non-whitespace characters
in one text node; a word is "whole" when every client rect of a DOM `Range`
over exactly that word, ignoring rects narrower than 0.5 px, shares one `top`
(±3 px).

1. **The fixtures are real.** The three w27 files and the six w26 files
   above exist and none contains `<script`. Every fixture except `landing`
   has exactly two `.nav__item` links, with text «صندوقك» and «يلي بعتها»,
   and a logout button with text «تسجيل خروج» inside `header.site`;
   `landing` has one `.nav__item` with text «تسجيل دخول». Both `inbox-*`
   files have one `.linkblock__buttons` with exactly two `button` children,
   one whose text contains «انسخ الرابط» and one whose text contains «بطاقة
   الستوري».
2. **No page is wider than the screen.** Each of the nine fixtures at each
   of the five viewports: `document.documentElement.scrollWidth <= width`.
3. **No header word is split.** Every word in every `.nav__item` and in the
   logout button, in every fixture at every viewport, is whole.
4. **The header holds what is in it.** In every fixture at every viewport,
   the bounding rect of `.brand`, of each `.nav__item` and of the logout
   button lies within `header.site`'s border box (±1 px), and no two of the
   `.nav__item` links and the logout button overlap (intersection area of
   their rects ≤ 1 px²).
5. **Wide screens keep one row.** At 375 and 412, in every fixture except
   `landing`: the two `.nav__item` links and the logout button have the same
   vertical centre (±2 px), and each `.nav__item`'s text is on one line.
6. **The link block's labels stay inside their buttons.** In both `inbox-*`
   files at every viewport, for each of the two buttons in
   `.linkblock__buttons`: a `Range` over the button's contents has a bounding
   rect inside the button's border box (±1 px, all four sides), the button's
   `scrollWidth <= clientWidth + 1`, every word in it is whole, and the two
   buttons are the same height (±0.5 px).
7. **Where they fit, they do not move.** In both `inbox-*` files at 360, 375
   and 412: each of the two buttons is 40 px tall (±0.5) and its label is on
   one line.
8. **Other inline buttons are untouched.** In `inbox-message` at 360, the
   logout button's computed `white-space` is `nowrap`.
9. **The browser is real.** If Chromium cannot be launched the file fails
   with the launch error. It does not skip.

Mutants, each must turn the file red (run by me, not the author):

- M1: the old tree.
- M2: only `.nav__item{overflow-wrap:normal}` (no `.nav` change, no link
  block rule).
- M3: only the `.nav` wrap (no `overflow-wrap:normal` on the labels).
- M4: §1 with `.nav__item{white-space:nowrap}` in place of `overflow-wrap`.
- M5: §1 with the link block rule replaced by
  `.linkblock__buttons .btn{overflow:hidden;text-overflow:ellipsis}`.
- M6: §1 with the link block rule keeping `.btn--sm`'s 14 px side padding.
  If M6 stays green, that is written down here as what the padding cut does
  not buy at these widths, and the rule is kept or dropped on that.

On this box run with
`PLAYWRIGHT_BROWSERS_PATH=/home/asam/.cache/ms-playwright`.

## §5 The drive

After deploy, staging, fresh dev-login accounts: `w27-midword.mjs` at all
five widths shows no split nav word, every page at the screen width, and the
two link block buttons whole at 320; screenshots of `/inbox` at 280, 320 and
360. The logout button is tapped for real at 320 and signs out. Production has
no dev login: fetch its stylesheet from outside and confirm it carries §1,
then the route table and `check-origins.mjs` as in week 26.
