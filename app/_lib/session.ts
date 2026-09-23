// Cookie signing helper for `sid`, `pending_identity` and `fb_oauth_state`
// (spec §3.3). Not a domain function — spec §4.2 never names a src/ file
// for this, and every consumer of it (the auth routes and /onboarding) is
// web-app scope, so it is implemented here, once, and reused by both signed
// cookies (spec §3.4: "same signing helper").
//
// The wire format and the HMAC itself live in src/session.ts, which is
// framework-free and directly tested. This file is only the cookie-shaped
// wrapper around it: names, options, and the payload types. Any parse
// failure is rejected without detail and never logged (spec §1 rule 3).

import {
  signPayload,
  verifyPayload,
  SESSION_MAX_AGE_MS,
  PENDING_IDENTITY_MAX_AGE_MS,
} from '../../src/session.js'
import { env } from './domain/env.js'

export const SID_COOKIE = 'sid'
export const PENDING_IDENTITY_COOKIE = 'pending_identity'
export const FB_OAUTH_STATE_COOKIE = 'fb_oauth_state'
// One cookie per provider, not one shared 'oauth_state'. Two tabs, two
// half-finished logins, and a shared name turns the second callback into a
// 400 that looks like a CSRF failure and is not one.
export const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state'

const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000
const PENDING_IDENTITY_MAX_AGE_SECONDS = PENDING_IDENTITY_MAX_AGE_MS / 1000

function sign(data: object): string {
  return signPayload(env.sessionSecret, data)
}

function verify<T>(value: string, maxAgeMs: number): (T & { iat: number }) | null {
  return verifyPayload<T>(env.sessionSecret, value, { maxAgeMs })
}

export type SessionPayload = { accountId: string }

export function createSessionCookieValue(accountId: string): string {
  return sign({ accountId } satisfies SessionPayload)
}

export function verifySessionCookieValue(value: string): { accountId: string } | null {
  const data = verify<SessionPayload>(value, SESSION_MAX_AGE_MS)
  if (!data || typeof data.accountId !== 'string') return null
  return { accountId: data.accountId }
}

// Kept in step with src/accounts.ts's Provider. Widening this type is what
// lets a second provider through /onboarding; the verify function below is
// what stops anything else getting in.
export type PendingProvider = 'facebook' | 'google'

const PENDING_PROVIDERS: readonly PendingProvider[] = ['facebook', 'google']

export type PendingIdentity = {
  provider: PendingProvider
  providerUserId: string
  displayName: string
}

export function createPendingIdentityCookieValue(identity: PendingIdentity): string {
  return sign(identity satisfies PendingIdentity)
}

export function verifyPendingIdentityCookieValue(value: string): PendingIdentity | null {
  const data = verify<PendingIdentity>(value, PENDING_IDENTITY_MAX_AGE_MS)
  if (!data || typeof data.providerUserId !== 'string' || typeof data.displayName !== 'string') return null
  // Previously this returned a hard-coded 'facebook' regardless of what the
  // payload said, which was harmless while one provider existed and is a
  // provider-confusion bug the moment a second one does: a Google sub would
  // have been written into the accounts row as a Facebook id, colliding in
  // a namespace it does not belong to. The provider now comes from the
  // signed payload and is checked against the list rather than trusted.
  if (!PENDING_PROVIDERS.includes(data.provider as PendingProvider)) return null
  return {
    provider: data.provider as PendingProvider,
    providerUserId: data.providerUserId,
    displayName: data.displayName,
  }
}

export const sidCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
}

export const pendingIdentityCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: PENDING_IDENTITY_MAX_AGE_SECONDS,
}

// Week 15 §2.3: where a visitor was headed when they signed in, carried
// across the OAuth round trip and through /onboarding. Unsigned on
// purpose: it only ever holds a path that already passed
// sanitizeNextDestination, and every reader sanitises it again, so a
// tampered value can at worst name another page on this same origin. It
// lives as long as the pending identity it travels beside. Shared by both
// providers: where someone was going has nothing to do with who they
// signed in with.
export const AFTER_LOGIN_COOKIE = 'after_login'
export const afterLoginCookieOptions = pendingIdentityCookieOptions

// One set of options, both providers: the state cookie's security
// properties have nothing to do with which provider issued the redirect.
export const oauthStateCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 10 * 60,
}

// The original name, kept so app/auth/facebook/* and its tests are not
// touched by a change that is not about them.
export const fbOauthStateCookieOptions = oauthStateCookieOptions
