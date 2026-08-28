// src/pool.ts
//
// The node-postgres handle for the real deploy (spec §4.1). Tests never
// import this file — they build a Db over PGlite via test/harness.ts,
// against the same migration files. This is the other driver of the same
// driver-agnostic `Db` type (src/db.ts), wired up once, lazily, and reused
// for the life of the process.

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'
import { getEnv } from './env.js'
import type { Db } from './db.js'

let pool: Pool | null = null
let db: Db | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getEnv().databaseUrl,
      max: 10,
      // Postgres sits on the same Docker network as the app, not reachable
      // over the internet, so there is no TLS hop to secure here (spec
      // §4.1).
      ssl: false,
    })
  }
  return pool
}

export function getDb(): Db {
  if (!db) {
    db = drizzle(getPool(), { schema })
  }
  return db
}
