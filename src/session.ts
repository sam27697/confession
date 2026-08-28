// src/session.ts
//
// The signed-cookie primitive behind both cookies this slice uses: `sid`
// (spec §3.3) and `pending_identity` (spec §3.4). Deliberately framework-
// free — no Next.js import anywhere in this file — so signing and
// verification are testable with plain node:test against plain strings,
// with no cookie, header or request object involved.
//
// Token shape: base64url(JSON(payload including iat)) + '.' +
// base64url(HMAC-SHA256(secret, that base64url string)).

import { createHmac, timingSafeEqual } from 'node:crypto'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const THIRTY_MINUTES_MS = 30 * 60 * 1000

// Named per spec §3.3/§3.4 rather than left as magic numbers at call sites.
export const SESSION_MAX_AGE_MS = SEVEN_DAYS_MS
export const PENDING_IDENTITY_MAX_AGE_MS = THIRTY_MINUTES_MS

function hmac(secret: string, encodedBody: string): Buffer {
  return createHmac('sha256', secret).update(encodedBody).digest()
}

// Signs an arbitrary JSON-serialisable payload, with `iat` (issued-at,
// epoch ms) stamped in alongside it. Both cookies in this slice — `sid` and
// `pending_identity` — are this same primitive with a different payload
// shape and a different max-age enforced at verify time.
export function signPayload<T extends object>(secret: string, payload: T): string {
  const encodedBody = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() }), 'utf8').toString('base64url')
  const signature = hmac(secret, encodedBody).toString('base64url')
  return `${encodedBody}.${signature}`
}

// Rejects on any parse failure, any signature mismatch, a foreign secret,
// or an `iat` older than maxAgeMs — all without distinguishing which,
// returning null rather than throwing (spec §3.3: "reject on any parse
// failure without detail"). `nowMs` is overridable so a caller — a test in
// particular — can assert expiry without waiting for real time to pass.
export function verifyPayload<T>(
  secret: string,
  token: string,
  { maxAgeMs, nowMs = Date.now() }: { maxAgeMs: number; nowMs?: number },
): (T & { iat: number }) | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encodedBody, signature] = parts
  if (encodedBody.length === 0 || signature.length === 0) return null

  const expected = hmac(secret, encodedBody)
  let actual: Buffer
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  // timingSafeEqual throws on unequal-length buffers rather than returning
  // false, so a length mismatch is checked first — the length of a valid
  // signature is fixed and public, so this leaks nothing a tamperer does
  // not already know.
  if (actual.length !== expected.length) return null
  if (!timingSafeEqual(actual, expected)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const iat = (parsed as { iat?: unknown }).iat
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return null
  if (iat > nowMs) return null // a token signed in the future is not valid now either
  if (nowMs - iat > maxAgeMs) return null

  return parsed as T & { iat: number }
}

export type SessionPayload = { accountId: string }

// The cookie holds the viewer's own account id and nothing else — no
// display name, no provider id, no link slug (spec §3.3).
export function signSession(secret: string, payload: SessionPayload): string {
  return signPayload(secret, payload)
}

export function verifySession(secret: string, token: string, nowMs?: number): SessionPayload | null {
  const result = verifyPayload<SessionPayload>(secret, token, { maxAgeMs: SESSION_MAX_AGE_MS, nowMs })
  if (!result) return null
  if (typeof result.accountId !== 'string' || result.accountId.length === 0) return null
  return { accountId: result.accountId }
}
