import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { freshDb } from './harness.js'
import { accounts, termsAcceptances, links } from '../src/schema.js'
import { createAccountWithTerms, recordTermsReacceptance } from '../src/accounts.js'
import { AgeAttestationRequiredError } from '../src/errors.js'

test('§3.4/§4.2 createAccountWithTerms writes exactly one accounts row, one terms_acceptances row and one links row', async () => {
  const { db, client } = await freshDb()

  const { accountId, linkSlug } = await createAccountWithTerms(db, {
    provider: 'facebook',
    providerUserId: 'devlogin:test-1',
    displayName: 'First Timer',
    termsVersion: '2026-08-25.1',
    locale: 'ar',
    ageAttested18: true,
  })

  const accountRows = await db.select().from(accounts).where(eq(accounts.id, accountId))
  const termsRows = await db.select().from(termsAcceptances).where(eq(termsAcceptances.accountId, accountId))
  const linkRows = await db.select().from(links).where(eq(links.ownerAccountId, accountId))

  assert.equal(accountRows.length, 1)
  assert.equal(termsRows.length, 1)
  assert.equal(termsRows[0].termsVersion, '2026-08-25.1')
  assert.equal(linkRows.length, 1)
  assert.equal(linkRows[0].slug, linkSlug)

  await client.close()
})

test('§3.4 createAccountWithTerms is one transaction: a terms_acceptances CHECK violation rolls back the accounts row too', async () => {
  const { db, client } = await freshDb()

  // 'xx' fails terms_acceptances_locale_check (only 'ar'/'en' are allowed).
  // The cast is needed because the TS signature is narrower than the check
  // this test is aimed at — the point is what the database does, not what
  // the type system would have stopped upstream.
  await assert.rejects(() =>
    createAccountWithTerms(db, {
      provider: 'facebook',
      providerUserId: 'devlogin:test-atomic',
      displayName: 'Atomicity Check',
      termsVersion: '2026-08-25.1',
      locale: 'xx' as unknown as 'ar',
      ageAttested18: true,
    }),
  )

  const accountRows = await db.select().from(accounts)
  const linkRows = await db.select().from(links)
  assert.equal(accountRows.length, 0, 'the accounts row must not survive a transaction that rolled back downstream')
  assert.equal(linkRows.length, 0)

  await client.close()
})

test('§3.4 ageAttested18: false throws and writes nothing — no accounts row, no terms_acceptances row, no links row', async () => {
  const { db, client } = await freshDb()

  await assert.rejects(
    () =>
      createAccountWithTerms(db, {
        provider: 'facebook',
        providerUserId: 'devlogin:test-2',
        displayName: 'Underage Claim',
        termsVersion: '2026-08-25.1',
        locale: 'ar',
        ageAttested18: false,
      }),
    AgeAttestationRequiredError,
  )

  const accountRows = await db.select().from(accounts)
  const termsRows = await db.select().from(termsAcceptances)
  const linkRows = await db.select().from(links)

  assert.equal(accountRows.length, 0, 'no accounts row for a refused attestation')
  assert.equal(termsRows.length, 0, 'no terms_acceptances row either — clause 5 is not optional')
  assert.equal(linkRows.length, 0)

  await client.close()
})

test('§3.4 re-acceptance appends a new terms_acceptances row and updates the account, rather than editing the first acceptance in place', async () => {
  const { db, client } = await freshDb()

  const { accountId } = await createAccountWithTerms(db, {
    provider: 'facebook',
    providerUserId: 'devlogin:test-3',
    displayName: 'Returning User',
    termsVersion: '2026-08-25.1',
    locale: 'ar',
    ageAttested18: true,
  })

  const [firstAcceptance] = await db.select().from(termsAcceptances).where(eq(termsAcceptances.accountId, accountId))

  await recordTermsReacceptance(db, { accountId, termsVersion: '2026-09-01.1', locale: 'en' })

  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId))
  assert.equal(account.termsVersion, '2026-09-01.1')

  const allAcceptances = await db.select().from(termsAcceptances).where(eq(termsAcceptances.accountId, accountId))
  assert.equal(allAcceptances.length, 2, 're-acceptance appends a row, it does not update the existing one')

  const versions = allAcceptances.map((a) => a.termsVersion).sort()
  assert.deepEqual(versions, ['2026-08-25.1', '2026-09-01.1'])

  const untouchedFirst = allAcceptances.find((a) => a.id === firstAcceptance.id)
  assert.ok(untouchedFirst, 'the original acceptance row must still exist under its own id')
  assert.equal(untouchedFirst?.termsVersion, '2026-08-25.1', 'the first row is not rewritten by the second acceptance')

  await client.close()
})
