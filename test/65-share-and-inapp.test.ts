// test/65-share-and-inapp.test.ts
//
// Two contracts that protect the growth path:
//
//  1. The in-app browsers that Google refuses OAuth from are recognised, and
//     real browsers are never mistaken for them. A false positive is worse
//     than a false negative here: it tells someone already in Chrome to open
//     Chrome.
//  2. Every share link is built by encoding, not concatenation, so an Arabic
//     caption or a slug with punctuation cannot break the URL.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isInAppBrowser, detectPlatform, escapeUrl } from '../src/inapp.js'
import { LINK_TARGETS, SHARE_TILES } from '../src/share-targets.js'

const IN_APP = {
  'instagram android':
    'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Instagram 302.0.0.23.109 Android',
  'facebook ios':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/441.0.0.30.105;FBBV/1234]',
  'facebook android': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 [FB_IAB/FB4A;FBAV/440.0.0.31.105;]',
  tiktok: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 musical_ly_2023 TikTok/31.5.4',
}

const REAL_BROWSERS = {
  'chrome android':
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
  'safari ios':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'firefox desktop': 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
}

test('the in-app browsers that break Google sign-in are recognised', () => {
  for (const [name, ua] of Object.entries(IN_APP)) {
    assert.equal(isInAppBrowser(ua), true, `${name} should be detected as an in-app browser`)
  }
})

test('real browsers are never told to open a browser', () => {
  for (const [name, ua] of Object.entries(REAL_BROWSERS)) {
    assert.equal(isInAppBrowser(ua), false, `${name} must not be treated as an in-app browser`)
  }
  assert.equal(isInAppBrowser(''), false)
})

test('platform detection picks the right escape hatch', () => {
  assert.equal(detectPlatform(IN_APP['instagram android']), 'android')
  assert.equal(detectPlatform(IN_APP['facebook ios']), 'ios')
  assert.equal(detectPlatform(REAL_BROWSERS['firefox desktop']), 'other')
})

test('the Android escape is an intent: URL with an https fallback', () => {
  const out = escapeUrl('https://masaraha.provefair.app/c/abc123', 'android')
  assert.ok(out?.startsWith('intent://masaraha.provefair.app/c/abc123#Intent;'))
  assert.match(out!, /package=com\.android\.chrome/)
  // Without the fallback a phone with no Chrome lands on an error instead of
  // on the page it was already looking at.
  assert.match(out!, /S\.browser_fallback_url=https%3A%2F%2Fmasaraha\.provefair\.app%2Fc%2Fabc123/)
})

test('the iOS escape is x-safari-https and keeps the path', () => {
  assert.equal(
    escapeUrl('https://masaraha.provefair.app/c/abc123', 'ios'),
    'x-safari-https://masaraha.provefair.app/c/abc123',
  )
})

test('escapeUrl refuses anything that is not our own https URL', () => {
  assert.equal(escapeUrl('http://masaraha.provefair.app/', 'android'), null)
  assert.equal(escapeUrl('javascript:alert(1)', 'android'), null)
  assert.equal(escapeUrl('not a url', 'ios'), null)
  assert.equal(escapeUrl('https://masaraha.provefair.app/', 'other'), null)
})

test('share links encode Arabic captions and the url instead of pasting them in', () => {
  const url = 'https://masaraha.provefair.app/c/abc 123'
  const text = 'احكيلي بصراحة & بالسر'
  for (const target of LINK_TARGETS) {
    const href = target.href({ url, text })
    assert.ok(href.startsWith('https://'), `${target.id} must be https`)
    // A raw space or a bare & in a query value is the bug this guards.
    assert.ok(!href.includes(' '), `${target.id} leaked a raw space`)
    assert.ok(!href.includes('& بالسر'), `${target.id} leaked a raw ampersand`)
    assert.ok(target.label.length > 0)
  }
})

test('no link target claims to post a story', () => {
  // Stories are unreachable from a web page on every one of these platforms;
  // the labels must not promise otherwise. The native share sheet is the
  // only route and it is a separate control.
  for (const target of LINK_TARGETS) {
    assert.ok(!/ستوري|story/i.test(target.label), `${target.id} must not be labelled as a story share`)
  }
})


test('the Facebook story tile comes before the Facebook post tile', () => {
  const ids = SHARE_TILES.map((t) => t.id)
  const story = ids.indexOf('facebook-story')
  const post = ids.indexOf('facebook')
  assert.ok(story >= 0 && post >= 0, 'both Facebook tiles must exist')
  // The story is how this app spreads; the post is the afterthought.
  assert.ok(story < post, 'story must render before post')
})

test('a sheet tile carries no URL, because no web route to a story exists', () => {
  for (const tile of SHARE_TILES) {
    if (tile.kind !== 'sheet') continue
    assert.ok(!('href' in tile), `${tile.id} must not pretend to have a web route`)
    // Facebook's own docs: sharing to Stories is Android Intents and iOS
    // custom URL schemes from a native app. A URL here would be a lie that
    // fails in the user's hand rather than in this suite.
  }
  assert.ok(SHARE_TILES.some((t) => t.kind === 'sheet'), 'the sheet route must be represented')
})

test('every link tile still builds a real https URL', () => {
  const linkIds = SHARE_TILES.filter((t) => t.kind === 'link').map((t) => t.id)
  assert.deepEqual(linkIds, LINK_TARGETS.map((t) => t.id))
})
