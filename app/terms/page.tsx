import { TERMS_VERSION, TERMS_TEXT_AR, TERMS_TEXT_EN } from '../_lib/domain/terms.js'

export default function TermsPage() {
  return (
    <div>
      <h1>الشروط والأحكام</h1>
      <p className="muted">نسخة {TERMS_VERSION}</p>
      <div className="card pre">{TERMS_TEXT_AR}</div>
      <hr />
      <h2>Terms and Conditions</h2>
      <div className="card pre">{TERMS_TEXT_EN}</div>
    </div>
  )
}
