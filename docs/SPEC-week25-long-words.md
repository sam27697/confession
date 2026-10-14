# Week 25 - one long word no longer breaks the other person's screen

Frozen 2026-10-14 21:5x +04, before any code. Measured on staging, which runs
the same tarball as production since week 24 (sha256 `4d5420a7c50eb476...`).

## §0 What was measured

### §0.1 The defect

Driven headless at 360x780 (`isMobile`, `hasTouch`) on
`stg.masaraha.provefair.app` with fresh dev-login accounts, owner A and
sender B on A's link (`work/confession-app/probes/w25-overflow.mjs`).
B sent two messages: a pasted link, `https://example.com/` and 180 `a`, and
a laugh, 150 `ه`. Both are one unbroken word. A long «هههههه» is the most
ordinary thing anyone types in Arabic.

`document.documentElement.scrollWidth` on each page, viewport 360:

| page | who | before |
|---|---|---|
| `/inbox` with B's two messages | A | **2459** |
| `/inbox` after A sends the reveal offer | A | **2459** |
| `/sent`, offer pending | B | **2459** |
| `/offer/<id>` | B | **1870** |
| `/sent`, both revealed | B | **2459** |
| `/inbox`, both revealed | A | **2459** |
| `/`, `/c/<slug>` compose, ordinary names | | 360 |

On A's inbox the whole column sits at x=1100..1420 of a 2459 px page, the
message runs off the left edge in one line, and the reveal form's submit
button cannot be clicked: Playwright reports `<html lang="ar" dir="rtl">
intercepts pointer events` for 30 s. On a phone the browser zooms the page
out to fit the widest line, so every word on it becomes unreadably small.

**Any sender can do this to any recipient with one message, and nothing the
recipient can do on that page fixes it.** The reveal, the block and the
report all sit on the same broken page. Moderation is the participant's job
(Sam, 2026-08-22), so the tools for it have to stay usable.

The same holds for every other field a person types into a box that is shown
to someone else: the offer question, the stake, both answers, and the display
name. A 69-character display name with no space (`w25-fx-owner-` and 60 `o`)
widened `/onboarding` to 501 px and pushed both terms checkboxes to x=448,
off a 360 px screen; on the compose page the recipient's long name made it
1160 px.

### §0.2 Why

`app/globals.css` has exactly one wrapping rule, `word-break:break-all` on the
link block (line 1045). Nothing else lets a word longer than its box break,
so the browser keeps it whole and every flex parent widens to hold it.

### §0.3 Re-measured, not assumed

The same seven pages were rendered from their captured DOM (§3) against this
tree's own `app/globals.css`, and again with one candidate rule appended:

| fixture | tree css | + `body{overflow-wrap:anywhere}` | + `body{overflow-wrap:break-word}` |
|---|---|---|---|
| compose-long-name | 1160 | 360 | 1160 |
| inbox-messages | 2406 | 360 | 360 |
| inbox-offer-pending | 2369 | 360 | 360 |
| inbox-resolved | 2414 | 360 | 707 |
| offer | 1870 | 360 | 360 |
| onboarding-long-name | 501 | 360 | 360 |
| sent-offer-pending | 2435 | 360 | 565 |
| sent-resolved | 2436 | 360 | 578 |

The same rule injected into the live staging pages (Playwright `addStyleTag`)
brought all six signed-in pages in §0.1 to 360.

**Seen and left alone:** with short ordinary messages a `button.btn` on
`/inbox` measures left = -1 px (empty `innerText`, inside a closed menu). The
page is 360 wide either way; it is not this slice.

**Not reproduced:** week 24's React error #418 on A's inbox. Two replays of
week 24's block drive and three rounds over `/inbox`, `/sent`, `/`,
`/privacy`, `/terms`, `/account/delete`, `/onboarding`, `/c/<slug>` with every
console error and page error captured: zero. Left as recorded.

## §1 The change

One declaration on the existing `body` rule in `app/globals.css`:

    overflow-wrap:anywhere

with a comment saying why. A word breaks only where it would otherwise not
fit, so ordinary text renders exactly as before; `anywhere`, unlike
`break-word`, also lowers the min-content width, which is what lets a flex
item shrink instead of pushing its parent wider (§0.3, column 3).

`white-space:nowrap` elements are untouched, since `overflow-wrap` only acts
where wrapping is allowed.

Stored text does not change. What the recipient receives, copies with «انسخ
النص» and shares on a story is byte-for-byte what the sender wrote.

## §2 Rejected

1. **`overflow-x:hidden` on `html` or `body`.** Hides the scrollbar and
   leaves the text cut off mid-word at the screen edge, unreadable. The
   message is the product.
2. **`overflow-wrap` on `.msg__body` and the other text classes one by one.**
   Eight surfaces today plus the admin pages, and every future surface would
   have to remember. One forgotten class and the defect is back, on the page
   nobody re-measured.
3. **`word-break:break-all`.** Breaks every line at any letter, including
   ordinary Arabic sentences that fit, which reads badly. Kept only where it
   already is, on the link block.
4. **`overflow-wrap:break-word`.** Measured: four of eight fixtures still
   overflow (§0.3).
5. **Inserting soft hyphens or zero-width spaces into the stored body, or
   cutting long words on the server.** Changes what was sent, and «انسخ
   النص» would copy the altered text.
6. **Refusing long words at send time.** A validation on what someone may
   say, and a laugh is not abuse.

## §3 The fixtures

`test/fixtures/w25/*.html`: the rendered DOM of the eight pages in §0.3,
captured from staging on 2026-10-14 by `work/confession-app/probes/
w25-capture.mjs`, with `<script>`, `<noscript>` and every stylesheet and
preload `<link>` removed. They are the real markup the defect was measured
on, not hand-written copies. The accounts are staging dev-login accounts
named `w25-fx-*`.

The test injects the tree's current `app/globals.css` into each fixture, so a
change to the stylesheet is what it tests.

## §4 Acceptance (test/75-long-words.test.ts)

Written by a different author from the change, in a worktree that holds the
spec and the fixtures and never held the change. Runs under `npm test`
(`node --import tsx --test`), using the `playwright` devDependency's
Chromium at viewport 360x780, `isMobile`, `hasTouch`.

1. **Each fixture exists and carries the long text.** All eight files in §3
   are present, none contains `<script`, and each contains at least one run of
   20 `a`, 20 `ه`, 20 `o` or 20 `s`. A fixture that lost its long word would
   otherwise pass vacuously.
2. **No page is wider than the screen.** For each fixture, with the tree's
   `app/globals.css` injected: `document.documentElement.scrollWidth <= 360`.
   Eight items, one per fixture, each naming its fixture.
3. **The long text is on screen, not cut off.** For each fixture, every
   element whose own text nodes contain one of the runs in item 1 has a
   bounding box within `[-1, 361]` horizontally and `scrollWidth <=
   clientWidth + 1`. This is what makes `overflow-x:hidden` fail.
4. **The browser is real.** If Chromium cannot be launched the file fails
   with the launch error. It does not skip.

Mutants, each must turn the file red (run by me, not the author):

- M1: the declaration removed (the old tree).
- M2: the declaration replaced with `html,body{overflow-x:hidden}`.
- M3: the declaration replaced with `overflow-wrap:break-word`.

On this box the Chromium matching `playwright@1.63` is under
`/home/asam/.cache/ms-playwright`; run with
`PLAYWRIGHT_BROWSERS_PATH=/home/asam/.cache/ms-playwright`.

## §5 The drive

After deploy, staging, fresh dev-login accounts, same script as §0.1: every
page in §0.1 at `scrollWidth` 360, and the reveal offer submitted with a real
click rather than `requestSubmit`. Production has no dev login: fetch its
stylesheet from outside and confirm it carries `overflow-wrap:anywhere`, and
confirm the route table and `check-origins.mjs` as in week 24.
