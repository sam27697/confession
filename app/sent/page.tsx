import { requireActiveViewerAccountId } from '../_lib/auth.js'
import { getDb } from '../_lib/domain/db.js'
import { getSentForSender } from '../_lib/domain/views.js'
import type { SentConfession } from '../_lib/domain/views.js'
import { formatHourStamp } from '../../src/hourstamp.js'
import { ACTION_EMOJI, MOOD_EMOJI, STATE_EMOJI } from '../_lib/emoji.js'

function OfferBlock({ offer }: { offer: SentConfession['offer'] }) {
  if (offer.kind === 'none') return null

  if (offer.kind === 'pending') {
    return (
      <div className="sent-offer">
        <span className="sent-offer__badge">{MOOD_EMOJI.sparkle} وصلك عرض مصارحة</span>
        <p className="sent-offer__question">{offer.questionForSender}</p>
        <a className="btn btn--secondary btn--sm" href={`/offer/${offer.offerId}`}>
          شوف العرض {ACTION_EMOJI.reveal}
        </a>
      </div>
    )
  }

  if (offer.kind === 'declined') {
    return (
      <div className="sent-declined">
        <p className="hint">ما وافقت على المصارحة.</p>
      </div>
    )
  }

  // No badge inside this card. The row's own chip, a few lines below,
  // already reads «انكشفوا الاتنين» with the same glyph; repeating it inside
  // the panel it labels is the same redundancy the previous pass produced on
  // the inbox link block. The rose tint is the signal here.
  return (
    <div className="card card--rose card--bubble sent-resolved">
      <div className="sent-resolved__item">
        <p className="hint">جوابك</p>
        <p className="sent-resolved__text">{offer.senderAnswer}</p>
      </div>
      <div className="sent-resolved__item">
        <p className="hint">جوابها</p>
        <p className="sent-resolved__text">{offer.recipientAnswer}</p>
      </div>
    </div>
  )
}

export default async function SentPage() {
  const db = getDb()
  const senderAccountId = await requireActiveViewerAccountId(db)
  const messages = await getSentForSender(db, { senderAccountId })
  const now = new Date()
  const totalSent = messages.length
  const isSentEmpty = totalSent === 0

  return (
    <div className="enter">
      <div className="sent-header">
        <h1>يلي بعتها</h1>
        <span className={isSentEmpty ? 'sent-badge sent-badge--empty' : 'sent-badge'}>
          {isSentEmpty ? `لسا فاضية ${MOOD_EMOJI.nothingSent}` : `${totalSent} ${ACTION_EMOJI.send}`}
        </span>
      </div>

      {isSentEmpty && (
        <div className="sent-empty">
          <div className="sent-empty__icon" aria-hidden="true">{MOOD_EMOJI.nothingSent}</div>
          <p className="sent-empty__title">لسا ما بعتّ شي.</p>
          <p className="sent-empty__desc">أي اعتراف بتبعته لحدا رح يظهر هون، وتشوف إذا وصل أو وصلك رد عليه.</p>
        </div>
      )}

      {messages.map((m) => {
        const isPending = m.offer.kind === 'pending'
        const isDeclined = m.offer.kind === 'declined'
        const isResolved = m.offer.kind === 'resolved'
        const offerChipLabel = isPending
          ? `${STATE_EMOJI.pending} لسا ما رد`
          : isDeclined
            ? `${STATE_EMOJI.declined} ما وافق`
            : isResolved
              ? `${STATE_EMOJI.resolved} انكشفوا الاتنين`
              : `${STATE_EMOJI.delivered} وصلت`
        const chipClass = isPending
          ? 'chip chip--pending'
          : isDeclined
            ? 'chip chip--declined'
            : isResolved
              ? 'chip chip--resolved'
              : 'chip chip--delivered'

        return (
          <div className="msg msg--out" key={m.confessionId}>
            <div className="msg__top">
              <span className="msg__to">لـ {m.recipientDisplayName}</span>
              <span className={chipClass}>{offerChipLabel}</span>
            </div>

            <p className="msg__body">{m.body}</p>

            <div className="msg__meta">
              <span className="hour">{formatHourStamp(m.createdHour, now)}</span>
            </div>

            <OfferBlock offer={m.offer} />
          </div>
        )
      })}
    </div>
  )
}
