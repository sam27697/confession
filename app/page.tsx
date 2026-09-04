import { redirect } from 'next/navigation'
import { resolveActiveViewerAccountId } from './_lib/auth.js'
import { getDb } from './_lib/domain/db.js'
import { env } from './_lib/domain/env.js'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>
}) {
  // Resolved against the database, not the cookie alone (spec §8.3): a
  // cookie whose account is missing, disabled or deleted renders the
  // landing page below instead of bouncing to /inbox, which is what sent a
  // stray post-deletion cookie into a redirect loop before this repair.
  const db = getDb()
  const accountId = await resolveActiveViewerAccountId(db)
  if (accountId) {
    redirect('/inbox')
  }

  const { deleted } = await searchParams

  return (
    <div className="veil">
      <p>
        تطبيق مصارحة سرية.{'\n'}
        الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.{'\n'}
        سجل دخول تبلش.
      </p>

      {deleted === '1' && <p className="notice">تم حذف حسابك نهائياً.</p>}

      <div className="card card--citron">
        {env.facebookAppId ? (
          <a className="btn btn--primary btn--block" href="/auth/facebook/start">تسجيل دخول بفيسبوك</a>
        ) : (
          <p className="hint">تسجيل الدخول بفيسبوك مش متاح هلق.</p>
        )}

        {env.allowDevLogin && (
          <form action="/auth/dev" method="post">
            <div className="field-row">
              <label className="field" htmlFor="displayName">اسم تجريبي (وضع تجربة فقط)</label>
              <input className="input" id="displayName" type="text" name="displayName" required minLength={1} maxLength={80} />
            </div>
            <button type="submit" className="btn btn--secondary btn--block">دخول تجريبي</button>
          </form>
        )}
      </div>

      <p className="hint">
        <a href="/terms">الشروط والأحكام</a> · <a href="/privacy">سياسة الخصوصية</a>
      </p>
    </div>
  )
}
