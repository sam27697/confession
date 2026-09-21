// test/harness.ts
//
// Applies the ACTUAL migration files in drizzle/ -- not a drizzle-kit push,
// not a schema sync -- to a fresh in-memory PGlite database (spec §3, §6).
// This is what runs on the real box, so it is what runs in the tests.
//
// WHY THIS FILE REUSES ONE PGlite INSTANCE PER PROCESS
//
// freshDb() used to answer every call with `new PGlite()`. That was correct
// but it made `npm test` fail intermittently, at the level of a whole FILE,
// with the bare message 'test failed' and no failing assertion -- while every
// named test in that file had just printed `ok`.
//
// The cause is not in this repository. Standing up one PGlite instance
// compiles SIXTEEN separate WebAssembly modules: thirteen tiny (32-33 byte)
// JS-to-WASM call trampolines that Emscripten builds through addFunction()
// at onRuntimeInitialized, plus three dynamic libraries (2 x 152 KiB and
// 1 x 568 KiB) loaded through dlopen. Closing the instance frees all
// sixteen. Each one is a V8 NativeModule that registers a JIT code
// allocation when it is built and unregisters it when it is freed, and that
// bookkeeping has a bug: under enough create/free churn V8 loses an entry
// and kills the process on the spot with
//
//   # Fatal error in , line 0
//   # Check failed: jit_page_->allocations_.erase(addr) == 1.
//   v8::internal::ThreadIsolation::UnregisterWasmAllocation
//
// That is a native abort -- Windows exit code 0x80000003, STATUS_BREAKPOINT --
// and not a JavaScript throw. Nothing can catch it, no assertion is
// involved, and the tests that already finished have already reported. All
// `node --test` can say about a child that dies that way is ERR_TEST_FAILURE
// with the string 'test failed', which is exactly the symptom that was seen.
//
// The churn was ours. test/16 called freshDb() eleven times in one process
// and test/04 nine times, so a single run of the suite built and tore down
// roughly eight hundred WebAssembly modules. Reproduced deliberately, eleven
// instances per process across eight concurrent processes aborted about one
// process in sixteen.
//
// So the instance is now created once per process and kept. Every freshDb()
// still hands back a genuinely fresh, empty, freshly-migrated database -- it
// drops and recreates the public schema and re-applies the real migration
// files, which is the same starting state a new instance gave, because the
// migrations in drizzle/ are pure public-schema DDL with no extensions, no
// roles and no seed rows. What no longer happens is the WebAssembly teardown
// between tests: sixteen modules per process instead of sixteen per test.
//
// The `client` handed back is therefore shared, and its close() releases the
// database rather than shutting the instance down -- the next freshDb() wipes
// it anyway. Everything else on the handle is the real PGlite instance.

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

let instance: PGlite | undefined
let handle: PGlite | undefined

// The tests call `await client.close()` when they are done with a database.
// Honouring that literally would destroy the one instance this process has
// and put the WebAssembly churn straight back, so the handle they get answers
// close() by releasing the database instead. It delegates every other
// property to the real instance, with `this` bound to that instance so
// PGlite's private fields keep working.
function leaseHandle(client: PGlite): PGlite {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === 'close') return async () => {}
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

async function sharedClient(): Promise<PGlite> {
  if (!instance || instance.closed) {
    instance = new PGlite()
    await instance.waitReady
    handle = leaseHandle(instance)
  }
  return handle!
}

export async function freshDb(): Promise<{ db: Db; client: PGlite; migrations: string[] }> {
  const client = await sharedClient()

  // Everything the migrations create lives in `public`, so dropping and
  // recreating it is what a brand new instance used to give: no tables, no
  // triggers, no sequences, no rows.
  await client.exec('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')

  const files = migrationFiles()
  for (const file of files) {
    const sqlText = readFileSync(path.join(migrationsDir, file), 'utf8')
    await client.exec(sqlText)
  }
  const db = drizzle(client, { schema })
  return { db, client, migrations: files }
}
