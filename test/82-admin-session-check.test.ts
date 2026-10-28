// test/82-admin-session-check.test.ts
//
// Written from docs/SPEC-week31b-admin-revoked-loop.md section 4, items 1
// to 7, and section 1, which names the signature
// adminUserIdFromCookie(db, raw): Promise<string | null>. Section 0 was
// read for context (the redirect loop these items close). Item 8 is a live
// staging check and is not covered here.
//
// The export is loaded with a dynamic import, the same way test/18 loads
// names that are not in the tree yet. A static import of a missing name
// fails the whole file at link time, so each item below would not get its
// own failure. Red is the expected result in this tree: items 1 to 6 fail
// because adminUserIdFromCookie is not exported, and item 7 fails because
// the two pages do not call it yet.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { freshDb } from './harness.js'
import { signAdminSession, verifyAdminSession, hashAdminPassword } from '../src/admin-auth.js'
import { revokeAdminSessions } from '../src/admin.js'
import { getEnv } from '../src/env.js'
import type { Db } from '../src/db.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const LOGIN_PAGE = path.join(REPO_ROOT, 'app', 'admin', 'login', 'page.tsx')
const ADMIN_LAYOUT = path.join(REPO_ROOT, 'app', 'admin', 'layout.tsx')

// One shared PGlite database, opened once and closed once, per test/18.
// Many PGlite instances in one process can exceed this container's memory.

type PgliteClient = Awaited<ReturnType<typeof freshDb>>['client']

type AdminUserIdFromCookie = (db: Db, raw: string | undefined) => Promise<string | null>

let sharedDb: Db
let sharedClient: PgliteClient

before(async () => {
  const ctx = await freshDb()
  sharedDb = ctx.db
  sharedClient = ctx.client
})

after(async () => {
  await sharedClient.close()
})

// Rows are inserted the way test/18 inserts them. disabled_at is written
// the way test/16 writes it: there is no disable helper in src/admin.ts,
// and getAdminUserById treats any non-null disabled_at as "no such admin".
async function insertAdminUser(
  client: PgliteClient,
  { username, password, disabled = false }: { username: string; password: string; disabled?: boolean },
): Promise<string> {
  const passwordHash = hashAdminPassword(password)
  const result = disabled
    ? await client.query<{ id: string }>(
        `insert into admin_users (username, password_hash, disabled_at) values ($1, $2, now()) returning id`,
        [username, passwordHash],
      )
    : await client.query<{ id: string }>(
        `insert into admin_users (username, password_hash) values ($1, $2) returning id`,
        [username, passwordHash],
      )
  return result.rows[0]!.id
}

// requireAdminUserId verifies through verifyAdminSessionCookieValue, which
// reads env.sessionSecret (getEnv(), cached on first use). This process
// often has no SESSION_SECRET. Fill the three required variables only when
// they are unset, then read back the secret the app will actually use, so
// a secret already in the environment is the one the tokens are signed with.
function appSessionSecret(): string {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim() === '') {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/confession'
  }
  if (process.env.SESSION_SECRET === undefined || process.env.SESSION_SECRET.trim() === '') {
    process.env.SESSION_SECRET = 'w'.repeat(32)
  }
  if (process.env.APP_ORIGIN === undefined || process.env.APP_ORIGIN.trim() === '') {
    process.env.APP_ORIGIN = 'http://localhost:3000'
  }
  return getEnv().sessionSecret
}

// signAdminSession stamps iat from Date.now() and takes no issued-at
// argument (src/session.ts signPayload). Pin Date.now for that one call so
// the token's own iat is the instant under test. Same signer as test/18.
function signAdminSessionIssuedAt(secret: string, adminUserId: string, issuedAtMs: number): string {
  const realNow = Date.now
  Date.now = () => issuedAtMs
  try {
    return signAdminSession(secret, { adminUserId })
  } finally {
    Date.now = realNow
  }
}

// The wire format test/18 item 1 decodes: base64url(JSON(payload+iat)).
function readTokenIssuedAtMs(token: string): number {
  const encodedBody = token.split('.')[0]
  assert.ok(encodedBody, 'a signed token has a body before the signature')
  const decoded = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8')) as { iat?: unknown }
  assert.equal(typeof decoded.iat, 'number', 'a signed token carries a numeric iat')
  return decoded.iat as number
}

async function loadAdminUserIdFromCookie(): Promise<AdminUserIdFromCookie> {
  const auth = await import('../app/admin/_lib/auth.js')
  const exported: unknown = auth.adminUserIdFromCookie
  assert.equal(
    typeof exported,
    'function',
    'app/admin/_lib/auth.ts must export adminUserIdFromCookie(db, raw): Promise<string | null> (spec section 1)',
  )
  return exported as AdminUserIdFromCookie
}

// Comments are dropped before the item 7 search. A line or block comment
// that names a function must not satisfy the "calls" check or trip the
// "does not name verifyAdminSessionCookieValue" check. Strings are copied
// through, so a "//" inside a URL or a quote is left alone. Same shape as
// the stripper in test/63-copy-contract.test.ts.
function stripComments(src: string): string {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const two = src.slice(i, i + 2)
    if (two === '//') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (two === '/*') {
      i += 2
      while (i < n && src.slice(i, i + 2) !== '*/') i++
      i += 2
      continue
    }
    const c = src[i]
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) {
          out += src[i]! + src[i + 1]!
          i += 2
          continue
        }
        out += src[i]!
        i++
      }
      if (i < n) {
        out += src[i]!
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

// ---------------------------------------------------------------------------
// Section 4. Items 1 to 6 go through adminUserIdFromCookie. Item 7 reads
// the two source files as text.
// ---------------------------------------------------------------------------

test('item 1: no cookie (undefined) returns null', async () => {
  const adminUserIdFromCookie = await loadAdminUserIdFromCookie()
  assert.equal(
    await adminUserIdFromCookie(sharedDb, undefined),
    null,
    'no cookie (undefined) must return null (spec section 4 item 1)',
  )
})

test('item 2: a value that is not a signed token, and a token signed with another secret, return null', async () => {
  const adminUserIdFromCookie = await loadAdminUserIdFromCookie()
  const secret = appSessionSecret()
  const id = await insertAdminUser(sharedClient, {
    username: 'item2-live-admin',
    password: 'pw-item2-live-admin',
  })

  const notAToken = 'not-a-signed-token'
  assert.equal(
    await adminUserIdFromCookie(sharedDb, notAToken),
    null,
    'a value that is not a signed token must return null (spec section 4 item 2)',
  )

  // Correct shape (signAdminSession), different secret. The id is a live
  // administrator, so a check that skipped the signature would return it.
  const otherSecret = `${secret}-other`
  assert.notEqual(otherSecret, secret, 'the other secret must differ from the secret the app uses')
  const wrongSecretToken = signAdminSession(otherSecret, { adminUserId: id })
  assert.ok(
    verifyAdminSession(otherSecret, wrongSecretToken),
    'the other-secret token must be a real signed token under that secret',
  )
  assert.equal(
    verifyAdminSession(secret, wrongSecretToken),
    null,
    'the other-secret token must not verify under the secret the app uses',
  )
  assert.equal(
    await adminUserIdFromCookie(sharedDb, wrongSecretToken),
    null,
    'a token signed with another secret must return null (spec section 4 item 2)',
  )
})

test('item 3: a valid token for a live administrator returns that administrator\'s id', async () => {
  const adminUserIdFromCookie = await loadAdminUserIdFromCookie()
  const secret = appSessionSecret()
  const id = await insertAdminUser(sharedClient, {
    username: 'item3-live-admin',
    password: 'pw-item3-live-admin',
  })
  const token = signAdminSession(secret, { adminUserId: id })
  assert.equal(
    await adminUserIdFromCookie(sharedDb, token),
    id,
    'a valid token for a live administrator must return that administrator\'s id (spec section 4 item 3)',
  )
})

test('item 4: a token issued at logged_out_before returns null, and so does one issued before it; one issued after it returns the id', async () => {
  const adminUserIdFromCookie = await loadAdminUserIdFromCookie()
  const secret = appSessionSecret()
  const id = await insertAdminUser(sharedClient, {
    username: 'item4-revoked-admin',
    password: 'pw-item4-revoked-admin',
  })

  // All three iats sit inside the eight-hour admin session window and not
  // in the future, so a rejection is the revocation check and not expiry.
  // One logged_out_before, three tokens: before it, exactly at it, after it.
  const now = Date.now()
  const loggedOutBefore = new Date(now - 10_000)
  const issuedBefore = loggedOutBefore.getTime() - 1000
  const issuedAt = loggedOutBefore.getTime()
  const issuedAfter = loggedOutBefore.getTime() + 1000
  assert.ok(issuedAfter < now, 'the after-token iat must not be in the future')

  await revokeAdminSessions(sharedDb, { adminUserId: id, at: loggedOutBefore })

  const { rows } = await sharedClient.query<{ logged_out_before: string }>(
    `select logged_out_before from admin_users where id = $1`,
    [id],
  )
  assert.equal(
    new Date(rows[0]!.logged_out_before).getTime(),
    loggedOutBefore.getTime(),
    'logged_out_before must be the instant passed to revokeAdminSessions',
  )

  const beforeToken = signAdminSessionIssuedAt(secret, id, issuedBefore)
  const atToken = signAdminSessionIssuedAt(secret, id, issuedAt)
  const afterToken = signAdminSessionIssuedAt(secret, id, issuedAfter)
  assert.equal(readTokenIssuedAtMs(beforeToken), issuedBefore)
  assert.equal(readTokenIssuedAtMs(atToken), issuedAt)
  assert.equal(readTokenIssuedAtMs(afterToken), issuedAfter)

  assert.equal(
    await adminUserIdFromCookie(sharedDb, beforeToken),
    null,
    'a token issued before logged_out_before must return null (spec section 4 item 4)',
  )
  assert.equal(
    await adminUserIdFromCookie(sharedDb, atToken),
    null,
    'a token issued at logged_out_before must return null (spec section 4 item 4, the <=)',
  )
  assert.equal(
    await adminUserIdFromCookie(sharedDb, afterToken),
    id,
    'a token issued after logged_out_before must return the id (spec section 4 item 4)',
  )
})

test('item 5: a valid token for a disabled administrator returns null', async () => {
  const adminUserIdFromCookie = await loadAdminUserIdFromCookie()
  const secret = appSessionSecret()
  const id = await insertAdminUser(sharedClient, {
    username: 'item5-disabled-admin',
    password: 'pw-item5-disabled-admin',
    disabled: true,
  })
  const token = signAdminSession(secret, { adminUserId: id })
  assert.ok(
    verifyAdminSession(secret, token),
    'the token itself must be valid; the null comes from disabled_at, not from the signature',
  )
  assert.equal(
    await adminUserIdFromCookie(sharedDb, token),
    null,
    'a valid token for a disabled administrator must return null (spec section 4 item 5)',
  )
})

test('item 6: a valid token naming an id with no admin_users row returns null', async () => {
  const adminUserIdFromCookie = await loadAdminUserIdFromCookie()
  const secret = appSessionSecret()
  const missingId = randomUUID()
  const existing = await sharedClient.query<{ id: string }>(
    `select id from admin_users where id = $1`,
    [missingId],
  )
  assert.equal(existing.rows.length, 0, 'the id under test must have no admin_users row')
  const token = signAdminSession(secret, { adminUserId: missingId })
  assert.ok(verifyAdminSession(secret, token), 'the token itself must be valid')
  assert.equal(
    await adminUserIdFromCookie(sharedDb, token),
    null,
    'a valid token naming an id with no admin_users row must return null (spec section 4 item 6)',
  )
})

test('item 7: login page and admin layout each call adminUserIdFromCookie and neither contains verifyAdminSessionCookieValue', () => {
  for (const file of [LOGIN_PAGE, ADMIN_LAYOUT]) {
    const stripped = stripComments(readFileSync(file, 'utf8'))
    const rel = path.relative(REPO_ROOT, file)
    assert.match(
      stripped,
      /\badminUserIdFromCookie\s*\(/,
      `${rel} must call adminUserIdFromCookie (spec section 4 item 7)`,
    )
    assert.doesNotMatch(
      stripped,
      /\bverifyAdminSessionCookieValue\b/,
      `${rel} must not contain verifyAdminSessionCookieValue (spec section 4 item 7)`,
    )
  }
})
