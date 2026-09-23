// src/share-card.ts
//
// Pure builders for the Open Graph / Twitter card metadata (week-6 share
// card spec §3). No Next.js import here — same discipline as src/robots.ts
// and src/session.ts: plain functions over plain inputs, testable with
// node:test without booting Next or a database.
//
// Spec §2.1: the card may contain exactly two variable things — the link
// owner's display name and the slug (inside og:url and the image URL).
// Nothing else. These builders take only appOrigin, facebookAppId (a fixed
// config value, not per-request), slug and ownerDisplayName as inputs —
// there is no account id, link id, offer id, count or timestamp anywhere
// near this module, by construction.

const SITE_NAME = 'مصارحة'
const OG_LOCALE = 'ar_AR'

export const GENERIC_OG_TITLE = 'مصارحة'
export const GENERIC_OG_DESCRIPTION =
  'خلي الناس تصارحك بصراحة، وهي متخفية. وإذا حبيت تعرف مين، لازم تصارحهم بدورك.'
export const PERSONALISED_OG_DESCRIPTION =
  'ابعتلو اللي بقلبك وهو ما بيعرف مين إنت. وإذا حب يعرف، لازم يصارحك بدوره.'

// Spec §3.1: "Names are already capped at 80 characters at the database;
// the card truncates to 40 with an ellipsis so the title fits a card."
const DISPLAY_NAME_MAX = 40
const ELLIPSIS = '…'

export function truncateDisplayName(displayName: string): string {
  if (displayName.length <= DISPLAY_NAME_MAX) return displayName
  return displayName.slice(0, DISPLAY_NAME_MAX - ELLIPSIS.length) + ELLIPSIS
}

export function personalisedTitle(ownerDisplayName: string): string {
  return `صارِح ${truncateDisplayName(ownerDisplayName)}`
}

export type OpenGraphImage = {
  url: string
  alt: string
  width?: number
  height?: number
}

export type ShareCardOpenGraph = {
  type: 'website'
  siteName: string
  locale: string
  title: string
  description: string
  url: string
  images: OpenGraphImage[]
}

export type ShareCardMetadata = {
  openGraph: ShareCardOpenGraph
  twitter: { card: 'summary_large_image' }
  facebook?: { appId: string }
}

// Spec §3: the generic card — the product's own, no user in it. This is
// both the root layout's default and the fallback for a disabled or
// missing slug (§1, §2.6 — the two cases must be byte-identical).
export function genericShareMetadata({
  appOrigin,
  facebookAppId,
}: {
  appOrigin: string
  facebookAppId: string | null
}): ShareCardMetadata {
  return {
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: OG_LOCALE,
      title: GENERIC_OG_TITLE,
      description: GENERIC_OG_DESCRIPTION,
      url: `${appOrigin}/`,
      images: [
        {
          url: `${appOrigin}/og/default.png`,
          width: 1200,
          height: 630,
          alt: GENERIC_OG_TITLE,
        },
      ],
    },
    twitter: { card: 'summary_large_image' },
    ...(facebookAppId ? { facebook: { appId: facebookAppId } } : {}),
  }
}

// Spec §3 as corrected by §4.3: the personalised card for an enabled link.
// og:title and og:description carry the per-link personalisation — plain
// text, rendered by the browser/crawler, no shaping engine involved. The
// image does NOT — §4.3 records that the per-link ImageResponse route
// (app/c/[slug]/opengraph-image.tsx, spec §4.2) was measured to render
// Arabic with correct letter joining but broken bidi (word order), so it is
// not shipped. Per §4.2's own stated fallback, og:image and og:image:alt
// here are the same static generic image and alt as the root card (§4.1) —
// not a personalised image URL.
// Week 16 (docs/SPEC-week16-clickable-story.md §2.1). A Facebook story that
// opens the link is drawn from this page's Open Graph tags, so the og:image
// is the story. The story sheet offers six questions and a reaction card;
// each has a pre-drawn preview in public/og/story/, made by
// scripts/generate-story-og-images.py. The shared link names one with ?q=.
//
// The variant is an index into a fixed list, never text a person typed, so
// the card still carries only the two variable things §2.1 allows: nothing
// from a message is ever drawn into a public image.
export const STORY_CARD_VARIANTS = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'r'] as const
export type StoryCardVariant = (typeof STORY_CARD_VARIANTS)[number]

// Anything that is not exactly one of the variants is ignored, so the query
// string can never choose a path, and a stale or hand-edited ?q= falls back
// to the page's ordinary card.
export function storyCardVariant(q: unknown): StoryCardVariant | null {
  return typeof q === 'string' && (STORY_CARD_VARIANTS as readonly string[]).includes(q)
    ? (q as StoryCardVariant)
    : null
}

export function personalisedShareMetadata({
  appOrigin,
  facebookAppId,
  slug,
  ownerDisplayName,
  storyVariant = null,
}: {
  appOrigin: string
  facebookAppId: string | null
  slug: string
  ownerDisplayName: string
  storyVariant?: StoryCardVariant | null
}): ShareCardMetadata {
  const title = personalisedTitle(ownerDisplayName)
  // og:url is Facebook's canonical URL for a share: without the variant in
  // it, Facebook resolves the plain page and draws the default card instead
  // of the story card (spec week 16 §1.4).
  const pageUrl = storyVariant ? `${appOrigin}/c/${slug}?q=${storyVariant}` : `${appOrigin}/c/${slug}`
  const image = storyVariant
    ? { url: `${appOrigin}/og/story/${storyVariant}.png`, width: 1200, height: 630, alt: title }
    : { url: `${appOrigin}/og/default.png`, width: 1200, height: 630, alt: GENERIC_OG_TITLE }
  return {
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: OG_LOCALE,
      title,
      description: PERSONALISED_OG_DESCRIPTION,
      url: pageUrl,
      images: [image],
    },
    twitter: { card: 'summary_large_image' },
    ...(facebookAppId ? { facebook: { appId: facebookAppId } } : {}),
  }
}
