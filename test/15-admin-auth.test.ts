// test/15-admin-auth.test.ts
//
// Written from docs/SPEC-week7-admin.md sections 1, 2, 6, not from
// src/admin.ts, src/admin-auth.ts, src/admin-throttle.ts, drizzle/0002_admin.sql
// or anything under app/admin/. Those files were not opened while writing
// this suite, with one narrow exception: scripts/bootstrap-admin.mjs is
// opened for item 18 only, because that item's subject is the file's own
// source text, not its behaviour. Every expected constant, format string
// and error condition below is transcribed by hand from the spec, section
// numbers included in each test name so a mismatch between this file and
// the frozen contract is easy to find later.
//
// This file covers the pure/crypto/env/throttle half of section 6: items
// 4, 5, 6, 7, 10, 11, 18. The database and surface half (items 1, 2, 3, 8,
// 9, 12, 13, 14, 15, 16, 17, 19, 20) is test/16-admin-surface.test.ts.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { signSession, verifySession } from '../src/session.js'
import { loadEnv } from '../src/env.js'
import {
  ADMIN_SESSION_MAX_AGE_MS,
  adminSessionKey,
  signAdminSession,
  verifyAdminSession,
  hashAdminPassword,
  verifyAdminPassword,
  isAdminPasswordHash,
} from '../src/admin-auth.js'
import {
  ADMIN_MAX_FAILURES,
  ADMIN_LOCKOUT_MS,
  createThrottle,
  isLockedOut,
  recordFailure,
  clearFailures,
} from '../src/admin-throttle.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOUR_MS = 60 * 60 * 1000

// ---------------------------------------------------------------------------
// item 4: password round-trip (spec §2.2)
// ---------------------------------------------------------------------------

test('7.6.4 hashAdminPassword/verifyAdminPassword round-trip: the correct password verifies, a wrong password fails, and two hashes of the same password differ by their random salt', () => {
  const password = 'a reasonably long test bootstrap password'
  const hashA = hashAdminPassword(password)
  const hashB = hashAdminPassword(password)

  assert.equal(verifyAdminPassword(password, hashA), true, 'the correct password must verify against its own hash')
  assert.equal(
    verifyAdminPassword('a completely different password', hashA),
    false,
    'a wrong password must not verify',
  )
  assert.notEqual(hashA, hashB, 'two hashes of the same password must differ: the salt is random (spec §2.2)')

  // Stored format, exactly: scrypt$<N>$<r>$<p>$<base64url(salt)>$<base64url(key)> (spec §2.2).
  assert.match(
    hashA,
    /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/,
    'the stored hash must match the exact scrypt$N$r$p$salt$key format in spec §2.2',
  )
  assert.ok(hashA.startsWith('scrypt$16384$8$1$'), 'the fixed parameters N=16384, r=8, p=1 must appear literally (spec §2.2)')
  assert.equal(isAdminPasswordHash(hashA), true, 'a hash produced by hashAdminPassword must satisfy isAdminPasswordHash')
})

// ---------------------------------------------------------------------------
// item 5: verifyAdminPassword never throws (spec §2.2)
// ---------------------------------------------------------------------------

test('7.6.5 verifyAdminPassword returns false and never throws for every malformed stored value', () => {
  const validSalt = Buffer.alloc(16, 7).toString('base64url')
  const wrongLengthKey = Buffer.alloc(10, 9).toString('base64url') // not the required 32-byte derived key

  const malformedInputs: string[] = [
    '',
    'scrypt$',
    'scrypt$a$b$c$d$e', // non-integer N/r/p, junk fields
    '$2b$12$KIXQ9s0aG7Z8y5x1u2v3ROeSomeBcryptLookingHashValueHere', // a bcrypt-looking string
    `scrypt$16384$8$1$${validSalt}$`, // a truncated base64 field (key field cut off entirely)
    `scrypt$16384$8$1$${validSalt}$${wrongLengthKey}`, // correct format, wrong-length key
  ]

  for (const stored of malformedInputs) {
    let result: boolean | undefined
    assert.doesNotThrow(() => {
      result = verifyAdminPassword('any password at all', stored)
    }, `verifyAdminPassword must not throw for malformed stored value ${JSON.stringify(stored)}`)
    assert.equal(result, false, `verifyAdminPassword must return false for malformed stored value ${JSON.stringify(stored)}`)
  }
})

// ---------------------------------------------------------------------------
// item 6: cookie separation is cryptographic (spec §2.1, §4.6)
// ---------------------------------------------------------------------------

test('7.6.6 the cookie separation is cryptographic: a plain user sid token fails verifyAdminSession, an admin_sid token fails verifySession, under the identical SESSION_SECRET, because they are signed under different derived keys', () => {
  const secret = 's'.repeat(32)

  const userToken = signSession(secret, { accountId: 'account-under-test' })
  assert.equal(
    verifyAdminSession(secret, userToken),
    null,
    'a token signed by signSession must not verify as an admin session, even under the same secret',
  )

  const adminToken = signAdminSession(secret, { adminUserId: 'admin-under-test' })
  assert.equal(
    verifySession(secret, adminToken),
    null,
    'a token signed by signAdminSession must not verify as a plain user session, even under the same secret',
  )

  // spec §2.1: adminSessionKey(secret) is
  // createHmac('sha256', secret).update('confession-admin-session-v1').digest('base64'),
  // derived, not a second configured secret. This is the mechanism, not
  // just its effect, so it is asserted directly.
  const expectedAdminKey = createHmac('sha256', secret).update('confession-admin-session-v1').digest('base64')
  assert.equal(adminSessionKey(secret), expectedAdminKey, 'adminSessionKey must match the exact derivation in spec §2.1')
})

// ---------------------------------------------------------------------------
// item 7: admin session expiry (spec §2.1)
// ---------------------------------------------------------------------------

test('7.6.7 an admin session is valid at 7h59m, null at 8h01m, null for an iat in the future, and null for a payload with an empty adminUserId', () => {
  assert.equal(ADMIN_SESSION_MAX_AGE_MS, 8 * HOUR_MS, 'ADMIN_SESSION_MAX_AGE_MS must be exactly eight hours, not seven days (spec §2.1)')

  const secret = 't'.repeat(32)
  const before = Date.now()
  const token = signAdminSession(secret, { adminUserId: 'admin-77' })

  const stillValid = verifyAdminSession(secret, token, before + 7 * HOUR_MS + 59 * 60 * 1000)
  assert.ok(stillValid, 'must still be valid at 7h59m')
  assert.equal(stillValid?.adminUserId, 'admin-77')

  const expired = verifyAdminSession(secret, token, before + 8 * HOUR_MS + 60 * 1000)
  assert.equal(expired, null, 'must be null at 8h01m')

  // An iat in the future relative to nowMs: verify against a nowMs from
  // strictly before the token could have been signed.
  const futureIat = verifyAdminSession(secret, token, before - 1000)
  assert.equal(futureIat, null, 'an iat that is in the future relative to nowMs must be rejected')

  const emptyAdminUserToken = signAdminSession(secret, { adminUserId: '' })
  assert.equal(
    verifyAdminSession(secret, emptyAdminUserToken),
    null,
    'a payload whose adminUserId is not a non-empty string must be rejected',
  )
})

// ---------------------------------------------------------------------------
// item 10: brute-force throttle (spec §2.6)
// ---------------------------------------------------------------------------

test('7.6.10 the throttle: five failures lock a username, a sixth attempt is still locked out, the lock expires after ADMIN_LOCKOUT_MS, clearFailures releases it immediately, and one username failing does not lock another', () => {
  assert.equal(ADMIN_MAX_FAILURES, 5, 'ADMIN_MAX_FAILURES must be 5 (spec §2.6)')
  assert.equal(ADMIN_LOCKOUT_MS, 15 * 60 * 1000, 'ADMIN_LOCKOUT_MS must be 15 minutes (spec §2.6)')

  const state = createThrottle()
  const now = Date.now()

  assert.equal(isLockedOut(state, 'flaky-admin', now), false, 'a username with no recorded failures must not be locked out')

  for (let i = 0; i < ADMIN_MAX_FAILURES; i++) {
    recordFailure(state, 'flaky-admin', now)
  }
  assert.equal(isLockedOut(state, 'flaky-admin', now), true, `${ADMIN_MAX_FAILURES} failures must lock the username`)

  // A further attempt while already locked reads as locked, with the right
  // password or not: this suite has no route layer to call
  // authenticateAdmin through, so the assertion is made at the throttle
  // primitive the route is specified to consult first (spec §3.1: "if
  // isLockedOut, re-render with the generic message" happens before
  // authenticateAdmin is even called).
  recordFailure(state, 'flaky-admin', now)
  assert.equal(isLockedOut(state, 'flaky-admin', now), true)

  assert.equal(
    isLockedOut(state, 'flaky-admin', now + ADMIN_LOCKOUT_MS + 1000),
    false,
    'the lock must expire after ADMIN_LOCKOUT_MS',
  )

  const state2 = createThrottle()
  for (let i = 0; i < ADMIN_MAX_FAILURES; i++) recordFailure(state2, 'clearable-admin', now)
  assert.equal(isLockedOut(state2, 'clearable-admin', now), true)
  clearFailures(state2, 'clearable-admin')
  assert.equal(isLockedOut(state2, 'clearable-admin', now), false, 'clearFailures must release the lock immediately')

  const state3 = createThrottle()
  for (let i = 0; i < ADMIN_MAX_FAILURES; i++) recordFailure(state3, 'attacker', now)
  assert.equal(isLockedOut(state3, 'attacker', now), true)
  assert.equal(
    isLockedOut(state3, 'innocent-bystander', now),
    false,
    "one username's failures must not lock another username, since the throttle is keyed on username alone",
  )
})

// ---------------------------------------------------------------------------
// item 11: loadEnv fail-closed on the admin variables (spec §2.4)
// ---------------------------------------------------------------------------

const ADMIN_ENV_BASE: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/confession',
  SESSION_SECRET: 'y'.repeat(32),
  APP_ORIGIN: 'https://stg.confession.fayad.app',
}

test('7.6.11 loadEnv throws when ADMIN_BOOTSTRAP_USERNAME is set without ADMIN_BOOTSTRAP_PASSWORD_HASH', () => {
  assert.throws(() => loadEnv({ ...ADMIN_ENV_BASE, ADMIN_BOOTSTRAP_USERNAME: 'siteadmin' }))
})

test('7.6.11 loadEnv throws when ADMIN_BOOTSTRAP_PASSWORD_HASH is set without ADMIN_BOOTSTRAP_USERNAME', () => {
  const validHash = hashAdminPassword('a bootstrap password')
  assert.throws(() => loadEnv({ ...ADMIN_ENV_BASE, ADMIN_BOOTSTRAP_PASSWORD_HASH: validHash }))
})

test('7.6.11 loadEnv throws on a malformed ADMIN_BOOTSTRAP_PASSWORD_HASH, and the thrown message does not contain the supplied malformed value', () => {
  const malformedHash = 'not-a-scrypt-hash-at-all-xyz789-distinctive-marker'
  assert.throws(
    () =>
      loadEnv({
        ...ADMIN_ENV_BASE,
        ADMIN_BOOTSTRAP_USERNAME: 'siteadmin',
        ADMIN_BOOTSTRAP_PASSWORD_HASH: malformedHash,
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error, 'loadEnv must throw an Error')
      assert.ok(
        !err.message.includes(malformedHash),
        `the thrown message must name the expected format and must not echo the supplied value; got: ${err.message}`,
      )
      return true
    },
  )
})

test('7.6.11 loadEnv: both ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD_HASH absent is valid, and adminEnabled is false', () => {
  const env = loadEnv(ADMIN_ENV_BASE)
  assert.equal(env.adminEnabled, false, 'no admin configured must not be an error, and adminEnabled must be false')
  assert.equal(env.adminBootstrapUsername, null)
  assert.equal(env.adminBootstrapPasswordHash, null)
})

test('7.6.11 loadEnv: both present and well-formed gives adminEnabled === true', () => {
  const validHash = hashAdminPassword('a bootstrap password')
  const env = loadEnv({
    ...ADMIN_ENV_BASE,
    ADMIN_BOOTSTRAP_USERNAME: 'siteadmin',
    ADMIN_BOOTSTRAP_PASSWORD_HASH: validHash,
  })
  assert.equal(env.adminEnabled, true)
  assert.equal(env.adminBootstrapUsername, 'siteadmin')
  assert.equal(env.adminBootstrapPasswordHash, validHash)
})

test('7.6.11 loadEnv rejects an ADMIN_BOOTSTRAP_USERNAME shorter than the database CHECK allows (btrim length under 3)', () => {
  const validHash = hashAdminPassword('a bootstrap password')
  // spec §2.4 rule 3: ADMIN_BOOTSTRAP_USERNAME, when set, must satisfy the
  // same length(btrim(...)) >= 3 the admin_users CHECK enforces, so the two
  // cannot disagree.
  assert.throws(() =>
    loadEnv({
      ...ADMIN_ENV_BASE,
      ADMIN_BOOTSTRAP_USERNAME: 'ab',
      ADMIN_BOOTSTRAP_PASSWORD_HASH: validHash,
    }),
  )
})

// ---------------------------------------------------------------------------
// item 18: scripts/bootstrap-admin.mjs never prints a password (spec §2.5)
//
// This is the one file this suite is explicitly permitted to open, because
// item 18's subject is the file's own source text, not its runtime
// behaviour: the script is never executed here.
// ---------------------------------------------------------------------------

test('7.6.18 scripts/bootstrap-admin.mjs never prints a password or its hash, never references a plaintext password variable, and implements no scrypt of its own', () => {
  const scriptPath = path.join(REPO_ROOT, 'scripts', 'bootstrap-admin.mjs')
  const src = readFileSync(scriptPath, 'utf8')

  const printLines = src.split('\n').filter((line) => /console\.(log|error|info|warn)/.test(line))
  assert.ok(printLines.length > 0, 'the script must print at least the username line (spec §2.5)')
  for (const line of printLines) {
    assert.ok(!/hash/i.test(line), `a print statement must not reference anything hash-shaped: "${line.trim()}"`)
  }

  assert.ok(
    !/ADMIN_BOOTSTRAP_PASSWORD(?!_HASH)\b/.test(src),
    'the script must reference only ADMIN_BOOTSTRAP_PASSWORD_HASH, never a plaintext ADMIN_BOOTSTRAP_PASSWORD variable (spec §2.5)',
  )

  assert.ok(
    !/scryptSync|scrypt\s*\(/i.test(src),
    'the script must not implement its own scrypt hashing: hashAdminPassword is implemented once, in src/admin-auth.ts (spec §2.5)',
  )
})
