import { requireActiveViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { getPendingOfferForSender } from '../../_lib/domain/views.js'
import { NotYourConfessionError, OfferNotPendingError, RevealOfferNotFoundError } from '../../_lib/domain/errors.js'
import { acceptOfferAction, declineOfferAction } from './actions.js'
import { SubmitButton } from '../../_components/SubmitButton.js'

const ERROR_COPY: Record<string, string> = {
  short: 'لازم تكتب جوابك.',
  generic: 'صار في مشكلة، جرب لاحقاً.',
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
      return <p className="notice notice--danger">ما لقينا هالعرض.</p>
    }
    if (err instanceof OfferNotPendingError) {
      return <p className="hint">هالعرض خلص، ما بقي فيه شي تعمله.</p>
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
        <p className="hint">شو بدها تعرف</p>
        <p className="sent-resolved__text">{offer.questionForSender}</p>
        <p className="hint">شو رح تحكيلك عن حالها</p>
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
        </form>
      </div>
    </div>
  )
}
