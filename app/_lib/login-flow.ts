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
  AFTER_LOGIN_COOKIE,
  afterLoginCookieOptions,
  createSessionCookieValue,
  createPendingIdentityCookieValue,
  sidCookieOptions,
  pendingIdentityCookieOptions,
} from './session.js'

export type ResolvedIdentity = { provider: 'facebook'; providerUserId: string; displayName: string }

export function sanitizeNextDestination(destination?: string | null): string {
  if (
    typeof destination === 'string' &&
    destination.startsWith('/') &&
    !destination.startsWith('//') &&
    !destination.includes(':')
  ) {
    return destination
  }
  return '/inbox'
}

type CookieStore = Awaited<ReturnType<typeof cookies>>

// Week 15 §2.3. /onboarding is a detour, not a destination: a stranger who
// opened a friend's link and has no account yet has to arrive back at that
// link once the terms are accepted, or the loop that brought them here ends
// in their own empty inbox. Only a real destination is remembered; the
// /inbox default needs no cookie, and a stale one from an abandoned attempt
// is cleared rather than left to hijack this login.
export function rememberDestination(store: CookieStore, destination?: string | null): void {
  const target = sanitizeNextDestination(destination)
  if (target === '/inbox') {
    store.delete(AFTER_LOGIN_COOKIE)
  } else {
    store.set(AFTER_LOGIN_COOKIE, target, afterLoginCookieOptions)
  }
}

// Reads and clears what rememberDestination stored. Always a same-origin
// path, and '/inbox' when nothing was remembered.
export async function takeRememberedDestination(): Promise<string> {
  const store = await cookies()
  const raw = store.get(AFTER_LOGIN_COOKIE)?.value ?? null
  if (raw !== null) store.delete(AFTER_LOGIN_COOKIE)
  return sanitizeNextDestination(raw)
}

export async function resolveLoginAndRedirect(
  identity: ResolvedIdentity,
  destination?: string | null,
): Promise<never> {
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
      rememberDestination(store, destination)
      redirect('/onboarding')
    }
    const target = sanitizeNextDestination(destination)
    redirect(target)
  }

  // No accounts row yet — no row is written here (spec §3.4 step 3). The
  // identity travels in a second signed, short-lived cookie only.
  store.set(PENDING_IDENTITY_COOKIE, createPendingIdentityCookieValue(identity), pendingIdentityCookieOptions)
  rememberDestination(store, destination)
  redirect('/onboarding')
}
