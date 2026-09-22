// src/share-targets.ts
//
// Where a story card can actually go, and — just as important — where it
// cannot.
//
// THE RULE THIS FILE EXISTS TO RECORD: no web page can post to an Instagram,
// TikTok, WhatsApp or Facebook **story**. Those platforms expose no web
// endpoint for it; the only route from a web page into a story is the
// operating system's own share sheet (navigator.share with a file), which
// the user then points at whichever app they like. Everything listed below
// as a link target opens a POST or a MESSAGE, never a story, and the labels
// say so rather than implying otherwise.
//
// So the card's primary action is the native share sheet, and these links
// are the secondary row for the platforms that do accept a link from the web.

// The glyph a tile draws. Deliberately generic shapes that describe the
// ACTION -- send, post, save a link -- and not any platform's mark. The
// platforms' logos are their trademarks to license; drawing a lookalike is
// the kind of thing that gets a takedown rather than a compliment. If
// official brand assets are ever added they slot in beside this, keyed by
// the same id.
export type ShareGlyph = 'bubble' | 'plane' | 'globe' | 'spark' | 'link' | 'image'

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

export const LINK_TARGETS: readonly ShareTarget[] = [
  {
    id: 'whatsapp',
    accent: '--citron-500',
    glyph: 'bubble',
    label: 'واتساب',
    // Opens a chat picker with the message prefilled. WhatsApp Status is not
    // reachable this way — that is the share sheet's job.
    href: ({ url, text }) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: 'telegram',
    accent: '--action-reveal',
    glyph: 'plane',
    label: 'تيليغرام',
    href: ({ url, text }) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'facebook',
    accent: '--citron-300',
    glyph: 'globe',
    label: 'فيسبوك (منشور)',
    href: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'x',
    accent: '--text-2',
    glyph: 'spark',
    label: 'إكس',
    href: ({ url, text }) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
] as const

// Named here so the omission is a decision on the record rather than a gap
// someone "fixes" with a broken button later.
export const NO_WEB_STORY_ROUTE = ['instagram', 'tiktok', 'whatsapp-status', 'facebook-story'] as const
