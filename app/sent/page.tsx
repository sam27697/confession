import { requireActiveViewerAccountId } from '../_lib/auth.js'
import { getDb } from '../_lib/domain/db.js'
import { getSentForSender } from '../_lib/domain/views.js'
import type { SentConfession } from '../_lib/domain/views.js'
import { formatHourStamp } from '../../src/hourstamp.js'

function OfferBlock({ offer }: { offer: SentConfession['offer'] }) {
  if (offer.kind === 'none') return null

  if (offer.kind === 'pending') {
    return (
      <>
        <p className="hint">وصلك عرض مصارحة</p>
        <a className="btn btn--secondary btn--sm" href={`/offer/${offer.offerId}`}>
          شوف العرض
        </a>
      </>
    )
  }

  if (offer.kind === 'declined') {
    return <p className="hint">ما وافقت على المصارحة.</p>
  }

  return (
    <div className="card card--rose card--bubble">
      <p className="hint">جوابك</p>
      <p>{offer.senderAnswer}</p>
      <p className="hint">جوابها</p>
      <p>{offer.recipientAnswer}</p>
    </div>
  )
}

export default async function SentPage() {
  const db = getDb()
  const senderAccountId = await requireActiveViewerAccountId(db)
  const messages = await getSentForSender(db, { senderAccountId })
  const now = new Date()

  return (
    <div>
      <h1>يلي بعتها</h1>

      {messages.length === 0 && <p className="hint">لسا ما بعتّ شي.</p>}

      {messages.map((m) => {
        const isPending = m.offer.kind === 'pending'
        const isDeclined = m.offer.kind === 'declined'
        const hasOffer = m.offer.kind !== 'none'
        const offerChipLabel = isPending ? 'لسا ما رد' : isDeclined ? 'ما وافق' : 'انكشفوا الاتنين'
        return (
        <div className="msg" key={m.confessionId}>
          <p className="hint">لـ {m.recipientDisplayName}</p>
          <p className="msg__body">{m.body}</p>
          <div className="msg__meta">
            <span className="hour">{formatHourStamp(m.createdHour, now)}</span>
            {hasOffer && (
              <span className={isPending ? 'chip chip--pending' : isDeclined ? 'chip chip--declined' : 'chip chip--resolved'}>
                {offerChipLabel}
              </span>
            )}
          </div>
          <OfferBlock offer={m.offer} />
        </div>
        )
      })}
    </div>
  )
}
