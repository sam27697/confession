// test/16-admin-surface.test.ts
//
// Written from docs/SPEC-week7-admin.md sections 1, 3, 4, 6, not from
// src/admin.ts, src/admin-auth.ts, src/admin-throttle.ts, drizzle/0002_admin.sql
// or anything under app/admin/. Every expected column name, constant and
// masking rule below is transcribed by hand from the spec.
//
// This file covers the database and surface half of section 6: items 1, 2,
// 3, 8, 9, 12, 13, 14, 15, 16, 17, 19, 20. The pure/crypto/env/throttle half
// (items 4, 5, 6, 7, 10, 11, 18) is test/15-admin-auth.test.ts.
//
// admin_users and the admin_user_id column on admin_reveal_log have no
// drizzle table object in src/schema.ts (that file is unmodified by this
// slice, per the spec's own §1: the migration is hand-written SQL). So the
// tests below that touch those columns go through the raw PGlite client
// (freshDb().client), exactly the way test/01-migration.test.ts and
// test/02-tripwire-columns.test.ts already read the schema without a
// drizzle table object for it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { freshDb } from './harness.js'
import { createAccount, createLink, createConfession } from './fixtures.js'
import { confessions } from '../src/schema.js'
import { getAdminInboxPage } from '../src/views.js'
import { adminReveal, adminRevealByAdminUser, reportConfession } from '../src/actions.js'
import { authenticateAdmin, getAdminUserById, getAdminReports } from '../src/admin.js'
import { hashAdminPassword } from '../src/admin-auth.js'
import { loadEnv } from '../src/env.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Small helper: inserts an admin_users row directly, since there is no
// drizzle table object for it available to this file. Returns the new row's
// id. password_hash defaults to a real scrypt hash so authentication tests
// can log in with a known plaintext.
async function insertAdminUser(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ id: string }> }> },
  { username, password, disabled = false }: { username: string; password: string; disabled?: boolean },
): Promise<string> {
  const passwordHash = hashAdminPassword(password)
  const rows = disabled
    ? await client.query(
        `insert into admin_users (username, password_hash, disabled_at) values ($1, $2, now()) returning id`,
        [username, passwordHash],
      )
    : await client.query(`insert into admin_users (username, password_hash) values ($1, $2) returning id`, [
        username,
        passwordHash,
      ])
  return rows.rows[0]!.id
}

// ---------------------------------------------------------------------------
// item 1: the migration itself (spec §1)
// ---------------------------------------------------------------------------

test('7.6.1 0002_admin.sql applies to a fresh database: admin_users exists, admin_reveal_log gains admin_user_id, and admin_account_id becomes nullable', async () => {
  const { client, migrations } = await freshDb()

  assert.ok(
    migrations.some((f) => /admin/i.test(f)),
    'expected a migration file for the admin slice among ' + JSON.stringify(migrations),
  )

  const tables = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  )
  assert.ok(
    tables.rows.some((r) => r.table_name === 'admin_users'),
    'admin_users must exist after migration',
  )

  const cols = await client.query<{ column_name: string; is_nullable: string }>(
    `select column_name, is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = 'admin_reveal_log'`,
  )
  const byName = new Map(cols.rows.map((r) => [r.column_name, r.is_nullable]))
  assert.ok(byName.has('admin_user_id'), 'admin_reveal_log must gain an admin_user_id column')
  assert.equal(byName.get('admin_account_id'), 'YES', 'admin_account_id must become nullable')

  await client.close()
})

// ---------------------------------------------------------------------------
// item 2: the exactly-one-actor CHECK (spec §1.2)
// ---------------------------------------------------------------------------

test('7.6.2 admin_reveal_log_exactly_one_actor: a row with both actors null is rejected, a row with both actors set is rejected, and each single-actor row is accepted', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const adminAccount = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })
  const adminUserId = await insertAdminUser(client, { username: 'exactly-one', password: 'pw-exactly-one' })

  await assert.rejects(
    () =>
      client.query(
        `insert into admin_reveal_log (admin_account_id, admin_user_id, confession_id, reason)
         values (null, null, $1, 'a valid reason here')`,
        [confession.id],
      ),
    'both actors null must be rejected',
  )

  await assert.rejects(
    () =>
      client.query(
        `insert into admin_reveal_log (admin_account_id, admin_user_id, confession_id, reason)
         values ($1, $2, $3, 'a valid reason here')`,
        [adminAccount.id, adminUserId, confession.id],
      ),
    'both actors set must be rejected',
  )

  await client.query(
    `insert into admin_reveal_log (admin_account_id, admin_user_id, confession_id, reason)
     values ($1, null, $2, 'account actor only')`,
    [adminAccount.id, confession.id],
  )

  await client.query(
    `insert into admin_reveal_log (admin_account_id, admin_user_id, confession_id, reason)
     values (null, $1, $2, 'admin user actor only')`,
    [adminUserId, confession.id],
  )

  const rows = await client.query<{ c: number }>(`select count(*)::int as c from admin_reveal_log`)
  assert.equal(rows.rows[0]!.c, 2, 'exactly the two single-actor rows must have been written')

  await client.close()
})

// ---------------------------------------------------------------------------
// item 3: admin_users CHECKs (spec §1)
// ---------------------------------------------------------------------------

test('7.6.3 admin_users CHECK constraints: a two-character username is rejected, and a password_hash not beginning scrypt$ is rejected', async () => {
  const { client } = await freshDb()

  await assert.rejects(
    () => client.query(`insert into admin_users (username, password_hash) values ('ab', 'scrypt$16384$8$1$aaaa$bbbb')`),
    'a username shorter than 3 characters (after btrim) must be rejected',
  )

  await assert.rejects(
    () => client.query(`insert into admin_users (username, password_hash) values ('validusername', 'bcrypt$not-scrypt')`),
    'a password_hash not beginning scrypt$ must be rejected',
  )

  await client.close()
})

// ---------------------------------------------------------------------------
// item 8: authenticateAdmin does not distinguish (spec §2.3)
// ---------------------------------------------------------------------------

test('7.6.8 authenticateAdmin returns null for an unknown username, a wrong password, and a disabled account alike, and returns the AdminUser only for a correct login on a live account', async () => {
  const { db, client } = await freshDb()
  await insertAdminUser(client, { username: 'liveadmin', password: 'correct horse battery staple' })
  await insertAdminUser(client, { username: 'disabledadmin', password: 'another good password', disabled: true })

  assert.equal(
    await authenticateAdmin(db, { username: 'no-such-admin-at-all', password: 'whatever' }),
    null,
    'an unknown username must return null',
  )
  assert.equal(
    await authenticateAdmin(db, { username: 'liveadmin', password: 'the wrong password' }),
    null,
    'a wrong password on a known username must return null',
  )
  assert.equal(
    await authenticateAdmin(db, { username: 'disabledadmin', password: 'another good password' }),
    null,
    'the correct password on a disabled_at row must still return null',
  )

  const result = await authenticateAdmin(db, { username: 'liveadmin', password: 'correct horse battery staple' })
  assert.ok(result, 'the correct password on a live row must succeed')
  assert.equal(result?.username, 'liveadmin')
  assert.equal(result?.disabledAt, null)

  await client.close()
})

// ---------------------------------------------------------------------------
// item 9: getAdminUserById refuses a disabled admin (spec §2.3)
// ---------------------------------------------------------------------------

test('7.6.9 getAdminUserById returns null for a disabled admin, so an issued cookie dies with the account, and returns the row for a live one', async () => {
  const { db, client } = await freshDb()
  const disabledId = await insertAdminUser(client, { username: 'gonesoon', password: 'pw-gonesoon', disabled: true })
  const liveId = await insertAdminUser(client, { username: 'stillhere', password: 'pw-stillhere' })

  assert.equal(await getAdminUserById(db, { adminUserId: disabledId }), null)

  const live = await getAdminUserById(db, { adminUserId: liveId })
  assert.ok(live)
  assert.equal(live?.id, liveId)
  assert.equal(live?.username, 'stillhere')
  assert.equal(live?.disabledAt, null)

  await client.close()
})

// ---------------------------------------------------------------------------
// item 12: getAdminInboxPage masks (spec §3.2, §4.1)
// ---------------------------------------------------------------------------

test('7.6.12 getAdminInboxPage masks the sender in the serialised string, not merely in a key, orders newest first, and respects limit', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db, { displayName: 'Masked Sender Display Name' })
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)

  // createdHour is the only timestamp this row carries (spec §4.5), so it
  // is the only field "newest first" can mean. Fixed two hours apart so
  // ordering is deterministic regardless of when the test happens to run.
  const [older] = await db
    .insert(confessions)
    .values({
      linkId: link.id,
      senderAccountId: sender.id,
      body: 'older confession',
      createdHour: sql`date_trunc('hour', now()) - interval '2 hours'`,
    })
    .returning({ id: confessions.id })

  const [newer] = await db
    .insert(confessions)
    .values({
      linkId: link.id,
      senderAccountId: sender.id,
      body: 'newer confession',
      createdHour: sql`date_trunc('hour', now())`,
    })
    .returning({ id: confessions.id })

  const page = await getAdminInboxPage(db, { limit: 50, offset: 0 })
  assert.equal(page.length, 2)
  assert.equal(page[0]!.id, newer!.id, 'newest first')
  assert.equal(page[1]!.id, older!.id)
  for (const row of page) assert.equal(row.senderMasked, true)

  const limited = await getAdminInboxPage(db, { limit: 1, offset: 0 })
  assert.equal(limited.length, 1, 'limit must be respected')
  assert.equal(limited[0]!.id, newer!.id)

  const offsetPage = await getAdminInboxPage(db, { limit: 1, offset: 1 })
  assert.equal(offsetPage.length, 1)
  assert.equal(offsetPage[0]!.id, older!.id)

  const json = JSON.stringify(page)
  assert.ok(!json.includes(sender.id), 'the sender account id must not appear anywhere in the serialised string')
  assert.ok(!json.includes(sender.displayName), 'the sender display name must not appear anywhere in the serialised string')

  await client.close()
})

// ---------------------------------------------------------------------------
// item 13: getAdminReports masks both sides (spec §3.4, §4.1)
// ---------------------------------------------------------------------------

test('7.6.13 getAdminReports masks both the sender and the reporter in the serialised string, while the report reason and confession body remain present', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db, { displayName: 'Report Sender Display Name' })
  const recipient = await createAccount(db) // the recipient is also the reporter: only the link owner may report
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, {
    linkId: link.id,
    senderAccountId: sender.id,
    body: 'a reportable confession body',
  })

  await reportConfession(db, {
    reporterAccountId: recipient.id,
    confessionId: confession.id,
    reason: 'reported for harassment',
  })

  const reportRows = await getAdminReports(db, { limit: 50 })
  assert.equal(reportRows.length, 1)
  assert.equal(reportRows[0]!.senderMasked, true)
  assert.equal(reportRows[0]!.reason, 'reported for harassment')
  assert.equal(reportRows[0]!.body, 'a reportable confession body')
  assert.equal(reportRows[0]!.confessionId, confession.id)

  const json = JSON.stringify(reportRows)
  assert.ok(!json.includes(sender.id), "the sender's account id must not appear")
  assert.ok(!json.includes(sender.displayName), "the sender's display name must not appear")
  assert.ok(!json.includes(recipient.id), "the reporter's account id must not appear")

  await client.close()
})

// ---------------------------------------------------------------------------
// item 14: adminRevealByAdminUser writes exactly one audit row per call (spec §3.3, §4.3)
// ---------------------------------------------------------------------------

test('7.6.14 adminRevealByAdminUser writes exactly one audit row per call with the given admin_user_id and a null admin_account_id, returns the sender identity, and a second call writes a second row', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db, { displayName: 'Reveal Target Display Name' })
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })
  const adminUserId = await insertAdminUser(client, { username: 'revealer', password: 'pw-revealer' })

  const result = await adminRevealByAdminUser(db, {
    adminUserId,
    confessionId: confession.id,
    reason: 'reported by another user, checking',
  })
  assert.equal(result.senderAccountId, sender.id)
  assert.equal(result.senderDisplayName, sender.displayName)
  assert.equal(result.confessionId, confession.id)

  const rows = await client.query<{ admin_user_id: string; admin_account_id: string | null; reason: string }>(
    `select admin_user_id, admin_account_id, reason from admin_reveal_log where confession_id = $1`,
    [confession.id],
  )
  assert.equal(rows.rows.length, 1)
  assert.equal(rows.rows[0]!.admin_user_id, adminUserId)
  assert.equal(rows.rows[0]!.admin_account_id, null)
  assert.equal(rows.rows[0]!.reason, 'reported by another user, checking')

  await adminRevealByAdminUser(db, { adminUserId, confessionId: confession.id, reason: 'a second, later look' })
  const rowsAfter = await client.query<{ c: number }>(
    `select count(*)::int as c from admin_reveal_log where confession_id = $1`,
    [confession.id],
  )
  assert.equal(rowsAfter.rows[0]!.c, 2, 'a second reveal call must write a second audit row, not update the first')

  await client.close()
})

// ---------------------------------------------------------------------------
// item 15: a reveal that cannot be recorded does not happen (spec §4.3)
// ---------------------------------------------------------------------------

test('7.6.15 adminRevealByAdminUser: a blank or seven-character reason rejects at the database, the call raises, and no identity is returned or row written', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })
  const adminUserId = await insertAdminUser(client, { username: 'rejecter', password: 'pw-rejecter' })

  for (const badReason of ['', '       ', '1234567']) {
    await assert.rejects(
      () => adminRevealByAdminUser(db, { adminUserId, confessionId: confession.id, reason: badReason }),
      `reason ${JSON.stringify(badReason)} must be rejected`,
    )
  }

  const rows = await client.query<{ c: number }>(`select count(*)::int as c from admin_reveal_log`)
  assert.equal(rows.rows[0]!.c, 0, 'a rejected reveal must write no audit row at all')

  await client.close()
})

// ---------------------------------------------------------------------------
// item 16: the existing adminReveal still works unchanged (spec §3.3)
// ---------------------------------------------------------------------------

test('7.6.16 the existing adminReveal still writes admin_account_id with a null admin_user_id: the retained account-based path of §3.3', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const adminAccount = await createAccount(db)
  const link = await createLink(db, recipient.id)
  const confession = await createConfession(db, { linkId: link.id, senderAccountId: sender.id })

  const revealed = await adminReveal(db, {
    adminAccountId: adminAccount.id,
    confessionId: confession.id,
    reason: 'legacy account-based reveal path',
  })
  assert.equal(revealed.senderAccountId, sender.id)

  const rows = await client.query<{ admin_account_id: string; admin_user_id: string | null }>(
    `select admin_account_id, admin_user_id from admin_reveal_log where confession_id = $1`,
    [confession.id],
  )
  assert.equal(rows.rows.length, 1)
  assert.equal(rows.rows[0]!.admin_account_id, adminAccount.id)
  assert.equal(rows.rows[0]!.admin_user_id, null)

  await client.close()
})

// ---------------------------------------------------------------------------
// item 17: created_hour is what the admin sees (spec §4.5)
// ---------------------------------------------------------------------------

test('7.6.17 the createdHour value returned by getAdminInboxPage is truncated to the hour, with no more precise timestamp available', async () => {
  const { db, client } = await freshDb()
  const sender = await createAccount(db)
  const recipient = await createAccount(db)
  const link = await createLink(db, recipient.id)
  await createConfession(db, { linkId: link.id, senderAccountId: sender.id })

  const page = await getAdminInboxPage(db, { limit: 50, offset: 0 })
  assert.equal(page.length, 1)
  const createdHour = new Date(page[0]!.createdHour)
  assert.equal(createdHour.getUTCMinutes(), 0, 'minutes must be truncated to zero')
  assert.equal(createdHour.getUTCSeconds(), 0, 'seconds must be truncated to zero')
  assert.equal(createdHour.getUTCMilliseconds(), 0, 'milliseconds must be truncated to zero')

  await client.close()
})

// ---------------------------------------------------------------------------
// item 19: no request-metadata reads under app/admin/ (spec §4.4)
// ---------------------------------------------------------------------------

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

test('7.6.19 no file under app/admin/ references x-forwarded-for, user-agent, referer or request.ip, calls headers(), or touches a cookie key other than admin_sid', () => {
  const adminDir = path.join(REPO_ROOT, 'app', 'admin')

  // The point of this test is to be loud rather than vacuous: if app/admin/
  // does not exist yet, that is not "nothing to check", it is a failure to
  // report, per the task's own instruction that a passing test over an
  // empty glob is the defect this project reviews for.
  assert.ok(
    existsSync(adminDir) && statSync(adminDir).isDirectory(),
    'app/admin/ does not exist yet: this must fail loudly rather than pass vacuously on an empty glob (spec §6 item 19)',
  )

  const files = listSourceFiles(adminDir)
  assert.ok(files.length > 0, 'app/admin/ exists but contains no .ts/.tsx source files: nothing to check is itself a failure here')

  const FORBIDDEN_METADATA = /x-forwarded-for|user-agent|referer|request\.ip/i

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const rel = path.relative(REPO_ROOT, file)

    assert.ok(
      !FORBIDDEN_METADATA.test(content),
      `${rel} references forbidden request metadata (x-forwarded-for / user-agent / referer / request.ip), forbidden on any admin path by spec §4.4`,
    )

    // headers() reads the raw request headers, which admin_sid never needs:
    // it is a cookie, read through cookies(). There is no legitimate call
    // to headers() anywhere under app/admin/.
    assert.ok(!/\bheaders\s*\(\s*\)/.test(content), `${rel} calls headers(), which spec §4.4 forbids on every admin path`)

    // Every cookie store operation chained directly off cookies() must name
    // admin_sid and nothing else. This is a best-effort static check: it
    // catches the common inline pattern cookies().get('name') but not a
    // cookie store first assigned to a variable and used two lines later,
    // which a source-level regex cannot follow reliably.
    const cookieCalls = [...content.matchAll(/cookies\(\)\s*\.\s*(get|set|delete)\(\s*['"]([^'"]+)['"]/g)]
    for (const match of cookieCalls) {
      assert.equal(
        match[2],
        'admin_sid',
        `${rel} touches cookie key "${match[2]}" via cookies(), but the only cookie an admin path may read or write is admin_sid (spec §4.4)`,
      )
    }
  }
})

// ---------------------------------------------------------------------------
// item 20: /admin is 404 when admin is disabled (spec §3.0)
// ---------------------------------------------------------------------------

const KILL_SWITCH_ENV_BASE: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/confession',
  SESSION_SECRET: 'z'.repeat(32),
  APP_ORIGIN: 'https://stg.confession.fayad.app',
}

test('7.6.20 env.adminEnabled, the guard every /admin route is specified to check, is false with no bootstrap username configured and true once one is', () => {
  // This is the level a suite that never opens app/admin/ can reach (spec
  // §6 item 20's own wording: "asserted at the level the tests can reach").
  // It does not boot the app, does not send an HTTP request, and cannot by
  // itself prove that every route under app/admin/ actually branches on
  // this flag before rendering anything: spec §3.0 and §5 name that proof
  // as external, over the real certificate, carried in the deploy run
  // report rather than in this suite.
  const disabled = loadEnv(KILL_SWITCH_ENV_BASE)
  assert.equal(
    disabled.adminEnabled,
    false,
    'with no ADMIN_BOOTSTRAP_USERNAME configured, adminEnabled must be false, and every /admin route must answer 404, not a login page (spec §3.0)',
  )

  const validHash = hashAdminPassword('a bootstrap password for the kill switch test')
  const enabled = loadEnv({
    ...KILL_SWITCH_ENV_BASE,
    ADMIN_BOOTSTRAP_USERNAME: 'siteadmin',
    ADMIN_BOOTSTRAP_PASSWORD_HASH: validHash,
  })
  assert.equal(enabled.adminEnabled, true, 'with a bootstrap username and a well-formed hash configured, adminEnabled must be true')
})
