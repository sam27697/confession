import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '../_lib/domain/db.js'
import { getViewerAccountId } from '../_lib/auth.js'
import { getAccountById } from '../_lib/domain/accounts.js'
import { TERMS_VERSION, TERMS_TEXT_AR, TERMS_TEXT_EN } from '../_lib/domain/terms.js'
import { PENDING_IDENTITY_COOKIE, verifyPendingIdentityCookieValue } from '../_lib/session.js'
import { TermsBlock } from '../_lib/terms-block.js'
import { acceptTermsAction } from './actions.js'

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
      <p className="muted">أهلا {displayName} — لازم توافق على هالشروط قبل ما تبلش.</p>

      <TermsBlock text={TERMS_TEXT_AR} dir="rtl" />
      <hr />
      <TermsBlock text={TERMS_TEXT_EN} dir="ltr" />

      {error === 'required' && <p className="error">لازم توافق على الشروط وتأكد إنك فوق ١٨.</p>}

      <form action={acceptTermsAction}>
        <label>
          <input type="checkbox" name="agree" required /> موافق على الشروط والأحكام
        </label>
        <label>
          <input type="checkbox" name="age18" required /> بأكد إني فوق ١٨ سنة
        </label>
        <button type="submit">موافق</button>
      </form>
    </div>
  )
}
