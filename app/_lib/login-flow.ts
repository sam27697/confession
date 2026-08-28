// Shared tail of both login paths (Facebook OAuth and the dev login), spec
// §3.4 steps 1-3: resolve identity, then either sign in an existing account
// or stash the identity for /onboarding to create one. Used by both
// app/auth/facebook/callback/route.ts and app/auth/dev/route.ts so the two
// entry points cannot drift.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from './domain/db.js'
import { findAccountByProvider } from './domain/accounts.js'
import { TERMS_VERSION } from './domain/terms.js'
import {
  SID_COOKIE,
  PENDING_IDENTITY_COOKIE,
  createSessionCookieValue,
  createPendingIdentityCookieValue,
  sidCookieOptions,
  pendingIdentityCookieOptions,
} from './session.js'

export type ResolvedIdentity = { provider: 'facebook'; providerUserId: string; displayName: string }

export async function resolveLoginAndRedirect(identity: ResolvedIdentity): Promise<never> {
  const db = getDb()
  const account = await findAccountByProvider(db, {
    provider: identity.provider,
    providerUserId: identity.providerUserId,
  })

  const store = await cookies()

  if (account) {
    store.set(SID_COOKIE, createSessionCookieValue(account.id), sidCookieOptions)
    // spec §3.4: a returning user behind on TERMS_VERSION goes back through
    // /onboarding to re-accept.
    if (account.termsVersion < TERMS_VERSION) {
      redirect('/onboarding')
    }
    redirect('/inbox')
  }

  // No accounts row yet — no row is written here (spec §3.4 step 3). The
  // identity travels in a second signed, short-lived cookie only.
  store.set(PENDING_IDENTITY_COOKIE, createPendingIdentityCookieValue(identity), pendingIdentityCookieOptions)
  redirect('/onboarding')
}
