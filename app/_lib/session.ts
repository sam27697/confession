// Cookie signing helper for `sid`, `pending_identity` and `fb_oauth_state`
// (spec §3.3). Not a domain function — spec §4.2 never names a src/ file
// for this, and every consumer of it (the auth routes and /onboarding) is
// web-app scope, so it is implemented here, once, and reused by both signed
// cookies (spec §3.4: "same signing helper").
//
// Wire format, verbatim from spec §3.3:
//   base64url(JSON(payload)) + '.' + base64url(HMAC-SHA256(SESSION_SECRET, payload))
// Verified with crypto.timingSafeEqual. Any parse failure is rejected
// without detail — never logged (spec §1 rule 3: no cookie value in a log).

import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './domain/env.js'

export const SID_COOKIE = 'sid'
export const PENDING_IDENTITY_COOKIE = 'pending_identity'
export const FB_OAUTH_STATE_COOKIE = 'fb_oauth_state'

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // spec §3.3
const PENDING_IDENTITY_MAX_AGE_SECONDS = 30 * 60 // spec §3.4

function hmac(payload: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url')
}

function sign(data: unknown): string {
  const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')
  return `${payload}.${hmac(payload)}`
}

// Returns the parsed payload only if the signature verifies AND `iat` is
// within `maxAgeSeconds`. Any failure returns null without detail (spec
// §3.3: "Reject on any parse failure without detail").
function verify<T extends { iat: number }>(value: string, maxAgeSeconds: number): T | null {
  const dot = value.indexOf('.')
  if (dot < 0) return null
  const payload = value.slice(0, dot)
  const signature = value.slice(dot + 1)
  const expected = hmac(payload)

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { iat?: unknown }).iat !== 'number') {
    return null
  }
  const data = parsed as T
  if (Date.now() - data.iat > maxAgeSeconds * 1000) return null
  return data
}

export type SessionPayload = { accountId: string; iat: number }

export function createSessionCookieValue(accountId: string): string {
  return sign({ accountId, iat: Date.now() } satisfies SessionPayload)
}

export function verifySessionCookieValue(value: string): { accountId: string } | null {
  const data = verify<SessionPayload>(value, SESSION_MAX_AGE_SECONDS)
  if (!data || typeof data.accountId !== 'string') return null
  return { accountId: data.accountId }
}

export type PendingIdentity = {
  provider: 'facebook'
  providerUserId: string
  displayName: string
  iat: number
}

export function createPendingIdentityCookieValue(identity: Omit<PendingIdentity, 'iat'>): string {
  return sign({ ...identity, iat: Date.now() } satisfies PendingIdentity)
}

export function verifyPendingIdentityCookieValue(
  value: string,
): { provider: 'facebook'; providerUserId: string; displayName: string } | null {
  const data = verify<PendingIdentity>(value, PENDING_IDENTITY_MAX_AGE_SECONDS)
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
