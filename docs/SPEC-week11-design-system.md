# SPEC — week 11: the commissioned design system becomes the app's skin

*Frozen 2026-09-04 21:5x, before any code, as every slice in this project is.
Priority 4 of the list Sam set on 2026-09-03. The design of record is
`design/masaraha-design-system/` in this repository, commissioned by Sam and
committed as `8d3f7fe`. `readme.md` in that directory is authoritative and this
spec does not overrule it anywhere; where the two appear to disagree, the
readme wins and this file is wrong.*

---

## 0. What this slice is, and what it deliberately is not

**It is a skin.** The placeholder UI that shipped in weeks 3 to 10 was written
by a developer to be legible, not to be looked at. The design system replaces
it: tokens, type scale, the notch, the veil, the citron primary, the rose that
belongs to the reveal and to nothing else, hour-only stamps, no icons, no emoji.

**It is not a behaviour change.** The rule that makes this slice safe to ship
in one session is stated once, here, and it governs every file:

> **No route, no server action, no form `action=`, no form field `name=`, no
> input validation attribute (`required`, `minLength`, `maxLength`, `type`),
> no redirect target and no database query may change.** Only class names,
> element structure, and the stylesheet change. The one exception is §4, the
> hour stamp, which adds a new pure module and renders a value the database
> already stores.

That is what keeps the 218 tests already on `main` meaningful across this
change. A test that goes red because the skin moved a `<div>` is a test that
was asserting on the placeholder, and it is to be reported, not edited around.

**It is also not a rewrite of copy.** Every user-facing Arabic string in the
app today was either taken from `COPY-ar.md`, approved by Sam in `BRIEF.md`, or
carried in the design system's own "Verbatim copy from the product" list. Copy
may be **moved** and may be **added** where a screen gains a surface that has
none (an empty state, a hint under a field). No existing sentence is reworded.

---

## 1. How the design system reaches the app

### 1.1 The decision

**The tokens are inlined into `app/globals.css`, and a class layer in the same
file reproduces the components' styles. The `design/` directory stays exactly
as committed and is imported by nothing.**

### 1.2 Rejected alternatives, in writing

| Option | Why it lost |
|---|---|
| **Import the `.jsx` components from `design/` directly** | They are preview components: every style is a React inline `style` object, so they cannot express `:hover`, `:focus-visible`, `::placeholder`, `::selection` or `@media (prefers-reduced-motion)` — six things the readme names as part of the system. Several take `onClick`/`onChange`, which would force `'use client'` onto server-rendered pages that today ship **zero** client JavaScript. Rejected on the design system's own terms, not on convenience. |
| **`@import url("../design/masaraha-design-system/styles.css")` from `globals.css`** | Works, and is the smallest diff. Rejected because the stylesheet's own header rule since week 3 is "no `@import`, no CDN, no external URL of any kind", and that rule is only enforceable as an absolute ban. A permitted `@import` is one careless edit away from a CDN, and the tripwire for it (§6 item 1) has to be a flat "the string does not appear". |
| **Tailwind / CSS modules / styled-components** | A new build surface and a new dependency for a nine-screen app whose entire stylesheet is under 700 lines. Nothing in the design system needs a utility engine; it needs the tokens it already ships. |
| **Copy `design/` into `app/` and edit it there** | Would fork the design of record. The commissioned directory must stay byte-identical to what Sam paid for, so that §6 item 2 can diff the app's tokens against it mechanically. |

### 1.3 The token parity rule, which is the point of §1.2's last row

Every custom property declared in a `:root{}` block of
`design/masaraha-design-system/tokens/*.css` **must appear in
`app/globals.css` with a byte-identical value.** This is machine-checkable and
is acceptance item 2. It means the app cannot drift from the design of record
silently; a palette change in the app that was not made in the design system
turns the suite red.

Ordering, whitespace and comments in `globals.css` are free. Values are not.

---

## 2. The stylesheet contract

`app/globals.css` is rewritten. Its shape:

1. A header comment naming the design system as the source, and restating the
   no-external-asset rule with its reason (privacy and supply chain).
2. The seven token blocks, inlined in the order `styles.css` imports them:
   `colors`, `typography`, `spacing`, `radius`, `effects`, `motion`, `base`.
   Each preceded by a one-line comment naming the file it came from.
3. The class layer, below.

### 2.1 Classes the app may use

The class layer defines exactly these, and the screens use no class that is not
in this list (acceptance item 5 enforces the reverse direction too: no class
used in a screen may be undefined in the stylesheet).

**Layout and chrome**

- `.site` — the sticky glass header. `--glass-bg` + `--glass-blur`, hairline
  bottom border, `position: sticky; top: 0`.
- `.site--plain` — the admin variant. Opaque `--surface-1`, **no glass, no
  blur.** The readme: *"The admin panel has no glass at all."*
- `.brand` / `.brand__mark` / `.brand__word` — the mark from `BrandMark.jsx`,
  drawn in CSS: a citron square carrying **م**, radius
  `r r notch r` so the bottom-leading corner is the notch. Never an image.
- `.nav` / `.nav__item` / `.nav__item--active` — pill navigation, `--control-h-sm`.
- `main` — single column, `--gutter` sides, capped at `--content-max`.
- `.veil` — a block carrying `--veil-citron`. `.veil--rose` carries
  `--veil-rose`. Per the readme these appear on the landing, the empty state,
  the link block and the reveal screens **and nowhere else**; lists and legal
  pages carry none.

**Core**

- `.card`, `.card--raised`, `.card--bubble` (radius `--radius-bubble`),
  `.card--citron`, `.card--rose`, `.card--inset`.
- `.notice`, and tones `.notice--citron`, `.notice--rose`, `.notice--warning`,
  `.notice--danger`. Default tone is info and needs no modifier.
- `.chip`, with state modifiers `--delivered --hidden --reported --pending
  --resolved --declined --cancelled`, each carrying its 6px dot via `::before`
  and its colour pair from `StateChip.jsx`.
- `.btn` and variants `.btn--primary` (default), `.btn--secondary`,
  `.btn--ghost`, `.btn--reveal`, `.btn--danger`, `.btn--danger-solid`; sizes
  `.btn--md`, `.btn--sm`; `.btn--block`.
  All are full pills (`--radius-button`), minimum `--tap-min`, primary
  `--control-h`. **`.btn--reveal` may be used on «صارحني بدورك» and on the
  offer acceptance and on nothing else** — the readme reserves rose for the
  mutual reveal.
- `.empty` — the empty state block from `EmptyState.jsx`, veil background,
  centred, the **م** bubble glyph, title, body, action.
- `.toggle` — the link on/off row.

**Forms**

- `.field` (label), `.input`, `.textarea`, `.textarea--hero`,
  `.field-row`, `.hint`, `.counter`, `.checkrow` + `.checkrow__box`.
  Fields are **inset wells**: `--bg-field`, which is darker than the card, with
  `--radius-field`.

**App**

- `.linkblock`, `.linkblock__head`, `.linkblock__slug` (mono, `dir="ltr"`,
  dashed hairline, the slug itself in citron), `.linkblock__actions`.
- `.msg` — one received confession. `--radius-bubble`, the body at
  `--size-subtitle` weight 500, the meta row beneath it, an actions row
  separated by a `--line-faint` hairline. `.msg--hidden` dims to .62.
- `.msg__body`, `.msg__meta`, `.msg__actions`.
- `.hour` — the hour stamp, `--type-micro`, `--text-3`, `white-space: nowrap`.
- `.reveal` — the `RevealPanel` surface. Rose tone. `.reveal--resolved` is the
  only place `--glow-rose` appears.
- `.legal` — terms and privacy prose. No veil, no glow, `--type-body-sm`,
  generous `--lh-body`.

### 2.2 Rules the stylesheet must obey, from the readme

- **No `url(`, anywhere.** Not for a font, not for an image, not for a data
  URI. The veils and the mark are gradients and CSS boxes.
- `--font-ar` is the system Arabic stack exactly as `typography.css` declares
  it. No `@font-face`.
- `letter-spacing` is `0` (`--tracking-ar`) on every Arabic element.
  `--tracking-latin` appears only on the slug and on Latin meta.
- Motion: `--dur-*` and `--ease-out` only. **No bounce, no spring, no
  `cubic-bezier` with an overshoot.** The `prefers-reduced-motion` block from
  `motion.css` is carried across verbatim.
- Focus is `--ring-focus` and nothing else. No `outline: none` without it.
- Two background colours per screen, maximum.

---

## 3. Screens

Mobile-first at 390px. Desktop is the same column centred at `--content-max`,
not a second layout.

### 3.1 `/` — landing (signed out)

Carries `--veil-citron`. The brand mark large, the pitch as the hero at
`--type-display`, the Facebook button as the one `.btn--primary` on the screen,
and the legal links at the foot in `--text-3`.

The pitch string is already in `app/page.tsx` and is the design system's
verbatim pitch. It stays byte-identical. The `deleted=1` line becomes a
`.notice` (info tone, not danger — it is a confirmation, not a failure).

The dev-login form, when `env.allowDevLogin` is set, is `.btn--secondary` and
is visually subordinate. It is not removed and its field names do not change.

### 3.2 `/inbox`

The screen the readme calls the growth screen.

- `.linkblock` first, above the messages, with the most visual weight on the
  page: veil, `--shadow-raised`, `--line-strong`, `--radius-xl`.
  The slug renders `dir="ltr"` in mono with the slug portion in citron.
  The existing on/off form becomes the `.toggle` row inside it. **The form's
  `action`, its two hidden inputs and their values do not change.**
  There is no copy-to-clipboard button and no share button: both need client
  JavaScript, this app ships none, and shipping a dead button is worse than
  shipping none. Recorded as §7.1.
- Each confession is a `.msg`: body, then a meta row carrying `.hour` and the
  `.chip` for its state, then the actions row.
- The reveal offer stays a `<details>` element (no client JS) but is styled as
  a `.reveal` panel; its summary is a `.btn--reveal`.
- The empty inbox is `.empty` carrying the readme's verbatim growth copy:
  «صندوقك لسا فاضي» / «حط رابطك بستوري أو بالبايو. أول رسالة بتوصل أسرع مما
  تتخيل.» This **replaces** the placeholder «لسا ما وصلك شي.», which is the one
  copy replacement this spec authorises, because the readme names the new
  string as product copy.
- «حذف الحساب» stays where it is, as a `.btn--ghost`-weight link, not a
  danger button — the danger is on the delete screen itself.

### 3.3 `/c/[slug]` — the public send page

The screen a stranger lands on from a shared link. It carries a veil.

- The recipient's display name is the hero.
- The textarea is `.textarea--hero`: `--radius-bubble`, `--size-subtitle`, the
  centre of gravity of the screen.
- The anonymity disclosure sits directly above the send button as a
  `.notice`, carrying the sentence the app already renders. That sentence is
  the design system's verbatim: «اسمك ما بيوصل للي عم تبعتله. بس رسالتك مربوطة
  بحسابك عنا، وإدارة التطبيق بتقدر تشوفه.» If the string in the app today
  differs, **the app's string wins and is not reworded** — it is the one Sam
  approved. Report the difference in the week log instead.
- Rate-limit and error copy renders as `.notice--warning` / `.notice--danger`.

### 3.4 `/offer/[offerId]` — the reveal

The one screen in the app allowed to be rose, and the only one carrying
`--veil-rose` and `--glow-rose`.

- Both sides' answers, the fairness rule «ما حدا بيشوف جواب التاني قبل ما
  ينزلوا الاتنين سوا» as a `.notice--rose`, and the accept action as
  `.btn--reveal`.
- The decline action is `.btn--secondary`, never danger: declining is a normal
  choice, not a failure.

### 3.5 `/sent`

A list. **No veil, no glow.** Each row is a `.msg` in its outgoing form
(`--radius-bubble-out`) with the `.chip` for its offer state.

### 3.6 `/onboarding`

The terms acceptance step. The terms block is `.legal` inside a `.card--inset`
scroll region; the acceptance control is a `.checkrow`. The submit is
`.btn--primary` and `.btn--block`.

**`app/_lib/terms-block.tsx` renders `src/terms.ts` and neither file's strings
change here** — except §5.

### 3.7 `/account/delete`

The readme: *"Tone shifts once. Account deletion and the admin reveal drop all
playfulness: plain, factual, and explicit about what is irreversible."*

No veil. No glow. `--surface-1` only. The consequences list is a
`.notice--danger`. The required checkbox is a `.checkrow`. The confirm button
is `.btn--danger-solid`, and it is the only solid danger button in the app.
**The checkbox stays unchecked by default and its `name` and `required` do not
change** — week 10 §4 and its tests.

### 3.8 `/terms` and `/privacy`

`.legal`. No veil, no card chrome, no accent beyond links. These pages are read
by Meta's reviewer and by nobody else in a hurry; legibility is the whole brief.

### 3.9 `/admin/**`

`.site--plain` header, no glass anywhere, tokens applied through the shared
stylesheet. **The admin's ISO timestamps stay ISO** — the operator is doing
forensics against an audit log, and «اليوم ٢ص» is the wrong tool for that. The
hour-only rule protects the *sender from the recipient*, and the admin is the
party the model deliberately exempts. Recorded so nobody "fixes" it later.

Nothing else on the admin surface changes. Week 9's hardening is not touched.

---

## 4. The hour stamp — the one behavioural addition

### 4.1 Why it is allowed

`confessions.created_hour` carries a CHECK, live since week 2, that **rejects
any value not truncated to the hour**. The recipient's inbox fetches it today
and renders nothing. Rendering it as «اليوم ٢ص» discloses exactly what the
database holds and no finer grain, which is the disclosure the truncation was
designed to make safe. The design system requires it (`MessageCard` composes
`HourStamp`) and the readme states the reasoning in rule 4.

### 4.2 The module

New file `src/hourstamp.ts`. **Pure**: no `Date.now()`, no `process.env`, no
database, no request. It exports:

```ts
export function toArabicDigits(value: string | number): string
export function formatHourStamp(at: Date, now: Date): string
```

- Digits are Arabic-Indic (`٠١٢٣٤٥٦٧٨٩`), matching `HourStamp.jsx`.
- 12-hour clock. `ص` before noon, `م` from noon. Midnight is `١٢ص`, noon is
  `١٢م`.
- Same calendar day as `now` → «اليوم ٢ص». The day before → «أمس ١١م».
  Anything older → day-of-month and the **Levantine** month name, e.g.
  «٣ أيلول ٢ص». Month table: كانون الثاني، شباط، آذار، نيسان، أيار، حزيران،
  تموز، آب، أيلول، تشرين الأول، تشرين الثاني، كانون الأول.
- **A minute never appears in the output**, in any branch. Acceptance item 12
  asserts this against a swept range of inputs, not against three examples.
- Timezone is fixed to **Asia/Damascus**. Rejected: UTC, which would show a
  Damascus user the wrong hour on a page rendered on a UTC server; rejected:
  client-side conversion, which needs JavaScript this app does not ship.
  The offset is resolved with `Intl.DateTimeFormat` and a fixed `timeZone`, so
  the DST rule comes from the platform's tz database rather than from a
  hardcoded `+03:00`.
- Relative stamps («من ساعتين», «منذ دقيقتين») are forbidden by readme rule 4
  and by this spec. They are minute-grade information wearing an hour's
  clothes.

### 4.3 Where it renders

`/inbox` and `/sent`, in the `.msg__meta` row. Nowhere else. The admin keeps
ISO per §3.9. `now` is obtained once per page render in the page component and
passed in, so the function under test stays pure.

---

## 5. The asterisk correction

`src/terms.ts` line 59 carries the literal characters `**from you**`, and they
are served to the public on both origins today. `BRIEF.md` records the ruling:
this document's own markdown emphasis leaked into approved copy, the approved
English wording is `hidden from you`, and stripping the four asterisks is a
correction to the brief's markup rather than a rewording of Sam's copy. It
needs no further ruling from him.

**Strip them.** Nothing else in `src/terms.ts` changes — not a character.

No test on `main` asserts the string `from you`, verified before this spec was
frozen, so this cannot make an existing test red by design; if it does, that is
a finding and it is reported, not edited away.

---

## 6. Acceptance items — written by a different agent, in a different worktree

The author of these tests does not read the implementation. They are written
from this document. Files: `test/21-design-system.test.ts` and
`test/22-hourstamp.test.ts`.

**Stylesheet**

1. `app/globals.css` contains no `@import` and no `url(`, case-insensitive.
2. **Token parity.** Parse every `--name:value` declaration inside a `:root{}`
   block of each file in `design/masaraha-design-system/tokens/`. Every one of
   them appears in `app/globals.css` with a value equal after collapsing
   whitespace. Report the first mismatch by name, not just a count.
3. `app/globals.css` contains no `@font-face`, no `http://`, no `https://`.
4. The `@media (prefers-reduced-motion:reduce)` block is present and sets
   `--dur-reveal` to `1ms`.
5. **Class coverage, both directions.** Collect every class token appearing in
   a `className="..."` or `className={...'...'}` literal under `app/`. Every
   one has a matching `.token` selector in `app/globals.css`. And every
   `.token` selector defined in the class layer of `app/globals.css` is used
   somewhere under `app/` — no dead classes.
6. `--font-ar` in `app/globals.css` equals the value in
   `design/masaraha-design-system/tokens/typography.css`, byte for byte after
   whitespace collapse.

**Discipline**

7. No emoji anywhere under `app/` or in `src/*.ts`. Test against the Unicode
   ranges, not a list of favourites.
8. No em-dash (`—`) on any non-comment line of any `.tsx` file under `app/`.
   A comment line is one whose trimmed start is `//`, `/*` or `*`, or which is
   inside a `{/* ... */}` JSX comment.
9. `.btn--reveal` appears in exactly the files §2.1 permits: the inbox and the
   offer screen. `--glow-rose` and `--veil-rose` appear in `app/globals.css`
   and in no `.tsx` file.
10. No `.tsx` file under `app/` contains `'use client'`. The app ships no
    client JavaScript and this slice must not be what changes that.

**Hour stamp**

11. `toArabicDigits` maps every Latin digit and leaves everything else alone.
12. `formatHourStamp` output **never** matches `/[:٫]|\d\d[:٫]\d\d/` and never
    contains two consecutive Arabic-Indic digits followed by a separator —
    concretely: sweep one full year at one-hour steps and assert no output
    contains a minute. Assert the output always ends in `ص` or `م`.
13. Same-day renders «اليوم», previous calendar day renders «أمس», two days
    back renders a Levantine month name from the §4.2 table.
14. Midnight renders `١٢ص`; noon renders `١٢م`; 13:00 renders `١م`.
15. The function is pure: calling it twice with the same arguments returns the
    same string, and it does not read `Date.now()` — assert by monkey-patching
    `Date.now` to throw for the duration of one call.
16. `src/hourstamp.ts` imports nothing from `next`, from the database, or from
    `process`.

**Contract preserved**

17. Every form `action=` handler name and every `name="..."` on an `input`,
    `textarea` or `select` under `app/` is unchanged from `main`. The test
    computes the set from `git show main:<file>` and compares it to the working
    tree, per file, and reports any name added or removed.
18. `src/terms.ts` differs from `main` in exactly the four asterisk characters
    of §5 and nothing else.

---

## 7. Recorded, deliberately not built

### 7.1 Copy and share buttons on the link block

`LinkBlock.jsx` carries «انسخ الرابط» and «شارك». Both require
`navigator.clipboard` / `navigator.share`, which is client JavaScript. This app
ships none, deliberately: every page is server-rendered and the absence is part
of why the privacy re-check each week can say "no request-header read anywhere
in `app/`".

Shipping a button that does nothing is worse than shipping no button, so the
link block renders the slug as selectable text and no copy control. Whether to
take the first `'use client'` island in this app for two buttons is a real
product decision with a real cost, and it is not made at the end of a session
that is already replacing every screen. It goes to the week log as the next
slice's question.

### 7.2 The `ui_kits/masaraha_admin` panel

Out of scope. §3.9 applies the tokens and the plain header, nothing more. Week
9's hardening is the last thing this project should touch casually.

### 7.3 `app/globals.css` line count

The class layer is expected to land around 500 to 700 lines. It is not
minified, not sorted by a tool, and carries the comments that say which
component each block came from. A stylesheet nobody can read is how a design
system dies.

---

## §8. Findings from the build, recorded rather than silently reinterpreted

### 8.1 `.nav__item--active` is not implemented

§2.1 lists `.nav__item--active` among the classes the layer defines. It is
not defined in `app/globals.css`, and it is not applied anywhere under
`app/`. Reasoning:

The app's nav lives in exactly two places, `app/layout.tsx` and
`app/admin/layout.tsx`, both shared across every page beneath them. Neither
component receives the current pathname: this app ships zero client
JavaScript (`usePathname` is a client hook, ruled out by §0), there is no
`middleware.ts` in this repository setting a path header for a Server
Component to read, and adding one would be new infrastructure, not a class
name -- exactly what §0 forbids for this slice. A `headers()` read that
happened to smuggle in the current path would also cut against this
project's standing privacy discipline of reading nothing from the request
that does not have to be read.

The alternative -- writing a conditional that references `nav__item--active`
but can never actually evaluate true -- was rejected on purpose: that is
dead code written to satisfy a mechanical class-coverage check, not a real
feature, and it is the kind of thing this instruction set explicitly asks
not to do. So the pill nav renders uniformly on every page; no tab is ever
marked current. This is a real, if minor, gap against §2.1's letter, flagged
here instead of gamed.

### 8.2 `.counter` is not implemented

§2.1 lists `.counter` for a live "typed/max" character count next to a
field. Rendering it correctly needs to read the current length of whatever
the user has typed, which needs client JavaScript this app does not ship
(§0). A `.counter` that always reads `0/4000` regardless of what is actually
in the field is worse than no counter -- it would be a small daily lie on
every field in the app. This is the same reasoning §7.1 already gives for
dropping the copy/share buttons on the link block, extended to this class:
not built, for the same reason, recorded here rather than shipped wrong.

### 8.3 `.msg--hidden` is defined but structurally unreachable today

§2.1's `.msg` bullet requires a `.msg--hidden` modifier (opacity .62) for a
hidden confession. The class is defined in `app/globals.css` and the inbox
page computes it from `m.status`, but `InboxPage` filters
`status === 'hidden_by_recipient'` out of `visible` before mapping over it
-- exactly the behaviour that shipped before this slice, and §0 forbids
changing it. So a message a recipient has hidden is never rendered at all,
and `.msg--hidden` can never actually paint. The class stays defined and the
conditional stays real (keyed off the genuine `m.status` field, not a
fabricated always-false check) so that if a future slice changes the filter,
the styling is already correct; it is flagged here as currently dead by
construction of unchanged, pre-existing behaviour rather than a gap in this
slice's own work.

### 8.4 `app/admin/_lib/html.ts`'s `revealDocument` keeps its own inline styles

`app/admin/reveal/route.ts` renders its confirmation page through
`revealDocument()` in `app/admin/_lib/html.ts`, a hand-built HTML document
with its own `<style>` block (the pre-week-11 palette). This slice's file
list (task step B) names `.tsx` pages and `app/layout.tsx`; `html.ts` and
`route.ts` are not page components, cannot import `globals.css` (Next hashes
the stylesheet's built filename, which a raw `Response` has no way to
learn), and are explicitly called out by that file's own comments as week 9
hardening the reveal-audit surface. §3.9 says admin hardening "is not
touched." Restyling it was judged out of scope and left alone rather than
guessed at.

### 8.5 Interpretation: where `.veil--rose` / `.reveal--resolved` are allowed to render

§3.4 states `/offer/[offerId]` is "the only one carrying `--veil-rose` and
`--glow-rose`," while §2.1 and §3.2 separately describe `.reveal--resolved`
(which carries `--glow-rose`) as the normal styling for a *resolved* mutual
reveal, and a resolved reveal is only ever shown to the two participants on
`/inbox` and `/sent` -- never on `/offer/[offerId]`, which
`getPendingOfferForSender` only ever renders in the `pending` state (an
already-resolved offer throws `OfferNotPendingError` before this page can
render it). Read completely literally, §3.4 and §3.2 cannot both hold.

Resolved this build as: §3.4 is about page-level treatment (the *screen*
allowed a full rose wash is the offer screen, via `.veil`/`.veil--rose` on
its wrapper), and `.reveal--resolved`'s glow is a *component*-level state
that appears wherever a resolved reveal is actually shown -- which, given
the offer page's own state machine, is never the offer page itself. `/sent`
keeps the explicit "no veil, no glow" of §3.5 by rendering its resolved
reveal as `.card--rose` (tinted, no glow, no veil) rather than `.reveal`.
`/inbox` uses `.reveal--resolved` for a resolved reveal, since §3.5's "no
veil, no glow" rule is written for `/sent` specifically and inbox is never
called a list the way `/sent` is. No acceptance item mechanically checks
which files carry `.reveal--resolved` or `.veil--rose` (item 9 only checks
`.btn--reveal`'s file set and the absence of the literal token strings in
`.tsx`), so this is a design judgement call, recorded rather than asserted
as the only possible reading.

- **§8.6** Acceptance item 18 as written could not pass. `**from you**`
  occurs three times in `main`'s `src/terms.ts`: twice in the header comment
  that quotes the clause while explaining why the markup was kept, once in the
  clause itself. The test's first-occurrence `String.replace` therefore built
  its `expected` by editing the comment, so the only file that could have
  passed it is one where the comment is corrupted and the clause still bold --
  the opposite of the item. The assertion now anchors on the single-line
  clause and asserts that anchor is unique.
- **§8.7** Acceptance item 16 as written could not pass either. It scans
  the whole of `src/hourstamp.ts`, comments included, for `process.`, and that
  module's header comment states in prose that it uses no `process.env`. The
  check now runs on the file with comments stripped. In both cases the
  implementation was correct and the test was repaired at the assertion; the
  alternative -- rewording source comments so a string matcher passes -- is the
  same defect §8 already records for `app/globals.css`, and it hides the
  real fault rather than fixing it.

---

## §9. The client island — §7.1's deferred decision, taken

*Amended 2026-09-05, after the slice shipped. §7.1 sent one question to the
week log: whether to take the first `'use client'` island in this app for a
copy button. This section answers it. Everything above stays as frozen; where
this section and an earlier one disagree, this one is the later ruling and
says so explicitly.*

### 9.1 The decision

**Three client components exist, they live in `app/_components/`, and they
are the whole of this app's client JavaScript.**

| Component | What it is for |
|---|---|
| `ToastProvider.tsx` | An `aria-live` region at the root of every page, and the `toast()` the other two call. Two tones, citron and danger, borrowed from `.notice`. |
| `SubmitButton.tsx` | Replaces `<button type="submit">` inside a **Server Action** form. Disables itself and shows a pending ring while the action is in flight. |
| `CopyLink.tsx` | The «انسخ الرابط» button `LinkBlock.jsx` always carried and §7.1 declined to build. |

No route, no Server Action, no form `action=`, no field `name=`, no
validation attribute and no query changed to make room for them. §0's rule
still governs; this section widens what may be *added*, not what may be
altered.

### 9.2 Why the ban was worth having, and why it goes now

§7.1's reasoning was never "client JavaScript is bad". It was that a button
which does nothing is worse than no button, and that taking the first island
is a real decision with a real cost that should not be made at the end of a
session already replacing every screen. Both halves still hold. The second
half is now satisfied — this is a decision taken on its own, with the cost
written down. The first half is satisfied by construction:

- `CopyLink` renders **nothing at all** until it has mounted *and*
  `navigator.clipboard.writeText` is confirmed to exist. With JavaScript off,
  or on an insecure origin where the Clipboard API is absent, there is no
  button — not a dead one. The slug stays selectable text above it either
  way, so the link is always obtainable by hand and this is only ever an
  accelerator.
- `SubmitButton` degrades to precisely what it replaced: a real submit
  button that posts its form. Without JavaScript it simply does not spin.
- `ToastProvider` renders an empty live region and nothing else.

### 9.3 The cost, stated rather than glossed

This app now ships a React client runtime on every page, which it did not
before. That is the price, and it is not small: it is bytes on a phone
connection, and it is a second execution environment where a future mistake
could put something on the client that should have stayed on the server.

What it does **not** cost is the privacy property. The island reads no
request header, holds no session, and receives no data the page was not
already rendering into HTML for the same viewer. §2.4's promise — "no
request-header read anywhere in `app/`" — is unchanged and still enforced
by `test/14-share-card.test.ts`. Acceptance item 10c makes the new half of
that explicit: **no client component may import the database, the domain
layer, `next/headers` or `next/cookies`.** A `'use client'` module's imports
are compiled into the browser bundle, so such an import would not merely
fail to run — it would publish the module's source to every visitor.

### 9.4 Rejected, in writing

| Option | Why it lost |
|---|---|
| **Keep §7.1 as frozen: no island, no copy button** | Defensible, and it was the standing position for a reason. It lost because the slug is a 20-character string a user is expected to transcribe onto a story, on a phone, and «انسخ الرابط» is copy the design system itself ships in `LinkBlock.jsx`. The growth screen's one job is getting that link into circulation. |
| **A copy button with no feedback** | `navigator.clipboard.writeText` resolves silently. A button that reports nothing on success is indistinguishable from one that failed, so the toast is not decoration — it is the button's only output. That is why `ToastProvider` is in scope and not deferred. |
| **`next/link` throughout, for client-side navigation** | Rejected. It is a real improvement and it is not this decision. Every `<a href>` in the app stays an `<a href>`; a navigation change is its own slice with its own prefetch and privacy questions. |
| **A story-card generator (`<canvas>`, share sheet, prompt picker)** | Rejected as out of scope, at ~230 lines and a second share surface with its own copy, its own image output and its own origin handling. It is a product feature, not a skin, and it belongs in a spec of its own. |
| **A "clue" chip the sender attaches to a confession** | Rejected on §0. A clue is a new field on the send form, which changes what the form submits and what the recipient's inbox parses — a behaviour change, and one that hands the recipient a new signal about who the sender is, which the anonymity model would have to be re-argued to permit. |
| **Fabricated engagement counters (streak, view count) on the inbox** | Rejected outright, and recorded here so the idea is not retried. The numbers proposed were `Math.random()`: an invented figure presented to a user as their own data, re-rolling on every render. An app whose entire promise is that it tells the truth about who can see what cannot open its main screen with a fake number. |

### 9.5 What this changes above

- **§2.1** gains seven classes: `.sr-only`, `.toasts`, `.toast`,
  `.toast--citron`, `.toast--danger`, `.toast--leaving`, `.btn__spinner`.
  They introduce no new colour, easing or duration; every value is a token
  already declared. Acceptance item 5 continues to enforce coverage in both
  directions over the enlarged list.
- **§7.1** is superseded for the copy button only. **«شارك» / `navigator.share`
  remains unbuilt** — it is a different capability with a different fallback
  story, and nothing in this slice needed it.
- **§8.2** is unaffected. `.counter` is still not implemented: the island is
  three named components, not a general licence, and a live character count
  is not one of them.
- **Acceptance item 10** as frozen ("no `.tsx` file under `app/` contains
  `'use client'`") no longer describes the app and is retired. It is replaced
  by **10a, 10b and 10c**, which are collectively stricter, not looser:
  shells stay server-rendered; the client files are exactly the three named
  above; and none of them may import server-side code.

  The weaker replacement — "pages and layouts carry no directive", which is
  all that is needed to make the tree pass — was written first and rejected.
  It would stay green for an island that had quietly grown a database
  import, which is the only failure mode here that matters.

### 9.6 Two acceptance items that were failing on `main`, and why

Recorded because both had been reported as repaired and neither was.

- **Item 18** could not pass once its own fix reached `main`. It built its
  expected file from `git show main:src/terms.ts` and asserted the working
  tree differed from it — true only while the correction was unmerged, and
  false forever after. §8.6 repaired the wrong half of it. It now asserts the
  property directly: the plain clause is present, the bold one is not.
- **Item 16** was repaired at the assertion per §8.7 — the check strips
  comments before scanning for `process.` — but the stripper split on
  `'\n'`, so on a CRLF checkout every line kept a trailing `\r`, and
  JavaScript's `.` excludes `\r` as a line terminator: `.*$` could never
  reach the end of the line and the stripper matched nothing. The item failed
  on Windows and passed on CI, and the source comment had been reworded to
  make it pass — the exact repair §8.7 forbids. The comment is restored and
  the stripper splits on `/\r?\n/`.

Four further tests failed only on Windows, for reasons unrelated to what they
assert: `path.relative` yields backslashes and two allow-lists were written
with forward slashes; a bare filesystem path is not a valid ESM specifier;
Node 24's default test reporter no longer emits the `# pass 7` line one item
reads back; and `spawnSync('bash', ...)` resolves to the WSL launcher, which
cannot see this filesystem, so twenty-one deploy-script tests exited 127
without running. Those scripts are the ones week 5 added after `deploy.sh`
deployed the wrong stack and exited 0, and they are the last ones that should
be silently unrun on a developer's own machine. All four are fixed in the
tests; no assertion was weakened to do it.
