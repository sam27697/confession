// src/db.ts
//
// Shared type for the drizzle handle passed into views.ts / actions.ts.
// This slice's only driver is PGlite (spec §0: no Postgres server, no
// Docker in this container). A future deploy slice against a real Postgres
// box would use drizzle-orm/node-postgres instead; the query builder calls
// in views.ts/actions.ts are driver-agnostic drizzle-orm, so only this
// alias and the harness that builds it would need to change.

import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type * as schema from './schema.js'

export type Db = PgliteDatabase<typeof schema>
