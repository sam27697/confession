// test/19-account-deletion.test.ts
//
// Written from docs/SPEC-week10-account-deletion.md section 6 alone, by an
// agent that has not read and must not read src/account-deletion.ts,
// drizzle/0004_account_deletion.sql or app/account/** -- the implementation
// of this same slice, being written in parallel in a different worktree.
// Red is the expected and correct result for most items in this file today.
//
// Several items name functions/exports that do not exist yet in this tree:
// deleteAccount (src/account-deletion.ts), AccountNotFoundError and
// AccountAlreadyDeletedError (src/errors.ts), requireActiveViewerAccountId
// and its pure decision predicate (app/_lib/auth.ts). A static
// `import { name } from './mod.js'` for a name that is not yet an export
// throws a SyntaxError at module link time and would crash this entire
// file. So, following the pattern already used in
// test/18-admin-hardening.test.ts, every such lookup is a dynamic
// `await import(...)` read off the returned module object.
//
// One PGlite instance is shared across every item that needs a database
// (opened in `before`, closed in `after`), per the project's own note that
// many PGlite instances in one process can exceed this container's memory
// limit (see test/18-admin-hardening.test.ts).
//
// A recurring hazard in this file: migration drizzle/0004_account_deletion.sql
// does not exist in THIS worktree, so accounts.deleted_at and links.deleted_at
// do not exist as columns here. Any raw SQL statement that references them
// will therefore throw "column does not exist" (Postgres code 42703) -- a
// real rejection, but the WRONG one: it would make an `assert.rejects()`
// aimed at a CHECK constraint or a trigger pass for a reason that has
// nothing to do with the constraint under test, i.e. a false green. Every
// constraint-style assertion below therefore uses a validator callback that
// positively rules out 42703 (undefined_column) and 42P01 (undefined_table),
// and for CHECK-constraint items additionally requires the Postgres CHECK
// violation code 23514, so a red result here is always attributable to the
// feature being genuinely absent, never to a typo in this file.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { freshDb } from './harness.js'
import { createAccount, createLink, createConfession } from './fixtures.js'
import { accounts, links, confessions, adminUsers } from '../src/schema.js'
import { findAccountByProvider, getAccountById, createAccountWithTerms } from '../src/accounts.js'
import { getLinkBySlug } from '../src/links.js'
import { sendConfession, adminRevealByAdminUser } from '../src/actions.js'
import { TERMS_VERSION, TERMS_TEXT_AR, TERMS_TEXT_EN } from '../src/terms.js'
import { hashAdminPassword } from '../src/admin-auth.js'
import type { Db } from '../src/db.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

type Ctx = Awaited<ReturnType<typeof freshDb>>
type PgliteClient = Ctx['client']

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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Applies the exact tombstone recipe of spec §2.2/§2.3 directly, by raw SQL,
// so that items 9, 10 and 18-23 (which are about the CONSEQUENCES of a row
// being tombstoned) can be tested without depending on deleteAccount itself
// existing -- deleteAccount's own contract is items 11-17, tested separately.
async function rawTombstoneAccount(client: PgliteClient, accountId: string): Promise<void> {
  await client.query(
    `update accounts
       set deleted_at = now(),
           disabled_at = coalesce(disabled_at, now()),
           display_name = '[deleted]',
           provider_user_id = 'deleted:' || id::text
     where id = $1`,
    [accountId],
  )
}

async function rawTombstoneLink(client: PgliteClient, linkId: string): Promise<void> {
  await client.query(`update links set enabled = false, deleted_at = now() where id = $1`, [linkId])
}

function pgErrorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined
}

// Validator for assert.rejects: rules out the row failing because the
// migration simply has not been applied in this tree (42703/42P01), which
// would otherwise make a constraint test pass for the wrong reason.
function notMissingSchemaError(err: unknown): boolean {
  const code = pgErrorCode(err)
  assert.notEqual(code, '42703', `expected a constraint/trigger violation, got an undefined-column error (migration 0004 not applied here): ${String(err)}`)
  assert.notEqual(code, '42P01', `expected a constraint/trigger violation, got an undefined-relation error (migration 0004 not applied here): ${String(err)}`)
  return true
}

// Stronger validator for the two CHECK constraints (spec §2.4 items 1-2):
// Postgres reports every CHECK violation as SQLSTATE 23514, regardless of
// the constraint's name, so this pins the failure to the right class.
function isCheckViolation(err: unknown): boolean {
  notMissingSchemaError(err)
  assert.equal(pgErrorCode(err), '23514', `expected a CHECK violation (23514), got: ${String(err)}`)
  return true
}

// Rules out a trigger-raised rejection being mistaken for the pre-existing
// FK defect spec §0 measured (23503) -- relevant to items 6-10, where a
// dependent row could in principle make a plain FK violation look like the
// new trigger firing.
function isTriggerRejectionNotFkOrMissingSchema(err: unknown): boolean {
  notMissingSchemaError(err)
  assert.notEqual(pgErrorCode(err), '23503', `expected the new trigger to raise, got the pre-existing FK violation instead: ${String(err)}`)
  return true
}

async function fetchAccountRaw(client: PgliteClient, accountId: string) {
  const { rows } = await client.query<{
    provider_user_id: string
    display_name: string
    deleted_at: string | null
    disabled_at: string | null
  }>(`select provider_user_id, display_name, deleted_at, disabled_at from accounts where id = $1`, [accountId])
  return rows[0] ?? null
}

async function insertAdminUser(db: Db, username: string): Promise<string> {
  const passwordHash = hashAdminPassword('a password long enough for scrypt in item 20 of week 10')
  const [row] = await db.insert(adminUsers).values({ username, passwordHash }).returning({ id: adminUsers.id })
  return row.id
}

async function loadDeleteAccount(): Promise<
  ((db: Db, args: { accountId: string }) => Promise<void>) | undefined
> {
  const mod = (await import('../src/account-deletion.js').catch(() => ({}))) as unknown as {
    deleteAccount?: (db: Db, args: { accountId: string }) => Promise<void>
  }
  return mod.deleteAccount
}

async function loadDeletionErrors(): Promise<{ AccountNotFoundError?: unknown; AccountAlreadyDeletedError?: unknown }> {
  const mod = (await import('../src/errors.js')) as unknown as {
    AccountNotFoundError?: unknown
    AccountAlreadyDeletedError?: unknown
  }
  return { AccountNotFoundError: mod.AccountNotFoundError, AccountAlreadyDeletedError: mod.AccountAlreadyDeletedError }
}

// =============================================================================
// Schema and constraints -- items 1 through 10
// =============================================================================

test('item 1: accounts.deleted_at and links.deleted_at exist, are timestamptz, nullable (spec section 6 item 1)', async () => {
  const { rows } = await sharedClient.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
    `select table_name, column_name, data_type, is_nullable
       from information_schema.columns
      where table_schema = 'public'
        and ((table_name = 'accounts' and column_name = 'deleted_at')
          or (table_name = 'links' and column_name = 'deleted_at'))`,
  )
  const byTable = new Map(rows.map((r) => [r.table_name, r]))

  const accountsCol = byTable.get('accounts')
  assert.ok(accountsCol, 'accounts.deleted_at must exist (spec section 2.1)')
  assert.equal(accountsCol!.data_type, 'timestamp with time zone', 'accounts.deleted_at must be timestamptz')
  assert.equal(accountsCol!.is_nullable, 'YES', 'accounts.deleted_at must be nullable')

  const linksCol = byTable.get('links')
  assert.ok(linksCol, 'links.deleted_at must exist (spec section 2.1)')
  assert.equal(linksCol!.data_type, 'timestamp with time zone', 'links.deleted_at must be timestamptz')
  assert.equal(linksCol!.is_nullable, 'YES', 'links.deleted_at must be nullable')
})

test('item 2: test/02-tripwire-columns.test.ts still passes after the 0004 migration exists (spec section 6 item 2)', async () => {
  const { spawnSync } = await import('node:child_process')
  const tripwireTest = path.resolve(REPO_ROOT, 'test', '02-tripwire-columns.test.ts')
  const result = spawnSync('node', ['--import', 'tsx', '--test', tripwireTest], { encoding: 'utf8', cwd: REPO_ROOT })
  assert.equal(
    result.status,
    0,
    `test/02-tripwire-columns.test.ts must still pass -- no banned column was added by the deletion slice. ` +
      `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
})

test('item 3: the accounts CHECK rejects setting deleted_at while leaving display_name unchanged (spec section 6 item 3)', async () => {
  const { id } = await createAccount(sharedDb, { displayName: 'item3 real name' })
  await assert.rejects(
    sharedClient.query(`update accounts set deleted_at = now() where id = $1`, [id]),
    isCheckViolation,
    'accounts_deleted_tombstone_check must reject deleted_at set with display_name still real (spec section 2.4 item 1)',
  )
})

test('item 4: the accounts CHECK rejects setting deleted_at while leaving provider_user_id unchanged (spec section 6 item 4)', async () => {
  const { id } = await createAccount(sharedDb, { displayName: 'item4 real name' })
  await assert.rejects(
    sharedClient.query(`update accounts set deleted_at = now(), display_name = '[deleted]' where id = $1`, [id]),
    isCheckViolation,
    'accounts_deleted_tombstone_check must reject deleted_at set with provider_user_id still the real one (spec section 2.4 item 1)',
  )
})

test('item 5: the links CHECK rejects a row with deleted_at set and enabled = true (spec section 6 item 5)', async () => {
  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item5 owner' })
  const { id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })
  await assert.rejects(
    sharedClient.query(`update links set deleted_at = now() where id = $1`, [linkId]),
    isCheckViolation,
    'links_deleted_not_enabled_check must reject deleted_at set while enabled stays true (spec section 2.4 item 2)',
  )
})

test('item 6: UPDATE on an already-deleted accounts row raises (spec section 6 item 6)', async () => {
  const { id } = await createAccount(sharedDb, { displayName: 'item6 real name' })
  await rawTombstoneAccount(sharedClient, id)

  await assert.rejects(
    sharedClient.query(`update accounts set disabled_at = now() where id = $1`, [id]),
    isTriggerRejectionNotFkOrMissingSchema,
    'accounts_tombstone_is_final must raise on any UPDATE of an already-deleted accounts row (spec section 2.4 item 3)',
  )
})

test('item 7: DELETE on any accounts row raises, deleted or not (spec section 6 item 7)', async () => {
  const { id: freshId } = await createAccount(sharedDb, { displayName: 'item7 fresh' })
  await assert.rejects(
    sharedClient.query(`delete from accounts where id = $1`, [freshId]),
    isTriggerRejectionNotFkOrMissingSchema,
    'accounts_never_deleted must raise on DELETE of a live accounts row (spec section 2.4 item 4)',
  )

  const { id: deletedId } = await createAccount(sharedDb, { displayName: 'item7 deleted' })
  await rawTombstoneAccount(sharedClient, deletedId)
  await assert.rejects(
    sharedClient.query(`delete from accounts where id = $1`, [deletedId]),
    isTriggerRejectionNotFkOrMissingSchema,
    'accounts_never_deleted must raise on DELETE of an already-deleted accounts row too (spec section 2.4 item 4)',
  )
})

test('item 8: UPDATE on an already-deleted links row raises, including one that only sets enabled = true (spec section 6 item 8)', async () => {
  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item8 owner' })
  const { id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })
  await rawTombstoneLink(sharedClient, linkId)

  await assert.rejects(
    sharedClient.query(`update links set enabled = true where id = $1`, [linkId]),
    isTriggerRejectionNotFkOrMissingSchema,
    'links_tombstone_is_final must raise on any UPDATE of an already-deleted links row, including re-enabling it (spec section 2.4 item 5)',
  )
})

test('item 9: INSERT into confessions with a deleted sender raises (spec section 6 item 9)', async () => {
  const { id: senderId } = await createAccount(sharedDb, { displayName: 'item9 sender' })
  await rawTombstoneAccount(sharedClient, senderId)

  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item9 owner' })
  const { id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })

  await assert.rejects(
    createConfession(sharedDb, { linkId, senderAccountId: senderId }),
    isTriggerRejectionNotFkOrMissingSchema,
    'confessions_sender_not_deleted must raise when the sender account is deleted (spec section 2.4 item 6)',
  )
})

test('item 10: INSERT into confessions targeting a deleted link raises (spec section 6 item 10)', async () => {
  const { id: senderId } = await createAccount(sharedDb, { displayName: 'item10 sender' })

  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item10 owner' })
  const { id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })
  await rawTombstoneLink(sharedClient, linkId)

  await assert.rejects(
    createConfession(sharedDb, { linkId, senderAccountId: senderId }),
    isTriggerRejectionNotFkOrMissingSchema,
    'confessions_sender_not_deleted must raise when the target link is deleted (spec section 2.4 item 6)',
  )
})

// =============================================================================
// Domain -- items 11 through 23
// =============================================================================

test('item 11: deleteAccount sets all four account fields of section 2.2 in one transaction (spec section 6 item 11)', async () => {
  const deleteAccount = await loadDeleteAccount()
  assert.equal(typeof deleteAccount, 'function', 'src/account-deletion.ts must export deleteAccount(db, { accountId })')

  const { id } = await createAccount(sharedDb, { displayName: 'item11 real name', providerUserId: 'item11-fb-id' })
  await deleteAccount!(sharedDb, { accountId: id })

  const row = await fetchAccountRaw(sharedClient, id)
  assert.ok(row, 'the account row must still exist after deletion (it is a tombstone, not a delete)')
  assert.equal(row!.provider_user_id, `deleted:${id}`, "provider_user_id must become 'deleted:' || id (spec section 2.2)")
  assert.equal(row!.display_name, '[deleted]', "display_name must become '[deleted]' (spec section 2.2)")
  assert.notEqual(row!.deleted_at, null, 'deleted_at must be set')
  assert.notEqual(row!.disabled_at, null, 'disabled_at must be set (it was null before deletion)')
  assert.equal(
    new Date(row!.disabled_at!).getTime(),
    new Date(row!.deleted_at!).getTime(),
    'a single deletion must carry a single timestamp for both fields (spec section 3.1)',
  )
})

test('item 12: deleteAccount disables and stamps every link the account owns (spec section 6 item 12)', async () => {
  const deleteAccount = await loadDeleteAccount()
  assert.equal(typeof deleteAccount, 'function', 'src/account-deletion.ts must export deleteAccount(db, { accountId })')

  const { id } = await createAccount(sharedDb, { displayName: 'item12 owner' })
  const linkA = await createLink(sharedDb, id, { enabled: true })
  const linkB = await createLink(sharedDb, id, { enabled: true })

  await deleteAccount!(sharedDb, { accountId: id })

  const { rows } = await sharedClient.query<{ id: string; enabled: boolean; deleted_at: string | null }>(
    `select id, enabled, deleted_at from links where owner_account_id = $1`,
    [id],
  )
  assert.equal(rows.length, 2, 'both links owned by the account must still be present')
  for (const link of rows) {
    assert.equal(link.enabled, false, `link ${link.id} must be disabled by deleteAccount (spec section 2.3)`)
    assert.notEqual(link.deleted_at, null, `link ${link.id} must have deleted_at stamped (spec section 2.3)`)
  }
  const ids = rows.map((r) => r.id).sort()
  assert.deepEqual(ids, [linkA.id, linkB.id].sort())
})

test('item 13: deleteAccount on an already-deleted account throws AccountAlreadyDeletedError and changes nothing (spec section 6 item 13)', async () => {
  const deleteAccount = await loadDeleteAccount()
  const { AccountAlreadyDeletedError } = await loadDeletionErrors()
  assert.equal(typeof deleteAccount, 'function', 'src/account-deletion.ts must export deleteAccount')
  assert.equal(typeof AccountAlreadyDeletedError, 'function', 'src/errors.ts must export AccountAlreadyDeletedError')

  const { id } = await createAccount(sharedDb, { displayName: 'item13 real name' })
  await deleteAccount!(sharedDb, { accountId: id })
  const before = await fetchAccountRaw(sharedClient, id)

  await assert.rejects(
    deleteAccount!(sharedDb, { accountId: id }),
    AccountAlreadyDeletedError as new (...args: unknown[]) => Error,
    'a second deleteAccount call on the same account must throw AccountAlreadyDeletedError (spec section 3.1)',
  )

  const after = await fetchAccountRaw(sharedClient, id)
  assert.deepEqual(after, before, 'a rejected second deletion must not change the account row at all')
})

test('item 14: deleteAccount on an unknown id throws AccountNotFoundError (spec section 6 item 14)', async () => {
  const deleteAccount = await loadDeleteAccount()
  const { AccountNotFoundError } = await loadDeletionErrors()
  assert.equal(typeof deleteAccount, 'function', 'src/account-deletion.ts must export deleteAccount')
  assert.equal(typeof AccountNotFoundError, 'function', 'src/errors.ts must export AccountNotFoundError')

  await assert.rejects(
    deleteAccount!(sharedDb, { accountId: randomUUID() }),
    AccountNotFoundError as new (...args: unknown[]) => Error,
    'deleteAccount on an id with no matching row must throw AccountNotFoundError (spec section 3.1)',
  )
})

test('item 15: after deletion, findAccountByProvider with the original provider id returns null (spec section 6 item 15)', async () => {
  const deleteAccount = await loadDeleteAccount()
  assert.equal(typeof deleteAccount, 'function', 'src/account-deletion.ts must export deleteAccount')

  const providerUserId = 'item15-original-fb-id'
  const { id } = await createAccount(sharedDb, { displayName: 'item15 real name', providerUserId })
  await deleteAccount!(sharedDb, { accountId: id })

  const found = await findAccountByProvider(sharedDb, { provider: 'facebook', providerUserId })
  assert.equal(
    found,
    null,
    'findAccountByProvider must not find the tombstoned row by its original provider id (spec section 2.2, section 3.2)',
  )
})

test('item 16: after deletion, creating a fresh account with the same original provider id succeeds and yields a different account id (spec section 6 item 16)', async () => {
  const deleteAccount = await loadDeleteAccount()
  assert.equal(typeof deleteAccount, 'function', 'src/account-deletion.ts must export deleteAccount')

  const providerUserId = 'item16-original-fb-id'
  const { id: firstId } = await createAccount(sharedDb, { displayName: 'item16 first', providerUserId })
  await deleteAccount!(sharedDb, { accountId: firstId })

  const { accountId: secondId } = await createAccountWithTerms(sharedDb, {
    provider: 'facebook',
    providerUserId,
    displayName: 'item16 second',
    termsVersion: TERMS_VERSION,
    locale: 'ar',
    ageAttested18: true,
  })

  assert.notEqual(secondId, firstId, 'the same Facebook user signing in again must get a new account, not the tombstone (spec section 2.2)')
})

test('item 17: getAccountById returns deletedAt populated (spec section 6 item 17)', async () => {
  const deleteAccount = await loadDeleteAccount()
  assert.equal(typeof deleteAccount, 'function', 'src/account-deletion.ts must export deleteAccount')

  const { id } = await createAccount(sharedDb, { displayName: 'item17 real name' })
  await deleteAccount!(sharedDb, { accountId: id })

  const account = (await getAccountById(sharedDb, { accountId: id })) as unknown as { deletedAt?: Date | null } | null
  assert.ok(account, 'getAccountById must still find the tombstoned row')
  assert.notEqual(
    account!.deletedAt,
    undefined,
    'Account must gain a deletedAt field (spec section 3.2) -- getAccountById does not select it yet',
  )
  assert.notEqual(account!.deletedAt, null, 'deletedAt must be populated for a deleted account')
})

test('item 18: sendConfession from a deleted sender is refused by the domain layer (spec section 6 item 18)', async () => {
  const { id: senderId } = await createAccount(sharedDb, { displayName: 'item18 sender' })
  await rawTombstoneAccount(sharedClient, senderId)

  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item18 owner' })
  const { slug } = await createLink(sharedDb, ownerId, { enabled: true })

  const before = await sharedDb.select().from(confessions)

  // The spec deliberately does not pin down which error is thrown here --
  // whichever of the existing disabled-sender error or a new
  // SenderAccountDeletedError matches what is already there (spec section
  // 3.3) -- so this asserts only that the domain layer refuses, and that
  // nothing was written.
  await assert.rejects(
    sendConfession(sharedDb, { senderAccountId: senderId, linkSlug: slug, body: 'item 18 body' }),
    'sendConfession must refuse a send from a deleted sender (spec section 3.3)',
  )

  const after = await sharedDb.select().from(confessions)
  assert.equal(after.length, before.length, 'a refused send must not write a confessions row')
})

test('item 19: the deleted user\'s own sent confessions are still present, with sender_account_id intact (spec section 6 item 19)', async () => {
  const { id: senderId } = await createAccount(sharedDb, { displayName: 'item19 sender' })
  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item19 owner' })
  const { id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })
  const { id: confessionId } = await createConfession(sharedDb, { linkId, senderAccountId: senderId })

  await rawTombstoneAccount(sharedClient, senderId)

  const [row] = await sharedDb.select().from(confessions).where(eq(confessions.id, confessionId))
  assert.ok(row, 'the confession sent by the now-deleted account must still exist (spec section 7: out of scope to delete it)')
  assert.equal(row!.senderAccountId, senderId, 'sender_account_id must remain intact after the sender deletes their account')
})

test('item 20: adminRevealByAdminUser on a confession from a deleted sender still returns the account id and writes its audit row, with display name [deleted] (spec section 6 item 20)', async () => {
  const { id: senderId } = await createAccount(sharedDb, { displayName: 'item20 sender real name' })
  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item20 owner' })
  const { id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })
  const { id: confessionId } = await createConfession(sharedDb, { linkId, senderAccountId: senderId })

  await rawTombstoneAccount(sharedClient, senderId)

  const adminUserId = await insertAdminUser(sharedDb, `item20-admin-${randomUUID()}`)

  const result = await adminRevealByAdminUser(sharedDb, {
    adminUserId,
    confessionId,
    reason: 'item 20 acceptance test reason, long enough',
  })

  assert.equal(result.senderAccountId, senderId, 'adminRevealByAdminUser must still return the sender account id for a deleted sender')
  assert.equal(result.senderDisplayName, '[deleted]', 'the display name returned must be the tombstone sentinel, not a crash and not a leak (spec section 2.2)')

  const { rows } = await sharedClient.query<{ count: string }>(
    `select count(*)::text as count from admin_reveal_log where confession_id = $1 and admin_user_id = $2`,
    [confessionId, adminUserId],
  )
  assert.equal(rows[0]!.count, '1', 'the reveal must still write exactly one audit row even for a deleted sender')
})

test('item 21: a confession sent to the deleted user before deletion is still present (spec section 6 item 21)', async () => {
  const { id: senderId } = await createAccount(sharedDb, { displayName: 'item21 sender' })
  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item21 recipient' })
  const { id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })
  const { id: confessionId } = await createConfession(sharedDb, { linkId, senderAccountId: senderId })

  await rawTombstoneAccount(sharedClient, ownerId)
  await rawTombstoneLink(sharedClient, linkId)

  const [row] = await sharedDb.select().from(confessions).where(eq(confessions.id, confessionId))
  assert.ok(row, 'a confession received by a now-deleted recipient must still be present (spec section 7)')
  assert.equal(row!.id, confessionId)
})

test('item 22: getLinkBySlug for a deleted owner\'s slug returns enabled: false (spec section 6 item 22)', async () => {
  const { id: ownerId } = await createAccount(sharedDb, { displayName: 'item22 owner' })
  const { slug, id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })

  await rawTombstoneAccount(sharedClient, ownerId)
  await rawTombstoneLink(sharedClient, linkId)

  const result = await getLinkBySlug(sharedDb, { slug })
  assert.ok(result, 'getLinkBySlug must still resolve the row -- the link is retained, not removed (spec section 2.3)')
  assert.equal(result!.enabled, false, 'a deleted owner\'s link must report enabled: false (spec section 3.4)')
})

test('item 23: the deleted owner\'s display name appears nowhere in the JSON of any recipient-facing view of their own slug (spec section 6 item 23)', async () => {
  const originalDisplayName = `item23-original-name-${randomUUID()}`
  const { id: ownerId } = await createAccount(sharedDb, { displayName: originalDisplayName })
  const { slug, id: linkId } = await createLink(sharedDb, ownerId, { enabled: true })

  await rawTombstoneAccount(sharedClient, ownerId)
  await rawTombstoneLink(sharedClient, linkId)

  const result = await getLinkBySlug(sharedDb, { slug })
  const serialised = JSON.stringify(result)
  assert.ok(
    !serialised.includes(originalDisplayName),
    `the original display name must not appear anywhere in the recipient-facing view of the slug once the owner is deleted; got: ${serialised}`,
  )
})

// =============================================================================
// Terms -- items 24 through 27
// =============================================================================
//
// The frozen clause text for items 25-27 is inlined below rather than read
// from work/confession-app/BRIEF.md: that file lives outside this repository
// (a sibling directory of this git worktree), and the task that produced
// this file froze the exact clause wording here for that reason, matching
// the fallback spec section 6 item 26 itself describes. Item 27's "old
// sentence" is transcribed from the current src/terms.ts read for this
// task, not from a garbled paraphrase, so the negative assertion is
// actually capable of catching the real pre-week-10 wording.

const FROZEN_CLAUSE_6_AR =
  'فيك تطفّي رابطك بأي وقت، وفيك تحذف حسابك بأي وقت. حذف الحساب نهائي وما فيك ترجع عنه: منمحي اسمك وربط حسابك بفيسبوك، وما بتقدر ترجع تفوت على نفس الحساب، ورابطك بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني.'
const FROZEN_CLAUSE_7_AR =
  'بس لازم تعرف شو بيضل بعد الحذف: الرسائل يلي بعتها بتضل عند الإدارة مربوطة برقم حساب بلا اسم، والرسائل يلي وصلتك بتضل كمان، وجوابك بأي مصارحة متبادلة ما منقدر نشيله. هالشي مشان نقدر نمنع الإساءة وإذا اضطرينا قانونياً.'
const FROZEN_CLAUSE_6_EN =
  'You can switch your link off at any time, and you can delete your account at any time. Deleting is permanent and cannot be undone: we erase your display name and the connection to your Facebook account, you cannot sign back in to that account, and your link stops working and is never given to anyone else.'
const FROZEN_CLAUSE_7_EN =
  'You should know what remains after deletion: the messages you sent stay with the administration, attached to an account id with no name on it; the messages you received also stay; and your answer in any mutual reveal cannot be removed. This is so we can prevent abuse and meet a legal requirement if one arises.'

// The pre-week-10 sentence, as it actually reads in src/terms.ts today (read
// for this task per the allowed pre-week-10 signatures) -- not a paraphrase.
const OLD_CLAUSE_6_SENTENCE_AR = 'أو تحذف حسابك بأي وقت'
const OLD_CLAUSE_6_SENTENCE_EN = 'delete your account at any time'

test('item 24: TERMS_VERSION === "2026-08-31.1" (spec section 6 item 24)', () => {
  assert.equal(TERMS_VERSION, '2026-08-31.1', 'the version bump for the rewritten clause 6 and new clause 7 (spec section 5)')
})

test('item 25: TERMS_TEXT_AR.clauses and TERMS_TEXT_EN.clauses both have length 7 (spec section 6 item 25)', () => {
  assert.equal(TERMS_TEXT_AR.clauses.length, 7, 'Arabic terms must end with seven clauses (spec section 5)')
  assert.equal(TERMS_TEXT_EN.clauses.length, 7, 'English terms must end with seven clauses (spec section 5)')
})

test('item 26: clause 6 in both languages is byte-identical to the frozen BRIEF.md text (spec section 6 item 26; BRIEF.md is outside this repo, so the literal frozen into this file is used, per the item\'s own stated fallback)', () => {
  assert.equal(TERMS_TEXT_AR.clauses[5], FROZEN_CLAUSE_6_AR, 'Arabic clause 6 must be byte-identical to the frozen BRIEF.md wording')
  assert.equal(TERMS_TEXT_EN.clauses[5], FROZEN_CLAUSE_6_EN, 'English clause 6 must be byte-identical to the frozen BRIEF.md wording')
  // Clause 7 is asserted here too since it is the other half of the same
  // frozen literal the task handed down, and section 5 requires it exist.
  assert.equal(TERMS_TEXT_AR.clauses[6], FROZEN_CLAUSE_7_AR, 'Arabic clause 7 must be byte-identical to the frozen BRIEF.md wording')
  assert.equal(TERMS_TEXT_EN.clauses[6], FROZEN_CLAUSE_7_EN, 'English clause 7 must be byte-identical to the frozen BRIEF.md wording')
})

test('item 27: no clause in either language still contains the old pre-week-10 sentence about deleting an account (spec section 6 item 27)', () => {
  for (const clause of TERMS_TEXT_AR.clauses) {
    assert.ok(
      !clause.includes(OLD_CLAUSE_6_SENTENCE_AR),
      `Arabic clause still contains the old, half-true sentence: ${JSON.stringify(clause)}`,
    )
  }
  for (const clause of TERMS_TEXT_EN.clauses) {
    assert.ok(
      !clause.includes(OLD_CLAUSE_6_SENTENCE_EN),
      `English clause still contains the old, half-true sentence: ${JSON.stringify(clause)}`,
    )
  }
})

// =============================================================================
// Surface -- items 28 through 32
// =============================================================================

const ACCOUNT_DELETE_PAGE = path.resolve(REPO_ROOT, 'app', 'account', 'delete', 'page.tsx')
const ACCOUNT_DELETE_ACTIONS = path.resolve(REPO_ROOT, 'app', 'account', 'delete', 'actions.ts')

function readIfExists(p: string): string | null {
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

test('item 28: app/account/delete/page.tsx exists and calls requireActiveViewerAccountId (spec section 6 item 28)', () => {
  const src = readIfExists(ACCOUNT_DELETE_PAGE)
  assert.ok(src, `app/account/delete/page.tsx must exist (spec section 4.1); looked at ${ACCOUNT_DELETE_PAGE}`)
  assert.match(
    src!,
    /requireActiveViewerAccountId/,
    'app/account/delete/page.tsx must call requireActiveViewerAccountId (spec section 4.1, section 4.3)',
  )
})

const AUTHENTICATED_SURFACES: Array<{ name: string; files: string[] }> = [
  { name: '/inbox', files: [path.resolve(REPO_ROOT, 'app', 'inbox', 'page.tsx')] },
  { name: '/sent', files: [path.resolve(REPO_ROOT, 'app', 'sent', 'page.tsx')] },
  { name: '/offer/[offerId]', files: [path.resolve(REPO_ROOT, 'app', 'offer', '[offerId]', 'page.tsx')] },
  { name: '/onboarding', files: [path.resolve(REPO_ROOT, 'app', 'onboarding', 'page.tsx')] },
  { name: '/account/delete', files: [ACCOUNT_DELETE_PAGE] },
]

test('item 29: every authenticated surface listed in section 4.3 calls requireActiveViewerAccountId and none of them calls requireViewerAccountId (spec section 6 item 29)', () => {
  for (const surface of AUTHENTICATED_SURFACES) {
    for (const file of surface.files) {
      const src = readIfExists(file)
      assert.ok(src, `${surface.name}'s page file must exist at ${file}`)
      assert.ok(
        src!.includes('requireActiveViewerAccountId'),
        `${surface.name} (${file}) must call requireActiveViewerAccountId (spec section 4.3)`,
      )
      assert.ok(
        !src!.includes('requireViewerAccountId('),
        `${surface.name} (${file}) must not call the retired requireViewerAccountId (spec section 4.3: ` +
          '"requireViewerAccountId is kept, unchanged, and left with no callers")',
      )
    }
  }
})

// Item 30's exact export name and its location are not stated by the spec --
// only that "requireActiveViewerAccountId is a testable decision -- a pure
// predicate over an account row, exported, so this item does not need
// next/headers." This is a genuine ambiguity, reported alongside this file.
// To test something real rather than inventing one specific name, this
// searches a short list of plausible module/export pairs and, once found,
// checks the actual decision boundary the spec section 4.3 states (redirect
// when the account is missing, disabled, or deleted; not otherwise) without
// assuming which boolean polarity the author chose -- it only requires that
// the three "inactive" shapes are treated identically to each other and
// oppositely from the one "active" shape.
const PREDICATE_CANDIDATES: Array<{ modulePath: string; exportNames: string[] }> = [
  { modulePath: '../app/_lib/auth.js', exportNames: ['isAccountActive', 'isActiveAccount', 'isAccountInactive', 'isViewerAccountActive', 'accountIsActive'] },
  { modulePath: '../src/accounts.js', exportNames: ['isAccountActive', 'isActiveAccount', 'isAccountInactive', 'isViewerAccountActive', 'accountIsActive'] },
]

async function loadActiveAccountPredicate(): Promise<
  { fn: (account: { disabledAt: Date | null; deletedAt: Date | null } | null) => boolean; modulePath: string; exportName: string } | null
> {
  for (const candidate of PREDICATE_CANDIDATES) {
    const mod = (await import(candidate.modulePath).catch(() => ({}))) as Record<string, unknown>
    for (const name of candidate.exportNames) {
      if (typeof mod[name] === 'function') {
        return { fn: mod[name] as (a: { disabledAt: Date | null; deletedAt: Date | null } | null) => boolean, modulePath: candidate.modulePath, exportName: name }
      }
    }
  }
  return null
}

test('item 30: requireActiveViewerAccountId\'s decision is a testable, exported pure predicate over an account row (spec section 6 item 30)', async () => {
  const found = await loadActiveAccountPredicate()
  assert.ok(
    found,
    'no exported pure predicate over an account row was found under any of the candidate names this test looked for ' +
      `(${PREDICATE_CANDIDATES.map((c) => `${c.modulePath}: ${c.exportNames.join('/')}`).join('; ')}). ` +
      'The spec (section 4.3) requires such a predicate to exist and be exported, but does not name it -- see this ' +
      'run\'s report for the ambiguity.',
  )
  if (!found) return

  const active = found.fn({ disabledAt: null, deletedAt: null })
  const missing = found.fn(null)
  const disabled = found.fn({ disabledAt: new Date(), deletedAt: null })
  const deleted = found.fn({ disabledAt: null, deletedAt: new Date() })

  assert.equal(typeof active, 'boolean', `${found.exportName} must return a boolean`)
  assert.notEqual(active, missing, 'a missing account must be decided oppositely from an active one (spec section 4.3)')
  assert.notEqual(active, disabled, 'a disabled account must be decided oppositely from an active one (spec section 4.3)')
  assert.notEqual(active, deleted, 'a deleted account must be decided oppositely from an active one (spec section 4.3)')
  assert.equal(missing, disabled, 'missing and disabled must be decided the same way (both are "not usable")')
  assert.equal(disabled, deleted, 'disabled and deleted must be decided the same way (both are "not usable")')
})

test('item 31: /inbox contains a link whose href is /account/delete (spec section 6 item 31, section 4.4)', () => {
  const src = readIfExists(path.resolve(REPO_ROOT, 'app', 'inbox', 'page.tsx'))
  assert.ok(src, 'app/inbox/page.tsx must exist')
  assert.match(
    src!,
    /href\s*=\s*\{?\s*["'`]\/account\/delete["'`]\s*\}?/,
    '/inbox must contain a link whose href is /account/delete, or the whole slice is unreachable (spec section 4.4)',
  )
})

test('item 32: the delete action reads the account id from the session, and no form field anywhere in the delete surface is named for an account id (spec section 6 item 32)', () => {
  const pageSrc = readIfExists(ACCOUNT_DELETE_PAGE)
  const actionsSrc = readIfExists(ACCOUNT_DELETE_ACTIONS)
  assert.ok(pageSrc, 'app/account/delete/page.tsx must exist')
  assert.ok(actionsSrc, 'app/account/delete/actions.ts must exist (spec section 4.2)')

  const accountIdFieldPattern = /name\s*=\s*["'`][^"'`]*account[_-]?id[^"'`]*["'`]/i
  assert.ok(
    !accountIdFieldPattern.test(pageSrc!),
    'app/account/delete/page.tsx must not contain a form field named for an account id (spec section 4.2: ' +
      'the action re-derives the viewer\'s account id from the session cookie, never from a form field)',
  )
  assert.ok(
    !accountIdFieldPattern.test(actionsSrc!),
    'app/account/delete/actions.ts must not read an account id off a form field either',
  )

  const formDataAccountIdPattern = /formData\.get\(\s*["'`][^"'`]*account[_-]?id[^"'`]*["'`]/i
  assert.ok(
    !formDataAccountIdPattern.test(actionsSrc!),
    'app/account/delete/actions.ts must not call formData.get(...) for anything named like an account id',
  )

  assert.ok(
    /requireActiveViewerAccountId|getViewerAccountId/.test(actionsSrc!),
    'app/account/delete/actions.ts must re-derive the viewer\'s account id from the session server-side (spec section 4.2)',
  )
})
