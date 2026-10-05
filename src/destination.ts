// src/destination.ts
//
// Where a login is allowed to send someone afterwards (spec
// docs/SPEC-week21-next-destination.md section 1).
//
// Framework-free on purpose, the same discipline as src/origins.ts: no `env`,
// no `next/*`, so the verdict is reachable from plain node:test.
//
// Why this file exists. The old guard was three string checks: starts with
// `/`, not `//`, no `:`. A browser reads `\` as `/` in an http(s) URL and
// drops tab, CR and LF before parsing, so `/\evil.example` and
// `/<TAB>/evil.example` both passed the guard and both resolve to
// https://evil.example/. Production stored them in after_login on
// 2026-10-05, and a returning user's OAuth callback hands that value to
// Next's redirect(), which writes it into Location unchanged. So the guard now
// asks the URL parser the same question the browser will ask, and checks the
// answer as well as the question.

export const DEFAULT_DESTINATION = '/inbox'

// Any origin that can never be ours works here; it only exists so the parser
// has something to resolve a relative path against. `.invalid` is reserved
// (RFC 2606), so no real redirect can ever match it.
const SENTINEL_ORIGIN = 'https://destination.invalid'

// Backslash, the C0 controls and DEL. Browsers strip or rewrite these before
// they parse a URL, which is how a path that looks local turns into a host.
const UNSAFE_CHARS = /[\\\u0000-\u001f\u007f]/

function isLocalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//')
}

// `unknown` because the value comes from a query string, a form field or a
// cookie, and the first rule is that it has to be a string at all.
export function sanitizeNextDestination(destination?: unknown): string {
  if (typeof destination !== 'string') return DEFAULT_DESTINATION
  if (!isLocalPath(destination)) return DEFAULT_DESTINATION
  if (destination.includes(':')) return DEFAULT_DESTINATION
  if (UNSAFE_CHARS.test(destination)) return DEFAULT_DESTINATION

  let parsed: URL
  try {
    parsed = new URL(destination, SENTINEL_ORIGIN)
  } catch {
    return DEFAULT_DESTINATION
  }
  // Unreachable while the rules above hold: a single leading `/` with no `\`,
  // `:` or control character cannot parse to another origin. It stays as the
  // second wall, and test/71 shows the two together are what hold (removing
  // both turns items 1 to 3 red; removing this one alone does not).
  if (parsed.origin !== SENTINEL_ORIGIN) return DEFAULT_DESTINATION

  // The parser percent-encodes anything outside ASCII, so this is always safe
  // to put in a Location header. It also resolves `.` and `..`, and
  // `/c/..//evil.example` comes out as `//evil.example`, so the result is
  // checked again rather than trusted (spec section 0.6).
  const result = parsed.pathname + parsed.search + parsed.hash
  if (!isLocalPath(result)) return DEFAULT_DESTINATION
  return result
}
