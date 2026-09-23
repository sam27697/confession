// test/67-clickable-story.test.ts
//
// docs/SPEC-week16-clickable-story.md §4: a Facebook story that opens the
// link. Facebook's Stories API has no link parameter, so the clickable story
// is the link itself shared through Facebook's own share page to "Your
// story", drawn from the page's Open Graph card. These checks keep the three
// pieces of that route joined: the share target, the per-question preview
// cards, and the metadata that picks one.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SHARE_TILES, FACEBOOK_STORY, NO_WEB_STORY_ROUTE } from '../src/share-targets.js'
import {
  STORY_CARD_VARIANTS,
  storyCardVariant,
  personalisedShareMetadata,
} from '../src/share-card.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STORY_DIR = path.join(REPO_ROOT, 'public', 'og', 'story')
const STORY_CARD_SRC = readFileSync(path.join(REPO_ROOT, 'app', '_components', 'StoryCard.tsx'), 'utf8')

function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file)
  assert.equal(buf.subarray(1, 4).toString('ascii'), 'PNG', `${file} must be a PNG`)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

// --- §4.1 the share target -------------------------------------------------

test('4.1: the Facebook story target opens Facebook\'s own share page with the link encoded', () => {
  assert.equal(FACEBOOK_STORY.kind, 'story')
  const url = 'https://masaraha.provefair.app/c/abc?q=q2'
  const href = FACEBOOK_STORY.href({ url, text: 'ignored' })
  assert.equal(href, `https://m.facebook.com/sharer.php?u=${encodeURIComponent(url)}`)
  assert.ok(!href.includes('?q=q2'), 'the story URL must be encoded, or its own ?q= would be read as the sharer\'s')
})

test('4.1: the Facebook story leads the panel, and Facebook left the no-route list', () => {
  assert.equal(SHARE_TILES[0]?.id, 'facebook-story')
  assert.ok(!(NO_WEB_STORY_ROUTE as readonly string[]).includes('facebook-story'))
  const shareRow = readFileSync(path.join(REPO_ROOT, 'app', '_components', 'ShareRow.tsx'), 'utf8')
  assert.match(shareRow, /t\.kind !== 'story'\) return null/, 'story tiles render as the lead buttons')
  assert.match(shareRow, /href=\{t\.href\(\{ url: storyUrl/, 'the lead button is given the story variant of the link')
  assert.match(shareRow, /t\.kind === 'story'\) return null/, 'and are not repeated in the grid')
})

// --- §4.2 the variant validator ------------------------------------------

test('4.2: storyCardVariant accepts exactly the drawn variants and nothing else', () => {
  for (const v of STORY_CARD_VARIANTS) assert.equal(storyCardVariant(v), v)
  for (const bad of ['', 'q6', 'Q1', 'q1 ', '../r', 'r.png', 'q-1', undefined, null, ['q1'], 1]) {
    assert.equal(storyCardVariant(bad), null, `${JSON.stringify(bad)} must be rejected`)
  }
})

// --- §4.3 the metadata ----------------------------------------------------

test('4.3: a story variant serves its card and names itself in og:url; no variant is unchanged', () => {
  const base = {
    appOrigin: 'https://masaraha.provefair.app',
    facebookAppId: null,
    slug: 'abc',
    ownerDisplayName: 'سامر',
  }
  const plain = personalisedShareMetadata(base)
  assert.equal(plain.openGraph.url, 'https://masaraha.provefair.app/c/abc')
  assert.equal(plain.openGraph.images[0]?.url, 'https://masaraha.provefair.app/og/default.png')

  const story = personalisedShareMetadata({ ...base, storyVariant: 'q3' })
  assert.equal(
    story.openGraph.url,
    'https://masaraha.provefair.app/c/abc?q=q3',
    'og:url is canonical for Facebook: without ?q= it would draw the default card',
  )
  assert.equal(story.openGraph.images[0]?.url, 'https://masaraha.provefair.app/og/story/q3.png')
  assert.equal(story.openGraph.title, plain.openGraph.title)
})

// --- §4.4 the cards ---------------------------------------------------------

test('4.4: every variant has a 1200x630 card on disk', () => {
  for (const v of STORY_CARD_VARIANTS) {
    const file = path.join(STORY_DIR, `${v}.png`)
    assert.ok(existsSync(file), `public/og/story/${v}.png is missing: run scripts/generate-story-og-images.py`)
    assert.deepEqual(pngSize(file), { width: 1200, height: 630 })
  }
})

test('4.4: the cards were drawn from the questions the story sheet offers today', () => {
  const match = STORY_CARD_SRC.match(/const\s+PROMPTS\s*=\s*\[([\s\S]*?)\]/)
  assert.ok(match, 'PROMPTS must be defined in StoryCard.tsx')
  const prompts = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])

  const manifest = JSON.parse(readFileSync(path.join(STORY_DIR, 'manifest.json'), 'utf8')) as {
    cards: Record<string, string>
  }
  assert.deepEqual(Object.keys(manifest.cards).sort(), [...STORY_CARD_VARIANTS].sort())
  prompts.forEach((p, i) => {
    assert.equal(
      manifest.cards[`q${i}`],
      p,
      `card q${i} shows a different question from PROMPTS[${i}]: re-run scripts/generate-story-og-images.py`,
    )
  })
  assert.equal(prompts.length, STORY_CARD_VARIANTS.filter((v) => v.startsWith('q')).length)
})

// --- §4.5 the page ---------------------------------------------------------------

test('4.5: /c/[slug] passes ?q= through storyCardVariant into its metadata', () => {
  const src = readFileSync(path.join(REPO_ROOT, 'app', 'c', '[slug]', 'page.tsx'), 'utf8')
  const meta = src.slice(src.indexOf('export async function generateMetadata'), src.indexOf('const ERROR_COPY'))
  assert.match(meta, /const \{ q \} = await searchParams/)
  assert.match(meta, /storyVariant: storyCardVariant\(q\)/)
})

// --- §4.6 the story card component ------------------------------------------------

test('4.6: StoryCard hands ShareRow the ?q= story link', () => {
  assert.match(STORY_CARD_SRC, /const storyUrl = `\$\{shareUrl\}\?q=\$\{reactionText \? 'r' : `q\$\{prompt\}`\}`/)
  assert.match(STORY_CARD_SRC, /storyUrl=\{storyUrl\}/)
})

test('4.6: the image route puts the link on the clipboard before the share sheet opens', () => {
  const start = STORY_CARD_SRC.indexOf('const handleShare = useCallback')
  const body = STORY_CARD_SRC.slice(start, STORY_CARD_SRC.indexOf('}, [slug, shareUrl', start))
  const copy = body.indexOf('navigator.clipboard?.writeText(shareUrl)')
  const share = body.indexOf('navigator.share(')
  assert.ok(copy > 0, 'the image route must copy the link for the sticker')
  assert.ok(copy < share, 'the copy must start before navigator.share')
  assert.doesNotMatch(body.slice(0, share), /await navigator\.clipboard/, 'and must not be awaited ahead of the share')
})

// --- §4.7 the picture talks to viewers ---------------------------------------------

test('4.7: the story picture no longer prints the poster\'s own instruction', () => {
  assert.ok(!STORY_CARD_SRC.includes('حط رابطك بستيكر الرابط بالستوري'))
  assert.ok(STORY_CARD_SRC.includes("'افتح الرابط وصارحني بالسر'"))
})
