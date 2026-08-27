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
export default function PrivacyPage() {
  return (
    <div>
      <h1>سياسة الخصوصية</h1>
      <div className="card">
        <p>هيك منخزن معلومات عنك بالظبط:</p>
        <ul>
          <li>رقم حسابك واسمك من فيسبوك، لطرفي أي رسالة (المرسل والمستقبل).</li>
          <li>نص الرسالة نفسها.</li>
          <li>الساعة يلي انبعتت فيها الرسالة (مش الدقيقة بالظبط).</li>
          <li>موافقتك على الشروط والأحكام.</li>
        </ul>
        <p>
          إدارة التطبيق فيها تشوف مين بعت أي رسالة، وكل مرة حدا من الإدارة يشوف هالشي بينسجل بسجل ثابت مايتغير.
        </p>
        <p>هيك ما منجمع أبداً: عنوان الـ IP تبعك، نوع جهازك أو متصفحك، موقعك، أو جهات اتصالك.</p>
      </div>

      <hr />

      <div className="card">
        <p>What we store, exactly:</p>
        <ul>
          <li>The Facebook account id and display name of both sides of a message (sender and recipient).</li>
          <li>The message text itself.</li>
          <li>The hour the message was sent (not the exact minute).</li>
          <li>Your acceptance of the terms.</li>
        </ul>
        <p>
          The app&apos;s administrators can see who sent a message, and every such
          lookup is written to a permanent, unchangeable record.
        </p>
        <p>What we never collect: your IP address, your device or browser, your location, or your contacts.</p>
      </div>
    </div>
  )
}
