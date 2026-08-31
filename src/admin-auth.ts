// src/admin-auth.ts
//
// Pure functions over strings for admin authentication: the admin session
// cookie's signing and verification (spec §2.1) and the admin password hash
// (spec §2.2). No database import here -- src/admin.ts is the half of this
// that touches Postgres, the same split as src/session.ts (framework-free,
// directly testable) versus app/_lib/session.ts (the cookie-shaped wrapper).

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { signPayload, verifyPayload } from './session.js'

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000

// Eight hours, not seven days (spec §2.1): a user session is a convenience,
// an admin session is a key to every sender's identity in the product, so
// it expires the same working day.
export const ADMIN_SESSION_MAX_AGE_MS = EIGHT_HOURS_MS

// Derived, not configured (spec §2.1): no new required environment
// variable, and a domain-separated key means a valid user `sid` cookie can
// never be replayed as `admin_sid` and vice versa, because the two are
// signed under different keys.
export function adminSessionKey(sessionSecret: string): string {
  return createHmac('sha256', sessionSecret).update('confession-admin-session-v1').digest('base64')
}

export type AdminSessionPayload = { adminUserId: string }
export type VerifiedAdminSession = { adminUserId: string; issuedAtMs: number }

// Reuses signPayload from src/session.ts rather than a second HMAC
// implementation -- week 4 already paid for the version of this project
// where the same primitive was written twice.
export function signAdminSession(sessionSecret: string, payload: AdminSessionPayload): string {
  return signPayload(adminSessionKey(sessionSecret), payload)
}

// Never throws (spec §2.1): returns null on any parse failure, any
// signature mismatch, an iat in the future, an iat older than
// ADMIN_SESSION_MAX_AGE_MS, or a payload whose adminUserId is not a
// non-empty string -- without distinguishing which.
//
// Returns the token's issuedAtMs (week 9 spec §1.4 item 3) alongside the
// adminUserId: verifyPayload already returns T & { iat: number }, and every
// existing caller destructures only adminUserId and is unaffected by the
// extra field.
export function verifyAdminSession(
  sessionSecret: string,
  token: string,
  nowMs?: number,
): VerifiedAdminSession | null {
  const result = verifyPayload<AdminSessionPayload>(adminSessionKey(sessionSecret), token, {
    maxAgeMs: ADMIN_SESSION_MAX_AGE_MS,
    nowMs,
  })
  if (!result) return null
  if (typeof result.adminUserId !== 'string' || result.adminUserId.length === 0) return null
  return { adminUserId: result.adminUserId, issuedAtMs: result.iat }
}

// Pure, exported and importable with no next/headers in the require chain
// (week 9 spec §5 item 4): the revocation decision app/admin/_lib/auth.ts
// makes on every protected admin request, over the two raw instants alone.
// Refused when loggedOutBefore is not null and issuedAtMs <= loggedOutBefore
// -- <= rather than < so a token issued in the same millisecond as a logout
// is refused rather than honoured (spec §1.3).
export function isAdminSessionRevoked(issuedAtMs: number, loggedOutBefore: Date | null): boolean {
  if (loggedOutBefore === null) return false
  return issuedAtMs <= loggedOutBefore.getTime()
}

// ---------------------------------------------------------------------------
// Password hashing (spec §2.2). node:crypto scryptSync -- no dependency is
// added to this project for this.
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEY_LENGTH = 32
const SCRYPT_SALT_LENGTH = 16

// Node's default scryptSync maxmem (32 MiB) is sized for a smaller N than
// this module always uses. The working set for scrypt is on the order of
// 128 * N * r bytes, so the ceiling passed to scryptSync below is computed
// from the actual N and r in play, with a factor of two of headroom, rather
// than relying on the default holding.
function scryptMaxmem(N: number, r: number): number {
  return Math.max(32 * 1024 * 1024, 128 * N * r * 2)
}

// Stored format, exactly: scrypt$<N>$<r>$<p>$<base64url(salt)>$<base64url(key)>
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_LENGTH)
  const key = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: scryptMaxmem(SCRYPT_N, SCRYPT_R),
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

type ParsedHash = { N: number; r: number; p: number; salt: Buffer; key: Buffer }

function isBase64UrlField(value: string): boolean {
  return value.length > 0 && /^[A-Za-z0-9_-]+$/.test(value)
}

function parsePositiveInt(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Shared by verifyAdminPassword and isAdminPasswordHash. Returns null for
// anything that is not exactly the stored format hashAdminPassword
// produces -- never throws, on any input.
function parseStoredHash(stored: string): ParsedHash | null {
  if (typeof stored !== 'string') return null
  const parts = stored.split('$')
  if (parts.length !== 6) return null
  const [scheme, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts
  if (scheme !== 'scrypt') return null

  const N = parsePositiveInt(nRaw)
  const r = parsePositiveInt(rRaw)
  const p = parsePositiveInt(pRaw)
  if (N === null || r === null || p === null) return null

  if (!isBase64UrlField(saltRaw) || !isBase64UrlField(keyRaw)) return null

  let salt: Buffer
  let key: Buffer
  try {
    salt = Buffer.from(saltRaw, 'base64url')
    key = Buffer.from(keyRaw, 'base64url')
  } catch {
    return null
  }
  if (salt.length === 0 || key.length === 0) return null

  return { N, r, p, salt, key }
}

// Used by src/env.ts (spec §2.4) to reject a misconfigured deploy at
// startup instead of at the first login attempt.
export function isAdminPasswordHash(value: string): boolean {
  return parseStoredHash(value) !== null
}

// Parses the stored string, recomputes with the STORED parameters and salt,
// and compares with timingSafeEqual. Never throws -- false on a malformed
// string, an unknown algorithm prefix, a bad base64url field, non-integer
// parameters, or a length mismatch (spec §2.2).
export function verifyAdminPassword(password: string, stored: string): boolean {
  const parsed = parseStoredHash(stored)
  if (!parsed) return false

  let derived: Buffer
  try {
    derived = scryptSync(password, parsed.salt, parsed.key.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      maxmem: scryptMaxmem(parsed.N, parsed.r),
    })
  } catch {
    return false
  }

  if (derived.length !== parsed.key.length) return false
  return timingSafeEqual(derived, parsed.key)
}
