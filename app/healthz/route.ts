import { sql } from 'drizzle-orm'
import { getDb } from '../_lib/domain/db.js'

// A health answer is true for the instant it was computed. A cache between
// the container and whoever is asking must never replay an old "ok".
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET() {
  try {
    const db = getDb()
    await db.execute(sql`select 1`)
    return new Response('ok', { status: 200, headers: NO_STORE })
  } catch (err) {
    // error class only — never the message, which could echo query context
    // (spec §1 rule 3).
    console.error('healthz check failed', err instanceof Error ? err.name : 'unknown')
    return new Response('unavailable', { status: 503, headers: NO_STORE })
  }
}
