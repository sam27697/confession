# Week 16 - a Facebook story that opens the link

*Frozen 2026-09-23 before any code, against `main` at `faa5022`.*

## §0 The ask, and what was true before

Sam: sharing to a Facebook story must not be only the image; the story must
be clickable to the link, easily and smoothly.

On `main`, the «ستوري فيسبوك» tile hands the 1080x1920 PNG to the phone's
share sheet. The person picks Facebook, then Your story, and posts a picture.
Nobody who sees that story can tap through to the link. The card even prints an
instruction to the poster onto the picture the viewers see («حط رابطك بستيكر
الرابط بالستوري...»), and nothing puts the link anywhere a sticker could use it.
`src/share-targets.ts` records the reason as a rule: "no web page can post to a
Facebook story."

## §1 What was measured

### §1.1 The native Stories API has no link parameter

Meta's own documentation, read 2026-09-23:

- Android, `com.facebook.stories.ADD_TO_STORY`: the only extras are
  `com.facebook.platform.extra.APPLICATION_ID`, `interactive_asset_uri`,
  `top_background_color`, `bottom_background_color`, plus the background asset
  as the intent data. No URL, link or attribution-link extra.
  <https://developers.facebook.com/docs/sharing/sharing-to-stories/android-developers>
- iOS, `facebook-stories://share`: pasteboard keys
  `com.facebook.sharedSticker.appID`, `.backgroundImage`, `.backgroundVideo`,
  `.stickerImage`, `.backgroundTopColor`, `.backgroundBottomColor`. No link key.
  <https://developers.facebook.com/docs/sharing/sharing-to-stories/ios-developers>

Both need a native app and a Facebook App ID. So even a native app could not
make an image story clickable through this API. The rule on `main` is right
about this API and wrong as a general statement.

### §1.2 Facebook's own share page offers "Your story"

`https://m.facebook.com/sharer.php?u=<url>` is Facebook's share page. For a
signed-in user it lets the user pick the destination, News Feed and/or Your
story. Shared to Your story, the link becomes a story drawn from the page's
Open Graph tags, and viewers tap it to open the link. It needs no App ID.

Sources, all describing the same route: geekinstructor (method 1),
<https://www.geekinstructor.com/2021/07/how-to-add-clickable-link-facebook-story.html>;
alphr, <https://www.alphr.com/facebook-stories-add-links/>; circleboom,
<https://circleboom.com/blog/add-link-to-facebook-story/>. They are 2021 to
2025 third-party guides, not Meta documentation, so §5 lists the check that has
to be made on a phone.

Measured here: in a signed-out browser the page answers «Not Logged In» and
nothing else. The destination picker was not observed, because observing it
needs a signed-in Facebook session this environment does not have.

### §1.3 The link sticker

Facebook stories have a Link sticker for many personal profiles, but the
rollout is uneven by region and account. Instagram's link sticker has been open
to every account since October 2021. A sticker is a paste of a URL the person
has to have on their clipboard.

### §1.4 What a link story looks like on `main`

The og:image of every `/c/[slug]` is `public/og/default.png`: the word
«مصارحة» in white on flat slate `#0f172a`, a colour this app has not used since
week 12. Shared to a story, that is the story.

`og:url` is Facebook's canonical URL for a share. A variant of the page that
changes its image must also carry its variant in `og:url`, or Facebook resolves
the canonical page and draws the default card.

---

## §2 The design

Two routes, in this order, because they are two different trade-offs.

### §2.1 Primary: «ستوري فيسبوك بالرابط», a link story

One button at the top of the share panel, an `<a target="_blank">` to
`https://m.facebook.com/sharer.php?u=<storyUrl>`. The hint under it says what
happens: Facebook's page opens, pick «قصتك» and post; the story is a card that
opens the link when tapped. Guaranteed clickable, no sticker, no paste.

`storyUrl` is the owner's link plus `?q=<variant>`:

- `q0` to `q5`: the question picked in the sheet, the index into `PROMPTS` in
  `app/_components/StoryCard.tsx`.
- `r`: the reaction card, opened from a message in the inbox.

`/c/[slug]`'s `generateMetadata` reads `q`, validates it against
`STORY_CARD_VARIANTS` (`src/share-card.ts`), and for a valid variant serves
`/og/story/<variant>.png` as og:image and puts `?q=<variant>` in og:url (§1.4).
Anything else is ignored and the page's metadata is exactly what it was. The
page body never reads `q`.

The variant is an index into a fixed list, so this stays inside week 6 §2.1:
no per-user value is added to the card, and nothing from a message is ever
drawn into a public image. The reaction story's preview carries a fixed
sentence, never the confession's text.

### §2.2 Secondary: «الصورة للستوري + ستيكر الرابط»

The existing image route, for Instagram and anyone who wants the full 1080x1920
picture. The same tap now also writes the clean link (`/c/<slug>`, no `q`) to
the clipboard before the share sheet opens, and says so: in the story, add the
«رابط» sticker and paste. That makes an Instagram story clickable in one paste,
and a Facebook one wherever the sticker exists (§1.3).

The clipboard write is started before `navigator.share` and not awaited, so the
share keeps the tap's user activation on browsers that are strict about it.

### §2.3 The story cards

`scripts/generate-story-og-images.py` draws the seven previews at 1200x630 in
the app's palette, read from `app/globals.css`, with Pillow and libraqm, which
shape and order Arabic correctly (week 6 §4.3 is why this is not next/og). The
questions are read from `PROMPTS`, and a `manifest.json` records what was
drawn, so a question edited in the component without re-running the script is
a red test, not a stale picture in someone's story.

### §2.4 The picture stops talking to the poster

The line printed at the foot of the 1080x1920 card, «حط رابطك بستيكر الرابط
بالستوري ليقدروا يجاوبوك مباشرة», is an instruction to the person posting,
shown to everyone who views it. It becomes a line for the viewer: «افتح الرابط
وصارحني بالسر». The instruction moves to the hint beside the button, where the
poster reads it.

### §2.5 Share targets

`src/share-targets.ts` gains a third kind, `story`: a tile with a real URL
that opens a platform's own share page where Story is a destination. Facebook
is the only one. The `sheet` tile that was Facebook's becomes Instagram's,
still with no URL (§1.1 holds for Instagram too, and it has no share page).
`NO_WEB_STORY_ROUTE` loses `facebook-story`. Link tiles still may not be
labelled as stories (test/65), because a feed or message link does not become
one.

---

## §3 Out of scope

The client island's membership (StoryCard and ShareRow already belong to it),
any new dependency, any server route or storage for user images, the Facebook
App ID, the native Stories API, and `public/og/default.png` itself.

## §4 Tripwire

`test/67-clickable-story.test.ts`:

1. The Facebook story target is kind `story`, builds
   `https://m.facebook.com/sharer.php?u=<encoded>` and renders first.
2. `storyCardVariant` accepts exactly `STORY_CARD_VARIANTS` and rejects
   anything else, including `q6`, `../r` and the empty string.
3. `personalisedShareMetadata` with a variant serves `/og/story/<v>.png` and
   puts `?q=<v>` in og:url; without one it is unchanged.
4. Every variant has a 1200x630 PNG, and `manifest.json` matches `PROMPTS` in
   StoryCard.tsx plus the reaction line.
5. `/c/[slug]`'s generateMetadata passes `q` through `storyCardVariant`.
6. StoryCard hands ShareRow a `storyUrl` carrying `?q=`, and starts the
   clipboard write before `navigator.share`.
7. The card no longer prints the poster's instruction.

## §5 To verify on a phone, signed in to Facebook

1. Open the story sheet, tap «ستوري فيسبوك بالرابط»: Facebook's page opens
   with a «قصتك» / Your story destination. If the phone hands the link to the
   Facebook app instead, the app's composer should offer Story.
2. Post it: the story shows the question card, and tapping it opens
   `/c/<slug>`.
3. First share of a new variant: if the card shows the old slate image,
   Facebook had cached the URL; <https://developers.facebook.com/tools/debug/>
   re-scrapes it.
