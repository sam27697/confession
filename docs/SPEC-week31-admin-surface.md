# Week 31: the admin pages on a phone

Frozen 2026-10-28, before the change was written, before the fixtures were
captured and before the test was written.

## §0 What is wrong, measured

Staging (`4e96b49`, the production tarball), headless Chromium, a disposable
`w31-probe` admin row, widths 280, 320, 360, 390 and 412.
`work/confession-app/probes/w31-admin.mjs`, output in `w31-before.json`,
screenshots in `w31-before-stg/`. Weeks 29 and 30 recorded the first defect
and left it.

1. **Two headers on every admin page.** `/admin/login`, `/admin`,
   `/admin/stats` and `/admin/reports` each show the product's own header (the
   «م مصارحة» brand and a «تسجيل دخول» link to `/`) above the admin header.
   The root layout renders its header for every page, `/admin/**` included.
   Two brand marks, and a sign-in link that leaves the admin surface.
2. **The admin nav on the sign-in page.** Signed out, `/admin/login` shows
   «لوحة الإدارة», «الأرقام», «البلاغات» and a «تسجيل خروج» button. Each link
   leads back to the sign-in page; the logout button logs out nobody.
3. **The 14-day table hides its last column.** On `/admin/stats` the table is
   393 px wide inside a box of 202 (at 280), 242, 282, 312 and 334 (at 412).
   `.stats-table{overflow-x:auto}` keeps it reachable by a sideways swipe, but
   nothing on screen says there is more: at 390 a reader sees three columns
   and «عروض» (offers per day) is entirely past the edge. The width comes from
   the headers: every cell is `white-space:nowrap`, so «حسابات جديدة» alone is
   136 px.
4. **A split date at 280.** «آخر حساب جديد: 2026-10-26» breaks the date at
   its hyphen, «2026-» over «10-26».

## §1 The change

1. `app/admin/layout.tsx`: the wrapper `div` gets `className="admin-shell"`.
   The layout reads the `admin_sid` cookie and checks it with
   `verifyAdminSessionCookieValue`, the same check `/admin/login` already makes
   before it redirects. Valid: the header renders as before (brand, three
   links, logout). Missing or invalid: the header renders the brand link only,
   no `nav`. The kill switch (`notFound()` when no administrator is
   configured) stays first and unchanged.
2. `app/globals.css`, one rule: `body:has(.admin-shell) .site:not(.site--plain)
   {display:none}`. The product header is still in the HTML of an admin page
   and is not drawn and not in the accessibility tree.
3. `app/globals.css`, the stats table: header cells may wrap at their spaces
   (`white-space:normal`) and never inside a word (`overflow-wrap:normal`,
   overriding `body`'s `anywhere`); header and data cells take 4 px inline
   padding; the table takes `font:var(--type-body-sm)`. Data cells stay
   `nowrap`. `overflow-x:auto` stays, as the fallback below 360.
4. `app/admin/stats/page.tsx`: the two date spans get `className="stats-day"`,
   and `app/globals.css` gives `.stats-day{white-space:nowrap}`. At 280 the
   date moves whole to the next line.

No copy changes. No change to any participant page's markup.

## §2 Measured candidates for the table (live page, `probes/w31-proto.mjs`)

Columns at 17 px: the date 99 px of text, «حسابات» 66, «رسايل» 54, «عروض» 56.

| candidate | fits from | notes |
|---|---|---|
| as shipped | never | 393 px at every width |
| header wraps only | 320 | splits «رسايل» and «عروض» mid-word (week 27's squeeze) |
| wraps, 4 px padding | 280 | same mid-word splits |
| wraps, no mid-word split, 4 px | 390 | |
| **wraps, no mid-word split, 4 px, body-sm** | **360** | chosen |
| the same without the 4 px | 390 | |
| every cell wraps | 280 | the date itself breaks into two or three lines |

## §3 Rejected

- **A route group** (`app/(site)/` with its own layout holding the header).
  The right shape for a new app; here it moves every participant page, and 52
  test files read those pages by path.
- **Widening `middleware.ts`** to mark `/admin` requests with a header the root
  layout reads. Week 18 holds the middleware to one matcher entry gated on
  `next-action` (`test/68` §4.8), so it runs on nothing else; that is a
  security decision and this slice does not reopen it.
- **A parallel route slot for the header.** Unmatched slots keep their last
  state on a soft navigation, and server-action redirects are soft; it also
  moves the nav out of `app/layout.tsx`, which `test/77` reads.
- **Hiding the header in the admin layout with a client component.** The
  admin surface works with JavaScript off and stays that way.
- **Shorter column labels, or dates without the year.** Copy and data, not
  layout; with either, 280 and 320 still do not fit at 17 px.
- **Turning the table into a list per day.** Fourteen rows of four lines each
  for a table that fits from 360.

## §4 Acceptance

Fixtures are captured from staging running this change. "Visible" means a
non-zero box and `visibility` not hidden. Widths 280, 320, 360, 390, 412.

1. `/admin/login` signed out, `/admin`, `/admin/stats`, `/admin/reports`
   signed in: exactly one visible `header`, and it is `.site--plain`. No
   visible link whose text is «تسجيل دخول».
2. `/admin/login` signed out: the visible header contains no `nav`, no link
   but the brand, and no form.
3. `/admin`, `/admin/stats`, `/admin/reports` signed in: the header has the
   three links «لوحة الإدارة» (`/admin`), «الأرقام» (`/admin/stats`),
   «البلاغات» (`/admin/reports`) and a form posting to `/admin/logout`.
4. Participant pages (the week 26 and 27 fixtures) still show `header.site`
   (not `.site--plain`) visible, at every width.
5. `/admin/stats` at 360, 390, 412: `.stats-table` scrollWidth is at most its
   clientWidth, and every `th` and `td` lies inside the `.stats-table` box
   (0.5 px tolerance).
6. `/admin/stats` at every width: no word of a `th` is drawn on two lines.
7. `/admin/stats` at every width: each `.stats-day` is drawn on one line.
8. Every admin fixture at every width: the page's scrollWidth equals the
   viewport width.
9. `/admin/stats`: the table's text content, row by row, is identical to the
   rendered fixture with this week's CSS rules removed (the change is layout
   only).

## §5 Known and left

- At 280 and 320 the table still scrolls sideways inside its card, with no
  cue. Measured: no candidate fits there without changing copy or data.
- The fit at 360 has about 8 px to spare in Chromium's font. The app ships
  no web font, so a phone whose Arabic font runs wider falls back to the
  sideways scroll, which is today's behaviour.
- The product header is still sent in the HTML of every admin page, hidden by
  CSS. A browser without `:has()` (Firefox before 121, Safari before 15.4)
  shows both headers, as today. The compose spotlight already depends on
  `:has()`.
