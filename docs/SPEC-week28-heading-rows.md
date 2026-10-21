# Week 28 - the inbox heading and the link switch keep their words at 280

Frozen 2026-10-21 21:45 +04, before the change is written. Author of the
change and author of the acceptance file are different (§4).

## §0 What was measured

### §0.1 The sweep

On staging (`51ab94a`, the same tarball as production), headless Chromium,
`isMobile`, fresh dev-login accounts, every page a participant reaches
(`/`, `/privacy`, `/terms`, `/onboarding`, `/inbox` empty, `/inbox` with one
message, `/inbox` with the options menu open, `/inbox` with the link off,
`/c/<slug>`, the post-send screen, `/sent`, `/account/delete`) at 280, 300,
320 and 360, three sets of display names (an Arabic four-part name, a Latin
name with a hyphen, a three-letter name). Probe:
`work/confession-app/probes/w28-rows.mjs`. A word is "split" when the
glyphs of one run of non-whitespace land on two line boxes; it is
"squeezed" when it was split even though it is narrower than the block it
sits in.

Squeezed, and therefore defects:

1. `/inbox`, every state, 280: the page heading «صندوقك» is split, «صندوق»
   over «ك». It is 108 px wide in a 240 px row.
2. `/inbox`, link on, 280: the switch label «الرابط شغال» runs over three
   lines with «الرابط» split as «الرا» / «ب» / «ط»; its text column is 44 px
   wide. The caption under it is one word per line, four lines with the link
   on and five with it off. At 300 and 320 the label is whole but on two
   lines and the caption on two or three.

Split but not defects, and not changed here:

- The link itself in `.linkblock__slug`: it is `word-break:break-all` on
  purpose and is wider than its block at every width.
- «ندمانة/ندمان» in a reveal question chip at 360 and «Al-Hashimi» on `/sent`
  and on the post-send button: both break at their own `/` or `-`, which is
  an ordinary line-break opportunity, not week 25's rule.
- `btn--danger` reported outside the screen on `/inbox`: those are the
  buttons inside the closed «خيارات» menu. With the menu open, nothing is
  outside the screen at any width.

### §0.2 Why

The same mechanism as week 27, in two rows week 27 did not touch.
`.inbox-header` and `.toggle` are one-line flex rows. With `body`'s
`overflow-wrap:anywhere` (week 25) a flex item's min-content width falls to
a single glyph, so when the row is too narrow the browser shrinks the text
item below its own words instead of moving anything.

### §0.3 Candidates, rendered in the live page

`work/confession-app/probes/w28-proto.mjs` and `w28-geo.mjs`, link on and
link off, at 280, 300, 320, 340, 360, 375, 390 and 412.

| candidate | splits | caption at 280 | 360 vs served |
|---|---|---|---|
| A: both rows `flex-wrap:wrap` | none | 1 line | **moved** (button under the text) |
| B: `overflow-wrap:normal` on the heading and the switch text | none | 4 lines (on), 5 (off) | identical |
| C: header wraps, switch text `overflow-wrap:normal` | none | 4 / 5 lines | identical |
| D: both rows wrap, switch text `flex:1 1 9em` | none | 1 line | **identical** |
| E: heading `flex-shrink:0`, switch text `overflow-wrap:normal` | none | 4 / 5 lines | identical; the chip goes to three lines |

D, measured box by box against the served page: 280 to 340 the button moves
to its own row under a one-line label and a one-line caption; 360 identical
in every box; 375, 390 and 412 the heading, the chip, the button and the
tops and heights of both text lines are identical, only the text column's
box is wider (it grows into the free space; the text is right-aligned, so
nothing visible moves).

## §1 The change

`app/globals.css`, CSS only, no markup, no copy:

```css
.inbox-header{ ...existing...; flex-wrap:wrap }
.toggle{ ...existing...; flex-wrap:wrap }
.toggle>span{ flex:1 1 9em }
```

With a comment in the house style saying why. The heading row: when the
heading and the chip do not fit side by side, the chip moves under the
heading whole. The switch: its text asks for 9em beside the button (about
«الناس تقدر تبعتلك» at the app's caption size); when it cannot have that,
the button moves to its own row. `em`, not a pixel breakpoint, because the
app ships no web font and every phone's Arabic font is its own width (week
27, §2).

## §2 Rejected

- **A, wrap alone.** Fixes 280, but at 360, the most common Android width,
  where the switch already read fine with a two-line caption beside the
  button, it moves the button under the text.
- **B, C, E, `overflow-wrap:normal` on the text.** No split, but the
  caption stays one word per line at 280, four or five lines of single
  words beside a button. That is the same squeeze with the breaks moved to
  the spaces.
- **E's `flex-shrink:0` on the heading.** The heading is whole and the chip
  takes the squeeze instead, three lines in a pill.
- **Undoing week 25 on `body`.** Week 25 is what stops one long word from
  widening the recipient's inbox to 2459 px. Rejected in week 27 for the
  same reason.
- **A pixel breakpoint** (`@media (max-width:340px)`). The row's real width
  depends on the phone's font.
- **Shortening «الرابط شغال» or the caption.** Copy, and Sam's.

## §3 The fixtures

New, `test/fixtures/w28/inbox-link-off.html`, captured from staging on
2026-10-21 by `work/confession-app/probes/w28-capture.mjs` with week 26's
method (2.5 s after load, `<script>`, `<noscript>`, `.celebrate`,
stylesheets and preload links removed). Account `w28-fx-owner-*`, its link
switched off through the real form.

Reused, unchanged, from `test/fixtures/w27/`: `inbox-empty.html` (link on,
no messages, chip «جاهز للرسايل ✨») and `inbox-message.html` (link on, one
message, chip «1 🔥»).

## §4 Acceptance (test/78-heading-rows.test.ts)

Written by a different author from the change, in a worktree that holds this
spec and the fixtures and never held the change. Runs under `npm test`, using
the `playwright` devDependency's Chromium, `isMobile`, `hasTouch`, height
780, at seven viewports: **280, 300, 320, 340, 360, 375, 412**. Each fixture
gets the tree's current `app/globals.css` injected before `</head>`, as in
`test/75` to `test/77`. "Word" means a maximal run of non-whitespace in one
text node; a word is "whole" when every client rect of a DOM `Range` over
exactly that word, ignoring rects narrower than 0.5 px, shares one `top`
(±3 px). "On one line" means the same test over all the element's text.

The three fixtures: `w27/inbox-empty.html`, `w27/inbox-message.html`,
`w28/inbox-link-off.html`.

1. **The fixtures are real.** All three exist and none contains `<script`.
   Each has exactly one `.inbox-header` holding an `h1` with text «صندوقك»
   and one `.inbox-badge`; and exactly one `.toggle` whose first child is a
   `span` holding a `strong` with text «الرابط شغال» and a caption `span`,
   and which holds one `button`. The button's text is «طفي الرابط» in the
   two w27 files and «شغل الرابط» in the w28 file.
2. **No page is wider than the screen.** Each fixture at each viewport:
   `document.documentElement.scrollWidth <= width`.
3. **No word in either row is split.** Every word in `.inbox-header` (the
   heading and the chip) and in `.toggle` (label, caption, button) is
   whole, in every fixture at every viewport.
4. **Each row holds what is in it.** The heading and the chip lie within
   `.inbox-header`'s border box (±1 px) and do not overlap (intersection
   ≤ 1 px²); the toggle's text `span` and its button lie within `.toggle`'s
   border box (±1 px) and do not overlap.
5. **Short texts stay on one line.** In every fixture at every viewport:
   the heading, the chip's text, the label «الرابط شغال» and the button's
   text are each on one line.
6. **The caption is read, not stacked.** In every fixture at every
   viewport the caption `span` is at most two lines (distinct line tops of
   a `Range` over its text, ±3 px).
7. **Where they fit, they do not move.** At 360, 375 and 412, in every
   fixture: the heading and the chip have the same vertical centre (±2 px),
   and the button's vertical extent overlaps the toggle text `span`'s (the
   button sits beside the text, not under it).
8. **The browser is real.** If Chromium cannot be launched the file fails
   with the launch error. It does not skip.

Mutants, each must turn the file red (run by me, not the author):

- M1: the old tree.
- M2: only `.inbox-header{flex-wrap:wrap}`.
- M3: §1 without `.toggle>span{flex:1 1 9em}` (candidate A).
- M4: §1 without `.toggle{flex-wrap:wrap}` (the basis alone).
- M5: candidate B in place of §1.
- M6: §1 with `.inbox-header h1{flex-shrink:0}` in place of the header wrap.

On this box run with
`PLAYWRIGHT_BROWSERS_PATH=/home/asam/.cache/ms-playwright`.

## §5 The drive

After deploy, staging, fresh dev-login accounts: `w28-rows.mjs` with all
three name sets and the link switched off shows zero squeezed words at 280,
300, 320 and 360, every page at the screen width; the switch is tapped for
real at 280 (off, then on) and the page reloads with the button on its own
row. Production has no dev login: fetch its stylesheet from outside and
confirm it carries §1, then the route table and `check-origins.mjs` as in
week 27.

## §6 Results, 2026-10-21 21:5x, after the acceptance file was first run

`test/78-heading-rows.test.ts`, 121 items, written by a separate author in a
worktree that never held §1, then re-run by me.

- Old tree: 104 pass, 17 red. Item 3 at 280 (all three fixtures), item 5 at
  280, 300 and 320 (all three), item 6 at 280 (all three) and also at 300
  and 320 on `inbox-link-off`. The brief predicted item 6 red at 280 only;
  the extra two are the longer link-off caption («ما حدا يقدر يبعتلك لحد ما
  تشغلو.») on three lines at 300 and 320, which §0.1 had measured. The
  author reported the difference instead of bending the test; the test
  stands.
- Fixed tree: 121 of 121.
- Mutants (`work/confession-app/probes/w28-mutants.py`): M1 17 red, M2 16,
  M3 4 (item 7 at 360 on all three, and 375 on link-off), M4 16, M5 16, M6
  2 (item 5 at 280, the chip on more than one line in the two fixtures whose
  chip is «جاهز للرسايل ✨»). None stayed green, so nothing in §1 is dropped.
