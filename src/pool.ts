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
      // The default is 0, which waits forever. With the database down or
      // all ten connections busy, a request would hang until the proxy gave
      // up; five seconds and an error page is the kinder answer (week 15
      // §0.3).
      connectionTimeoutMillis: 5_000,
      // A connection nobody has used for half a minute goes back to
      // Postgres instead of holding a backend open on a quiet box.
      idleTimeoutMillis: 30_000,
      // Every query this app runs is an indexed lookup on one person's rows.
      // Anything still running after ten seconds is a bug, and Postgres
      // cancels it rather than letting it hold a connection and its locks.
      statement_timeout: 10_000,
      // A transaction left open by a crashed request would hold its locks
      // until the connection died. Postgres ends it instead.
      idle_in_transaction_session_timeout: 30_000,
      // Names this pool's backends in pg_stat_activity.
      application_name: 'confession-web',
      keepAlive: true,
      // Postgres sits on the same Docker network as the app, not reachable
      // over the internet, so there is no TLS hop to secure here (spec
      // §4.1).
      ssl: false,
    })

    // When Postgres restarts under an idle pooled connection, node-postgres
    // emits 'error' on the pool. An EventEmitter with no 'error' listener
    // throws, and the whole web process exits over a connection nobody was
    // using. The pool has already discarded that client; the next query
    // opens a fresh one. Error class and SQLSTATE only, never the message
    // (week 3 §1 rule 3).
    pool.on('error', (err: Error & { code?: string }) => {
      console.error('pg pool idle client error', err.name, err.code ?? '')
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
