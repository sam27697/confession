// test/fixtures.ts — small helpers shared across the numbered spec tests.

import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Db } from '../src/db.js'
import { accounts, confessions, links } from '../src/schema.js'

let counter = 0
function unique(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}-${randomUUID()}`
}

export async function createAccount(
  db: Db,
  overrides: Partial<{ displayName: string; providerUserId: string; disabledAt: Date | null }> = {},
): Promise<{ id: string; displayName: string; providerUserId: string }> {
  const displayName = overrides.displayName ?? unique('display-name')
  const providerUserId = overrides.providerUserId ?? unique('fb-user')
  const [row] = await db
    .insert(accounts)
    .values({
      provider: 'facebook',
      providerUserId,
      displayName,
      termsVersion: '2026-08-25',
      termsAcceptedAt: new Date(),
      ageAttested18: true,
      disabledAt: overrides.disabledAt ?? null,
    })
    .returning({ id: accounts.id })

  return { id: row.id, displayName, providerUserId }
}

export async function createLink(
  db: Db,
  ownerAccountId: string,
  overrides: Partial<{ enabled: boolean; slug: string }> = {},
): Promise<{ id: string; slug: string }> {
  const slug = overrides.slug ?? unique('slug')
  const [row] = await db
    .insert(links)
    .values({
      ownerAccountId,
      slug,
      enabled: overrides.enabled ?? true,
    })
    .returning({ id: links.id })

  return { id: row.id, slug }
}

export async function createConfession(
  db: Db,
  { linkId, senderAccountId, body }: { linkId: string; senderAccountId: string; body?: string },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(confessions)
    .values({
      linkId,
      senderAccountId,
      body: body ?? unique('confession body'),
      createdHour: sql`date_trunc('hour', now())`,
    })
    .returning({ id: confessions.id })

  return { id: row.id }
}
