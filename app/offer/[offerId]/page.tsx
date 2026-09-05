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
      <h1>وصلك عرض مصارحة</h1>
      <p className="notice notice--rose">
        الشخص يلي بعتلو الرسالة بدو يعرف منك شي، وبالمقابل رح يحكيلك شي عن حالو. إذا وافقت، اسمك رح ينكشف إلو، وبس
        إلو، وبس على هالرسالة.
      </p>

      <div className="reveal">
        <p className="hint">شو بدها تعرف</p>
        <p>{offer.questionForSender}</p>
        <p className="hint">شو رح تحكيلك عن حالها</p>
        <p>{offer.stakePrompt}</p>
      </div>

      {error && ERROR_COPY[error] && <p className="notice notice--danger">{ERROR_COPY[error]}</p>}

      <form action={acceptOfferAction}>
        <input type="hidden" name="offerId" value={offer.offerId} />
        <div className="field-row">
          <label className="field" htmlFor="senderAnswer">جوابك</label>
          <textarea className="textarea" id="senderAnswer" name="senderAnswer" required minLength={2} maxLength={4000} rows={4} />
        </div>
        <SubmitButton className="btn btn--reveal btn--block" loadingText="عم ينزل الجوابين...">وافق وجاوب</SubmitButton>
      </form>

      <form action={declineOfferAction}>
        <input type="hidden" name="offerId" value={offer.offerId} />
        <SubmitButton className="btn btn--secondary btn--block">لأ، مو هلق</SubmitButton>
      </form>
    </div>
  )
}
