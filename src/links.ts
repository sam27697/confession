// src/links.ts
//
// The link is the recipient's public handle — the URL she gives out and the
// one thing a sender resolves against. getLinkBySlug is the only query in
// this slice that a public, unauthenticated route (the send page) is
// allowed to call, and it returns ownerAccountId only so the server can
// check "is the viewer the owner" — that field is never rendered (spec
// §4.2).

import { eq } from 'drizzle-orm'
import type { Db } from './db.js'
import { accounts, links } from './schema.js'
import { ViewerNotLinkOwnerError } from './errors.js'

export type LinkForSend = {
  linkId: string
  ownerAccountId: string
  ownerDisplayName: string
  enabled: boolean
}

export async function getLinkBySlug(db: Db, { slug }: { slug: string }): Promise<LinkForSend | null> {
  const [row] = await db
    .select({
      linkId: links.id,
      ownerAccountId: links.ownerAccountId,
      ownerDisplayName: accounts.displayName,
      enabled: links.enabled,
    })
    .from(links)
    .innerJoin(accounts, eq(accounts.id, links.ownerAccountId))
    .where(eq(links.slug, slug))
    .limit(1)

  return row ?? null
}

export type LinkForOwner = {
  linkId: string
  slug: string
  enabled: boolean
}

export async function getLinkForOwner(db: Db, { ownerAccountId }: { ownerAccountId: string }): Promise<LinkForOwner | null> {
  const [row] = await db
    .select({
      linkId: links.id,
      slug: links.slug,
      enabled: links.enabled,
    })
    .from(links)
    .where(eq(links.ownerAccountId, ownerAccountId))
    .limit(1)

  return row ?? null
}

// Terms clause 6: "you can switch your link off ... at any time." Throws
// ViewerNotLinkOwnerError if the caller does not own the link — ownership
// is re-checked here rather than trusted from a form field (spec §5.3).
export async function setLinkEnabled(
  db: Db,
  { ownerAccountId, linkId, enabled }: { ownerAccountId: string; linkId: string; enabled: boolean },
): Promise<void> {
  const [row] = await db.select({ ownerAccountId: links.ownerAccountId }).from(links).where(eq(links.id, linkId)).limit(1)

  if (!row || row.ownerAccountId !== ownerAccountId) {
    throw new ViewerNotLinkOwnerError()
  }

  await db.update(links).set({ enabled }).where(eq(links.id, linkId))
}
