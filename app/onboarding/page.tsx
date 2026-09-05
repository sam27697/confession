import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '../_lib/domain/db.js'
import { getViewerAccountId, requireActiveViewerAccountId } from '../_lib/auth.js'
import { getAccountById } from '../_lib/domain/accounts.js'
import { TERMS_VERSION, TERMS_TEXT_AR, TERMS_TEXT_EN } from '../_lib/domain/terms.js'
import { PENDING_IDENTITY_COOKIE, verifyPendingIdentityCookieValue } from '../_lib/session.js'
import { TermsBlock } from '../_lib/terms-block.js'
import { acceptTermsAction } from './actions.js'
import { SubmitButton } from '../_components/SubmitButton.js'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const db = getDb()
  const sessionAccountId = await getViewerAccountId()

  let displayName: string | null = null

  if (sessionAccountId) {
    // A deleted or disabled account's cookie stops re-accepting terms here
    // too (spec §4.3). The pending-identity branch below is the signup
    // path and is untouched, since redirecting it away would break signup.
    await requireActiveViewerAccountId(db)
    const account = await getAccountById(db, { accountId: sessionAccountId })
    if (!account) redirect('/')
    if (account.termsVersion >= TERMS_VERSION) redirect('/inbox')
    displayName = account.displayName
  } else {
    const store = await cookies()
    const raw = store.get(PENDING_IDENTITY_COOKIE)?.value
    const identity = raw ? verifyPendingIdentityCookieValue(raw) : null
    if (!identity) redirect('/')
    displayName = identity.displayName
  }

  return (
    <div>
      <h1>الشروط والأحكام</h1>
      <p className="hint">أهلا {displayName}، لازم توافق على هالشروط قبل ما تبلش.</p>

      <div className="card card--inset">
        <TermsBlock text={TERMS_TEXT_AR} dir="rtl" />
        <hr />
        <TermsBlock text={TERMS_TEXT_EN} dir="ltr" />
      </div>

      {error === 'required' && <p className="notice notice--danger">لازم توافق على الشروط وتأكد إنك فوق ١٨.</p>}

      <form action={acceptTermsAction}>
        <label className="checkrow" htmlFor="agree">
          <input id="agree" type="checkbox" name="agree" required />
          <span className="checkrow__box"></span>
          <span>موافق على الشروط والأحكام</span>
        </label>
        <label className="checkrow" htmlFor="age18">
          <input id="age18" type="checkbox" name="age18" required />
          <span className="checkrow__box"></span>
          <span>بأكد إني فوق ١٨ سنة</span>
        </label>
        <SubmitButton className="btn btn--primary btn--block">موافق</SubmitButton>
      </form>
    </div>
  )
}
