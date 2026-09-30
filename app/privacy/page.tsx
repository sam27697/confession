// Spec §5.4: this page states, in Arabic and English, exactly what is
// stored and exactly what is not. It must never claim more secrecy than the
// schema supports (spec §1 rule and STACK.md's tripwire), and it must never
// be true unless §1 rule 1 (no request identity ever read) actually holds in
// every file of this slice.
//
// NOTE — flagged, not resolved silently: spec §5.1 says "No English fallback
// UI — English appears only in the terms, beside the Arabic," while spec
// §5.4 explicitly requires this page to state its contents "in Arabic and
// English." Those two sentences conflict for this one page. Followed §5.4
// here, since it is the more specific instruction for /privacy's own
// content; the conflict is reported in full in the final summary.
import { PRIVACY_AR, PRIVACY_EN, type PrivacyText } from '../../src/privacy.js'

// Week 19: every sentence below comes from src/privacy.ts, which names the
// tables each one is about. Nothing is written on this page directly, so
// the page cannot say less than the schema holds without test/69 noticing.
function PolicyBody({ text, deleteLabel }: { text: PrivacyText; deleteLabel: string }) {
  return (
    <>
      <p>{text.storedIntro}</p>
      <ul>
        {text.stored.map((item) => (
          <li key={item.text}>{item.text}</li>
        ))}
      </ul>
      <p>{text.admin.text}</p>
      <p>{text.sharing}</p>
      <p>{text.cookies}</p>
      <p>{text.deletion}</p>
      <p><a href="/account/delete">{deleteLabel}</a></p>
      <p>{text.never}</p>
    </>
  )
}

export default function PrivacyPage() {
  return (
    <div>
      <div className="policy-header">
        <a className="policy-return btn btn--ghost btn--sm" href="/inbox">→ رجوع</a>
      </div>
      <h1>{PRIVACY_AR.heading}</h1>
      <div className="legal" dir="rtl">
        <PolicyBody text={PRIVACY_AR} deleteLabel="حذف الحساب" />
      </div>

      <hr />

      <h2 dir="ltr">{PRIVACY_EN.heading}</h2>
      <div className="legal" dir="ltr">
        <PolicyBody text={PRIVACY_EN} deleteLabel="Delete your account" />
      </div>
    </div>
  )
}
