// src/robots.ts
//
// Pure body-builder for /robots.txt (spec §3). Framework-free — no `env`
// import here, so the origin comparison is testable with plain strings via
// plain node:test, same discipline as src/session.ts. The route handler
// (app/robots.txt/route.ts) is the only place that reads env.appOrigin and
// hands it to this function.

const PRODUCTION_ORIGIN = 'https://confession.fayad.app'

// The allow-list that was previously public/robots.txt, unchanged. It only
// ever ships for the exact production origin (spec §3).
const PRODUCTION_BODY = [
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
