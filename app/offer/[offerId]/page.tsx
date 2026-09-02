import { requireActiveViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { getPendingOfferForSender } from '../../_lib/domain/views.js'
import { NotYourConfessionError, OfferNotPendingError, RevealOfferNotFoundError } from '../../_lib/domain/errors.js'
import { acceptOfferAction, declineOfferAction } from './actions.js'

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
      return <p className="error">ما لقينا هالعرض.</p>
    }
    if (err instanceof OfferNotPendingError) {
      return <p className="muted">هالعرض خلص، ما بقي فيه شي تعمله.</p>
    }
    throw err
  }

  return (
    <div>
      <h1>وصلك عرض مصارحة</h1>
      <p className="notice">
        الشخص يلي بعتلو الرسالة بدو يعرف منك شي، وبالمقابل رح يحكيلك شي عن حالو. إذا وافقت، اسمك رح ينكشف إلو، وبس
        إلو، وبس على هالرسالة.
      </p>

      <div className="card">
        <p className="muted">شو بدها تعرف</p>
        <p>{offer.questionForSender}</p>
        <p className="muted">شو رح تحكيلك عن حالها</p>
        <p>{offer.stakePrompt}</p>
      </div>

      {error && ERROR_COPY[error] && <p className="error">{ERROR_COPY[error]}</p>}

      <form action={acceptOfferAction}>
        <input type="hidden" name="offerId" value={offer.offerId} />
        <label htmlFor="senderAnswer">جوابك</label>
        <textarea id="senderAnswer" name="senderAnswer" required minLength={2} maxLength={4000} rows={4} />
        <button type="submit">وافق وجاوب</button>
      </form>

      <form action={declineOfferAction}>
        <input type="hidden" name="offerId" value={offer.offerId} />
        <button type="submit" className="secondary">لأ، مو هلق</button>
      </form>
    </div>
  )
}
