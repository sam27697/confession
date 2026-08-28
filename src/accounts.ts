// src/accounts.ts
//
// Terms acceptance IS account creation (spec §3.4): the schema makes
// terms_version / terms_accepted_at / age_attested_18 NOT NULL on accounts,
// so there is no path that writes an accounts row without also writing the
// terms_acceptances row that justifies it, and no path that writes either
// without the caller's link. All three go in one transaction.

import { and, eq } from 'drizzle-orm'
import type { Db } from './db.js'
import { accounts, links, termsAcceptances } from './schema.js'
import { AgeAttestationRequiredError } from './errors.js'
import { generateSlug } from './slug.js'

export type Provider = 'facebook'
export type Locale = 'ar' | 'en'

export type Account = {
  id: string
  displayName: string
  termsVersion: string
  disabledAt: Date | null
}

export async function findAccountByProvider(
  db: Db,
  { provider, providerUserId }: { provider: Provider; providerUserId: string },
): Promise<Account | null> {
  const [row] = await db
    .select({
      id: accounts.id,
      displayName: accounts.displayName,
      termsVersion: accounts.termsVersion,
      disabledAt: accounts.disabledAt,
    })
    .from(accounts)
    .where(and(eq(accounts.provider, provider), eq(accounts.providerUserId, providerUserId)))
    .limit(1)

  return row ?? null
}

export async function getAccountById(db: Db, { accountId }: { accountId: string }): Promise<Account | null> {
  const [row] = await db
    .select({
      id: accounts.id,
      displayName: accounts.displayName,
      termsVersion: accounts.termsVersion,
      disabledAt: accounts.disabledAt,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  return row ?? null
}

// A slug collision is astronomically unlikely at 31^12 possibilities, but
// checking is free and the alternative is a signup that fails for a reason
// the user cannot do anything about (spec §4.2: "retry up to 5 times").
const SLUG_INSERT_ATTEMPTS = 5

function isUniqueViolation(err: unknown): boolean {
  // Postgres error code 23505 = unique_violation, surfaced the same way by
  // node-postgres and by PGlite's Postgres-compatible error objects.
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505'
}

// One transaction: accounts + terms_acceptances + links (spec §4.2). Throws
// AgeAttestationRequiredError, and writes nothing, if ageAttested18 is
// false — clause 5 is not optional.
export async function createAccountWithTerms(
  db: Db,
  {
    provider,
    providerUserId,
    displayName,
    termsVersion,
    locale,
    ageAttested18,
  }: {
    provider: Provider
    providerUserId: string
    displayName: string
    termsVersion: string
    locale: Locale
    ageAttested18: boolean
  },
): Promise<{ accountId: string; linkSlug: string }> {
  if (!ageAttested18) throw new AgeAttestationRequiredError()

  return db.transaction(async (tx) => {
    const acceptedAt = new Date()

    const [account] = await tx
      .insert(accounts)
      .values({
        provider,
        providerUserId,
        displayName,
        termsVersion,
        termsAcceptedAt: acceptedAt,
        ageAttested18,
      })
      .returning({ id: accounts.id })

    await tx.insert(termsAcceptances).values({
      accountId: account.id,
      termsVersion,
      acceptedAt,
      locale,
    })

    // The link insert is wrapped in its own nested transaction (a Postgres
    // SAVEPOINT under the hood) so a unique-violation on the slug rolls
    // back just that insert and lets the outer transaction — which already
    // holds the accounts/terms_acceptances rows — keep going and retry.
    // Catching the same error directly against `tx` would leave the whole
    // outer transaction aborted after the first collision.
    let lastError: unknown
    for (let attempt = 0; attempt < SLUG_INSERT_ATTEMPTS; attempt += 1) {
      try {
        const [link] = await tx.transaction(async (tx2) =>
          tx2
            .insert(links)
            .values({ ownerAccountId: account.id, slug: generateSlug() })
            .returning({ slug: links.slug }),
        )
        return { accountId: account.id, linkSlug: link.slug }
      } catch (err) {
        if (!isUniqueViolation(err)) throw err
        lastError = err
      }
    }
    throw lastError instanceof Error ? lastError : new Error('failed to allocate a unique link slug')
  })
}

// UPDATE accounts.terms_version/terms_accepted_at + INSERT terms_acceptances
// (spec §4.2). The acceptance table is append-only history (spec §3.4:
// "never updated in place") — this appends a new row rather than editing
// the account's first one.
export async function recordTermsReacceptance(
  db: Db,
  { accountId, termsVersion, locale }: { accountId: string; termsVersion: string; locale: Locale },
): Promise<void> {
  const acceptedAt = new Date()

  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ termsVersion, termsAcceptedAt: acceptedAt }).where(eq(accounts.id, accountId))

    await tx.insert(termsAcceptances).values({
      accountId,
      termsVersion,
      acceptedAt,
      locale,
    })
  })
}
