// src/db.ts
//
// Shared type for the drizzle handle passed into views.ts / actions.ts.
// Week 2 aliased this to PgliteDatabase, since the only driver in the room
// was PGlite (no Postgres server, no Docker, in that container). Week 3
// runs the real server against Postgres 17 over node-postgres (src/pool.ts)
// while the test suite keeps running on PGlite (test/harness.ts). Both are
// drivers of the same driver-agnostic drizzle type, so the alias widens to
// that instead of picking one driver (spec §4.1).

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './schema.js'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
