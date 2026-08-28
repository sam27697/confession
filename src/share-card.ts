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
export function personalisedShareMetadata({
  appOrigin,
  facebookAppId,
  slug,
  ownerDisplayName,
}: {
  appOrigin: string
  facebookAppId: string | null
  slug: string
  ownerDisplayName: string
}): ShareCardMetadata {
  const title = personalisedTitle(ownerDisplayName)
  return {
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: OG_LOCALE,
      title,
      description: PERSONALISED_OG_DESCRIPTION,
      url: `${appOrigin}/c/${slug}`,
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
