import { requireActiveViewerAccountId } from '../_lib/auth.js'
import { getDb } from '../_lib/domain/db.js'
import { getSentForSender } from '../_lib/domain/views.js'
import type { SentConfession } from '../_lib/domain/views.js'

function OfferBlock({ offer }: { offer: SentConfession['offer'] }) {
  if (offer.kind === 'none') return null

  if (offer.kind === 'pending') {
    return (
      <div className="card">
        <p className="muted">وصلك عرض مصارحة</p>
        <a className="btn" href={`/offer/${offer.offerId}`}>
          شوف العرض
        </a>
      </div>
    )
  }

  if (offer.kind === 'declined') {
    return <p className="muted">ما وافقت على المصارحة.</p>
  }

  return (
    <div className="card">
      <p className="muted">انكشفوا الاتنين</p>
      <p className="muted">جوابك</p>
      <p>{offer.senderAnswer}</p>
      <p className="muted">جوابها</p>
      <p>{offer.recipientAnswer}</p>
    </div>
  )
}

export default async function SentPage() {
  const db = getDb()
  const senderAccountId = await requireActiveViewerAccountId(db)
  const messages = await getSentForSender(db, { senderAccountId })

  return (
    <div>
      <h1>يلي بعتها</h1>

      {messages.length === 0 && <p className="muted">لسا ما بعتّ شي.</p>}

      {messages.map((m) => (
        <div className="card" key={m.confessionId}>
          <p className="muted">لـ {m.recipientDisplayName}</p>
          <p>{m.body}</p>
          <OfferBlock offer={m.offer} />
        </div>
      ))}
    </div>
  )
}
