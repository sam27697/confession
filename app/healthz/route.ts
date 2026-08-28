import { sql } from 'drizzle-orm'
import { getDb } from '../_lib/domain/db.js'

export async function GET() {
  try {
    const db = getDb()
    await db.execute(sql`select 1`)
    return new Response('ok', { status: 200 })
  } catch (err) {
    // error class only — never the message, which could echo query context
    // (spec §1 rule 3).
    console.error('healthz check failed', err instanceof Error ? err.name : 'unknown')
    return new Response('unavailable', { status: 503 })
  }
}
