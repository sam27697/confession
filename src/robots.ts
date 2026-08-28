// src/robots.ts
//
// Pure body-builder for /robots.txt (spec §3). Framework-free — no `env`
// import here, so the origin comparison is testable with plain strings via
// plain node:test, same discipline as src/session.ts. The route handler
// (app/robots.txt/route.ts) is the only place that reads env.appOrigin and
// hands it to this function.

const PRODUCTION_ORIGIN = 'https://confession.fayad.app'

// Week-6 share-card spec §5.1: week 5's single `User-agent: *` block
// disallowed `/c/` for every crawler, including facebookexternalhit — the
// crawler that builds the Facebook link-preview card, which is the entire
// distribution channel for this product (see BRIEF.md item 19). Per Meta's
// own docs (developers.facebook.com/docs/sharing/webmasters/web-crawlers,
// read 2026-08-28), a disallow blocks facebookexternalhit; the only named
// exception is its own security/integrity checks, not building a preview.
// So three groups, in this order:
//   1. facebookexternalhit gets `/c/` and the site root, nothing private.
//   2. meta-externalagent (Meta's separate AI-training crawler) is
//      disallowed everywhere, by name, so it does not inherit group 1.
//   3. `*` is unchanged from week 5 — Google still does not index `/c/`.
const PRODUCTION_BODY = [
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
  '',
].join('\n')

// Closed by default (spec §3): every origin that is not exactly the
// production origin — staging, localhost, a future host nobody has
// anticipated yet — gets the fully-disallowed body. The match is exact
// string equality, not a prefix or substring check, so a lookalike origin
// cannot pass as production.
const CLOSED_BODY = ['User-agent: *', 'Disallow: /', ''].join('\n')

export function robotsBody(appOrigin: string): string {
  return appOrigin === PRODUCTION_ORIGIN ? PRODUCTION_BODY : CLOSED_BODY
}
