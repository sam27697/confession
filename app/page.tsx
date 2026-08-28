import { redirect } from 'next/navigation'
import { getViewerAccountId } from './_lib/auth.js'
import { env } from './_lib/domain/env.js'

export default async function HomePage() {
  const accountId = await getViewerAccountId()
  if (accountId) {
    redirect('/inbox')
  }

  return (
    <div>
      <p className="pre">
        تطبيق مصارحة سرية.{'\n'}
        الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.{'\n'}
        سجل دخول تبلش.
      </p>

      <div className="card">
        {env.facebookAppId ? (
          <a className="btn" href="/auth/facebook/start">تسجيل دخول بفيسبوك</a>
        ) : (
          <p className="muted">تسجيل الدخول بفيسبوك مش متاح هلق.</p>
        )}

        {env.allowDevLogin && (
          <form action="/auth/dev" method="post">
            <label htmlFor="displayName">اسم تجريبي (وضع تجربة فقط)</label>
            <input id="displayName" type="text" name="displayName" required minLength={1} maxLength={80} />
            <button type="submit" className="secondary">دخول تجريبي</button>
          </form>
        )}
      </div>

      <p className="muted">
        <a href="/terms">الشروط والأحكام</a> · <a href="/privacy">سياسة الخصوصية</a>
      </p>
    </div>
  )
}
