import { redirect } from 'next/navigation'
import { resolveActiveViewerAccountId } from './_lib/auth.js'
import { getDb } from './_lib/domain/db.js'
import { env } from './_lib/domain/env.js'

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ deleted?: string; next?: string }>
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

  const { deleted, next } = (await searchParams) ?? {}

  return (
    <div className="veil enter">
      {/* The two sentences below are Sam's own, approved 2026-08-25 and frozen
          by SPEC-week13-landing.md section 2. They are pinned byte for byte by
          test/63-copy-contract.test.ts. Do not reword them here: the wording of
          a product claim is his decision, and the last pass that rewrote them
          put a promise on this page that terms clause 1 denies. */}
      <div className="home-hero">
        <h1>تطبيق مصارحة سرية.</h1>
        <p className="hint">الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.</p>
      </div>

      <div className="home-steps">
        <div className="home-step">
          <span className="home-step__badge">1</span>
          <p className="home-step__text"><strong>شارك رابطك:</strong> انشر رابط صندوقك السري على ستوري انستغرام أو وتساب لتستقبل رسايل من أصحابك.</p>
        </div>
        <div className="home-step">
          <span className="home-step__badge">2</span>
          {/* Terms clause 1 restated in one breath: hidden from the recipient,
              visible to the operator. The anonymity half and the operator half
              belong in the same sentence, never in two paragraphs, because a
              stranger reads the first one and signs up. */}
          <p className="home-step__text"><strong>استقبل بصراحة:</strong> الرسائل توصلك بلا اسم المرسل، وهويته مخفية عنك. إدارة التطبيق بس فيها تشوف مين بعت، ومنستخدمها لمنع الإساءة.</p>
        </div>
        <div className="home-step">
          <span className="home-step__badge">3</span>
          <p className="home-step__text"><strong>صارحني بدورك:</strong> إذا حبيتوا تكشفوا مين المرسل، ميزة «صارحني بدورك» بتكشف الهوية بس بالتراضي بين الطرفين.</p>
        </div>
      </div>

      {deleted === '1' && <p className="notice">تم حذف حسابك نهائياً.</p>}

      <div className="card card--citron">
        {env.facebookAppId ? (
          <a
            className="btn btn--primary btn--block"
            href={next ? `/auth/facebook/start?next=${encodeURIComponent(next)}` : '/auth/facebook/start'}
          >
            تسجيل دخول بفيسبوك
          </a>
        ) : (
          <p className="hint">تسجيل الدخول بفيسبوك مش متاح هلق.</p>
        )}

        {env.allowDevLogin && (
          <form action="/auth/dev" method="post">
            {next && <input type="hidden" name={'next'} value={next} />}
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
