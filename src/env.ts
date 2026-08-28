// src/env.ts
//
// All configuration comes from environment variables, read once through
// this module and nowhere else (spec §2) — no process.env reads scattered
// through route handlers or domain code. loadEnv is a pure function over an
// env-var record so it can be validated in a test without touching the
// process's real environment; `env` is the eagerly-validated singleton
// every other module imports for normal use.

import { isAdminPasswordHash } from './admin-auth.js'

export type Env = {
  databaseUrl: string
  sessionSecret: string
  appOrigin: string
  facebookAppId: string | null
  facebookAppSecret: string | null
  // 1 enables POST /auth/dev, the local test-identity login (spec §3.2).
  // Must be absent in production — see the APP_ORIGIN check below.
  allowDevLogin: boolean
  port: number
  // The week 7 admin surface (spec §2.4). Both optional; the deploy rules
  // below make "half set" a startup failure rather than a state to run in.
  adminBootstrapUsername: string | null
  adminBootstrapPasswordHash: string | null
  adminEnabled: boolean
}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(`missing required environment variable ${name}`)
  }
  return value
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = required(source, 'DATABASE_URL')

  const sessionSecret = required(source, 'SESSION_SECRET')
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new Error('SESSION_SECRET must be at least 32 bytes (spec §2 — it is the HMAC key for the session cookie)')
  }

  const appOrigin = required(source, 'APP_ORIGIN')

  const facebookAppId = source.FACEBOOK_APP_ID?.trim() || null
  const facebookAppSecret = source.FACEBOOK_APP_SECRET?.trim() || null

  const allowDevLogin = source.ALLOW_DEV_LOGIN === '1'
  // The one genuinely dangerous switch in this slice (spec §2): refuse to
  // start rather than let a production-looking deploy accidentally ship
  // the dev-identity login. "Looks like staging or local" is a narrower
  // check than "is not production" on purpose — it has to fail closed.
  if (allowDevLogin && !(appOrigin.startsWith('https://stg.') || appOrigin.startsWith('http://localhost'))) {
    throw new Error(
      'ALLOW_DEV_LOGIN=1 refuses to start unless APP_ORIGIN begins with https://stg. or http://localhost (spec §2)',
    )
  }

  const portRaw = source.PORT
  const port = portRaw === undefined || portRaw.trim() === '' ? 3000 : Number(portRaw)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer')
  }

  // Spec §2.4 rule 1: half-configured admin access is a configuration
  // error, not a state to run in.
  const adminBootstrapUsername = source.ADMIN_BOOTSTRAP_USERNAME?.trim() || null
  const adminBootstrapPasswordHash = source.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim() || null

  if ((adminBootstrapUsername === null) !== (adminBootstrapPasswordHash === null)) {
    throw new Error(
      'ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD_HASH must both be set or both be left unset (spec §2.4)',
    )
  }

  // Spec §2.4 rule 3: the same floor as the admin_users_username_nonblank
  // CHECK in drizzle/0002_admin.sql, so the two cannot disagree.
  if (adminBootstrapUsername !== null && adminBootstrapUsername.length < 3) {
    throw new Error('ADMIN_BOOTSTRAP_USERNAME must be at least 3 characters after trimming (spec §2.4)')
  }

  // Spec §2.4 rule 2: the malformed value is never included in the thrown
  // message, only the expected shape.
  if (adminBootstrapPasswordHash !== null && !isAdminPasswordHash(adminBootstrapPasswordHash)) {
    throw new Error(
      'ADMIN_BOOTSTRAP_PASSWORD_HASH is not a valid scrypt hash of the form scrypt$N$r$p$salt$key (spec §2.4)',
    )
  }

  const adminEnabled = adminBootstrapUsername !== null

  return {
    databaseUrl,
    sessionSecret,
    appOrigin,
    facebookAppId,
    facebookAppSecret,
    allowDevLogin,
    port,
    adminBootstrapUsername,
    adminBootstrapPasswordHash,
    adminEnabled,
  }
}

// Lazily-initialised singleton, not a top-level `loadEnv()` call: importing
// this module (e.g. to reach `loadEnv` from a test) must not itself throw
// just because the process the test runs in has no DATABASE_URL set. The
// real app calls `getEnv()` once at startup, which is where "read once"
// actually happens, and every later call returns the same validated value.
let cached: Env | null = null

export function getEnv(): Env {
  if (!cached) cached = loadEnv()
  return cached
}
