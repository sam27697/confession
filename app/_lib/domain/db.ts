// Re-export point for the shared Postgres handle built by builder A in
// src/pool.ts (spec §4.1: "creates the node-postgres Pool and the drizzle
// handle from DATABASE_URL, exported as a lazily-initialised singleton").
// Centralised here so that if the real export name differs once src/pool.ts
// lands, only this one file needs to change.
export { getDb } from '../../../src/pool.js'
export type { Db } from '../../../src/db.js'
