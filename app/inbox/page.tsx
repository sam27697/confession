import { requireActiveViewerAccountId } from '../_lib/auth.js'
import { getDb } from '../_lib/domain/db.js'
import { getLinkForOwner } from '../_lib/domain/links.js'
import { getInboxForRecipient } from '../_lib/domain/views.js'
import type { RecipientConfession } from '../_lib/domain/views.js'
import { env } from '../_lib/domain/env.js'
import { formatHourStamp } from '../../src/hourstamp.js'
import {
  setLinkEnabledAction,
  openRevealOfferAction,
  blockSenderAction,
  reportConfessionAction,
  hideConfessionAction,
} from './actions.js'

const ERROR_COPY: Record<string, string> = {
  short: 'لازم تكتب شي مش أقل من حرفين، بكل خانة.',
  generic: 'صار في مشكلة، جرب لاحقاً.',
}

// COPY-ar.md "Default question set" — #9 first, per the note that it is the
// one question a sender cannot answer generically.
const QUESTION_SUGGESTIONS = [
  'شو يلي خلاك تبعتلي هالرسالة هلق بالذات؟',
  'شو الشي يلي دايماً بتحس إني ما فهمته عنك؟',
  'إيمتى كانت آخر مرة زعلت مني وما حكيت؟',
  'شو الشي يلي ندمان عليه معي؟',
  'لو كنت محلي، شو كنت عملت غير؟',
  'شو الشي يلي بتخاف قلّي ياه؟',
  'شو أكتر شي بتتذكره عنّي؟',
  'شو الشي يلي بتمنى لو رجعنا مثل قبل فيه؟',
  'وين كنت غلطان معي وما اعترفت؟',
  'شو بتتمنى إني اعرفه عنك بس ما بتعرف تحكيه؟',
]

// COPY-ar.md "Default stake set" — what she commits to disclose, shown to
// the sender before he decides (this becomes stake_prompt, not her literal
// answer — see the note in the composer form below).
const STAKE_SUGGESTIONS = [
  'رح قلك شو كان رأيي فيك بالحقيقة أول ما تعرفنا.',
  'رح قلك الشي يلي زعلني منك وما حكيته.',
  'رح قلك شو الشي يلي ندمانة/ندمان عليه معك.',
  'رح قلك مين الشخص يلي كنت عم فكر فيه لما وصلتني رسالتك.',
  'رح قلك شو أكتر شي بيخوفني هالفترة.',
  'رح قلك شي عني ما بيعرفه غير شخص واحد.',
  'رح قلك ليش بعدت.',
  'رح قلك شو الشي يلي بتمنى لو قلتلك ياه بوقتو.',
]

function RevealBlock({ reveal, confessionId }: { reveal: RecipientConfession['reveal']; confessionId: string }) {
  if (reveal.kind === 'resolved') {
    return (
      <div className="reveal reveal--resolved">
        <span className="chip chip--resolved">انكشفوا الاتنين</span>
        <p>هو: {reveal.senderDisplayName}</p>
        <p className="hint">جوابه</p>
        <p>{reveal.senderAnswer}</p>
        <p className="hint">جوابك</p>
        <p>{reveal.recipientAnswer}</p>
      </div>
    )
  }

  if (reveal.kind === 'offered' && reveal.state === 'pending') {
    return (
      <div className="reveal">
        <span className="chip chip--pending">لسا ما رد</span>
        <p>بعتلو عرض مصارحة. لسا ما رد.</p>
      </div>
    )
  }

  if (reveal.kind === 'offered' && reveal.state === 'declined') {
    return (
      <div className="reveal">
        <span className="chip chip--declined">ما وافق</span>
        <p>ما وافق على المصارحة. جوابك ضلّ عندك وما حدا شافو.</p>
      </div>
    )
  }

  if (reveal.kind === 'offered' && reveal.state === 'cancelled') {
    return (
      <div className="reveal">
        <span className="chip chip--cancelled">انسحب العرض</span>
        <p>انسحب عرض المصارحة.</p>
      </div>
    )
  }

  return (
    <details className="reveal">
      <summary className="btn btn--reveal btn--sm">صارحني بدورك</summary>
      <p>
        بتحكيلو شي عن حالك، وبتطلب منه شي بالمقابل. ما حدا بيشوف جواب التاني قبل ما ينزلوا الاتنين سوا.
      </p>
      <form action={openRevealOfferAction}>
        <input type="hidden" name="confessionId" value={confessionId} />

        <div className="field-row">
          <label className="field" htmlFor={`q-${confessionId}`}>شو بدك تسأله؟</label>
          <input
            className="input"
            list={`q-list-${confessionId}`}
            id={`q-${confessionId}`}
            name="questionForSender"
            required
            minLength={2}
            maxLength={500}
            placeholder="اكتب سؤالك، أو اختار من تحت"
          />
          <datalist id={`q-list-${confessionId}`}>
            {QUESTION_SUGGESTIONS.map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
        </div>

        <div className="field-row">
          <label className="field" htmlFor={`s-${confessionId}`}>وشو رح تحكيله عن حالك؟</label>
          <input
            className="input"
            list={`s-list-${confessionId}`}
            id={`s-${confessionId}`}
            name="stakePrompt"
            required
            minLength={2}
            maxLength={500}
            placeholder="اختار من تحت أو اكتب وعدك"
          />
          <datalist id={`s-list-${confessionId}`}>
            {STAKE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <span className="hint">لازم يكون شي بنفس الصراحة. هيدا يلي بيخليه يرد.</span>
        </div>

        <div className="field-row">
          <label className="field" htmlFor={`a-${confessionId}`}>جوابك الحقيقي (رح يضل مخبى لحد ما يوافق هو)</label>
          <textarea
            className="textarea"
            id={`a-${confessionId}`}
            name="recipientAnswer"
            required
            minLength={2}
            maxLength={4000}
            rows={3}
            placeholder="اكتب جوابك هون"
          />
          <span className="hint">جوابك محفوظ من هلق وما فيك تغيّره بعدين.</span>
        </div>

        <button type="submit" className="btn btn--primary">ابعت العرض</button>
      </form>
    </details>
  )
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const db = getDb()
  const viewerAccountId = await requireActiveViewerAccountId(db)
  const { error } = await searchParams

  const link = await getLinkForOwner(db, { ownerAccountId: viewerAccountId })
  if (!link) {
    return <p className="notice notice--danger">ما لقينا رابطك.</p>
  }

  const messages = await getInboxForRecipient(db, { linkId: link.linkId, viewerAccountId })
  const visible = messages.filter((m) => m.status !== 'hidden_by_recipient')
  const now = new Date()

  return (
    <div>
      <h1>صندوقك</h1>

      <div className="linkblock">
        <div className="linkblock__head">
          <span>رابطك</span>
          <span>{link.enabled ? 'شغال' : 'مطفي'}</span>
        </div>

        <div className="linkblock__slug" dir="ltr">
          {env.appOrigin}/c/<strong>{link.slug}</strong>
        </div>

        <div className="linkblock__actions">
          <form action={setLinkEnabledAction}>
            <input type="hidden" name="linkId" value={link.linkId} />
            <input type="hidden" name="enabled" value={link.enabled ? '0' : '1'} />
            <div className="toggle">
              <span>
                <strong>الرابط شغال</strong>
                <span>{link.enabled ? 'الناس تقدر تبعتلك هلق.' : 'ما حدا يقدر يبعتلك لحد ما تشغلو.'}</span>
              </span>
              <button type="submit" className="btn btn--secondary btn--md">
                {link.enabled ? 'طفي الرابط' : 'شغل الرابط'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {error && ERROR_COPY[error] && <p className="notice notice--danger">{ERROR_COPY[error]}</p>}

      {visible.length === 0 && (
        <div className="empty">
          <p>صندوقك لسا فاضي</p>
          <p>حط رابطك بستوري أو بالبايو. أول رسالة بتوصل أسرع مما تتخيل.</p>
        </div>
      )}

      {visible.map((m) => {
        const isHidden = m.status === 'hidden_by_recipient'
        const isReported = m.status === 'reported'
        const statusLabel = isHidden ? 'مخبّاها' : isReported ? 'تم الإبلاغ عنها' : 'وصلت'
        return (
        <div className={isHidden ? 'msg msg--hidden' : 'msg'} key={m.id}>
          <p className="msg__body">{m.body}</p>

          <div className="msg__meta">
            <span className="hour">{formatHourStamp(m.createdHour, now)}</span>
            <span className={isHidden ? 'chip chip--hidden' : isReported ? 'chip chip--reported' : 'chip chip--delivered'}>
              {statusLabel}
            </span>
          </div>

          <RevealBlock reveal={m.reveal} confessionId={m.id} />

          <div className="msg__actions">
            <form action={hideConfessionAction}>
              <input type="hidden" name="confessionId" value={m.id} />
              <button type="submit" className="btn btn--secondary btn--sm">خبيها</button>
            </form>
            <form action={blockSenderAction}>
              <input type="hidden" name="confessionId" value={m.id} />
              <button type="submit" className="btn btn--danger btn--sm">احظر صاحبها</button>
            </form>
            <details>
              <summary className="btn btn--secondary btn--sm">بلغ عنها</summary>
              <form action={reportConfessionAction}>
                <input type="hidden" name="confessionId" value={m.id} />
                <div className="field-row">
                  <label className="field" htmlFor={`r-${m.id}`}>ليش عم تبلغ؟</label>
                  <input className="input" id={`r-${m.id}`} type="text" name="reason" required minLength={2} maxLength={300} />
                </div>
                <button type="submit" className="btn btn--danger">بلغ</button>
              </form>
            </details>
          </div>
        </div>
        )
      })}

      <a className="btn btn--ghost" href="/account/delete">حذف الحساب</a>
    </div>
  )
}
