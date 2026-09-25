// test/67-origin-contract.test.ts
//
// docs/SPEC-week16-origin-contract.md §3: the origin table is the single
// place this product's advertised hostnames live, and it is the thing that
// stops finding A (confession.fayad.app going NXDOMAIN while the suite
// stayed green for nineteen hours) from happening silently a second time. A
// document that names the old hosts is not a check (§0.2) -- this file is
// what makes the table's claims fail loudly if they stop being true, and
// §3 item 5 is what stops "fix the red check" from meaning "delete the row".
//
// Written from the spec alone, in a worktree that does not contain
// src/origins.ts or scripts/check-origins.mjs, by design (spec §1.3). Every
// test below either fabricates its own probe records or reads
// scripts/check-origins.mjs as inert text for a substring sweep (item 10);
// nothing here opens a socket, resolves a name or imports the script.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ORIGINS, expectedRedirect, judgeProbe } from '../src/origins.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHECK_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'check-origins.mjs')

// The four rows §0.1 and §1.1 measured against the live internet before any
// code existed. Pinned here as literals, independent of whatever
// src/origins.ts currently contains, so that removing a row from the table
// to quiet a failing check (§2 rejected alternative 4) turns this suite red
// instead of green. A red check on a retired origin is the finding, not a
// bug to be edited away.
const PRODUCTION_ORIGIN = 'https://masaraha.provefair.app'
const STAGING_ORIGIN = 'https://stg.masaraha.provefair.app'
const RETIRED_PRODUCTION_ORIGIN = 'https://confession.fayad.app'
const RETIRED_STAGING_ORIGIN = 'https://stg.confession.fayad.app'

function findByOrigin(origin: string) {
  return ORIGINS.find((e) => e.origin === origin)
}

// --- §3 item 1: shape --------------------------------------------------

test('3.1: ORIGINS is an array whose every entry has kind live or retired and an absolute https:// origin with no trailing slash and no path', () => {
  assert.ok(Array.isArray(ORIGINS), 'ORIGINS must be an array')
  for (const entry of ORIGINS) {
    assert.ok(
      entry.kind === 'live' || entry.kind === 'retired',
      `entry ${JSON.stringify(entry)} has kind "${entry.kind}", expected "live" or "retired"`,
    )
    assert.ok(
      typeof entry.origin === 'string' && entry.origin.startsWith('https://'),
      `entry ${JSON.stringify(entry)} has an origin that is not an absolute https:// URL`,
    )
    let parsed: URL
    try {
      parsed = new URL(entry.origin)
    } catch {
      assert.fail(`entry.origin "${entry.origin}" is not a parseable URL`)
      return
    }
    assert.equal(
      parsed.pathname === '/' ? '' : parsed.pathname,
      '',
      `entry.origin "${entry.origin}" carries a path; an origin must be host-only`,
    )
    assert.equal(
      entry.origin.endsWith('/'),
      false,
      `entry.origin "${entry.origin}" has a trailing slash; an origin string must not`,
    )
  }
})

// --- §3 item 2: both live origins present -------------------------------

test('3.2: the production origin is present with role production and the staging origin is present with role staging', () => {
  const prod = findByOrigin(PRODUCTION_ORIGIN)
  assert.ok(prod, `${PRODUCTION_ORIGIN} is missing from ORIGINS`)
  assert.equal(prod?.kind, 'live', `${PRODUCTION_ORIGIN} must be a live entry`)
  assert.equal(
    (prod as { role?: string })?.role,
    'production',
    `${PRODUCTION_ORIGIN} must carry role: 'production'`,
  )

  const staging = findByOrigin(STAGING_ORIGIN)
  assert.ok(staging, `${STAGING_ORIGIN} is missing from ORIGINS`)
  assert.equal(staging?.kind, 'live', `${STAGING_ORIGIN} must be a live entry`)
  assert.equal(
    (staging as { role?: string })?.role,
    'staging',
    `${STAGING_ORIGIN} must carry role: 'staging'`,
  )
})

// --- §3 item 3: both retired origins present, pointing into the table ----

test('3.3: both retired origins are present, each redirectsTo the origin of a live entry in the same table', () => {
  for (const retiredOrigin of [RETIRED_PRODUCTION_ORIGIN, RETIRED_STAGING_ORIGIN]) {
    const entry = findByOrigin(retiredOrigin)
    assert.ok(entry, `${retiredOrigin} is missing from ORIGINS`)
    assert.equal(entry?.kind, 'retired', `${retiredOrigin} must be a retired entry`)
    const redirectsTo = (entry as { redirectsTo?: string })?.redirectsTo
    assert.ok(redirectsTo, `${retiredOrigin} has no redirectsTo`)
    const target = findByOrigin(redirectsTo as string)
    assert.ok(
      target,
      `${retiredOrigin} redirectsTo "${redirectsTo}", which is not any origin in ORIGINS at all`,
    )
    assert.equal(
      target?.kind,
      'live',
      `${retiredOrigin} redirectsTo "${redirectsTo}", which is itself a retired origin -- ` +
        'a retired host may not point at another retired host',
    )
  }
})

// --- §3 item 4: staging retires to staging, not to production ------------

test('3.4: stg.confession.fayad.app redirects to the staging origin, not to production', () => {
  const entry = findByOrigin(RETIRED_STAGING_ORIGIN)
  assert.ok(entry, `${RETIRED_STAGING_ORIGIN} is missing from ORIGINS`)
  const redirectsTo = (entry as { redirectsTo?: string })?.redirectsTo
  assert.equal(
    redirectsTo,
    STAGING_ORIGIN,
    `${RETIRED_STAGING_ORIGIN} must redirectsTo ${STAGING_ORIGIN}, not ${redirectsTo}. ` +
      'Sending a staging link to production would hand a test visitor the real site.',
  )
  assert.notEqual(
    redirectsTo,
    PRODUCTION_ORIGIN,
    `${RETIRED_STAGING_ORIGIN} must not redirectsTo the production origin`,
  )
})

// --- §3 item 5: the table may not shrink ----------------------------------

test('3.5: all four origins measured in the build session are still present in ORIGINS -- the table may gain rows and may never lose one', () => {
  const present = new Set(ORIGINS.map((e) => e.origin))
  for (const origin of [
    PRODUCTION_ORIGIN,
    STAGING_ORIGIN,
    RETIRED_PRODUCTION_ORIGIN,
    RETIRED_STAGING_ORIGIN,
  ]) {
    assert.ok(
      present.has(origin),
      `${origin} is missing from ORIGINS. Deleting a row to quiet a failing check is the ` +
        'failure mode this slice exists to resist (spec §2 rejected alternative 4): a red ' +
        'check on a retired origin is the finding, not a bug in the check.',
    )
  }
})

// --- §3 item 6: expectedRedirect preserves the path -----------------------

test('3.6: expectedRedirect preserves the path exactly, never doubling or dropping a slash', () => {
  const retiredProd = findByOrigin(RETIRED_PRODUCTION_ORIGIN)
  assert.ok(retiredProd, `${RETIRED_PRODUCTION_ORIGIN} is missing from ORIGINS`)
  if (!retiredProd) return

  assert.equal(
    expectedRedirect(retiredProd, '/c/abc'),
    `${PRODUCTION_ORIGIN}/c/abc`,
    'expectedRedirect must preserve /c/abc exactly under the production retirement',
  )
  assert.equal(
    expectedRedirect(retiredProd, '/'),
    `${PRODUCTION_ORIGIN}/`,
    'expectedRedirect must give exactly the origin plus a single slash for path "/"',
  )
})

// --- §3 item 7: judgeProbe ranks DNS first --------------------------------

test('3.7: judgeProbe fails with a reason beginning NXDOMAIN when dnsResolved is false, even alongside a 200 status', () => {
  const entry = findByOrigin(RETIRED_PRODUCTION_ORIGIN)
  assert.ok(entry, `${RETIRED_PRODUCTION_ORIGIN} is missing from ORIGINS`)
  if (!entry) return

  // probePath is part of the probe record (spec §4.1); DNS is checked before
  // the path is ever compared, so a root probe is enough to prove the rank.
  const verdict = judgeProbe(entry, { dnsResolved: false, probePath: '/', status: 200, location: null })
  assert.equal(verdict.ok, false, 'an entry with dnsResolved: false must not pass')
  assert.ok(
    verdict.reason.startsWith('NXDOMAIN'),
    `reason must begin with "NXDOMAIN" when dnsResolved is false, got "${verdict.reason}". ` +
      'An unresolvable name has no status, so DNS must outrank every other check even when ' +
      'a status of 200 is present in the same record.',
  )
})

// --- §3 item 8: a live entry names the status it received ----------------

test('3.8: a live entry passes on 200 and fails on 301, 404, 500 and 503, each naming the received status', () => {
  const live = findByOrigin(PRODUCTION_ORIGIN)
  assert.ok(live, `${PRODUCTION_ORIGIN} is missing from ORIGINS`)
  if (!live) return

  // §4.2: a live entry is always probed at "/", so probePath is fixed here.
  const okVerdict = judgeProbe(live, { dnsResolved: true, probePath: '/', status: 200, location: null })
  assert.equal(okVerdict.ok, true, `a live entry must pass on 200, got reason "${okVerdict.reason}"`)

  for (const status of [301, 404, 500, 503]) {
    const verdict = judgeProbe(live, { dnsResolved: true, probePath: '/', status, location: null })
    assert.equal(verdict.ok, false, `a live entry answering ${status} must not pass`)
    assert.ok(
      verdict.reason.includes(String(status)),
      `a live entry answering ${status} must name that status in the reason, got "${verdict.reason}"`,
    )
  }
})

// --- §3 item 9: a retired entry's full pass/fail matrix -------------------

test('3.9: a retired entry passes on an exactly-correct 301 and fails on 200, 404, a dropped path, the old host itself, and 302', () => {
  const entry = findByOrigin(RETIRED_PRODUCTION_ORIGIN)
  assert.ok(entry, `${RETIRED_PRODUCTION_ORIGIN} is missing from ORIGINS`)
  if (!entry) return

  // probePath rides in the probe record (spec §4.1). Every fixture below
  // probes /c/abc on purpose: at probePath "/" the correct location and a
  // "path dropped to the homepage" location are the same string
  // (https://.../), so only a non-root probe can prove the path-dropped
  // case fails for the reason claimed and not by accident.
  const probePath = '/c/abc'
  const correctLocation = expectedRedirect(entry, probePath)

  const okVerdict = judgeProbe(entry, { dnsResolved: true, probePath, status: 301, location: correctLocation })
  assert.equal(
    okVerdict.ok,
    true,
    `a retired entry answering 301 with the exactly-correct location must pass, got reason "${okVerdict.reason}"`,
  )

  const notRedirecting200 = judgeProbe(entry, { dnsResolved: true, probePath, status: 200, location: null })
  assert.equal(notRedirecting200.ok, false, 'a retired entry answering 200 must not pass')

  const notRedirecting404 = judgeProbe(entry, { dnsResolved: true, probePath, status: 404, location: null })
  assert.equal(notRedirecting404.ok, false, 'a retired entry answering 404 must not pass')

  const droppedPath = judgeProbe(entry, { dnsResolved: true, probePath, status: 301, location: PRODUCTION_ORIGIN })
  assert.equal(
    droppedPath.ok,
    false,
    `a retired entry probed at ${probePath} but redirected to the bare successor origin ` +
      '(the path dropped) must not pass',
  )

  const backToOldHost = judgeProbe(entry, {
    dnsResolved: true,
    probePath,
    status: 301,
    location: `${RETIRED_PRODUCTION_ORIGIN}${probePath}`,
  })
  assert.equal(
    backToOldHost.ok,
    false,
    'a retired entry answering 301 to itself (the old host) must not pass',
  )

  const temporaryRedirect = judgeProbe(entry, { dnsResolved: true, probePath, status: 302, location: correctLocation })
  assert.equal(
    temporaryRedirect.ok,
    false,
    'a retired entry answering 302 with an otherwise correct location must not pass -- ' +
      'the commitment is permanently, and a temporary redirect is a different promise',
  )
})

// --- §3 item 10: no secret surface in the checker script ------------------

test('3.10: scripts/check-origins.mjs contains no .env read, no process.env secret access and no Authorization header', () => {
  const src = readFileSync(CHECK_SCRIPT_PATH, 'utf8')

  assert.ok(
    !/\.env\b/.test(src),
    'scripts/check-origins.mjs references .env; the script must read no secret file ' +
      'to check a set of public origins',
  )
  assert.ok(
    !/process\.env/.test(src),
    'scripts/check-origins.mjs reads process.env; §1.2 promises the script sends no ' +
      'credential and reads no .env, and a plain process.env read is how that leaks in quietly',
  )
  assert.ok(
    !/Authorization/i.test(src),
    'scripts/check-origins.mjs sets an Authorization header; checking whether a public ' +
      'origin redirects correctly requires no credential of any kind',
  )
})

// --- §3 item 11: the script's exit-code rule, proved over judgeProbe -----

test('3.11: the exit-code rule -- non-zero when any entry fails, over a fabricated result set', () => {
  // §1.2 step 3: the script hands each probe record to judgeProbe and exits
  // 1 if any of them fail, 0 only if all of them pass. The rule under test
  // is a fold over judgeProbe's own verdicts, not the script's I/O, so it is
  // proved here without importing or reading the script's logic.
  // §4.2: a live entry is always probed at "/"; a retired entry's probePath
  // rides along in the probe record (§4.1) so judgeProbe can tell a correct
  // redirect from one that dropped the path.
  const probePath = '/'
  const allPassing = ORIGINS.map((entry) => {
    if (entry.kind === 'live') {
      return judgeProbe(entry, { dnsResolved: true, probePath, status: 200, location: null })
    }
    const location = expectedRedirect(entry, probePath)
    return judgeProbe(entry, { dnsResolved: true, probePath, status: 301, location })
  })
  const allExitCode = allPassing.some((v) => !v.ok) ? 1 : 0
  assert.equal(
    allExitCode,
    0,
    'when every entry passes judgeProbe, the exit-code rule must compute 0',
  )

  const oneFailing = ORIGINS.map((entry, i) => {
    if (i === 0) {
      return judgeProbe(entry, { dnsResolved: false, probePath, status: 200, location: null })
    }
    if (entry.kind === 'live') {
      return judgeProbe(entry, { dnsResolved: true, probePath, status: 200, location: null })
    }
    const location = expectedRedirect(entry, probePath)
    return judgeProbe(entry, { dnsResolved: true, probePath, status: 301, location })
  })
  const oneFailingExitCode = oneFailing.some((v) => !v.ok) ? 1 : 0
  assert.equal(
    oneFailingExitCode,
    1,
    'the exit-code rule must compute 1 as soon as a single entry fails judgeProbe, ' +
      'because stopping at the first failure hides the second (spec §1.2)',
  )
})

// --- §3 item 12: no network in this file -----------------------------------

test('3.12: this test file performs no DNS lookup and no fetch -- itself read as text', () => {
  const selfPath = fileURLToPath(import.meta.url)
  const selfSrc = readFileSync(selfPath, 'utf8')

  assert.ok(
    !/\bfetch\s*\(/.test(selfSrc),
    'test/67-origin-contract.test.ts calls fetch; every judgement here must be pure ' +
      'over fabricated records, never over the network',
  )
  assert.ok(
    !/node:dns/.test(selfSrc),
    'test/67-origin-contract.test.ts imports node:dns; a resolver lookup here would make ' +
      'this file exactly the thing §2 rejected alternative 2 refused to ship inside npm test',
  )
  assert.ok(
    !/\bnet\.(connect|createConnection)\b/.test(selfSrc),
    'test/67-origin-contract.test.ts opens a raw socket; this file proves judgeProbe and ' +
      'expectedRedirect against data it fabricates itself, nothing reachable',
  )
})
