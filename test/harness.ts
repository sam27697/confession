// test/harness.ts
//
// Applies the ACTUAL migration files in drizzle/ — not a drizzle-kit push,
// not a schema sync — to a fresh in-memory PGlite instance (spec §3, §6).
// This is what runs on the real box, so it is what runs in the tests.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '../src/schema.js'
import type { Db } from '../src/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', 'drizzle')

function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

export async function freshDb(): Promise<{ db: Db; client: PGlite; migrations: string[] }> {
  const client = new PGlite()
  const files = migrationFiles()
  for (const file of files) {
    const sqlText = readFileSync(path.join(migrationsDir, file), 'utf8')
    await client.exec(sqlText)
  }
  const db = drizzle(client, { schema })
  return { db, client, migrations: files }
}
