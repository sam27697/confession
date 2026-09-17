import { TERMS_VERSION, TERMS_TEXT_AR, TERMS_TEXT_EN } from '../_lib/domain/terms.js'
import { TermsBlock } from '../_lib/terms-block.js'

export default function TermsPage() {
  return (
    <div>
      <div className="policy-header">
        <a className="policy-return btn btn--ghost btn--sm" href="/inbox">→ رجوع</a>
      </div>
      <h1>الشروط والأحكام</h1>
      <p className="hint">نسخة {TERMS_VERSION}</p>
      <TermsBlock text={TERMS_TEXT_AR} dir="rtl" />
      <hr />
      <h2>Terms and Conditions</h2>
      <TermsBlock text={TERMS_TEXT_EN} dir="ltr" />
    </div>
  )
}
