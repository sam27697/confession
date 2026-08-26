// src/actions.ts
//
// The mutating half of §2: sendConfession, the reveal-offer state machine,
// and adminReveal (a write that returns a read). Every rejection in
// sendConfession is a distinct typed error EXCEPT the blocked-sender path,
// which must be indistinguishable from success to the sender (spec §2) —
// see the comment on that branch below.

import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { Db } from './db.js'
import {
  accounts,
  adminRevealLog,
  confessions,
  linkBlocks,
  links,
  revealAnswers,
  revealOffers,
  sendCounters,
} from './schema.js'
import {
  LinkDisabledError,
  LinkNotFoundError,
  NotYourConfessionError,
  OfferNotPendingError,
  PerAccountRateLimitExceededError,
  PerLinkRateLimitExceededError,
  RevealOfferNotFoundError,
  SenderAccountDisabledError,
} from './errors.js'
import { MAX_PER_ACCOUNT_PER_DAY, MAX_PER_LINK_PER_HOUR } from './limits.js'

export type AdminRevealedSender = {
  confessionId: string
  senderAccountId: string
  senderDisplayName: string
}

// One transaction: insert the log row, then return the identity. If the
// insert fails (blank reason — enforced by the CHECK constraint in
// drizzle/0001_constraints.sql), the transaction rolls back and nothing is
// returned (spec §2, §4.3 test 7).
export async function adminReveal(
  db: Db,
  { adminAccountId, confessionId, reason }: { adminAccountId: string; confessionId: string; reason: string },
): Promise<AdminRevealedSender> {
  return db.transaction(async (tx) => {
    await tx.insert(adminRevealLog).values({
      adminAccountId,
      confessionId,
      reason,
    })

    const [row] = await tx
      .select({
        senderAccountId: accounts.id,
        senderDisplayName: accounts.displayName,
      })
      .from(confessions)
      .innerJoin(accounts, eq(accounts.id, confessions.senderAccountId))
      .where(eq(confessions.id, confessionId))
      .limit(1)

    if (!row) throw new Error(`no confession ${confessionId}`)

    return {
      confessionId,
      senderAccountId: row.senderAccountId,
      senderDisplayName: row.senderDisplayName,
    }
  })
}

export type SendConfessionResult = { confessionId: string }

// Checks, in order (spec §2): link exists and enabled; sender not blocked
// on that link; sender's account not disabled; rate limits; then inserts.
export async function sendConfession(
  db: Db,
  { senderAccountId, linkSlug, body }: { senderAccountId: string; linkSlug: string; body: string },
): Promise<SendConfessionResult> {
  const [link] = await db
    .select({ id: links.id, enabled: links.enabled })
    .from(links)
    .where(eq(links.slug, linkSlug))
    .limit(1)

  if (!link) throw new LinkNotFoundError(linkSlug)
  if (!link.enabled) throw new LinkDisabledError(linkSlug)

  const [blocked] = await db
    .select({ id: linkBlocks.id })
    .from(linkBlocks)
    .where(and(eq(linkBlocks.linkId, link.id), eq(linkBlocks.blockedAccountId, senderAccountId)))
    .limit(1)

  if (blocked) {
    // The block check must be indistinguishable from success to the
    // sender (spec §2): a blocked sender who gets an error learns he is
    // blocked, which tells him the recipient acted on him. So: return a
    // success-shaped result and write nothing. The id is not tied to any
    // row — there is nothing in the database to look up it against.
    return { confessionId: randomUUID() }
  }

  const [sender] = await db
    .select({ disabledAt: accounts.disabledAt })
    .from(accounts)
    .where(eq(accounts.id, senderAccountId))
    .limit(1)

  if (!sender) throw new Error(`no account ${senderAccountId}`)
  if (sender.disabledAt !== null) throw new SenderAccountDisabledError()

  return db.transaction(async (tx) => {
    const [{ hourCount }] = await tx.execute<{ hourCount: number }>(sql`
      select coalesce(count, 0)::int as "hourCount"
      from ${sendCounters}
      where ${sendCounters.senderAccountId} = ${senderAccountId}
        and ${sendCounters.linkId} = ${link.id}
        and ${sendCounters.windowHour} = date_trunc('hour', now())
    `).then((r) => (r.rows.length ? r.rows : [{ hourCount: 0 }]))

    if (hourCount >= MAX_PER_LINK_PER_HOUR) {
      throw new PerLinkRateLimitExceededError(MAX_PER_LINK_PER_HOUR)
    }

    const [{ dayTotal }] = await tx.execute<{ dayTotal: number }>(sql`
      select coalesce(sum(count), 0)::int as "dayTotal"
      from ${sendCounters}
      where ${sendCounters.senderAccountId} = ${senderAccountId}
        and ${sendCounters.windowHour} >= date_trunc('day', now())
        and ${sendCounters.windowHour} < date_trunc('day', now()) + interval '1 day'
    `).then((r) => r.rows)

    if (dayTotal >= MAX_PER_ACCOUNT_PER_DAY) {
      throw new PerAccountRateLimitExceededError(MAX_PER_ACCOUNT_PER_DAY)
    }

    const [inserted] = await tx
      .insert(confessions)
      .values({
        linkId: link.id,
        senderAccountId,
        body,
        createdHour: sql`date_trunc('hour', now())`,
      })
      .returning({ id: confessions.id })

    await tx.execute(sql`
      insert into ${sendCounters} (sender_account_id, link_id, window_hour, count)
      values (${senderAccountId}, ${link.id}, date_trunc('hour', now()), 1)
      on conflict (sender_account_id, link_id, window_hour)
      do update set count = ${sendCounters.count} + 1
    `)

    return { confessionId: inserted.id }
  })
}

export type OpenRevealOfferResult = { offerId: string }

export async function openRevealOffer(
  db: Db,
  {
    recipientAccountId,
    confessionId,
    questionForSender,
    stakePrompt,
    recipientAnswer,
  }: {
    recipientAccountId: string
    confessionId: string
    questionForSender: string
    stakePrompt: string
    recipientAnswer: string
  },
): Promise<OpenRevealOfferResult> {
  const [row] = await db
    .select({ ownerAccountId: links.ownerAccountId })
    .from(confessions)
    .innerJoin(links, eq(links.id, confessions.linkId))
    .where(eq(confessions.id, confessionId))
    .limit(1)

  if (!row) throw new Error(`no confession ${confessionId}`)
  if (row.ownerAccountId !== recipientAccountId) throw new NotYourConfessionError()

  // Spec §1 state machine, step 1: her own answer is written in the same
  // transaction as the offer — she stakes first, sight unseen. The deferred
  // constraint trigger in drizzle/0001_constraints.sql raises at COMMIT if
  // this invariant is ever violated by a future change here.
  return db.transaction(async (tx) => {
    const [offer] = await tx
      .insert(revealOffers)
      .values({ confessionId, questionForSender, stakePrompt, createdAt: new Date() })
      .returning({ id: revealOffers.id })

    await tx.insert(revealAnswers).values({
      offerId: offer.id,
      side: 'recipient',
      body: recipientAnswer,
    })

    return { offerId: offer.id }
  })
}

async function loadOfferForSender(db: Db, offerId: string, senderAccountId: string) {
  const [row] = await db
    .select({
      offerId: revealOffers.id,
      state: revealOffers.state,
      senderAccountId: confessions.senderAccountId,
    })
    .from(revealOffers)
    .innerJoin(confessions, eq(confessions.id, revealOffers.confessionId))
    .where(eq(revealOffers.id, offerId))
    .limit(1)

  if (!row) throw new RevealOfferNotFoundError(offerId)
  // spec §4.4 test 18: accepting/declining an offer on someone else's
  // confession raises.
  if (row.senderAccountId !== senderAccountId) throw new NotYourConfessionError()
  if (row.state !== 'pending') throw new OfferNotPendingError(offerId)
  return row
}

// One transaction: writes the sender answer row AND flips state to
// 'resolved' in the same transaction — both unlock at once, neither side
// reads first (spec §1 state machine, step 3).
export async function acceptRevealOffer(
  db: Db,
  { senderAccountId, offerId, senderAnswer }: { senderAccountId: string; offerId: string; senderAnswer: string },
): Promise<void> {
  await loadOfferForSender(db, offerId, senderAccountId)

  await db.transaction(async (tx) => {
    await tx.insert(revealAnswers).values({ offerId, side: 'sender', body: senderAnswer })
    await tx.update(revealOffers).set({ state: 'resolved', settledAt: new Date() }).where(eq(revealOffers.id, offerId))
  })
}

// Terminal, nothing revealed, no penalty (spec §1 step 2, DESIGN.md).
export async function declineRevealOffer(
  db: Db,
  { senderAccountId, offerId }: { senderAccountId: string; offerId: string },
): Promise<void> {
  await loadOfferForSender(db, offerId, senderAccountId)

  await db
    .update(revealOffers)
    .set({ state: 'declined', settledAt: new Date() })
    .where(eq(revealOffers.id, offerId))
}
