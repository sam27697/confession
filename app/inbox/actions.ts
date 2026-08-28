'use server'
// Every mutation here re-derives the viewer from the session cookie and lets
// the domain layer re-check ownership — no ownership decision is ever taken
// from a form field (spec §5.3). Errors carry the error class only, never
// .message, which can embed a confession id or a link slug (spec §1 rule 3).
import { redirect } from 'next/navigation'
import { requireViewerAccountId } from '../_lib/auth.js'
import { getDb } from '../_lib/domain/db.js'
import { setLinkEnabled } from '../_lib/domain/links.js'
import {
  openRevealOffer,
  blockSenderOfConfession,
  reportConfession,
  hideConfession,
} from '../_lib/domain/actions.js'
import { ViewerNotLinkOwnerError, NotYourConfessionError } from '../_lib/domain/errors.js'

export async function setLinkEnabledAction(formData: FormData) {
  const ownerAccountId = await requireViewerAccountId()
  const linkId = String(formData.get('linkId') ?? '')
  const enabled = formData.get('enabled') === '1'

  const db = getDb()
  try {
    await setLinkEnabled(db, { ownerAccountId, linkId, enabled })
  } catch (err) {
    if (err instanceof ViewerNotLinkOwnerError) {
      redirect('/inbox?error=generic')
    }
    console.error('setLinkEnabled failed', err instanceof Error ? err.name : 'unknown')
    redirect('/inbox?error=generic')
  }

  redirect('/inbox')
}

export async function openRevealOfferAction(formData: FormData) {
  const recipientAccountId = await requireViewerAccountId()
  const confessionId = String(formData.get('confessionId') ?? '')
  const questionForSender = String(formData.get('questionForSender') ?? '').trim()
  const stakePrompt = String(formData.get('stakePrompt') ?? '').trim()
  const recipientAnswer = String(formData.get('recipientAnswer') ?? '').trim()

  if (questionForSender.length < 2 || stakePrompt.length < 2 || recipientAnswer.length < 2) {
    redirect('/inbox?error=short')
  }

  const db = getDb()
  try {
    await openRevealOffer(db, {
      recipientAccountId,
      confessionId,
      questionForSender,
      stakePrompt,
      recipientAnswer,
    })
  } catch (err) {
    if (err instanceof NotYourConfessionError) {
      redirect('/inbox?error=generic')
    }
    console.error('openRevealOffer failed', err instanceof Error ? err.name : 'unknown')
    redirect('/inbox?error=generic')
  }

  redirect('/inbox')
}

export async function blockSenderAction(formData: FormData) {
  const recipientAccountId = await requireViewerAccountId()
  const confessionId = String(formData.get('confessionId') ?? '')

  const db = getDb()
  try {
    await blockSenderOfConfession(db, { recipientAccountId, confessionId })
  } catch (err) {
    if (err instanceof ViewerNotLinkOwnerError) {
      redirect('/inbox?error=generic')
    }
    console.error('blockSenderOfConfession failed', err instanceof Error ? err.name : 'unknown')
    redirect('/inbox?error=generic')
  }

  redirect('/inbox')
}

export async function reportConfessionAction(formData: FormData) {
  const reporterAccountId = await requireViewerAccountId()
  const confessionId = String(formData.get('confessionId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (reason.length < 2) {
    redirect('/inbox?error=short')
  }

  const db = getDb()
  try {
    await reportConfession(db, { reporterAccountId, confessionId, reason })
  } catch (err) {
    if (err instanceof ViewerNotLinkOwnerError) {
      redirect('/inbox?error=generic')
    }
    console.error('reportConfession failed', err instanceof Error ? err.name : 'unknown')
    redirect('/inbox?error=generic')
  }

  redirect('/inbox')
}

export async function hideConfessionAction(formData: FormData) {
  const recipientAccountId = await requireViewerAccountId()
  const confessionId = String(formData.get('confessionId') ?? '')

  const db = getDb()
  try {
    await hideConfession(db, { recipientAccountId, confessionId })
  } catch (err) {
    if (err instanceof ViewerNotLinkOwnerError) {
      redirect('/inbox?error=generic')
    }
    console.error('hideConfession failed', err instanceof Error ? err.name : 'unknown')
    redirect('/inbox?error=generic')
  }

  redirect('/inbox')
}
