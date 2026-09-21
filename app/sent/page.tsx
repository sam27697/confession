import { requireActiveViewerAccountId } from '../_lib/auth.js'
import { getDb } from '../_lib/domain/db.js'
import { getInboxForRecipient, getSentForSender } from '../_lib/domain/views.js'
import { getLinkForOwner } from '../_lib/domain/links.js'
import type { SentConfession } from '../_lib/domain/views.js'
import { formatHourStamp } from '../../src/hourstamp.js'
import { ACTION_EMOJI, MOOD_EMOJI, STATE_EMOJI } from '../_lib/emoji.js'
import { Stardust } from '../_components/Stardust.js'

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
    <div className="card card--rose card--bubble sent-resolved sent-resolved--glow">
      <div className="sent-resolved__seal">
        <span className="chip chip--resolved">{STATE_EMOJI.resolved} انكشف السر بينكم</span>
        <span className="sent-resolved__affirmation">انكشف السر بينكم، صار فيكم تحكوا براحتكم ✨</span>
      </div>
      <div className="sent-resolved__dialogue">
        <div className="sent-resolved__item">
          <span className="hint">جوابك</span>
          <p className="sent-resolved__text">{offer.senderAnswer}</p>
        </div>
        <div className="sent-resolved__item">
          <span className="hint">جوابها</span>
          <p className="sent-resolved__text">{offer.recipientAnswer}</p>
        </div>
      </div>
    </div>
  )
}

export default async function SentPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const { filter = 'all' } = (await searchParams) || {}
  const db = getDb()
  const senderAccountId = await requireActiveViewerAccountId(db)
  const messages = await getSentForSender(db, { senderAccountId })
  const link = await getLinkForOwner(db, { ownerAccountId: senderAccountId })
  let totalInbox = 0
  if (link) {
    const inboxMessages = await getInboxForRecipient(db, { linkId: link.linkId, viewerAccountId: senderAccountId })
    totalInbox = inboxMessages.filter((m) => m.status !== 'hidden_by_recipient').length
  }
  const now = new Date()
  const totalSent = messages.length
  const isSentEmpty = totalSent === 0

  const pendingCount = messages.filter((m) => m.offer.kind === 'pending').length
  const resolvedCount = messages.filter((m) => m.offer.kind === 'resolved').length

  const filteredMessages = messages.filter((m) => {
    if (filter === 'pending') return m.offer.kind === 'pending'
    if (filter === 'resolved') return m.offer.kind === 'resolved'
    return true
  })

  const isAllFilter = filter === 'all'
  const isPendingFilter = filter === 'pending'
  const isResolvedFilter = filter === 'resolved'

  return (
    <div className="enter">
      <nav className="app-nav" aria-label="التنقل الرئيسي">
        <a href="/inbox" className="app-nav__tab">
          <span>صندوقي</span>
          <span className="app-nav__badge">{totalInbox}</span>
        </a>
        <a href="/sent" className="app-nav__tab app-nav__tab--active" aria-current="page">
          <span>الرسائل المرسلة</span>
          <span className="app-nav__badge">{totalSent}</span>
        </a>
      </nav>

      <div className="sent-header">
        <h1>يلي بعتها</h1>
        <span className={isSentEmpty ? 'sent-badge sent-badge--empty' : 'sent-badge'}>
          {isSentEmpty ? `لسا فاضية ${MOOD_EMOJI.nothingSent}` : `${totalSent} ${ACTION_EMOJI.send}`}
        </span>
      </div>

      {!isSentEmpty && (
        <div className="sent-filters" role="tablist" aria-label="تصفية الرسائل المرسلة">
          <a
            href="/sent"
            className={isAllFilter ? 'sent-filter sent-filter--active' : 'sent-filter'}
            role="tab"
            aria-selected={isAllFilter}
          >
            الكل ({totalSent})
          </a>
          <a
            href="/sent?filter=pending"
            className={isPendingFilter ? 'sent-filter sent-filter--active' : 'sent-filter'}
            role="tab"
            aria-selected={isPendingFilter}
          >
            معلّق ({pendingCount})
          </a>
          <a
            href="/sent?filter=resolved"
            className={isResolvedFilter ? 'sent-filter sent-filter--active' : 'sent-filter'}
            role="tab"
            aria-selected={isResolvedFilter}
          >
            مكشوف ({resolvedCount})
          </a>
        </div>
      )}

      {totalSent === 0 && (
        <div className="sent-empty">
          <Stardust />
          <div className="sent-empty__icon" aria-hidden="true">{MOOD_EMOJI.nothingSent}</div>
          <p className="sent-empty__title">لسا ما بعتّ شي.</p>
          <p className="sent-empty__desc">أي اعتراف بتبعته لحدا رح يظهر هون، وتشوف إذا وصل أو وصلك رد عليه.</p>
          <a className="btn btn--secondary btn--sm" href="/inbox">صندوقي السري</a>
        </div>
      )}

      {!isSentEmpty && filteredMessages.length === 0 && (
        <div className="sent-empty filter-empty">
          <p className="sent-empty__title">
            {isPendingFilter ? 'ما في رسائل معلّقة عم تستنى رد هلق.' : 'لسا ما في مصارحات انكشفت.'}
          </p>
          <p className="sent-empty__desc">
            {isPendingFilter
              ? 'لما حدا يبعتلك عرض مصارحة أو تبعت عرض لحدا، بتلاقيه هون.'
              : 'المصارحات اللي وافق الطرفين على كشفها بتظهر هون.'}
          </p>
        </div>
      )}

      {filteredMessages.map((m) => {
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
              <button
                type="button"
                className="msg__copy-btn"
                data-copy-text={m.body}
                aria-label="نسخ نص الرسالة"
              >
                انسخ النص
              </button>
            </div>

            <OfferBlock offer={m.offer} />
          </div>
        )
      })}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){document.addEventListener('click',async function(e){var b=e.target.closest('button[data-copy-text]');if(!b)return;var txt=b.getAttribute('data-copy-text');if(!txt)return;try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(txt);}else{var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}var orig=b.textContent;b.textContent='تم النسخ ✅';b.classList.add('btn--copied');setTimeout(function(){b.textContent=orig;b.classList.remove('btn--copied');},1500);}catch(err){b.textContent='فشل النسخ';setTimeout(function(){b.textContent='انسخ النص';},1500);}});})();`,
        }}
      />
    </div>
  )
}
