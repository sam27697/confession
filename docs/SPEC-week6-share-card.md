# SPEC — week 6: the share card

*Frozen 2026-08-28, before any code. Written by the session that plans, not by
the agent that implements. An agent implementing this document does not edit
it; if it is wrong, the correction is a numbered section appended here saying
so, the way §1.3 of the week-5 spec did.*

## 0. The problem, measured

Production serves **zero** Open Graph tags. Measured 2026-08-28 against the
live site immediately after promotion:

```
$ curl -s https://confession.fayad.app/ | grep -oiE '<meta[^>]*(og:|twitter:)[^>]*>'
(no output)
```

`app/layout.tsx` exports a `Metadata` object with `title` and `description` and
nothing else, so Next emits `<title>` and `<meta name="description">` and no
`og:` tag at all.

This is not a polish gap. `BRIEF.md`, on Sam's answer of 2026-08-28 (item 19):
the distribution channel is **a link pasted into a Facebook post or story**.
There is no app store, no feed, no search, no other way in. The card that
unfurls when that link is pasted is the entire conversion surface, and today it
unfurls as a bare blue URL.

## 1. Which pages get a card

| path | card |
|---|---|
| `/` | generic |
| `/c/<slug>` where the link exists **and** `enabled = true` | personalised |
| `/c/<slug>` where the link exists and `enabled = false` | generic |
| `/c/<slug>` where the slug does not exist | generic |
| `/terms`, `/privacy` | generic |
| `/inbox`, `/sent`, `/offer/*`, `/onboarding`, `/auth/*` | **none** — see §2 |

"Generic" means the site's own card: the product name, the one-line pitch, the
static brand image. It carries no user in it.

A **disabled** link gets the generic card deliberately. Switching a link off is
the user withdrawing from the product; a card is a publication, and continuing
to publish somebody's name after they have switched off is the wrong default
even though the page itself still resolves.

## 2. The privacy rules that bound this slice

This is the section that outranks the rest of the document.

The `/c/<slug>` card is fetched by an **unauthenticated third-party crawler**
and then rendered **publicly, in a feed, to people who never visited the site**.
Every byte in it is published. So:

**2.1 The card may contain exactly two variable things:** the link owner's
display name, and the slug (inside `og:url` and the image URL). Nothing else.
Both are already public on the page the card points at.

**2.2 The card must not contain, in any tag or in the image:**

- any count — of confessions received, sent, pending, or offers open. A count
  is a signal about the owner's private inbox and it must not leak through the
  front door.
- any sender information of any kind. There is no path from a `/c/<slug>`
  request to a sender in this design and there must not become one.
- any account id, link id, offer id or other internal uuid. `og:url` and the
  image URL are built from the **slug**, which is the public handle, and never
  from `links.id` or `accounts.id`.
- any timestamp. Not the link's creation time, not "last active", not
  "responds in an hour". A timestamp on a public card is a presence signal.
- the owner's `provider_user_id`, ever, in any form, hashed or otherwise.

**2.3 The private surfaces emit no `og:` tags at all.** `/inbox`, `/sent`,
`/offer/*`, `/onboarding` and `/auth/*` are behind a session and must stay
uninteresting to a crawler. They inherit no personalised metadata. If the
generic card leaks onto them through layout inheritance that is acceptable;
a *personalised* one is not.

**2.4 The image route reads no request header.** Not the user agent, not the
referrer, not the address. The rule from week 4 does not get an exception
because the caller happens to be Facebook. The tripwire is the same one: the
grep over `app/` and `src/` for header reads must keep returning only the
privacy page's own copy and the literal `User-agent:` in the robots body.

**2.5 The image route logs nothing.** It is the one route that will be hit by
a machine at unpredictable volume, which makes it the most likely place for
somebody to add a counter or a debug line later. It does not get one.

**2.6 It must not become a user-enumeration oracle beyond what the page
already is.** The card for a non-existent slug and the card for a disabled slug
are byte-identical — both generic. If the *page* underneath still distinguishes
them, that is a pre-existing property of the page and is out of scope here, but
the card must not add a second, easier oracle on top of it.

## 3. The tags, exactly

On every page, from the root layout, as Next `Metadata`:

```
metadataBase        = new URL(env.appOrigin)
og:type             = website
og:site_name        = مصارحة
og:locale           = ar_AR
twitter:card        = summary_large_image
```

`metadataBase` is what makes every relative image URL resolve to an absolute
one. Facebook's scraper does not resolve relative `og:image` values, so this is
not a convenience — without it the card has no image.

Generic (root layout defaults):

```
og:title        = مصارحة
og:description  = خلي الناس تصارحك بصراحة، وهي متخفية. وإذا حبيت تعرف مين، لازم تصارحهم بدورك.
og:url          = <appOrigin>/
og:image        = <appOrigin>/og/default.png
og:image:width  = 1200
og:image:height = 630
og:image:alt    = مصارحة
```

Personalised, on `/c/<slug>`, via that page's `generateMetadata`:

```
og:title        = صارِح {displayName}
og:description  = ابعتلو اللي بقلبك وهو ما بيعرف مين إنت. وإذا حب يعرف، لازم يصارحك بدوره.
og:url          = <appOrigin>/c/{slug}
og:image        = <appOrigin>/c/{slug}/opengraph-image
og:image:alt    = صارِح {displayName}
```

The description is the **mechanic**, not a generic "send me anonymous
messages". The mutual reveal is the thing that is not NGL, and the front door
is where it has to be said. This sentence is a product decision, not filler
copy, and an implementer does not reword it.

`fb:app_id` is emitted **only** when `env.facebookAppId` is non-null. An empty
or placeholder `fb:app_id` is worse than none: it is a claim about an app that
does not exist. Production has no app id today, so production emits no
`fb:app_id` today, and that is correct.

### 3.1 Escaping

`displayName` comes from Facebook and is attacker-influenced in the ordinary
sense that a person chooses their own name. It goes into a `<meta content="">`
attribute. React's metadata rendering escapes it, but the spec states the
requirement rather than relying on the framework being remembered: a display
name containing `"`, `<`, `>` or a newline must not break out of the attribute,
and a test asserts it. Names are already capped at 80 characters at the
database; the card truncates to 40 with an ellipsis so the title fits a card.

## 4. The image

Two images, and they are different kinds of thing.

**4.1 `/og/default.png` — static, committed, 1200×630.** A real file in
`public/og/`. Brand only: the word مصارحة and the one-line pitch. No user in
it. It is served by the static file handler, needs no runtime, and cannot fail.

**4.2 `/c/<slug>/opengraph-image` — generated per link, 1200×630.** Next's
file-convention route (`app/c/[slug]/opengraph-image.tsx`) using `ImageResponse`
from `next/og`. It renders the owner's display name into the card.

Constraints on it:

- **1200×630, PNG.** Meta's stated recommendation for a large card.
- **The font is vendored into the repo** and loaded from disk by the route. It
  is not fetched from Google Fonts or any CDN at request time: a card that
  depends on a third-party network call at scrape time is a card that
  intermittently does not exist. The font must be OFL or similarly
  redistributable, and its licence file ships next to it.
- **Arabic must render correctly** — joined, right-to-left, not reversed and
  not in disconnected isolated forms. **This is a proof obligation, not an
  assumption.** The implementing agent renders the PNG, writes it to disk, and
  it is inspected visually before this route is called done.
- **If Arabic shaping cannot be made correct**, the route is not shipped
  broken and it is not shipped with the name transliterated or dropped
  silently. It falls back to §4.1's static image for every link, the fallback
  is stated in `BRIEF.md`'s week log as a shortfall, and the reason is written
  down. A card with mangled Arabic in a Facebook feed is worse than a clean
  brand card — it is the first impression of a product whose whole pitch is
  that it is Arabic-first.
- **It must not query anything but the link.** One read by slug. If the link
  does not exist or is disabled, it returns the same bytes as §4.1 (§1, §2.6).
- **`alt` is set**, matching `og:image:alt`.

## 5. `robots.txt`

Production currently serves `Disallow: /c/` under `User-agent: *`, added in
week 5 to keep confession link pages out of search results. That intent stands
and does not change.

**The open question this slice must answer before it can be called done: does
the crawler that builds Facebook's link preview obey `robots.txt`, and does
that `Disallow: /c/` therefore stop the card from ever rendering?** If it does,
the entire distribution loop is dead on arrival and nobody would see it until
Sam pasted a link.

This is being measured against Meta's own documentation in the same session,
and the answer is written into §5.1 below as a numbered correction with its
citation, **before** the deploy is called done. It is not guessed at here.

Whatever the answer, the shape of the change is bounded: `src/robots.ts` is a
pure function over the origin with an exact-equality check, and any named
user-agent block goes in it, keeps the exact-equality guard, and keeps staging
fully closed with `Disallow: /`. Staging never becomes crawlable, for any
agent, for any reason.

## 5.1 ANSWERED, 2026-08-28 — the answer is yes, and week 5's robots.txt kills the product

**Measured against Meta's own crawler documentation, and re-measured by the
session rather than taken from the agent that found it.**

Source: [Meta web crawlers](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers),
read 2026-08-28. The page shows no revision date, so that is a date read, not a
date published.

Verbatim:

> "By configuring the robots.txt file on your website, you can specify to the
> Meta web crawlers how you would prefer them to interact with your site."

> "In order to block these crawlers, add a disallow for the relevant crawler to
> robots.txt."

> "Also, the FacebookExternalHit crawler might bypass robots.txt when
> performing security or integrity checks."

The link-preview crawler is `facebookexternalhit`, and Meta gives its exact
string:

> "`facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)`"

So: a disallow blocks it, and the only exception Meta names is security and
integrity checking — not building a preview card. It has no `User-agent` group
of its own in our `robots.txt`, so under ordinary robots.txt precedence it
falls into the `User-agent: *` group, and that group says `Disallow: /c/`.

**Week 5 shipped a `robots.txt` that tells Facebook not to read the only page
the product asks people to share.** Every card would have come back empty, and
nothing in the app would have reported an error — the first symptom would have
been Sam pasting his own link into Facebook and getting a bare blue URL. The
two changes are each individually correct and together they are fatal, which is
exactly the class of defect a spec is supposed to catch and this one did not.

### The change

`robotsBody(appOrigin)` for the **production origin only** becomes three groups,
in this order:

```
User-agent: facebookexternalhit
Allow: /
Disallow: /inbox
Disallow: /sent
Disallow: /offer/
Disallow: /onboarding
Disallow: /auth/

User-agent: meta-externalagent
Disallow: /

User-agent: *
Disallow: /c/
Disallow: /inbox
Disallow: /sent
Disallow: /offer/
Disallow: /onboarding
Disallow: /auth/
```

Three deliberate decisions in that:

1. **`facebookexternalhit` gets `/c/` and nothing private.** It needs the link
   page and the site root to build a card. It has no business in an inbox, and
   although those are behind a session anyway, the disallow costs nothing and
   is the honest statement of intent.
2. **`meta-externalagent` is disallowed everywhere.** Meta documents it as a
   separate crawler: *"The Meta-ExternalAgent crawler crawls the web for use
   cases such as training foundation AI models or improving products by
   indexing content directly."* That is a different thing from rendering a
   share card, and on a product whose entire proposition is confidentiality,
   the default answer to "may we train on this" is no. It is disallowed by
   name, so it cannot inherit the `facebookexternalhit` allowance.
3. **The `*` group is unchanged.** Google still does not index `/c/`. The
   privacy intent of week 5 survives intact; only the crawler that needs an
   exception gets one.

Staging is **unchanged and stays fully closed**: `User-agent: *` /
`Disallow: /` covers `facebookexternalhit` too, since on staging it has no
group of its own to fall into. The exact-equality origin guard is not touched.
Staging never becomes crawlable, and that means **the card cannot be validated
on staging by Facebook** — see §5.2.

### 5.2 What cannot be verified, and it is not small

Meta's Sharing Debugger is the tool that would prove a card renders. It is
behind a Facebook login:

> "Log in to Facebook to use this tool" — https://developers.facebook.com/tools/debug/,
> read 2026-08-28 unauthenticated.

There is no unauthenticated Meta validator. This session has no Facebook
credentials — the same missing App ID and Secret that block Facebook Login also
block the only authoritative way to check a card.

So this slice can prove, and does prove:

- the tags are served, on the right pages, with the right absolute values;
- the image exists, is 1200×630, and loads over the public internet
  unauthenticated;
- `robots.txt` allows `facebookexternalhit` on `/c/` and still blocks the `*`
  group there.

It **cannot** prove that Facebook actually renders the card, because that
requires either a login or a real post. That is stated as an open item and not
dressed up. Meta also caches `robots.txt`:

> "Please allow up to 24 hours for changes to `robots.txt` to take effect
> because crawlers may cache the contents of `robots.txt` for up to 24 hours."

so the first real card may be up to a day behind this deploy.

## 4.3 CORRECTION, 2026-08-28 — satori (next/og) shapes Arabic but does not run bidi; the per-link image is not shipped

**Measured while implementing §4.2, not assumed.** Three proof renders were
written to `/tmp/og-proof/` using `ImageResponse` from `next/og` (satori,
the version vendored by `next@15.5.24`) with `Tajawal-Bold.ttf` (the font
vendored for this attempt) and `direction: 'rtl'` on the container:

- `tajawal-short.png` — a short Arabic-only name. Letters within each word
  are correctly joined.
- `tajawal-long.png` — a long Arabic name past the 40-character truncation
  point, to see wrapping.
- `tajawal-latin.png` — the mixed-direction case, source string `صارِح John
  Smith` (Arabic verb, Latin name).

Letter **shaping is correct** in all three: joined forms, not isolated
letters, not mirrored glyphs. **Bidi (word order) is not.** The clearest
evidence is `tajawal-latin.png`: the logical order is [صارِح] [John Smith].
In correct RTL layout the first logical run sits at the right edge, so
"John Smith" (the second run) should render to its *left*. The actual
render puts صارِح on the left and "John Smith" on the right — the two runs
in left-to-right logical order, i.e. bidi reordering never ran. The same
defect is visible in `tajawal-long.png`: once the text wraps, word order is
reversed on both lines and the truncation ellipsis lands at the right end
of the last line, where RTL requires it on the left. This is a known class
of satori limitation — it shapes complex scripts but does not implement the
Unicode Bidirectional Algorithm (UAX #9) before laying text out.

**Decision, per §4.2's own stated fallback:** `app/c/[slug]/opengraph-image.tsx`
is **not shipped**. A card with reversed Arabic word order in a Facebook
feed is worse than a clean brand card, and §4.2 was explicit that this is
not a case to ship "broken" or "transliterated or dropped silently" — it is
a case to fall back. So:

- `/c/<slug>`'s `og:image` and `og:image:alt` point at the same
  `<appOrigin>/og/default.png` and `مصارحة` as the generic/root card — not a
  personalised image, for every link, enabled or not.
- The personalisation for an enabled link still ships in full in
  `og:title` and `og:description` (§3) — those are plain text handed to the
  browser/crawler's own text renderer, which does bidi correctly; they are
  not run through satori and have no rendering defect.

**The same defect hit `public/og/default.png` (§4.1) too**, and that one
*is* fixable, because unlike a per-link name it is one fixed string decided
at build time and can be checked by eye once, not regenerated per crawler
hit. `scripts/generate-default-og-image.py` renders it with Python +
Pillow, built with **libraqm** (HarfBuzz + FriBidi + FreeType) — a real
implementation of both Arabic shaping and the bidi algorithm, not
satori/next-og. The two-line brand image (`مصارحة` / the one-line pitch)
was re-rendered this way and re-inspected; the subtitle now reads, right to
left starting at the right edge, `خلي الناس تصارحك بصراحة، وهي متخفية` —
correct visual order. This is the "preferred: something that does real
bidi" option §4.2 anticipates, not the "pre-reverse the source string"
workaround — the source string in the generator is the normal, forward,
logical-order Arabic sentence; no reversal trick was needed once raqm was
doing the layout.

**Known fix path for a later slice, not implemented tonight, not tested:**
satori accepts pre-shaped, pre-bidi-ordered *glyph strings* — it does not
have to be given logical-order text if the caller does the Unicode
Bidirectional Algorithm and Arabic contextual shaping itself first (e.g.
`bidi-js` for UAX #9 reordering plus an Arabic reshaper for the
presentation-form substitution, feeding satori the resulting visual-order
string instead of the logical one). This was not attempted here: it adds a
text-shaping dependency to the request path of a route that today has none,
the interaction between manual pre-shaping and satori's own (partial)
complex-text handling is unverified, and there was no time in this slice to
render and inspect proof images for it. Whoever picks this up should treat
"it doesn't throw" as insufficient evidence, the same way this correction
does — render it, look at it, check word order specifically for
mixed-direction and multi-word RTL strings, not just that Arabic letters
join.

## 6. Tests

Written by a **different agent** than the one that writes the implementation,
from this document, not from the code. That is this project's standing rule and
it is not relaxed because the slice is small.

`test/14-share-card.test.ts`, at minimum:

1. The generic metadata object contains every tag §3 lists, with the exact
   values §3 gives.
2. The personalised metadata for an enabled link contains the owner's display
   name in `og:title` and `og:image:alt`, and `og:url` ends with `/c/<slug>`.
3. `og:url` and the image URL are **absolute** and begin with the configured
   `appOrigin`. A relative `og:image` fails this test.
4. A disabled link produces byte-identical metadata to a non-existent slug,
   and neither contains the owner's display name. (§1, §2.6)
5. The serialised metadata for `/c/<slug>` contains **no** account id, link id
   or offer id, asserted against a fixture whose uuids are known — the same
   "absent from the JSON string, not merely from a key" discipline as week 2.
6. No timestamp field appears in the serialised metadata. (§2.2)
7. A display name containing `"` and `<script>` does not escape its attribute,
   and a name over 40 characters is truncated. (§3.1)
8. `fb:app_id` is absent when `facebookAppId` is null and present when it is
   set. Two cases, both asserted.
9. The header-read tripwire from §2.4, extended to cover the new files: a grep
   over `app/` and `src/` finds no request-header read outside the two known
   allowed matches. This test fails the build if a later change adds one.
10. Whatever §5.1 settles, asserted as robots body strings for the production
    origin and for staging, with staging still fully closed.

## 7. What this slice does not do

- It does not touch Facebook Login, which is still waiting on the App ID and
  Secret.
- It does not add analytics, a click counter, or any measurement of how often a
  card is fetched. That would be the first request-logging in the product and
  it is not being added by the back door of a metrics feature.
- It does not change the send flow, the mutual-reveal state machine, or the
  schema. No migration.
