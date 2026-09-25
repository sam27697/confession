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
// Revised 2026-09-25 against §5, the amendment that replaces §3 items 3, 4,
// 6 and 9 with 3', 4', 6' and 9' and adds items 13 and 14. The owner retired
// confession.fayad.app and stg.confession.fayad.app himself on 2026-09-24,
// on purpose, so his name would stop appearing in this app's URL -- so a
// retired origin no longer owes a redirect. It owes silence: the name must
// not resolve at all, and if it ever does resolve again that is a change to
// his DNS someone has to explain, not a redirect this repository arranges.
// The old items 3, 4, 6 and 9 tested a redirect that the owner has since
// said he does not want, so they are replaced rather than kept.
//
// Written from the spec alone, in a worktree that does not contain
// src/origins.ts or scripts/check-origins.mjs, by design (spec §1.3). Every
// test below either fabricates its own probe records or reads
// scripts/check-origins.mjs as inert text for a substring sweep (items 10
// and 14); nothing here opens a socket, resolves a name or imports the
// script.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as origins from '../src/origins.js'

const { ORIGINS, judgeProbe } = origins

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHECK_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'check-origins.mjs')

// The four rows §0.1 and §1.1 measured against the live internet before any
// code existed. Pinned here as literals, independent of whatever
// src/origins.ts currently contains, so that removing a row from the table
// to quiet a failing check (§2 rejected alternative 4) turns this suite red
// instead of green. A red check on a retired origin is the finding, not a
// bug to be edited away. As of §5 the two retired rows below no longer
// redirect anywhere; they must simply not resolve.
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

// --- §5.3 item 3': both retired origins present, expects absent, no redirectsTo ---

test("3': both retired origins are present, each with expects: 'absent' and no redirectsTo property at all", () => {
  for (const retiredOrigin of [RETIRED_PRODUCTION_ORIGIN, RETIRED_STAGING_ORIGIN]) {
    const entry = findByOrigin(retiredOrigin)
    assert.ok(entry, `${retiredOrigin} is missing from ORIGINS`)
    assert.equal(entry?.kind, 'retired', `${retiredOrigin} must be a retired entry`)
    assert.equal(
      (entry as { expects?: string })?.expects,
      'absent',
      `${retiredOrigin} must carry expects: 'absent' -- §5.1: a retired origin now means ` +
        'the name must not resolve at all, not that it redirects somewhere',
    )
    assert.ok(
      entry && !('redirectsTo' in entry),
      `${retiredOrigin} still carries a redirectsTo property; §5.1 removes it, because ` +
        'nothing owes this name a redirect any more',
    )
  }
})

// --- §5.3 item 4': src/origins.ts exports no expectedRedirect --------------

test("4': src/origins.ts exports no expectedRedirect", () => {
  // Read through Record<string, unknown> rather than off the typed
  // namespace: origins.expectedRedirect does not typecheck once the
  // property is genuinely absent from the module's type, and that absence
  // is exactly what this test is proving, so the access has to go through
  // something the compiler will not reject on that basis alone.
  const namespaceRecord = origins as Record<string, unknown>

  assert.equal(
    Object.prototype.hasOwnProperty.call(origins, 'expectedRedirect'),
    false,
    'src/origins.ts still exports expectedRedirect as an own property of the module ' +
      'namespace; §5.1 removes it -- nothing owes a redirect any more, and a helper that ' +
      'computes one invites someone to build one',
  )
  assert.equal(
    namespaceRecord['expectedRedirect'],
    undefined,
    'src/origins.ts still exports expectedRedirect; §5.1 removes it -- nothing owes a ' +
      'redirect any more, and a helper that computes one invites someone to build one',
  )
})

// --- §3 item 5: the table may not shrink ----------------------------------

test('5: all four origins measured in the build session are still present in ORIGINS -- the table may gain rows and may never lose one', () => {
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
        'check on a retired origin is the finding, not a bug in the check. §5.2: the table ' +
        'still has four rows and still may not shrink, with the new expectation attached ' +
        'to the two retired ones.',
    )
  }
})

// --- §5.3 item 6': a retired entry with dnsResolved: false passes regardless of status/location ---

test("6': a retired entry with dnsResolved: false passes, even when a status of 301 and a location on a live origin are also supplied", () => {
  const entry = findByOrigin(RETIRED_PRODUCTION_ORIGIN)
  assert.ok(entry, `${RETIRED_PRODUCTION_ORIGIN} is missing from ORIGINS`)
  if (!entry) return

  const verdict = judgeProbe(entry, {
    dnsResolved: false,
    probePath: '/',
    status: 301,
    location: `${PRODUCTION_ORIGIN}/`,
  })
  assert.equal(
    verdict.ok,
    true,
    `a retired entry with dnsResolved: false must pass regardless of any status or ` +
      `location also present in the record, got reason "${verdict.reason}"`,
  )
  assert.ok(
    verdict.reason.startsWith('NXDOMAIN'),
    `the reason must still begin "NXDOMAIN" on a passing retired verdict, got ` +
      `"${verdict.reason}" -- §5.1: DNS keeps ranking first for both kinds, only the ` +
      'verdict differs',
  )
})

// --- §5.3 item 7: judgeProbe ranks DNS first, for both kinds ---------------

test('7: judgeProbe ranks DNS first for both kinds -- the reason begins NXDOMAIN whenever dnsResolved is false, even with a status supplied, though the verdict differs by kind', () => {
  const live = findByOrigin(PRODUCTION_ORIGIN)
  const retired = findByOrigin(RETIRED_PRODUCTION_ORIGIN)
  assert.ok(live, `${PRODUCTION_ORIGIN} is missing from ORIGINS`)
  assert.ok(retired, `${RETIRED_PRODUCTION_ORIGIN} is missing from ORIGINS`)
  if (!live || !retired) return

  const liveVerdict = judgeProbe(live, { dnsResolved: false, probePath: '/', status: 200, location: null })
  assert.equal(liveVerdict.ok, false, 'a live entry with dnsResolved: false must still fail')
  assert.ok(
    liveVerdict.reason.startsWith('NXDOMAIN'),
    `a live entry's reason must begin "NXDOMAIN" when dnsResolved is false, even ` +
      `alongside a status of 200, got "${liveVerdict.reason}"`,
  )

  const retiredVerdict = judgeProbe(retired, { dnsResolved: false, probePath: '/', status: 200, location: null })
  assert.equal(
    retiredVerdict.ok,
    true,
    'a retired entry with dnsResolved: false must pass -- absence is now the correct state',
  )
  assert.ok(
    retiredVerdict.reason.startsWith('NXDOMAIN'),
    `a retired entry's reason must also begin "NXDOMAIN" when dnsResolved is false, even ` +
      `alongside a status of 200, got "${retiredVerdict.reason}" -- DNS ranks first for ` +
      'both kinds, and only the verdict differs (§5.1)',
  )
})

// --- §3 item 8: a live entry names the status it received ----------------

test('8: a live entry passes on 200 and fails on 301, 404, 500 and 503, each naming the received status', () => {
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

// --- §5.3 item 9': a retired entry with dnsResolved: true fails, whatever else it carries ---

test("9': a retired entry with dnsResolved: true fails on 200, 404, a 301 to the live successor, a 302 to the same, and a record with no status at all, each reason naming the retired origin", () => {
  const entry = findByOrigin(RETIRED_PRODUCTION_ORIGIN)
  assert.ok(entry, `${RETIRED_PRODUCTION_ORIGIN} is missing from ORIGINS`)
  if (!entry) return

  const cases: Array<{ label: string; probe: { status?: number; location?: string | null } }> = [
    { label: '200', probe: { status: 200, location: null } },
    { label: '404', probe: { status: 404, location: null } },
    { label: '301 to the live successor', probe: { status: 301, location: `${PRODUCTION_ORIGIN}/` } },
    { label: '302 to the live successor', probe: { status: 302, location: `${PRODUCTION_ORIGIN}/` } },
    { label: 'no status at all', probe: {} },
  ]

  for (const { label, probe } of cases) {
    const verdict = judgeProbe(entry, { dnsResolved: true, probePath: '/', ...probe })
    assert.equal(
      verdict.ok,
      false,
      `a retired entry with dnsResolved: true must fail on ${label} -- §5.1: the name ` +
        'resolving at all is the failure now, whatever else the record carries',
    )
    assert.ok(
      verdict.reason.includes(RETIRED_PRODUCTION_ORIGIN),
      `a retired entry's failure reason on ${label} must name the retired origin, got ` +
        `"${verdict.reason}"`,
    )
  }
})

// --- §3 item 10: no secret surface in the checker script ------------------

test('10: scripts/check-origins.mjs contains no .env read, no process.env secret access and no Authorization header', () => {
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

test("11: the exit-code rule -- non-zero when any entry fails, over a fabricated result set built to the retired semantics of §5.1", () => {
  // §1.2 step 3: the script hands each probe record to judgeProbe and exits
  // 1 if any of them fail, 0 only if all of them pass. The rule under test
  // is a fold over judgeProbe's own verdicts, not the script's I/O, so it is
  // proved here without importing or reading the script's logic.
  // §5.1: a retired entry now passes on dnsResolved: false alone and is
  // built with no redirectsTo, so a passing retired record here carries no
  // location at all -- unlike the pre-amendment fixture, there is no
  // successor URL to compute.
  const probePath = '/'
  const passingProbeFor = (entry: (typeof ORIGINS)[number]) =>
    entry.kind === 'live'
      ? judgeProbe(entry, { dnsResolved: true, probePath, status: 200, location: null })
      : judgeProbe(entry, { dnsResolved: false, probePath })

  const failingProbeFor = (entry: (typeof ORIGINS)[number]) =>
    entry.kind === 'live'
      ? judgeProbe(entry, { dnsResolved: false, probePath })
      : judgeProbe(entry, { dnsResolved: true, probePath, status: 200, location: null })

  const allPassing = ORIGINS.map(passingProbeFor)
  const allExitCode = allPassing.some((v) => !v.ok) ? 1 : 0
  assert.equal(
    allExitCode,
    0,
    'when every entry passes judgeProbe, the exit-code rule must compute 0',
  )

  const oneFailing = ORIGINS.map((entry, i) => (i === 0 ? failingProbeFor(entry) : passingProbeFor(entry)))
  const oneFailingExitCode = oneFailing.some((v) => !v.ok) ? 1 : 0
  assert.equal(
    oneFailingExitCode,
    1,
    'the exit-code rule must compute 1 as soon as a single entry fails judgeProbe, ' +
      'because stopping at the first failure hides the second (spec §1.2)',
  )
})

// --- §3 item 12: no network in this file -----------------------------------

// Built by concatenation rather than as one contiguous literal, so the
// needle this test sweeps for does not appear verbatim in its own source.
// The pre-amendment file swept for the dns module (with its node: prefix)
// spelled out as one plain literal, sitting right there in the regex and
// in the assertion message, so the sweep matched itself and could never
// go red on a real import. Joining the segments at runtime keeps the
// check honest: the joined module name only ever exists in memory, never
// as contiguous text on disk.
const dnsModuleName = ['node', 'dns'].join(':')
const dnsImportPattern = new RegExp(
  `\\bfrom\\s+['"](?:${dnsModuleName}|dns)(?:/promises)?['"]` +
    `|\\brequire\\(\\s*['"](?:${dnsModuleName}|dns)(?:/promises)?['"]\\s*\\)`,
)

test('12: this test file performs no DNS lookup and no fetch -- itself read as text', () => {
  const selfPath = fileURLToPath(import.meta.url)
  const selfSrc = readFileSync(selfPath, 'utf8')

  assert.ok(
    !/\bfetch\s*\(/.test(selfSrc),
    'test/67-origin-contract.test.ts calls fetch; every judgement here must be pure ' +
      'over fabricated records, never over the network',
  )
  assert.ok(
    !dnsImportPattern.test(selfSrc),
    `test/67-origin-contract.test.ts imports the ${dnsModuleName} module (or bare 'dns'); ` +
      'a resolver lookup here would make this file exactly the thing §2 rejected ' +
      'alternative 2 refused to ship inside npm test',
  )
  assert.ok(
    !/\bnet\.(connect|createConnection)\b/.test(selfSrc),
    'test/67-origin-contract.test.ts opens a raw socket; this file proves judgeProbe ' +
      'against data it fabricates itself, nothing reachable',
  )
})

// --- §5.3 item 13: live rows are not weakened by the amendment -------------

test('13: a live entry with dnsResolved: false still fails, with a reason beginning NXDOMAIN', () => {
  const live = findByOrigin(PRODUCTION_ORIGIN)
  assert.ok(live, `${PRODUCTION_ORIGIN} is missing from ORIGINS`)
  if (!live) return

  const verdict = judgeProbe(live, { dnsResolved: false, probePath: '/', status: 200, location: null })
  assert.equal(
    verdict.ok,
    false,
    'a live entry with dnsResolved: false must fail -- §5.1 changes what a retired entry ' +
      'means, not what a live one requires',
  )
  assert.ok(
    verdict.reason.startsWith('NXDOMAIN'),
    `a live entry's reason must begin "NXDOMAIN" when dnsResolved is false, got ` +
      `"${verdict.reason}"`,
  )
})

// --- §5.3 item 14: the checker script no longer takes --path ---------------

test('14: scripts/check-origins.mjs, read as inert text, contains no --path', () => {
  const src = readFileSync(CHECK_SCRIPT_PATH, 'utf8')
  assert.ok(
    !src.includes('--path'),
    'scripts/check-origins.mjs still references --path; §5.1 removes it -- every origin ' +
      'is now probed at "/", and an unknown argument exits 2 with a usage line instead of ' +
      'being accepted',
  )
})
