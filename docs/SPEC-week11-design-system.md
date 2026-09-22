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
