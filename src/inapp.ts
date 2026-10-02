// src/inapp.ts
//
// Detecting the in-app browsers that CANNOT complete a Google sign-in, and
// building the escape hatch out of them.
//
// This is not a nicety. Google refuses OAuth inside embedded webviews and
// answers `403 disallowed_useragent`. مصارحة is distributed by a link in a
// story, so the overwhelmingly common first contact is: tap the link inside
// Instagram or Facebook, land in that app's embedded browser, press "sign in
// with Google", and hit a Google error page. Without this module the app's
// main growth path and its only login are mutually exclusive.
//
// Pure string functions, no window, no navigator -- the component passes the
// user agent and the href in, so every branch below is testable.

// Matched on the markers each app appends to its webview's user agent.
// Facebook is FBAN/FBAV, Instagram is 'Instagram', and the rest are their
// own names. Deliberately NOT matched: Safari, Chrome, Firefox, Samsung
// Internet -- a real browser must never be told to open a real browser.
const IN_APP_MARKERS = [
  'FBAN',
  'FBAV',
  'FB_IAB',
  'Instagram',
  'Line/',
  'MicroMessenger', // WeChat
  'TikTok',
  'musical_ly', // TikTok's older marker
  'Snapchat',
  'Twitter',
  'Pinterest',
  'KAKAOTALK',
] as const

// The names above only cover the apps someone thought of. Google refuses by
// engine, not by app name (week 20 spec §0.1), so the two engines are matched
// as well:
//
// Android WebView puts `wv` last in the platform group, `(...; wv)`. Chrome,
// Samsung Internet, Firefox and Custom Tabs never do.
//
// iOS WKWebView sends AppleWebKit with no `Safari/` token. Safari,
// SFSafariViewController (which Google allows) and every iOS browser built on
// it -- CriOS, FxiOS, EdgiOS, DuckDuckGo, the Google app -- all carry it.
// iPhone/iPad/iPod only: a Mac app's WKWebView looks the same as iPad desktop
// mode, and telling a desktop browser to open a browser is the worse mistake.
function isAndroidWebView(userAgent: string): boolean {
  return userAgent.includes('; wv)')
}

function isIosWebView(userAgent: string): boolean {
  return (
    detectPlatform(userAgent) === 'ios' &&
    userAgent.includes('AppleWebKit') &&
    !userAgent.includes('Safari/')
  )
}

export function isInAppBrowser(userAgent: string): boolean {
  if (!userAgent) return false
  return (
    IN_APP_MARKERS.some((m) => userAgent.includes(m)) ||
    isAndroidWebView(userAgent) ||
    isIosWebView(userAgent)
  )
}

export type MobilePlatform = 'android' | 'ios' | 'other'

export function detectPlatform(userAgent: string): MobilePlatform {
  if (/Android/i.test(userAgent)) return 'android'
  // iPadOS 13+ reports as Macintosh; the touch check that would separate the
  // two belongs to the component, which is why this stays conservative and
  // only claims iOS for the devices that say so.
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  return 'other'
}

// The way out, per platform.
//
// Android: an intent: URL naming Chrome explicitly. `S.browser_fallback_url`
// means a phone without Chrome lands back on the https URL rather than on an
// error.
//
// iOS: there is no public API to leave an embedded webview. `x-safari-https:`
// is an undocumented scheme that Safari registers and that has worked for
// years; if it silently does nothing, the component's written instruction is
// the real fallback, which is why escapeUrl can return null and callers must
// handle it.
export function escapeUrl(href: string, platform: MobilePlatform): string | null {
  let parsed: URL
  try {
    parsed = new URL(href)
  } catch {
    return null
  }
  // Only ever hand a browser an https URL of our own making.
  if (parsed.protocol !== 'https:') return null

  if (platform === 'android') {
    const withoutScheme = `${parsed.host}${parsed.pathname}${parsed.search}`
    const fallback = encodeURIComponent(parsed.toString())
    return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`
  }

  if (platform === 'ios') {
    return `x-safari-https://${parsed.host}${parsed.pathname}${parsed.search}`
  }

  return null
}
