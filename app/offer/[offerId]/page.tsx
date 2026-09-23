import { requireActiveViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { getPendingOfferForSender } from '../../_lib/domain/views.js'
import { NotYourConfessionError, OfferNotPendingError, RevealOfferNotFoundError } from '../../_lib/domain/errors.js'
import { acceptOfferAction, declineOfferAction } from './actions.js'
import { SubmitButton } from '../../_components/SubmitButton.js'

const ERROR_COPY: Record<string, string> = {
  short: 'جوابك لازم يكون حرفين على الأقل.',
  generic: 'صار خلل من عنا، مش منك. جرب كمان مرة بعد شوي.',
}

// The two ways this page can have nothing to offer. Each used to be one bare
// line with no way off the screen; each now says why and points at /sent,
// where every offer this person has ever received is listed (week 15 §3.5).
function OfferGone({ title, line }: { title: string; line: string }) {
  return (
    <div className="veil veil--rose enter">
      <div className="empty">
        <p>{title}</p>
        <p>{line}</p>
        <a className="btn btn--secondary btn--sm" href="/sent">
          الرسائل المرسلة
        </a>
      </div>
    </div>
  )
}

const RESPONSE_STARTER_PROMPTS = [
  'بصراحة ومن قلبي، هيدا جوابي...',
  'ما كنت متوقع تسألني هيك، بس الحقيقة هي...',
  'لأنه الوعد متبادل، رح قلك بالسر...',
]

export default async function OfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ offerId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const db = getDb()
  const senderAccountId = await requireActiveViewerAccountId(db)
  const { offerId } = await params
  const { error } = await searchParams

  let offer
  try {
    offer = await getPendingOfferForSender(db, { offerId, senderAccountId })
  } catch (err) {
    if (err instanceof RevealOfferNotFoundError || err instanceof NotYourConfessionError) {
      // One answer for both: telling "no such offer" apart from "not yours"
      // would confirm that an offer id exists.
      return (
        <OfferGone
          title="ما لقينا هالعرض."
          line="يمكن الرابط ناقص، أو العرض مش إلك. كل العروض يلي وصلتك بتلاقيها بالرسائل المرسلة."
        />
      )
    }
    if (err instanceof OfferNotPendingError) {
      return <OfferGone title="هالعرض تسكّر." line="انرد عليه من قبل، أو انسحب. آخر أخباره بتلاقيها بالرسائل المرسلة." />
    }
    throw err
  }

  return (
    <div className="veil veil--rose">
      <nav className="view-breadcrumb" aria-label="مسار التنقل">
        <a href="/sent" className="view-breadcrumb__link" aria-label="الرجوع للرسائل المرسلة">
          <span aria-hidden="true">→</span>
          <span>الرسائل المرسلة</span>
        </a>
      </nav>
      <h1>وصلك عرض مصارحة</h1>
      <p className="notice notice--rose">
        الشخص يلي بعتلو الرسالة بدو يعرف منك شي، وبالمقابل رح يحكيلك شي عن حالو. إذا وافقت، اسمك رح ينكشف إلو، وبس
        إلو، وبس على هالرسالة.
      </p>

      <div className="card card--raised card--bubble reveal">
        {/* This page has no name for the other side, by design, so the
            labels are neutral instead of guessing «بدها» (week 15 §3.3). */}
        <p className="hint">السؤال يلي بدو جوابك</p>
        <p className="sent-resolved__text">{offer.questionForSender}</p>
        <p className="hint">وشو رح تعرف بالمقابل</p>
        <p className="sent-resolved__text">{offer.stakePrompt}</p>
      </div>

      {error && ERROR_COPY[error] && <p className="notice notice--danger">{ERROR_COPY[error]}</p>}

      <form action={acceptOfferAction}>
        <input type="hidden" name="offerId" value={offer.offerId} />
        <div className="offer-starters" role="group" aria-label="أفكار للإجابة">
          <span className="offer-starters__label">أفكار للإجابة:</span>
          <div className="offer-starters__list">
            {RESPONSE_STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="starter-chip"
                data-response-prompt={prompt}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){document.addEventListener('click',function(e){var b=e.target.closest('button[data-response-prompt]');if(!b)return;var f=b.closest('form');if(!f)return;var ta=f.querySelector('textarea[name="senderAnswer"]');if(!ta)return;ta.value=b.getAttribute('data-response-prompt')||'';ta.focus();ta.dispatchEvent(new Event('input',{bubbles:true}));});})();`,
          }}
        />
        <div className="field-row">
          <label className="field" htmlFor="senderAnswer">جوابك</label>
          <textarea className="textarea" id="senderAnswer" name="senderAnswer" required minLength={2} maxLength={4000} rows={4} />
        </div>
        <SubmitButton className="btn btn--reveal btn--block" loadingText="عم ينزل الجوابين...">وافق وجاوب</SubmitButton>
      </form>

      <div className="offer-actions">
        <a href="/sent" className="btn btn--secondary btn--block">
          الرجوع للمرسلة
        </a>

        <form action={declineOfferAction}>
          <input type="hidden" name="offerId" value={offer.offerId} />
          <SubmitButton className="btn btn--danger btn--block">رفض العرض نهائياً</SubmitButton>
          {/* What saying no costs, said before it is said (week 15 §3.4).
              A declined offer writes no sender answer, and the recipient's
              inbox shows only «ما وافق». */}
          <span className="hint offer-actions__note">إذا رفضت، ما في شي بينكشف عنك. الطرف التاني بيعرف بس إنك ما وافقت.</span>
        </form>
      </div>
    </div>
  )
}
