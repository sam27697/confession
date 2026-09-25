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
// host would keep answering a permanent redirect. Nineteen hours later both old
// names were NXDOMAIN and the whole suite was still green, because 468 tests
// knew nothing about what hostname this product is served on. A promise kept
// in a commit message is a promise that can never fail. This one is a table a
// script can probe.
//
// The promise itself was then withdrawn by the owner, 2026-09-24: he moved the
// domain so that his name would not appear in this app's URL (spec section 5).
// So a retired origin here must be absent from DNS altogether. A redirect from
// one of them would put his name back in front of the app, which is the thing
// the move was for.

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
  expects: 'absent'
  retired: string
  why: string
}

export type OriginEntry = LiveOrigin | RetiredOrigin

export const PRODUCTION_ORIGIN = 'https://masaraha.provefair.app'
export const STAGING_ORIGIN = 'https://stg.masaraha.provefair.app'

// The rule for this table runs one way: it gains rows and it never loses one.
// A retired origin that starts failing means the name came back, and that is
// a finding to explain, not a row to delete, and test/67 pins all four strings so that removing one turns
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
    expects: 'absent',
    retired: '2026-09-24',
    why: 'Retired by the owner so that his name does not appear in the app\'s URL. Story cards posted before 2026-09-23 carry this host and no longer open; that cost was accepted with the move.',
  },
  {
    kind: 'retired',
    origin: 'https://stg.confession.fayad.app',
    expects: 'absent',
    retired: '2026-09-24',
    why: 'Staging twin of the name above, retired with it for the same reason.',
  },
] as const)

export type OriginProbe = {
  // false when the name resolves to neither an A nor an AAAA record. Kept
  // separate from an HTTP failure because it is a different repair by a
  // different person, and flattening the two is how the 2026-09-23 outage
  // stayed invisible for nineteen hours.
  dnsResolved: boolean
  // The path the probe was taken at (spec section 4.1). Carried for the
  // printed line only since section 5: nothing is judged on it any more.
  probePath?: string
  status?: number
  location?: string | null
}

export type OriginVerdict = {
  ok: boolean
  reason: string
}

export function judgeProbe(entry: OriginEntry, probe: OriginProbe): OriginVerdict {
  // DNS ranks ahead of everything else, for both kinds. An unresolvable name
  // has no status, and a status supplied alongside dnsResolved:false is
  // evidence of nothing. What differs is the verdict: for a live origin it is
  // an outage, for a retired one it is the state the owner asked for.
  if (!probe.dnsResolved) {
    if (entry.kind === 'retired') {
      return {
        ok: true,
        reason: `NXDOMAIN: ${entry.origin} resolves to nothing, retired ${entry.retired} and absent as intended`,
      }
    }
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

  // The name resolves again. Whatever it answers, somebody changed the owner's
  // DNS, and a redirect to the new host is the likeliest shape of that change,
  // so it is named rather than reported as a bare 301.
  const answered =
    status !== undefined && status >= 300 && status <= 399 && probe.location
      ? `${status} to ${probe.location}`
      : describeStatus(status)
  return {
    ok: false,
    reason: `${entry.origin} resolves again and answered ${answered}; the owner retired it ${entry.retired} so his name would not appear in the app's URL, and it should not resolve at all`,
  }
}

function describeStatus(status: number | undefined): string {
  return status === undefined ? 'no HTTP response' : String(status)
}
