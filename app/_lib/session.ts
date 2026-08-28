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

export type PendingIdentity = {
  provider: 'facebook'
  providerUserId: string
  displayName: string
}

export function createPendingIdentityCookieValue(identity: PendingIdentity): string {
  return sign(identity satisfies PendingIdentity)
}

export function verifyPendingIdentityCookieValue(
  value: string,
): { provider: 'facebook'; providerUserId: string; displayName: string } | null {
  const data = verify<PendingIdentity>(value, PENDING_IDENTITY_MAX_AGE_MS)
  if (!data || typeof data.providerUserId !== 'string' || typeof data.displayName !== 'string') return null
  return { provider: 'facebook', providerUserId: data.providerUserId, displayName: data.displayName }
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

export const fbOauthStateCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 10 * 60,
}
