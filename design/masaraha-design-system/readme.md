# مصارحة (Masaraha) — Design System

Anonymous-message web app for young Arabic speakers. You get a personal link, share it in a story or a bio, and anyone can write to you without you learning who they are. If one message makes you want to know, you send a **«صارحني بدورك»** offer: one question for them, and something of your own put up in return. Only if they accept do both answers unlock and their name appear. Nobody is unmasked without agreeing to it — that consent-gated mutual reveal is the product; everything else is plumbing.

**Audience.** Syrian, Levantine and Gulf, on phones, mostly at night. Terms require 18+. The visual language is young and fashion-forward but never child-facing: no mascots, no school imagery, no toy cues. "Late-night, close friends, a little dangerous."

## Sources this system was built from

- GitHub: **https://github.com/sam27697/confession** (branch `main`) — the running Next.js app. Read for copy, data vocabulary, limits and rules: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/inbox/page.tsx`, `app/c/[slug]/page.tsx`, `app/offer/[offerId]/page.tsx`, `app/sent/page.tsx`, `app/onboarding/page.tsx`, `app/privacy/page.tsx`, `app/admin/**`, `src/views.ts`, `src/terms.ts`, `src/limits.ts`, `src/slug.ts`, `src/errors.ts`, `src/share-card.ts`, and the specs in `docs/SPEC-week*.md`. Worth exploring further — the specs carry the safety reasoning behind most of these rules.
- The brand brief supplied with this project (full redesign; the repo's UI was a developer placeholder and none of it was preserved).

Nothing else was provided. There was **no logo file, no font file and no image asset** in the sources — the mark in `assets/` is built from the brief's own description (a speech bubble carrying **م**) and is drawn in CSS/SVG, not copied.

## Non-negotiable constraints

1. **Arabic, RTL, always.** No English UI. Arabic-Indic numerals inside Arabic text; Latin slugs run LTR inside RTL.
2. **No external assets.** No web fonts, no CDN, no icon library, no images. A system Arabic stack plus inline CSS/SVG. (The specimen cards and UI kits load React from unpkg for previewing only — the product ships one stylesheet.)
3. **Mobile-first**, 390×844; desktop caps content at 640px.
4. **Hour-only timestamps.** «اليوم ٢ص», «أمس ١١م». Never a minute, never "منذ دقيقتين" — a minute-level stamp plus knowing who was awake identifies the sender.
5. **The sender is anonymous to the recipient, not to the operator.** Never write copy promising nobody can ever know.

## CONTENT FUNDAMENTALS

**Register.** Spoken Levantine dialect, not MSA. Short sentences, warm, a little playful, never corporate, never preachy. Second person singular, addressed directly: «الناس تقدر تبعتلك أي شي وهي متخفية عنك». Dialect spellings are deliberate — «هلق», «شو», «بدك», «لسا», «منقدر», «فيك» — never "normalize" them to MSA.

**Verbatim copy from the product** (do not rewrite these):

- Pitch: «تطبيق مصارحة سرية. الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.»
- Anonymity disclosure: «اسمك ما بيوصل للي عم تبعتله. بس رسالتك مربوطة بحسابك عنا، وإدارة التطبيق بتقدر تشوفه.»
- Reveal promise to the sender: «إذا وافقت، اسمك رح ينكشف إلو — وبس إلو، وبس على هالرسالة.»
- Fairness rule: «ما حدا بيشوف جواب التاني قبل ما ينزلوا الاتنين سوا.»
- Share card: «صارِح {الاسم}» / «ابعتلو اللي بقلبك وهو ما بيعرف مين إنت.»

**Errors sound like a person, not a code.** «بعتت ٥ رسائل لهاد الرابط بهي الساعة. ارتاح شوي وارجع.» — not "Rate limit exceeded". Limits: 5 per link per hour, 30 per account per day.

**Casing & punctuation.** Arabic has no case; hierarchy is weight and size only. Guillemets «» for feature names and quoted UI strings. No exclamation marks. No trailing colons in labels. Questions end with «؟».

**Buttons are verbs in the imperative:** «ابعت», «انسخ الرابط», «شارك», «خبيها», «بلغ», «احظر صاحبها», «وافق وجاوب», «لأ، مو هلق», «اكشف المرسل», «احذف حسابي نهائياً».

**Emoji: never.** Not in UI, not in copy, not as icons. The only glyph-as-icon in the system is **م** in the brand mark, ✓ in a checkbox, and a hairline dot in a state chip.

**Empty states are prompts, not errors.** The empty inbox is the growth screen: «صندوقك لسا فاضي / حط رابطك بستوري أو بالبايو. أول رسالة بتوصل أسرع مما تتخيل.»

**Tone shifts once.** Account deletion and the admin reveal drop all playfulness: plain, factual, and explicit about what is irreversible.

## VISUAL FOUNDATIONS

**Palette.** Warm charcoal-brown ground (`--ground #150F0E`, deep `#0D0908`) with warm off-white text (`#F5EFE9`) — warm, not blue-black. One acid-citron primary (`--citron-500 #D6F25B`) for every action. One dusty rose (`--rose-500 #E39BA8`) reserved *exclusively* for the mutual reveal. Semantics: vermilion `#FF5C4D` danger, amber `#F0B95B` pending, dull `#8E7F79` hidden. Two background colours per screen, maximum. Dark is the only theme.

**Type.** System Arabic stack — `system-ui, -apple-system, Tahoma, Arial, sans-serif`, naming no OS-specific face so each platform resolves its own Arabic default — weights 400/500/700/800. Scale 44 / 34 / 26 / 20 / 17 / 15 / 13 / 12. Line-height 1.75 for body (Arabic needs the air), 1.24 for display. **Letter-spacing is always 0 in Arabic** — spacing breaks letter joining. Mono is used for exactly two things: the link slug and character counters.

**Backgrounds.** No images, no photography, no illustration, no repeating pattern. The one motif is the **veil**: a single top-down radial wash of citron (or rose, on reveal screens) over the ground, fading to nothing by 62%. Never a multi-hue gradient, never a diagonal one. Landing, empty state, link block and reveal screens carry a veil; lists and legal pages do not.

**Shape.** Radii 6 / 10 / 14 / 22 / 28 + pill. The signature is the **notch**: one corner cut back to 6px so a panel reads as speech without a drawn tail. In RTL the notch sits bottom-left. Buttons are always full pills. Fields are 14px.

**Cards.** `--surface-1` fill, 1px `--line` hairline border, 22px radius, soft downward shadow (`--shadow-card`: a 1px inner top highlight at 3% plus `0 8px 24px -12px` near-black). Raised variants get `--shadow-raised` and the stronger hairline. Fields are *inset* wells (`--surface-inset`, darker than the card) so they read as holes, not boxes. No coloured left-border accents anywhere.

**Depth & glow.** Glow is meaningful, not decorative: citron glow marks the one primary action, rose glow appears only when a reveal resolves. Never both on one screen.

**Transparency & blur.** Glass (`--glass-bg` 72% + 14px blur) appears in exactly two places: the sticky app header and bottom sheets. Everything else is opaque. The admin panel has no glass at all.

**Motion.** 90ms press, 150ms hover/colour, 220ms toggle and sheet, 900ms for the identity reveal — the only slow move in the system. `cubic-bezier(.22,.61,.36,1)`. **No bounce, no spring, ever.** Respects `prefers-reduced-motion`.

**Hover / press.** Hover lifts 1px and lightens the surface one step (`--surface-2` → `--surface-3`); it never changes hue. Press scales to .97 and adds an inset shadow. Links underline on hover at 3px offset — they do not change colour except one step lighter. Focus is a 2px citron ring with a 2px ground gap.

**Layout.** One decision per screen. Single column, 20px gutters, 14px between stacked cards, 48px minimum tap target (52px primary). Sticky header, sheets from the bottom, nothing fixed at the side. Desktop is the same column, centred, capped at 640px — not a new layout.

## ICONOGRAPHY

There is none, deliberately. The sources ship no icon font, no sprite, no SVG set, and rule 2 forbids adding one. So:

- **State is text.** `StateChip` carries an Arabic label and a 6px dot; the dot's colour is the only glyph.
- **Actions are words.** Buttons never carry an icon. «انسخ الرابط», not a clipboard.
- The brand mark is the only drawn shape in the system: a notched square with **م** (`assets/icon.svg`, `assets/logo.svg`, or the `BrandMark` component, which draws it in CSS at any size).
- Two Unicode characters are permitted as marks: `✓` inside a checkbox or a success bubble, and `·` as a separator. No emoji, no arrows, no chevrons.
- If a future screen truly needs a glyph, draw it inline as an SVG that ships with the page. Do not link Lucide, Heroicons, Font Awesome or anything else.

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The one entry point. `@import`s only. |
| `tokens/` | `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `effects.css`, `motion.css`, `base.css`. |
| `guidelines/` | 15 foundation specimen cards (Colors, Type, Spacing, Shape, Motion). |
| `brand/` | App-icon sheet (1024/512/256) and the 1200×630 share card. |
| `assets/` | `icon.svg`, `logo.svg` — the only asset files; both drawn, none supplied. |
| `components/` | The primitives, below. |
| `ui_kits/masaraha_app/` | Mobile app: every screen and state, click-through. Plus `desktop.html`. |
| `ui_kits/masaraha_admin/` | Operator panel: login, message queue, reports, gated reveal. |
| `thumbnail.html` | Homepage tile. |
| `SKILL.md` | Agent-skill entry point. |
| `github.md` | Upstream repository association and screen map. |

### Components

Grouped by concern. Every one carries a `.d.ts` props contract and a `.prompt.md` usage note.

- `components/core/` — **Button**, **Card**, **Notice**, **StateChip**, **Toggle**, **EmptyState**
- `components/forms/` — **TextField**, **TextArea**, **CheckboxRow**
- `components/app/` — **AppHeader**, **LinkBlock**, **MessageCard**, **RevealPanel**, **HourStamp** (plus the `toArabicDigits` helper it exports)
- `components/brand/` — **BrandMark**

### Intentional additions

The repo styles UI with element selectors and a handful of classes rather than named components, so the inventory above was derived from those classes and the screens that use them (`.card`, `.notice`, `.tag`, `button`/`.secondary`/`.danger`, `input`/`textarea`, `.actions`, `details.offer`, the link on/off form, the header). Three additions have no direct counterpart in the source and exist because the brief asks for them explicitly: **BrandMark** (there was no logo file), **HourStamp** (the hour-only rule needs one enforcement point), and **RevealPanel** (the brief's central screen; the repo renders it as loose `<p>` pairs).

## Caveats

- **Fonts.** By design there are no font files: `--font-ar` resolves to the platform's own Arabic face, so the design system reports "no @font-face". Do not substitute a webfont — the no-external-assets rule is a privacy and supply-chain decision. Rendering therefore varies slightly by OS; the hierarchy is built from weight and size so it survives that.
- `/account/delete` does not exist in the repository yet; that screen is designed from the brief and the terms text, not from code.
