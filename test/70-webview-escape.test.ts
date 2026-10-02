// test/70-webview-escape.test.ts
//
// Google refuses OAuth from any embedded WebView or WKWebView, whatever app
// hosts it, so isInAppBrowser has to read the engine and not only a list of
// app names. This file proves the acceptance list in
// docs/SPEC-week20-webview-escape.md section 4, items 2 to 10 (item 1 is
// test/65 running unchanged). It covers both sides: generic Android WebViews
// (`; wv)`) and iOS WKWebViews (iPhone/iPad, AppleWebKit, no `Safari/`) are
// caught, and real browsers, desktop Mac WebKit and look-alike strings are
// left alone. Each test name starts with the spec item it proves.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isInAppBrowser, detectPlatform, escapeUrl } from '../src/inapp.js'

// Item 2: an app WebView on Android with no named marker. Same shape as the
// example in spec section 0.3.
const ANDROID_GENERIC_WV =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36'

// Item 3
const LINKEDIN_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.6312.118 Mobile Safari/537.36 [LinkedInApp]/4.1.921'

// Item 4
const LINKEDIN_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.6930'

// Item 5: bare WKWebView, nothing after Mobile/15E148.
const IPHONE_BARE_WKWEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const IPAD_BARE_WKWEBVIEW =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

// Item 6: every browser the spec lists. None of these may be told to open a
// browser.
const REAL_BROWSERS: Record<string, string> = {
  'chrome android':
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'samsung internet':
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  'firefox android': 'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
  'safari ios':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'chrome ios (CriOS)':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1',
  'firefox ios (FxiOS)':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15',
  'edge ios (EdgiOS)':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/124.0.2478.50 Mobile/15E148 Safari/605.1.15',
  'duckduckgo ios':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15',
  'google app ios (GSA)':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/311.0.622508452 Mobile/15E148 Safari/604.1',
  'safari ipad desktop mode':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'chrome desktop':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'safari desktop':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'firefox desktop': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
}

// Item 7: a Mac app's WKWebView. Looks like iPad desktop-mode WKWebView, and
// the spec chose to leave both alone rather than risk a false positive.
const MAC_WKWEBVIEW =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'

// Item 8: Android Chrome with the letters wv in the model or build, but never
// as the `; wv)` token.
const WV_LOOKALIKES: Record<string, string> = {
  'build QWV1.210':
    'Mozilla/5.0 (Linux; Android 10; Pixel 4 Build/QWV1.210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'model Xwv5':
    'Mozilla/5.0 (Linux; Android 13; Xwv5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'model starting wv, build ending wv':
    'Mozilla/5.0 (Linux; Android 12; wv20 Build/SP1A.210812.016wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.99 Mobile Safari/537.36',
}

// Item 9: the word Safari shows up, but never as `Safari/`.
const IPHONE_WKWEBVIEW_SAFARI_NO_SLASH =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MySafari 3'

const SHARE_URL = 'https://masaraha.provefair.app/?next=/c/abc'

test('item 2: a generic Android WebView with no named marker is in-app', () => {
  assert.ok(ANDROID_GENERIC_WV.includes('; wv)'))
  assert.equal(isInAppBrowser(ANDROID_GENERIC_WV), true)
})

test('item 3: LinkedIn on Android is in-app', () => {
  assert.equal(isInAppBrowser(LINKEDIN_ANDROID), true)
})

test('item 4: LinkedIn on iOS, with no Safari/ token, is in-app', () => {
  assert.ok(!LINKEDIN_IOS.includes('Safari/'))
  assert.equal(isInAppBrowser(LINKEDIN_IOS), true)
})

test('item 5: a bare iPhone WKWebView is in-app', () => {
  assert.equal(isInAppBrowser(IPHONE_BARE_WKWEBVIEW), true)
})

test('item 5: a bare iPad WKWebView is in-app', () => {
  assert.equal(isInAppBrowser(IPAD_BARE_WKWEBVIEW), true)
})

test('item 6: real browsers on Android, iOS and desktop are not in-app', () => {
  for (const [name, ua] of Object.entries(REAL_BROWSERS)) {
    assert.equal(isInAppBrowser(ua), false, `${name} must not be treated as an in-app browser`)
  }
  assert.equal(isInAppBrowser(''), false, 'the empty string must not be treated as an in-app browser')
})

test('item 7: a desktop Mac WKWebView (AppleWebKit, no Safari/) is not in-app', () => {
  assert.ok(!MAC_WKWEBVIEW.includes('Safari/'))
  assert.equal(isInAppBrowser(MAC_WKWEBVIEW), false)
})

test('item 8: wv in a model or build string is not the WebView token', () => {
  for (const [name, ua] of Object.entries(WV_LOOKALIKES)) {
    assert.ok(/wv/i.test(ua) && !ua.includes('; wv)'), `fixture ${name} is not the shape item 8 asks for`)
    assert.equal(isInAppBrowser(ua), false, `${name} must not be treated as an in-app browser`)
  }
})

test('item 9: Safari without a slash does not make a WKWebView a browser', () => {
  assert.ok(IPHONE_WKWEBVIEW_SAFARI_NO_SLASH.includes('Safari'))
  assert.ok(!IPHONE_WKWEBVIEW_SAFARI_NO_SLASH.includes('Safari/'))
  assert.equal(isInAppBrowser(IPHONE_WKWEBVIEW_SAFARI_NO_SLASH), true)
})

test('item 10: the generic Android WebView gets the intent:// escape', () => {
  const platform = detectPlatform(ANDROID_GENERIC_WV)
  assert.equal(platform, 'android')
  const out = escapeUrl(SHARE_URL, platform)
  assert.ok(out?.startsWith('intent://masaraha.provefair.app/'), `got ${out}`)
})

test('item 10: the bare iPhone WKWebView gets the x-safari-https escape', () => {
  const platform = detectPlatform(IPHONE_BARE_WKWEBVIEW)
  assert.equal(platform, 'ios')
  assert.equal(escapeUrl(SHARE_URL, platform), 'x-safari-https://masaraha.provefair.app/?next=/c/abc')
})
