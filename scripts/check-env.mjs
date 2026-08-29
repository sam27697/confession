// scripts/check-env.mjs
//
// Validates the environment before anything else runs (week 9 spec §4,
// Finding D): calls the same checks src/env.ts's loadEnv performs, exits 0
// silently on success, and on a throw prints `check-env: <message>` to
// stderr and exits 1. Runs first in docker-entrypoint.sh, before
// migrate.mjs, because a stack that cannot serve a request should not have
// written to the database.
//
// It prints no variable VALUES, ever -- only the thrown message, and every
// message below is written so it never contains one (spec §2.4 rule 2,
// carried over unchanged).
//
// This does NOT import src/env.ts's loadEnv. It cannot: this file is
// copied into the runtime image as a plain .mjs, run by `node` directly
// (see docker-entrypoint.sh and the Dockerfile COPY list), the same way
// migrate.mjs and bootstrap-admin.mjs already are. Neither of those two
// imports anything from src/ either -- src/ is TypeScript and is not
// copied into the runtime image at all; only `.next/standalone`,
// `.next/static`, `public`, `drizzle`, `migrate.mjs` and
// `bootstrap-admin.mjs` are (Dockerfile, runtime stage). `next build`
// compiles src/env.ts into Next's own webpack bundle for the web server,
// but that bundle has no stable, importable entry point -- it is one
// minified IIFE per route with module ids assigned per build, not a
// package. So this script re-states loadEnv's checks directly, in plain
// JS, the same way migrate.mjs and bootstrap-admin.mjs already re-state
// their own minimal process.env reads rather than importing src/env.ts.
// Every message below is transcribed from src/env.ts so the two describe
// the same contract; if src/env.ts's checks change, this file must change
// with it by hand, because there is no shared module for the two to share.

function required(source, name) {
  const value = source[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(`missing required environment variable ${name}`)
  }
  return value
}

// Mirrors src/admin-auth.ts's isAdminPasswordHash -- a format check only,
// no scrypt derivation, so no node:crypto import is needed here.
function isAdminPasswordHash(value) {
  if (typeof value !== 'string') return false
  const parts = value.split('$')
  if (parts.length !== 6) return false
  const [scheme, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts
  if (scheme !== 'scrypt') return false

  for (const raw of [nRaw, rRaw, pRaw]) {
    if (!/^[0-9]+$/.test(raw)) return false
    const n = Number(raw)
    if (!Number.isInteger(n) || n <= 0) return false
  }

  const isBase64UrlField = (v) => v.length > 0 && /^[A-Za-z0-9_-]+$/.test(v)
  if (!isBase64UrlField(saltRaw) || !isBase64UrlField(keyRaw)) return false

  try {
    if (Buffer.from(saltRaw, 'base64url').length === 0) return false
    if (Buffer.from(keyRaw, 'base64url').length === 0) return false
  } catch {
    return false
  }

  return true
}

// Re-states src/env.ts's loadEnv, check for check, message for message.
function checkEnv(source) {
  required(source, 'DATABASE_URL')

  const sessionSecret = required(source, 'SESSION_SECRET')
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new Error('SESSION_SECRET must be at least 32 bytes (spec §2 — it is the HMAC key for the session cookie)')
  }

  const appOrigin = required(source, 'APP_ORIGIN')

  const allowDevLogin = source.ALLOW_DEV_LOGIN === '1'
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

  const adminBootstrapUsername = source.ADMIN_BOOTSTRAP_USERNAME?.trim() || null
  const adminBootstrapPasswordHash = source.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim() || null

  if ((adminBootstrapUsername === null) !== (adminBootstrapPasswordHash === null)) {
    throw new Error(
      'ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD_HASH must both be set or both be left unset (spec §2.4)',
    )
  }

  if (adminBootstrapUsername !== null && adminBootstrapUsername.length < 3) {
    throw new Error('ADMIN_BOOTSTRAP_USERNAME must be at least 3 characters after trimming (spec §2.4)')
  }

  if (adminBootstrapPasswordHash !== null && !isAdminPasswordHash(adminBootstrapPasswordHash)) {
    throw new Error(
      'ADMIN_BOOTSTRAP_PASSWORD_HASH is not a valid scrypt hash of the form scrypt$N$r$p$salt$key (spec §2.4)',
    )
  }
}

try {
  checkEnv(process.env)
  process.exit(0)
} catch (err) {
  console.error('check-env: ' + err.message)
  process.exit(1)
}
