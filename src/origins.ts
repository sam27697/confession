// src/origins.ts
//
// Every origin this product has ever advertised, as data (spec
// docs/SPEC-week16-origin-contract.md section 1.1).
//
// Framework-free on purpose: no `env` import, no `next/*`, nothing that needs
// a request. The same discipline as src/robots.ts, and for the same reason:
// the verdict below has to be reachable from plain node:test with no network
// and no database.
//
// Why this file exists. On 2026-09-23 the app moved from confession.fayad.app
// to masaraha.provefair.app, and the commit that moved it promised the old
// host would keep answering a permanent redirect so that links already posted
// in people's stories would survive the move. Nineteen hours later both old
// names were NXDOMAIN and the whole suite was still green, because 468 tests
// knew nothing about what hostname this product is served on. A promise kept
// in a commit message is a promise that can never fail. This one is a table a
// script can probe.

export type LiveOrigin = {
  kind: 'live'
  origin: string
  role: 'production' | 'staging'
  since: string
  why: string
}

export type RetiredOrigin = {
  kind: 'retired'
  origin: string
  redirectsTo: string
  retired: string
  why: string
}

export type OriginEntry = LiveOrigin | RetiredOrigin

export const PRODUCTION_ORIGIN = 'https://masaraha.provefair.app'
export const STAGING_ORIGIN = 'https://stg.masaraha.provefair.app'

// The rule for this table runs one way: it gains rows and it never loses one.
// A retired origin that starts failing is a finding about the internet, not a
// row to delete, and test/67 pins all four strings so that removing one turns
// the suite red instead of quieting the check.
export const ORIGINS: readonly OriginEntry[] = Object.freeze([
  {
    kind: 'live',
    origin: PRODUCTION_ORIGIN,
    role: 'production',
    since: '2026-09-23',
    why: 'The app the public uses.',
  },
  {
    kind: 'live',
    origin: STAGING_ORIGIN,
    role: 'staging',
    since: '2026-09-23',
    why: 'Every deploy lands here first and is verified from outside before promotion.',
  },
  {
    kind: 'retired',
    origin: 'https://confession.fayad.app',
    redirectsTo: PRODUCTION_ORIGIN,
    retired: '2026-09-23',
    why: 'Story cards posted before the move have this host painted into the image by StoryCard.tsx. The person holding one cannot be told where the app went, so the host has to tell them.',
  },
  {
    kind: 'retired',
    origin: 'https://stg.confession.fayad.app',
    redirectsTo: STAGING_ORIGIN,
    retired: '2026-09-23',
    why: 'Retires to staging and not to production. A test link that quietly lands on the real site is how a seeded confession becomes a real one.',
  },
] as const)

// Path preserved means the path, and only the path. Query strings and
// fragments are deliberately out of scope: nothing this product shares carries
// one, and claiming to preserve something untested is the kind of sentence
// this slice exists to stop.
export function expectedRedirect(entry: RetiredOrigin, probePath: string): string {
  const path = probePath.startsWith('/') ? probePath : `/${probePath}`
  return `${entry.redirectsTo}${path}`
}

export type OriginProbe = {
  // false when the name resolves to neither an A nor an AAAA record. Kept
  // separate from an HTTP failure because it is a different repair by a
  // different person, and flattening the two is how the 2026-09-23 outage
  // stayed invisible for nineteen hours.
  dnsResolved: boolean
  // The path the probe was actually taken at (spec section 4.1). Without it,
  // a redirect to the successor's root cannot be told apart from a correct
  // redirect of a probe taken at the root.
  probePath?: string
  status?: number
  location?: string | null
}

export type OriginVerdict = {
  ok: boolean
  reason: string
}

export function judgeProbe(entry: OriginEntry, probe: OriginProbe): OriginVerdict {
  // DNS ranks ahead of everything else. An unresolvable name has no status,
  // and a status supplied alongside dnsResolved:false is evidence of nothing.
  if (!probe.dnsResolved) {
    return {
      ok: false,
      reason: `NXDOMAIN: ${entry.origin} resolves to no A and no AAAA record, so nothing after DNS was measured`,
    }
  }

  const status = probe.status

  if (entry.kind === 'live') {
    if (status === 200) {
      return { ok: true, reason: `200 at ${entry.origin}` }
    }
    return {
      ok: false,
      reason: `${entry.origin} answered ${describeStatus(status)}, expected 200`,
    }
  }

  const probePath = probe.probePath ?? '/'
  const wanted = expectedRedirect(entry, probePath)

  if (status === undefined) {
    return {
      ok: false,
      reason: `${entry.origin} answered ${describeStatus(status)}, expected 301 to ${wanted}`,
    }
  }

  if (status < 300 || status > 399) {
    return {
      ok: false,
      reason: `${entry.origin} answered ${status} and is not redirecting, expected 301 to ${wanted}`,
    }
  }

  // A 302 with a perfect location still fails. The commitment made when the
  // domain moved was "permanently", and a temporary redirect tells a browser
  // cache, a crawler and Facebook's own link store a different thing.
  if (status !== 301) {
    return {
      ok: false,
      reason: `${entry.origin} answered ${status}, expected 301: the move was permanent and a temporary redirect is a different promise`,
    }
  }

  const got = probe.location ?? ''
  if (got !== wanted) {
    return {
      ok: false,
      reason: `${entry.origin} redirected to ${got || '(no location header)'}, expected ${wanted}`,
    }
  }

  return { ok: true, reason: `301 ${entry.origin} to ${wanted}` }
}

function describeStatus(status: number | undefined): string {
  return status === undefined ? 'no HTTP response' : String(status)
}
