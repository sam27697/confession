import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { genericShareMetadata, personalisedShareMetadata, truncateDisplayName } from '../src/share-card.js'

// Written from docs/SPEC-week6-share-card.md, not from src/share-card.ts or
// app/c/[slug]/page.tsx. The implementation files were opened only to learn
// the exported function names and parameter shapes (task instructions);
// every expected string below is transcribed by hand from the spec.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const APP_ORIGIN = 'https://share-card-test-origin.example' // distinctive, not a real config value
const SLUG = 'test-slug-xyz'
const DISPLAY_NAME = 'سارة الاختبار'

// §3, transcribed verbatim from the spec document (not from the source file).
const SPEC_SITE_NAME = 'مصارحة'
const SPEC_LOCALE = 'ar_AR'
const SPEC_GENERIC_TITLE = 'مصارحة'
const SPEC_GENERIC_DESCRIPTION =
  'خلي الناس تصارحك بصراحة، وهي متخفية. وإذا حبيت تعرف مين، لازم تصارحهم بدورك.'
const SPEC_PERSONALISED_DESCRIPTION =
  'ابعتلو اللي بقلبك وهو ما بيعرف مين إنت. وإذا حب يعرف، لازم يصارحك بدوره.'
// The combining kasra on the ر is part of the spec text itself (§3's
// `og:title = صارِح {displayName}` line) — copied as-is, not normalised.
const SPEC_PERSONALISED_TITLE_PREFIX = 'صارِح'

// ---------------------------------------------------------------------------
// 1. generic metadata contains every §3 tag, exact values
// ---------------------------------------------------------------------------

test('§6.1 the generic metadata object contains every §3 tag with the exact values', () => {
  const meta = genericShareMetadata({ appOrigin: APP_ORIGIN, facebookAppId: null })

  assert.equal(meta.openGraph.type, 'website')
  assert.equal(meta.openGraph.siteName, SPEC_SITE_NAME)
  assert.equal(meta.openGraph.locale, SPEC_LOCALE)
  assert.equal(meta.twitter.card, 'summary_large_image')

  assert.equal(meta.openGraph.title, SPEC_GENERIC_TITLE)
  assert.equal(meta.openGraph.description, SPEC_GENERIC_DESCRIPTION)
  assert.equal(meta.openGraph.url, `${APP_ORIGIN}/`)
  assert.equal(meta.openGraph.images.length, 1)
  const image = meta.openGraph.images[0]
  assert.equal(image.url, `${APP_ORIGIN}/og/default.png`)
  assert.equal(image.width, 1200)
  assert.equal(image.height, 630)
  assert.equal(image.alt, SPEC_GENERIC_TITLE)
})

// §3: "metadataBase = new URL(env.appOrigin)" is set once, in the root
// layout, not inside the pure share-card builders under test here (their
// urls are already absolute strings). This is a source-level check that the
// root layout does the thing the spec requires — not a behavioural proof,
// since it does not boot Next or render anything.
test('§6.1 (source-level) app/layout.tsx sets metadataBase from env.appOrigin', () => {
  const layoutSrc = readFileSync(path.join(REPO_ROOT, 'app/layout.tsx'), 'utf8')
  assert.match(
    layoutSrc,
    /metadataBase:\s*new URL\(env\.appOrigin\)/,
    'root layout must set metadataBase = new URL(env.appOrigin) per §3',
  )
})

// ---------------------------------------------------------------------------
// 2. personalised metadata for an enabled link
// ---------------------------------------------------------------------------

// NOTE on a contradiction in the spec document itself: §6 item 2, as
// literally worded, says the personalised card contains the display name
// "in og:title and og:image:alt". But §4.3 (a later, dated, appended
// correction — the document's own mechanism for superseding earlier text
// without editing it) is explicit and detailed: satori/next-og cannot lay
// out the name with correct bidi order, so the per-link image route is NOT
// shipped, and "`/c/<slug>`'s og:image and og:image:alt point at the same
// <appOrigin>/og/default.png and مصارحة as the generic/root card ... not a
// personalised image, for every link, enabled or not." §4.3 is unambiguous
// and postdates §6's item 2, so this test asserts §4.3's corrected
// behaviour (title personalised, image/alt generic) rather than the stale
// literal wording of item 2. Flagged in the report; not silently resolved.
test('§6.2 (as corrected by §4.3) personalised metadata for an enabled link', () => {
  const meta = personalisedShareMetadata({
    appOrigin: APP_ORIGIN,
    facebookAppId: null,
    slug: SLUG,
    ownerDisplayName: DISPLAY_NAME,
  })

  assert.ok(
    meta.openGraph.title.includes(DISPLAY_NAME),
    'og:title must contain the owner display name (§3)',
  )
  assert.ok(meta.openGraph.title.startsWith(SPEC_PERSONALISED_TITLE_PREFIX))
  assert.equal(meta.openGraph.description, SPEC_PERSONALISED_DESCRIPTION)
  assert.ok(
    meta.openGraph.url.endsWith(`/c/${SLUG}`),
    'og:url must end with /c/<slug> (§6 item 2)',
  )

  // §4.3 correction: image and alt are the SAME generic ones as the root
  // card — not personalised, for every link, enabled or not.
  const image = meta.openGraph.images[0]
  assert.equal(image.url, `${APP_ORIGIN}/og/default.png`)
  assert.equal(image.alt, SPEC_GENERIC_TITLE)
  assert.ok(
    !image.alt.includes(DISPLAY_NAME),
    '§4.3: og:image:alt must NOT contain the display name — it falls back to the generic alt',
  )
})

// ---------------------------------------------------------------------------
// 3. og:url and image url are absolute, begin with appOrigin
// ---------------------------------------------------------------------------

test('§6.3 og:url and the image url are absolute and begin with the configured appOrigin', () => {
  const generic = genericShareMetadata({ appOrigin: APP_ORIGIN, facebookAppId: null })
  assert.ok(generic.openGraph.url.startsWith(APP_ORIGIN))
  assert.ok(generic.openGraph.images[0]!.url.startsWith(APP_ORIGIN))

  const personalised = personalisedShareMetadata({
    appOrigin: APP_ORIGIN,
    facebookAppId: null,
    slug: SLUG,
    ownerDisplayName: DISPLAY_NAME,
  })
  assert.ok(personalised.openGraph.url.startsWith(APP_ORIGIN))
  assert.ok(personalised.openGraph.images[0]!.url.startsWith(APP_ORIGIN))

  // A relative og:image must fail this test: sanity-check the assertion
  // itself catches a relative URL.
  assert.ok(!'/og/default.png'.startsWith(APP_ORIGIN))
})

// ---------------------------------------------------------------------------
// 4. disabled link === non-existent slug, byte-identical, no display name
// ---------------------------------------------------------------------------

test('§6.4 a disabled link and a non-existent slug both resolve to the same generic metadata, with no display name', () => {
  // Neither "disabled" nor "non-existent" ever reaches genericShareMetadata
  // with a slug or a display name at all — §1/§2.6 are satisfied by
  // construction: the generic builder's signature has no slug parameter and
  // no display-name parameter, so there is nothing that could vary between
  // the two cases. Both call sites (a disabled link, a missing slug) can
  // only ever produce this one call shape.
  const forDisabledLink = genericShareMetadata({ appOrigin: APP_ORIGIN, facebookAppId: null })
  const forMissingSlug = genericShareMetadata({ appOrigin: APP_ORIGIN, facebookAppId: null })

  assert.deepEqual(forDisabledLink, forMissingSlug)
  assert.equal(JSON.stringify(forDisabledLink), JSON.stringify(forMissingSlug))

  const serialised = JSON.stringify(forDisabledLink)
  assert.ok(!serialised.includes(DISPLAY_NAME))
  assert.ok(!serialised.includes(SLUG))
})

// Source-level, not behavioural: asserts the actual branch in
// app/c/[slug]/page.tsx that makes the disabled-vs-missing case
// byte-identical exists as written. This does NOT boot Next or prove the
// HTTP response; it proves the guard is present in source.
test('§6.4 (source-level) app/c/[slug]/page.tsx returns {} for both a disabled link and a missing link', () => {
  const pageSrc = readFileSync(path.join(REPO_ROOT, 'app/c/[slug]/page.tsx'), 'utf8')
  assert.match(
    pageSrc,
    /if\s*\(\s*!link\s*\|\|\s*!link\.enabled\s*\)\s*return\s*\{\}/,
    'generateMetadata must return {} for both !link and link.enabled === false, letting the root layout generic card apply',
  )
})

// ---------------------------------------------------------------------------
// 5 & 6. no account/link/offer id, no timestamp — absent from the JSON
// string, not merely from a key
// ---------------------------------------------------------------------------

// A fixture shaped like what a real caller has on hand (cf.
// app/c/[slug]/page.tsx's `link` row from getLinkBySlug), with known,
// distinctive uuid-like and timestamp values that a naive implementation
// might be tempted to interpolate. Only the two fields §2.1 permits (slug,
// ownerDisplayName) are ever passed to the builder.
const FIXTURE_LINK = {
  id: 'aaaaaaaa-1111-4444-8888-000000000001',
  ownerAccountId: 'bbbbbbbb-2222-4444-8888-000000000002',
  offerId: 'cccccccc-3333-4444-8888-000000000003',
  createdAt: '2024-03-14T09:26:53.000Z',
  updatedAt: '2025-11-02T18:04:12.123Z',
  slug: SLUG,
  ownerDisplayName: DISPLAY_NAME,
}

test('§6.5 no account id, link id or offer id appears anywhere in the serialised personalised metadata', () => {
  const meta = personalisedShareMetadata({
    appOrigin: APP_ORIGIN,
    facebookAppId: null,
    slug: FIXTURE_LINK.slug,
    ownerDisplayName: FIXTURE_LINK.ownerDisplayName,
  })
  const serialised = JSON.stringify(meta)

  assert.ok(!serialised.includes(FIXTURE_LINK.id), 'link id must not appear')
  assert.ok(!serialised.includes(FIXTURE_LINK.ownerAccountId), 'account id must not appear')
  assert.ok(!serialised.includes(FIXTURE_LINK.offerId), 'offer id must not appear')

  // Broader sweep: no uuid-shaped substring at all should appear, not just
  // the three specific fixture ids.
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  assert.ok(!uuidPattern.test(serialised), `no uuid-shaped string should appear in the card: ${serialised}`)
})

test('§6.6 no timestamp field appears in the serialised personalised or generic metadata', () => {
  const personalised = personalisedShareMetadata({
    appOrigin: APP_ORIGIN,
    facebookAppId: null,
    slug: FIXTURE_LINK.slug,
    ownerDisplayName: FIXTURE_LINK.ownerDisplayName,
  })
  const generic = genericShareMetadata({ appOrigin: APP_ORIGIN, facebookAppId: null })

  for (const meta of [personalised, generic]) {
    const serialised = JSON.stringify(meta)
    assert.ok(!serialised.includes(FIXTURE_LINK.createdAt))
    assert.ok(!serialised.includes(FIXTURE_LINK.updatedAt))
    // Broader sweep: no ISO-8601-shaped date/time substring at all.
    const isoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
    assert.ok(!isoPattern.test(serialised), `no ISO timestamp should appear in the card: ${serialised}`)
  }
})

// ---------------------------------------------------------------------------
// 7. escaping-relevant characters carried as data; truncation at 40
// ---------------------------------------------------------------------------

// This module returns plain JS strings inside a plain object. It is React's
// metadata renderer that turns `content=""` attribute strings into safe
// HTML at render time (§3.1: "React's metadata rendering escapes it"). This
// test proves the two things provable at THIS layer: the dangerous
// characters are carried through as data, unmangled and unstripped (so
// there is something for React to escape), and this module does not do its
// own unsafe string concatenation into an HTML/attribute string. It does
// NOT and CANNOT prove that `"` cannot break out of a rendered attribute —
// that would require rendering the page, which is out of reach here.
test('§6.7 a display name containing " and <script> is carried through as data, unmangled', () => {
  const dangerousName = '"><script>alert(1)</script>'
  const meta = personalisedShareMetadata({
    appOrigin: APP_ORIGIN,
    facebookAppId: null,
    slug: SLUG,
    ownerDisplayName: dangerousName,
  })

  assert.ok(
    meta.openGraph.title.includes(dangerousName),
    'the dangerous name must be carried through as data, not stripped or mangled by this module',
  )
  // This module must not itself produce an HTML/attribute string with the
  // name spliced in unescaped — it returns a plain object field, never a
  // pre-built <meta ...> string.
  assert.equal(typeof meta.openGraph.title, 'string')
  assert.ok(!meta.openGraph.title.includes('<meta'), 'this module must never build raw HTML itself')
})

test('§6.7 a display name over 40 characters is truncated with an ellipsis', () => {
  const exactly40 = 'ا'.repeat(40)
  assert.equal(truncateDisplayName(exactly40), exactly40, 'a name of exactly 40 characters is not truncated')

  const over40 = 'ا'.repeat(41)
  const truncated = truncateDisplayName(over40)
  assert.ok(truncated.length <= 40, 'truncated name must fit within 40 characters (§3.1)')
  assert.ok(truncated.endsWith('…'), 'truncated name must end with an ellipsis (§3.1)')
  const withoutEllipsis = truncated.slice(0, -1)
  assert.equal(
    withoutEllipsis,
    over40.slice(0, withoutEllipsis.length),
    'the truncated prefix must be a literal prefix of the original name, not reordered or mangled',
  )

  // The title built from an over-length name must carry the truncated form,
  // not the full 41-character name.
  const meta = personalisedShareMetadata({
    appOrigin: APP_ORIGIN,
    facebookAppId: null,
    slug: SLUG,
    ownerDisplayName: over40,
  })
  assert.ok(!meta.openGraph.title.includes(over40), 'og:title must not contain the untruncated over-length name')
})

// ---------------------------------------------------------------------------
// 8. fb:app_id present/absent
// ---------------------------------------------------------------------------

test('§6.8 fb:app_id is absent when facebookAppId is null', () => {
  const meta = genericShareMetadata({ appOrigin: APP_ORIGIN, facebookAppId: null })
  assert.equal(meta.facebook, undefined)
  assert.ok(!JSON.stringify(meta).includes('facebook'), 'no facebook/fb:app_id key at all when unset')
})

test('§6.8 fb:app_id is present and correct when facebookAppId is set', () => {
  const appId = '1234567890123456'
  const meta = genericShareMetadata({ appOrigin: APP_ORIGIN, facebookAppId: appId })
  assert.equal(meta.facebook?.appId, appId)

  const personalised = personalisedShareMetadata({
    appOrigin: APP_ORIGIN,
    facebookAppId: appId,
    slug: SLUG,
    ownerDisplayName: DISPLAY_NAME,
  })
  assert.equal(personalised.facebook?.appId, appId)
})

// ---------------------------------------------------------------------------
// 9. header-read tripwire, extended to app/ and src/
// ---------------------------------------------------------------------------

// Search of the whole test/ directory (grep for "headers()", "user-agent",
// "tripwire", etc.) found NO existing grep-based header-read tripwire test
// to extend — despite §2.4's text ("the tripwire is the same one") implying
// one already existed from an earlier week. None of test/01 through
// test/13 greps app/ or src/ for header reads. This is therefore a NEW
// test, not an extension of an existing one; that discrepancy is reported
// verbatim in the final report rather than silently written around.
//
// It reproduces, by hand from §2.4's own wording, the exact two allowances
// §2.4 names: "the privacy page's own copy and the literal `User-agent:` in
// the robots body". Verified directly against this checkout (not assumed):
// grepping app/ and src/ for header/IP/user-agent-adjacent terms currently
// returns exactly app/privacy/page.tsx's "IP address" prose line and
// src/robots.ts's literal "User-agent:" lines, and nothing else — no file
// anywhere imports the `headers` function from 'next/headers' (only
// `cookies`, which is unrelated to reading request headers).
function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const HEADER_READ_INDICATORS =
  /user-agent|x-forwarded|referer|referrer|remoteAddress|req\.ip|request\.ip|ip address|\bheaders\(\)|from 'next\/headers'.*\bheaders\b/i

test('§6.9 / §2.4 the header-read tripwire: app/ and src/ contain no request-header read beyond the two known allowed matches', () => {
  const files = [...listSourceFiles(path.join(REPO_ROOT, 'app')), ...listSourceFiles(path.join(REPO_ROOT, 'src'))]

  const matches: { file: string; line: number; text: string }[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (HEADER_READ_INDICATORS.test(lines[i]!)) {
        matches.push({ file: path.relative(REPO_ROOT, file), line: i + 1, text: lines[i]!.trim() })
      }
    }
  }

  const unexpected = matches.filter((m) => {
    const isPrivacyPageCopy = m.file === 'app/privacy/page.tsx' && /ip address/i.test(m.text)
    const isRobotsLiteral = m.file === 'src/robots.ts' && /User-agent:/.test(m.text)
    return !isPrivacyPageCopy && !isRobotsLiteral
  })

  assert.deepEqual(
    unexpected,
    [],
    `found a request-header-shaped read outside the two allowed matches: ${JSON.stringify(unexpected, null, 2)}`,
  )

  // The tripwire must actually be live, not vacuous — assert it does find
  // the two known, allowed matches, so an empty match set doesn't silently
  // pass this test for the wrong reason.
  assert.ok(matches.some((m) => m.file === 'app/privacy/page.tsx'))
  assert.ok(matches.some((m) => m.file === 'src/robots.ts'))

  // No file imports the actual request-header-reading function from
  // next/headers (only `cookies`, which reads/writes the session cookie,
  // not request headers).
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    assert.ok(
      !/import\s*\{\s*[^}]*\bheaders\b[^}]*\}\s*from\s*'next\/headers'/.test(content),
      `${path.relative(REPO_ROOT, file)} imports the headers() function from next/headers`,
    )
  }
})

// The per-link image route is explicitly NOT shipped (§4.3 correction), and
// its non-existence is itself part of what makes §2.4/§2.5 hold for it —
// there is no request-header or logging concern in a route that does not
// exist. Verified directly rather than assumed.
test('§6.9 (source-level) app/c/[slug]/opengraph-image.tsx does not exist, per §4.3\'s stated fallback', () => {
  const imageRoutePath = path.join(REPO_ROOT, 'app/c/[slug]/opengraph-image.tsx')
  assert.throws(() => statSync(imageRoutePath), 'the per-link image route must not exist (§4.3)')
})

// ---------------------------------------------------------------------------
// 10. robots.txt — exact production three-group body, staging fully closed
// ---------------------------------------------------------------------------

test('§6.10 / §5.1 the production robots body is the exact three groups, in order', async () => {
  const { robotsBody } = await import('../src/robots.js')
  const PRODUCTION_ORIGIN = 'https://confession.fayad.app'

  // Transcribed from spec §5.1's fenced code block, verbatim, not from
  // src/robots.ts.
  const expected = [
    'User-agent: facebookexternalhit',
    'Allow: /',
    'Disallow: /inbox',
    'Disallow: /sent',
    'Disallow: /offer/',
    'Disallow: /onboarding',
    'Disallow: /auth/',
    '',
    'User-agent: meta-externalagent',
    'Disallow: /',
    '',
    'User-agent: *',
    'Disallow: /c/',
    'Disallow: /inbox',
    'Disallow: /sent',
    'Disallow: /offer/',
    'Disallow: /onboarding',
    'Disallow: /auth/',
  ].join('\n')

  const body = robotsBody(PRODUCTION_ORIGIN).replace(/\n+$/, '')
  assert.equal(body, expected)
})

test('§6.10 / §5.1 staging is still fully closed: User-agent: * / Disallow: /', async () => {
  const { robotsBody } = await import('../src/robots.js')
  const STAGING_ORIGIN = 'https://stg.confession.fayad.app'
  const body = robotsBody(STAGING_ORIGIN)
  const lines = body.split('\n').map((l) => l.trimEnd())
  assert.equal(lines[0], 'User-agent: *')
  assert.ok(lines.includes('Disallow: /'))
  // Fully closed means nothing else is allowed through — staging never
  // becomes crawlable, for any agent, for any reason (§5.1).
  assert.ok(!lines.some((l) => l.startsWith('Allow:')))
})
