'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '../_lib/domain/db.js'
import { getViewerAccountId, requireActiveViewerAccountId } from '../_lib/auth.js'
import { getAccountById, createAccountWithTerms, recordTermsReacceptance } from '../_lib/domain/accounts.js'
import { TERMS_VERSION } from '../_lib/domain/terms.js'
import { takeRememberedDestination } from '../_lib/login-flow.js'
import {
  SID_COOKIE,
  PENDING_IDENTITY_COOKIE,
  createSessionCookieValue,
  sidCookieOptions,
  verifyPendingIdentityCookieValue,
} from '../_lib/session.js'

export async function acceptTermsAction(formData: FormData) {
  const agree = formData.get('agree') === 'on'
  const age18 = formData.get('age18') === 'on'
  if (!agree || !age18) {
    redirect('/onboarding?error=required')
  }

  const db = getDb()
  const store = await cookies()

  const sessionAccountId = await getViewerAccountId()
  if (sessionAccountId) {
    const accountId = await requireActiveViewerAccountId(db)
    const account = await getAccountById(db, { accountId })
    if (!account) redirect('/')
    if (account.termsVersion < TERMS_VERSION) {
      await recordTermsReacceptance(db, { accountId, termsVersion: TERMS_VERSION, locale: 'ar' })
    }
    // '/inbox' unless the login that sent them here was on its way somewhere
    // (week 15 §2.3).
    redirect(await takeRememberedDestination())
  }

  const pendingRaw = store.get(PENDING_IDENTITY_COOKIE)?.value
  const identity = pendingRaw ? verifyPendingIdentityCookieValue(pendingRaw) : null
  if (!identity) redirect('/')

  const { accountId } = await createAccountWithTerms(db, {
    provider: identity.provider,
    providerUserId: identity.providerUserId,
    displayName: identity.displayName,
    termsVersion: TERMS_VERSION,
    locale: 'ar',
    ageAttested18: true,
  })

  store.set(SID_COOKIE, createSessionCookieValue(accountId), sidCookieOptions)
  store.delete(PENDING_IDENTITY_COOKIE)
  // A stranger who signed up from a friend's link goes back to that link,
  // not to their own empty inbox (week 15 §0.5).
  redirect(await takeRememberedDestination())
}
