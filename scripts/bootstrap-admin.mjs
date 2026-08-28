// scripts/bootstrap-admin.mjs
//
// Idempotently upserts the single bootstrap administrator row, from
// ADMIN_BOOTSTRAP_USERNAME / ADMIN_BOOTSTRAP_PASSWORD_HASH (spec §2.5).
// Plain ESM using pg directly, modelled on scripts/migrate.mjs, and run by
// docker-entrypoint.sh after the migration step and before the server
// starts.
//
// This script performs no hashing and has no code path that could print a
// password, because it never receives one -- only the already-computed
// hash. The hash is generated off the server, once, by
// scripts/hash-admin-password.ts, the only place in this project that
// calls hashAdminPassword.

import pg from 'pg'

const username = process.env.ADMIN_BOOTSTRAP_USERNAME

// It is not an error to run a stack without an administrator (spec §2.5).
if (!username) {
  console.log('bootstrap-admin: ADMIN_BOOTSTRAP_USERNAME is not set, admin access is not configured')
  process.exit(0)
}

const passwordHash = process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH

const url = process.env.DATABASE_URL
if (!url) {
  console.error('bootstrap-admin: DATABASE_URL is not set')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })

async function main() {
  await client.connect()

  // ON CONFLICT DO UPDATE makes this idempotent and doubles as the
  // password-rotation path: change the hash in the stack's .env, redeploy,
  // done (spec §2.5).
  await client.query(
    `insert into admin_users (username, password_hash) values ($1, $2)
     on conflict (username) do update set password_hash = excluded.password_hash`,
    [username, passwordHash],
  )

  // The username only, never the hash (spec §2.5).
  console.log(`bootstrap-admin: admin user ${username} is provisioned`)
  await client.end()
}

main().catch((err) => {
  console.error('bootstrap-admin: ' + err.message)
  process.exit(1)
})
