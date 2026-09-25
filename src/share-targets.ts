// src/share-targets.ts
//
// Where a story card can actually go, and -- just as important -- where it
// cannot.
//
// THE RULE THIS FILE EXISTS TO RECORD, as corrected in week 16
// (docs/SPEC-week16-clickable-story.md §1): no platform offers an API that
// lets a web page, or even a native app, post a story that opens a link.
// Facebook's Stories API takes images, stickers and colours and nothing else.
// But Facebook's OWN share page (m.facebook.com/sharer.php) lets a signed-in
// person pick "Your story" as the destination, and a link shared that way
// becomes a story drawn from the page's Open Graph card that opens the link
// when tapped. That is the one web route to a clickable story, and it is a
// `story` target below. Instagram, TikTok and WhatsApp status have no such
// page; the only route into them is the phone's share sheet with the image
// (a `sheet` tile), made clickable by the person adding a link sticker.
//
// Everything listed as a plain `link` target opens a POST or a MESSAGE, never
// a story, and the labels say so rather than implying otherwise.

// The glyph a tile draws. Deliberately generic shapes that describe the
// ACTION -- send, post, save a link -- and not any platform's mark. The
// platforms' logos are their trademarks to license; drawing a lookalike is
// the kind of thing that gets a takedown rather than a compliment. If
// official brand assets are ever added they slot in beside this, keyed by
// the same id.
export type ShareGlyph = 'bubble' | 'plane' | 'feed' | 'story' | 'spark' | 'link' | 'image'

export type ShareTarget = {
  id: string
  glyph: ShareGlyph
  // The design token this tile's glow and glyph are tinted with. A token
  // NAME rather than a class, so the tile needs no per-destination CSS rule
  // -- adding a destination is one line here and nothing in the stylesheet.
  // The colours are this app's own palette on purpose: a tile tinted with
  // nobody's trade dress cannot be mistaken for an endorsement.
  accent: string
  // Shown to the user. Says what the tap actually does, because "شارك على
  // انستغرام" on a button that cannot do that is the kind of copy that gets
  // an app called broken.
  label: string
  href: (args: { url: string; text: string }) => string
}

// A tile that goes through the phone's own share sheet carrying the PNG,
// because the destination has NO web route: Instagram has no share page, and
// its Stories API is native-only (week 16 §1.1). From the sheet the person
// picks the app and then Story; the link rides along on the clipboard for the
// link sticker.
export type SheetTile = {
  kind: 'sheet'
  id: string
  glyph: ShareGlyph
  accent: string
  label: string
}

export type LinkTile = ShareTarget & { kind: 'link' }

// A platform's own share page where Story is one of the destinations the
// person picks. The URL it is given should be the story variant of the link
// (?q=), because the story is drawn from that page's Open Graph card.
export type StoryTile = ShareTarget & { kind: 'story' }

export type ShareTile = LinkTile | SheetTile | StoryTile

const WHATSAPP: LinkTile = {
  kind: 'link',
  id: 'whatsapp',
  accent: '--citron-500',
  glyph: 'bubble',
  label: 'واتساب',
  href: ({ url, text }) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
}

// Facebook's mobile share page, not its API: it needs no App ID, and for a
// signed-in person it offers News Feed and Your story. m. rather than www.,
// because the mobile page is the one that offers the story destination.
export const FACEBOOK_STORY: StoryTile = {
  kind: 'story',
  id: 'facebook-story',
  accent: '--citron-300',
  glyph: 'story',
  label: 'ستوري فيسبوك بالرابط',
  href: ({ url }) => `https://m.facebook.com/sharer.php?u=${encodeURIComponent(url)}`,
}

// Ordered as it renders. The Facebook story leads, deliberately: the story is
// what this app is shared through, and the post is the afterthought. The
// share panel draws `story` tiles as its lead buttons and the rest as the
// grid beneath them.
export const SHARE_TILES: readonly ShareTile[] = [
  FACEBOOK_STORY,
  WHATSAPP,
  {
    kind: 'link',
    id: 'telegram',
    accent: '--action-reveal',
    glyph: 'plane',
    label: 'تيليغرام',
    href: ({ url, text }) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    kind: 'sheet',
    id: 'instagram-story',
    accent: '--rose-300',
    glyph: 'story',
    label: 'ستوري انستغرام',
  },
  {
    kind: 'link',
    id: 'facebook',
    accent: '--citron-300',
    glyph: 'feed',
    label: 'فيسبوك (منشور)',
    href: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    kind: 'link',
    id: 'x',
    accent: '--text-2',
    glyph: 'spark',
    label: 'إكس',
    href: ({ url, text }) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
] as const

// Kept as the link-only view of the same list: the URL-building contract is
// tested against this, and a sheet tile has no URL to test.
export const LINK_TARGETS: readonly ShareTarget[] = SHARE_TILES.filter(
  (t): t is LinkTile => t.kind === 'link',
)

// Named here so the omission is a decision on the record rather than a gap
// someone "fixes" with a broken button later.
// Facebook's story left this list in week 16: its share page is a route.
export const NO_WEB_STORY_ROUTE = ['instagram', 'tiktok', 'whatsapp-status'] as const
