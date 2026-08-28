'use server'
import { redirect } from 'next/navigation'
import { getViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { sendConfession } from '../../_lib/domain/actions.js'
import {
  PerLinkRateLimitExceededError,
  PerAccountRateLimitExceededError,
  LinkDisabledError,
  LinkNotFoundError,
} from '../../_lib/domain/errors.js'

export async function sendConfessionAction(slug: string, formData: FormData) {
  const senderAccountId = await getViewerAccountId()
  if (!senderAccountId) {
    redirect(`/c/${slug}?error=signin`)
  }

  const body = String(formData.get('body') ?? '').trim()
  if (!body) {
    redirect(`/c/${slug}?error=empty`)
  }

  const db = getDb()
  try {
    // A blocked sender gets the same success-shaped result and no row is
    // written — never special-cased, never logged (spec §5.3).
    await sendConfession(db, { senderAccountId, linkSlug: slug, body })
  } catch (err) {
    if (err instanceof PerLinkRateLimitExceededError || err instanceof PerAccountRateLimitExceededError) {
      redirect(`/c/${slug}?error=ratelimit`)
    }
    if (err instanceof LinkDisabledError || err instanceof LinkNotFoundError) {
      redirect(`/c/${slug}?error=unavailable`)
    }
    // error class only — never .message, which can embed the slug.
    console.error('sendConfession failed', err instanceof Error ? err.name : 'unknown')
    redirect(`/c/${slug}?error=generic`)
  }

  redirect(`/c/${slug}?sent=1`)
}
