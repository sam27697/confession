// scripts/migrate.mjs
//
// Applies the .sql files in drizzle/ to the database named by DATABASE_URL,
// in filename order, once each. Runs at container start, before the web
// server listens: a container that comes up serving requests against a
// half-migrated database is worse than a container that does not come up.
//
// This deliberately applies the SAME files the test harness applies
// (test/harness.ts). There is no drizzle-kit push and no schema sync
// anywhere in this project. What runs on the box is what the tests ran.
//
// Exits non-zero on any failure. Each file is one transaction, so a file
// that fails leaves nothing behind and can be re-run after the fix.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, 'drizzle')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('migrate: DATABASE_URL is not set')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })

// The database is starting up in the same compose stack, so a connection
// refused on the first try is normal rather than an error.
async function connectWithRetry(attempts = 30, delayMs = 1000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await client.connect()
      return
    } catch (err) {
      if (i === attempts) throw err
      console.error(`migrate: database not ready (attempt ${i}/${attempts}), retrying`)
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}

async function main() {
  await connectWithRetry()

  await client.query(`
    create table if not exists _applied_migrations (
      filename    text primary key,
      applied_at  timestamptz not null default now()
    )
  `)

  const { rows } = await client.query('select filename from _applied_migrations')
  const applied = new Set(rows.map((r) => r.filename))

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    console.error('migrate: no .sql files found in ' + migrationsDir)
    process.exit(1)
  }

  let ran = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const sqlText = readFileSync(path.join(migrationsDir, file), 'utf8')
    try {
      await client.query('begin')
      await client.query(sqlText)
      await client.query('insert into _applied_migrations (filename) values ($1)', [file])
      await client.query('commit')
      console.log(`migrate: applied ${file}`)
      ran++
    } catch (err) {
      await client.query('rollback').catch(() => {})
      console.error(`migrate: FAILED on ${file}: ${err.message}`)
      process.exit(1)
    }
  }

  console.log(`migrate: ${ran} applied, ${files.length - ran} already present`)
  await client.end()
}

main().catch((err) => {
  console.error('migrate: ' + err.message)
  process.exit(1)
})
