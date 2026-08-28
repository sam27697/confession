// src/views.ts
//
// STACK.md rule 1: "excluded at the serializer, not filtered in the UI — a
// field the recipient's API response never contains cannot be found in a
// network tab." So the recipient view and the admin view are two
// *structurally different* TypeScript types, built by two *different* SQL
// queries (spec §2) — not one query with a `delete row.x`. Neither query
// below ever SELECTs confessions.sender_account_id as an output column for
// a non-admin caller; where it is needed at all (to resolve a display name
// on a *resolved* offer) it is used only inside a JOIN condition, never
// returned.
//
// 2026-08-28: that paragraph was true and it was not enough. It named ONE
// column, confessions.sender_account_id, and an adversarial review found a
// second identifier — accounts.provider_user_id, the Facebook account id —
// being selected into the recipient's resolved-reveal payload, where the
// paragraph's own reasoning says it must not be. So the rule is restated
// here as the rule it always meant: NO identifier of the sender other than
// display_name reaches a recipient-facing type from this file. Not the
// internal uuid, not the provider id, not a hash of either. If a future
// change needs one, the sentence the sender consents to changes first.
// See docs/SPEC-week2-data-model.md, CORRECTION 2026-08-28.

import { desc, eq, inArray } from 'drizzle-orm'
import type { Db } from './db.js'
import {
  accounts,
  confessions,
  links,
  revealAnswers,
  revealOffers,
} from './schema.js'
import {
  ViewerNotLinkOwnerError,
  NotYourConfessionError,
  OfferNotPendingError,
  RevealOfferNotFoundError,
} from './errors.js'

export type RecipientReveal =
  | { kind: 'none' }
  | { kind: 'offered'; offerId: string; state: 'pending' | 'declined' | 'cancelled' }
  | {
      kind: 'resolved'
      offerId: string
      // The display name and nothing else. provider_user_id used to sit here
      // and was removed on 2026-08-28 (SPEC-week2-data-model.md, CORRECTION):
      // the sender's consent screen promises «اسمك رح ينكشف» -- a NAME -- and
      // provider_user_id is the Facebook account id, which resolves to a
      // profile. Nothing rendered it, but STACK.md rule 1 draws this boundary
      // at the serializer and not in the UI, and a field that is already on
      // the object is a field one careless render away from shipping.
      senderDisplayName: string
      senderAnswer: string
      recipientAnswer: string
    }

export type RecipientConfession = {
  id: string
  body: string
  createdHour: Date
  status: 'delivered' | 'hidden_by_recipient' | 'reported'
  reveal: RecipientReveal
}

// The DEFAULT admin row — masked. `senderMasked: true` is a literal so the
// type itself cannot carry an id (STACK.md rule 3: admin lists default to
// masked).
export type AdminConfession = {
  id: string
  body: string
  createdHour: Date
  status: 'delivered' | 'hidden_by_recipient' | 'reported'
  senderMasked: true
}

export async function getInboxForRecipient(
  db: Db,
  { linkId, viewerAccountId }: { linkId: string; viewerAccountId: string },
): Promise<RecipientConfession[]> {
  const [link] = await db
    .select({ ownerAccountId: links.ownerAccountId })
    .from(links)
    .where(eq(links.id, linkId))
    .limit(1)

  // spec §4.3 test 9: throws when the viewer does not own the link. Also
  // covers "no such link" — there is nothing useful to distinguish here for
  // a recipient-facing call.
  if (!link || link.ownerAccountId !== viewerAccountId) {
    throw new ViewerNotLinkOwnerError()
  }

  const confessionRows = await db
    .select({
      id: confessions.id,
      body: confessions.body,
      createdHour: confessions.createdHour,
      status: confessions.status,
    })
    .from(confessions)
    .where(eq(confessions.linkId, linkId))

  if (confessionRows.length === 0) return []

  const confessionIds = confessionRows.map((c) => c.id)

  const offerRows = await db
    .select({
      offerId: revealOffers.id,
      confessionId: revealOffers.confessionId,
      state: revealOffers.state,
    })
    .from(revealOffers)
    .where(inArray(revealOffers.confessionId, confessionIds))

  const offerByConfessionId = new Map(offerRows.map((o) => [o.confessionId, o]))

  const resolvedOfferIds = offerRows.filter((o) => o.state === 'resolved').map((o) => o.offerId)

  // Identity + both answer bodies are only ever fetched for offers that are
  // ALREADY resolved (spec §1 step 6: "on resolved, and only then"). This is
  // the join that touches confessions.sender_account_id, and it is used only
  // as a JOIN condition — the column itself is never in the SELECT list.
  const resolvedIdentity =
    resolvedOfferIds.length === 0
      ? []
      : await db
          // accounts is still joined, because display_name lives on it. What
          // is NOT selected is provider_user_id -- see the note on
          // RecipientReveal above and the CORRECTION in
          // docs/SPEC-week2-data-model.md. Adding it back here without
          // changing the sender's consent copy first makes that copy false.
          .select({
            offerId: revealOffers.id,
            senderDisplayName: accounts.displayName,
          })
          .from(revealOffers)
          .innerJoin(confessions, eq(confessions.id, revealOffers.confessionId))
          .innerJoin(accounts, eq(accounts.id, confessions.senderAccountId))
          .where(inArray(revealOffers.id, resolvedOfferIds))

  const identityByOfferId = new Map(resolvedIdentity.map((r) => [r.offerId, r]))

  const resolvedAnswers =
    resolvedOfferIds.length === 0
      ? []
      : await db
          .select({
            offerId: revealAnswers.offerId,
            side: revealAnswers.side,
            body: revealAnswers.body,
          })
          .from(revealAnswers)
          .where(inArray(revealAnswers.offerId, resolvedOfferIds))

  const answersByOfferId = new Map<string, { recipient?: string; sender?: string }>()
  for (const a of resolvedAnswers) {
    const entry = answersByOfferId.get(a.offerId) ?? {}
    entry[a.side] = a.body
    answersByOfferId.set(a.offerId, entry)
  }

  return confessionRows.map((c) => {
    const offer = offerByConfessionId.get(c.id)
    let reveal: RecipientReveal = { kind: 'none' }
    if (offer) {
      if (offer.state === 'resolved') {
        const identity = identityByOfferId.get(offer.offerId)
        const ans = answersByOfferId.get(offer.offerId)
        if (identity && ans && ans.recipient !== undefined && ans.sender !== undefined) {
          reveal = {
            kind: 'resolved',
            offerId: offer.offerId,
            senderDisplayName: identity.senderDisplayName,
            senderAnswer: ans.sender,
            recipientAnswer: ans.recipient,
          }
        }
      } else {
        reveal = { kind: 'offered', offerId: offer.offerId, state: offer.state as 'pending' | 'declined' | 'cancelled' }
      }
    }
    return {
      id: c.id,
      body: c.body,
      createdHour: c.createdHour,
      status: c.status,
      reveal,
    }
  })
}

export type PendingOfferForSender = {
  offerId: string
  confessionId: string
  questionForSender: string
  stakePrompt: string
  state: 'pending' | 'resolved' | 'declined' | 'cancelled'
}

export async function getPendingOfferForSender(
  db: Db,
  { offerId, senderAccountId }: { offerId: string; senderAccountId: string },
): Promise<PendingOfferForSender> {
  // Deliberately selects only id/question/stake/state — never touches
  // reveal_answers at all in this query (spec §2: "and no answer bodies").
  const [row] = await db
    .select({
      offerId: revealOffers.id,
      confessionId: revealOffers.confessionId,
      questionForSender: revealOffers.questionForSender,
      stakePrompt: revealOffers.stakePrompt,
      state: revealOffers.state,
      senderAccountId: confessions.senderAccountId,
    })
    .from(revealOffers)
    .innerJoin(confessions, eq(confessions.id, revealOffers.confessionId))
    .where(eq(revealOffers.id, offerId))
    .limit(1)

  if (!row) throw new RevealOfferNotFoundError(offerId)
  if (row.senderAccountId !== senderAccountId) throw new NotYourConfessionError()
  // The function is named for the pending case (spec §2): once an offer has
  // left 'pending' — declined, resolved or cancelled — there is no reason
  // for the sender to read it through this path, and for 'declined' in
  // particular this is part of "her staked answer is not shown to the
  // sender" (spec §4.4 test 15): there must be no live read path at all.
  if (row.state !== 'pending') throw new OfferNotPendingError(offerId)

  return {
    offerId: row.offerId,
    confessionId: row.confessionId,
    questionForSender: row.questionForSender,
    stakePrompt: row.stakePrompt,
    state: row.state,
  }
}

export async function getAdminInbox(
  db: Db,
  // adminAccountId is part of the documented signature (spec §2) and is
  // reserved for future admin authorization/scoping. There is no
  // moderation dashboard in this slice (spec §5) and no admin-role column
  // in `accounts`, so nothing to check against yet — this function lists
  // every confession, masked, which is the primitive the dashboard will be
  // built from.
  { adminAccountId }: { adminAccountId: string },
): Promise<AdminConfession[]> {
  void adminAccountId
  const rows = await db
    .select({
      id: confessions.id,
      body: confessions.body,
      createdHour: confessions.createdHour,
      status: confessions.status,
    })
    .from(confessions)

  return rows.map((r) => ({ ...r, senderMasked: true as const }))
}

// The masked list behind the week 7 admin surface (spec §3.2) -- a NEW
// function, so getAdminInbox above is untouched and its existing test keeps
// passing against the function it was written for.
export async function getAdminInboxPage(
  db: Db,
  { limit, offset }: { limit: number; offset: number },
): Promise<AdminConfession[]> {
  const rows = await db
    .select({
      id: confessions.id,
      body: confessions.body,
      createdHour: confessions.createdHour,
      status: confessions.status,
    })
    .from(confessions)
    .orderBy(desc(confessions.createdHour))
    .limit(limit)
    .offset(offset)

  return rows.map((r) => ({ ...r, senderMasked: true as const }))
}

// The mutual reveal is the product (spec §4.2): without a page where a
// sender can see that someone has staked something and is waiting, the
// mechanic is unreachable. There are no notifications in v1 — this query is
// the only delivery channel for that fact.
export type SentReveal =
  | { kind: 'none' }
  | { kind: 'pending'; offerId: string; questionForSender: string; stakePrompt: string }
  | { kind: 'resolved'; offerId: string; senderAnswer: string; recipientAnswer: string }
  | { kind: 'declined' }

export type SentConfession = {
  confessionId: string
  body: string
  createdHour: Date
  recipientDisplayName: string
  offer: SentReveal
}

export async function getSentForSender(
  db: Db,
  { senderAccountId }: { senderAccountId: string },
): Promise<SentConfession[]> {
  const confessionRows = await db
    .select({
      confessionId: confessions.id,
      body: confessions.body,
      createdHour: confessions.createdHour,
      recipientDisplayName: accounts.displayName,
    })
    .from(confessions)
    .innerJoin(links, eq(links.id, confessions.linkId))
    .innerJoin(accounts, eq(accounts.id, links.ownerAccountId))
    .where(eq(confessions.senderAccountId, senderAccountId))

  if (confessionRows.length === 0) return []

  const confessionIds = confessionRows.map((c) => c.confessionId)

  const offerRows = await db
    .select({
      offerId: revealOffers.id,
      confessionId: revealOffers.confessionId,
      state: revealOffers.state,
      questionForSender: revealOffers.questionForSender,
      stakePrompt: revealOffers.stakePrompt,
    })
    .from(revealOffers)
    .where(inArray(revealOffers.confessionId, confessionIds))

  const offerByConfessionId = new Map(offerRows.map((o) => [o.confessionId, o]))
  const resolvedOfferIds = offerRows.filter((o) => o.state === 'resolved').map((o) => o.offerId)

  // Both answer bodies are fetched ONLY for offers that are already
  // resolved. This is the one property that has to be right: on a pending
  // offer the recipient's staked answer must never be read here at all —
  // she stakes sight unseen, and a sender who could read it before
  // committing his own answer would break the mechanic the deferred-
  // constraint work in week 2 exists to protect (spec §4.2).
  const resolvedAnswers =
    resolvedOfferIds.length === 0
      ? []
      : await db
          .select({ offerId: revealAnswers.offerId, side: revealAnswers.side, body: revealAnswers.body })
          .from(revealAnswers)
          .where(inArray(revealAnswers.offerId, resolvedOfferIds))

  const answersByOfferId = new Map<string, { recipient?: string; sender?: string }>()
  for (const a of resolvedAnswers) {
    const entry = answersByOfferId.get(a.offerId) ?? {}
    entry[a.side] = a.body
    answersByOfferId.set(a.offerId, entry)
  }

  return confessionRows.map((c) => {
    const offer = offerByConfessionId.get(c.confessionId)
    let reveal: SentReveal = { kind: 'none' }

    if (offer?.state === 'pending') {
      reveal = {
        kind: 'pending',
        offerId: offer.offerId,
        questionForSender: offer.questionForSender,
        stakePrompt: offer.stakePrompt,
      }
    } else if (offer?.state === 'declined') {
      reveal = { kind: 'declined' }
    } else if (offer?.state === 'resolved') {
      const ans = answersByOfferId.get(offer.offerId)
      if (ans && ans.recipient !== undefined && ans.sender !== undefined) {
        reveal = {
          kind: 'resolved',
          offerId: offer.offerId,
          senderAnswer: ans.sender,
          recipientAnswer: ans.recipient,
        }
      }
    }
    // 'cancelled' is reachable only from 'pending', and only by the
    // recipient (spec §1 state machine, step 4). From the sender's side
    // there was never anything to see — the offer never reached him — so
    // it collapses to 'none', same as a confession with no offer at all.
    // The frozen SentConfession type (spec §4.2) has no 'cancelled'
    // variant, which is consistent with that reading.

    return {
      confessionId: c.confessionId,
      body: c.body,
      createdHour: c.createdHour,
      recipientDisplayName: c.recipientDisplayName,
      offer: reveal,
    }
  })
}
