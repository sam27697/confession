# Week 30: the link switch says «الرابط»

Frozen 2026-10-26, before the fixtures were captured and before the test was
written.

## §0 The decision

Sam, card `c-20261021-2159-2ab5` (filed 2026-10-25). Asked after week 28:
«زر التشغيل مكتوب «الرابط شغال» حتى لما الرابط مطفي. بدك يصير «الرابط» بس؟»
His answer: yes.

### §0.1 What was wrong

On `/inbox` the switch row's label was the fixed text «الرابط شغال» ("the link
is on") whether the link was on or off. With the link off the row read «الرابط
شغال» over «ما حدا يقدر يبعتلك لحد ما تشغلو.» beside a «شغل الرابط» button: the
label said the opposite of the caption and the button.

### §0.2 Measured before the change

Staging (`a43eb2a`, the production tarball), `probes/w30-rows.mjs`
(week 28's probe, screenshot path changed), all three name sets, link on and off, 280, 300, 320
and 360. Nothing in `.toggle` or `.inbox-header` is squeezed at any width.
The only squeezed words are the three week 28 recorded as ordinary
break opportunities («ندمانة/ندمان» in a reveal chip at 360, «Al-Hashimi» on
`/sent` and on the post-send button). Output: `work/confession-app/probes/
w30-before-*.txt`.

## §1 The change

`app/inbox/page.tsx`: the switch label is «الرابط» in both states. Nothing
else changes: the caption still carries the state, the button still names
the action, and `.linkblock__head` still says «شغال» or «مطفي» beside
«رابطك».

### §1.1 Rejected

- **A label that follows the state** («الرابط شغال» / «الرابط مطفي»). It
  would be correct, and it was the other way to fix §0.1. Sam chose the bare
  word; the state is already said twice in the block (head and caption).
- **No label, caption only.** The row would lose its name, and the caption
  is a sentence, not a name.
- **Editing the design system's `Toggle` example** («الرابط شغال» in
  `design/masaraha-design-system/components/core/Toggle.*`). That is the
  design of record's sample usage, not product copy.
- **Rewriting `test/78`.** Its fixtures are week 27 and week 28 captures of
  the old markup and it tests the stylesheet against them. A longer label is
  the harder case for that row, so it stays a valid check of the CSS and is
  left as it is. This week's markup gets its own fixtures and its own file.

## §2 The fixtures

New, `test/fixtures/w30/`, captured from staging after the change is
deployed there, by `work/confession-app/probes/w30-capture.mjs` with week 26's
method (fresh dev-login accounts, 2.5 s after load, `<script>`,
`<noscript>`, `.celebrate`, stylesheets and preload links removed):

- `inbox-empty.html`: link on, no messages.
- `inbox-message.html`: link on, one message.
- `inbox-link-off.html`: link switched off through the real form, one
  message.

## §3 Acceptance (test/80-link-label.test.ts)

Written by a different author from the change, from this spec and the
fixtures. Runs under `npm test` with the `playwright` devDependency's
Chromium, `isMobile`, `hasTouch`, height 780, at seven viewports: **280, 300,
320, 340, 360, 375, 412**. Each fixture gets the tree's current
`app/globals.css` injected before `</head>`, as in `test/75` to `test/78`.
"Word", "whole" and "on one line" mean exactly what `docs/
SPEC-week28-heading-rows.md` §4 says they mean.

1. **The fixtures are real.** All three exist and none contains `<script`.
   Each has exactly one `.toggle` whose first child is a `span` holding a
   `strong` and a caption `span`, and which holds exactly one `button`.
2. **The label is the bare word, in both states.** In all three fixtures
   the `strong`'s text, trimmed, is exactly «الرابط».
3. **The state is still said.** The caption is «الناس تقدر تبعتلك هلق.» and
   the button «طفي الرابط» in the two link-on fixtures; the caption is «ما
   حدا يقدر يبعتلك لحد ما تشغلو.» and the button «شغل الرابط» in the link-off
   fixture. `.linkblock__head`'s second `span` is «شغال» in the link-on
   fixtures and «مطفي» in the link-off fixture.
4. **The old label is gone.** No fixture's text contains «الرابط شغال».
5. **No page is wider than the screen.** Each fixture at each viewport:
   `document.documentElement.scrollWidth <= width`.
6. **No word in the row is split.** Every word in `.toggle` (label, caption,
   button) is whole, in every fixture at every viewport.
7. **The row holds what is in it.** The toggle's text `span` and its button
   lie within `.toggle`'s border box (±1 px) and do not overlap
   (intersection ≤ 1 px²).
8. **Short texts stay on one line; the caption at most two.** The label and
   the button's text are each on one line; the caption is at most two lines.
9. **Where it fits, the button sits beside the text.** At 360, 375 and 412
   the button's vertical extent overlaps the toggle text `span`'s.
10. **The browser is real.** If Chromium cannot be launched the file fails
    with the launch error. It does not skip.

## §4 After the deploy

Re-run the row probe on staging with all three name sets, link on and off,
at 280, 300, 320 and 360 (Sam's card asks for this), and compare with §0.2.
