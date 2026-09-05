// scripts/setup-local-db.mjs
//
// Creates the local development database if it does not exist, then hands
// off to scripts/migrate.mjs.
//
// It does the one thing migrate.mjs cannot -- CREATE DATABASE has to run on
// a connection to some *other* database -- and deliberately nothing else.
// An earlier draft of this file carried its own copy of the migration loop,
// which is a second implementation of the thing migrate.mjs's own header
// says must have exactly one ("What runs on the box is what the tests ran").
// Two runners drift, and the one that drifts is the one nobody deploys.
//
// Connection details come from DATABASE_URL, the same variable the app,
// the container entrypoint and migrate.mjs read. No credentials live in
// this file.
//
//   DATABASE_URL=postgres://user:pass@localhost:5432/confession_dev \
//     node scripts/setup-local-db.mjs

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))

const url = process.env.DATABASE_URL
if (!url) {
  console.error('setup-local-db: DATABASE_URL is not set')
  console.error('setup-local-db: e.g. postgres://postgres:postgres@localhost:5432/confession_dev')
  process.exit(1)
}

const parsed = new URL(url)
const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
if (!dbName) {
  console.error(`setup-local-db: DATABASE_URL names no database: ${parsed.pathname || '(empty path)'}`)
  process.exit(1)
}

// CREATE DATABASE cannot run inside the database being created, so the
// bootstrap connection goes to the server's default 'postgres' database.
const adminUrl = new URL(url)
adminUrl.pathname = '/postgres'

async function main() {
  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  try {
    const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [dbName])
    if (rowCount === 0) {
      // The name comes from an operator's own DATABASE_URL rather than from
      // user input, but CREATE DATABASE takes no parameter placeholder, so
      // the identifier is quoted properly instead of interpolated raw.
      await admin.query(`create database "${dbName.replace(/"/g, '""')}"`)
      console.log(`setup-local-db: created database ${dbName}`)
    } else {
      console.log(`setup-local-db: database ${dbName} already exists`)
    }
  } finally {
    await admin.end()
  }

  const migrate = spawnSync(process.execPath, [path.join(here, 'migrate.mjs')], {
    stdio: 'inherit',
    env: process.env,
  })
  if (migrate.status !== 0) {
    console.error('setup-local-db: migrate.mjs failed')
    process.exit(migrate.status ?? 1)
  }
  console.log('setup-local-db: ready')
}

main().catch((err) => {
  console.error('setup-local-db: ' + err.message)
  process.exit(1)
})
