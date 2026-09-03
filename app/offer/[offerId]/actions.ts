'use server'
// Both actions re-derive the sender from the session cookie and let the
// domain layer re-check that the offer belongs to his confession — no
// ownership decision is made from a form field (spec §5.3).
import { redirect } from 'next/navigation'
import { requireActiveViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { acceptRevealOffer, declineRevealOffer } from '../../_lib/domain/actions.js'
import { NotYourConfessionError, OfferNotPendingError, RevealOfferNotFoundError } from '../../_lib/domain/errors.js'

export async function acceptOfferAction(formData: FormData) {
  const db = getDb()
  const senderAccountId = await requireActiveViewerAccountId(db)
  const offerId = String(formData.get('offerId') ?? '')
  const senderAnswer = String(formData.get('senderAnswer') ?? '').trim()

  if (senderAnswer.length < 2) {
    redirect(`/offer/${offerId}?error=short`)
  }

  try {
    await acceptRevealOffer(db, { senderAccountId, offerId, senderAnswer })
  } catch (err) {
    if (
      err instanceof NotYourConfessionError ||
      err instanceof OfferNotPendingError ||
      err instanceof RevealOfferNotFoundError
    ) {
      redirect(`/offer/${offerId}?error=generic`)
    }
    console.error('acceptRevealOffer failed', err instanceof Error ? err.name : 'unknown')
    redirect(`/offer/${offerId}?error=generic`)
  }

  // Both answers unlock together — the resolution itself shows on the
  // sender's own list of what he sent (spec §5.2 /sent), since this page
  // never reads answer bodies at all.
  redirect('/sent')
}

export async function declineOfferAction(formData: FormData) {
  const db = getDb()
  const senderAccountId = await requireActiveViewerAccountId(db)
  const offerId = String(formData.get('offerId') ?? '')

  try {
    await declineRevealOffer(db, { senderAccountId, offerId })
  } catch (err) {
    if (
      err instanceof NotYourConfessionError ||
      err instanceof OfferNotPendingError ||
      err instanceof RevealOfferNotFoundError
    ) {
      redirect(`/offer/${offerId}?error=generic`)
    }
    console.error('declineRevealOffer failed', err instanceof Error ? err.name : 'unknown')
    redirect(`/offer/${offerId}?error=generic`)
  }

  // Terminal, no nag, no penalty (DESIGN.md) — straight back to his own list.
  redirect('/sent')
}
