import { requireViewerAccountId } from '../_lib/auth.js'
import { getDb } from '../_lib/domain/db.js'
import { getLinkForOwner } from '../_lib/domain/links.js'
import { getInboxForRecipient } from '../_lib/domain/views.js'
import type { RecipientConfession } from '../_lib/domain/views.js'
import { env } from '../_lib/domain/env.js'
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
      <div className="card">
        <p className="muted">انكشفوا الاتنين</p>
        <p>هو: {reveal.senderDisplayName}</p>
        <p className="muted">جوابه</p>
        <p>{reveal.senderAnswer}</p>
        <p className="muted">جوابك</p>
        <p>{reveal.recipientAnswer}</p>
      </div>
    )
  }

  if (reveal.kind === 'offered' && reveal.state === 'pending') {
    return <p className="muted">بعتلو عرض مصارحة. لسا ما رد.</p>
  }

  if (reveal.kind === 'offered' && reveal.state === 'declined') {
    return <p className="muted">ما وافق على المصارحة. جوابك ضلّ عندك وما حدا شافو.</p>
  }

  if (reveal.kind === 'offered' && reveal.state === 'cancelled') {
    return <p className="muted">انسحب عرض المصارحة.</p>
  }

  return (
    <details className="offer">
      <summary>صارحني بدورك</summary>
      <p className="muted">
        بتحكيلو شي عن حالك، وبتطلب منه شي بالمقابل. ما حدا بيشوف جواب التاني قبل ما ينزلوا الاتنين سوا.
      </p>
      <form action={openRevealOfferAction}>
        <input type="hidden" name="confessionId" value={confessionId} />

        <label htmlFor={`q-${confessionId}`}>شو بدك تسأله؟</label>
        <input
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

        <label htmlFor={`s-${confessionId}`}>وشو رح تحكيله عن حالك؟</label>
        <input
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
        <p className="muted">لازم يكون شي بنفس الصراحة. هيدا يلي بيخليه يرد.</p>

        <label htmlFor={`a-${confessionId}`}>جوابك الحقيقي (رح يضل مخبى لحد ما يوافق هو)</label>
        <textarea
          id={`a-${confessionId}`}
          name="recipientAnswer"
          required
          minLength={2}
          maxLength={4000}
          rows={3}
          placeholder="اكتب جوابك هون"
        />
        <p className="muted">جوابك محفوظ من هلق وما فيك تغيّره بعدين.</p>

        <button type="submit">ابعت العرض</button>
      </form>
    </details>
  )
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const viewerAccountId = await requireViewerAccountId()
  const { error } = await searchParams
  const db = getDb()

  const link = await getLinkForOwner(db, { ownerAccountId: viewerAccountId })
  if (!link) {
    return <p className="error">ما لقينا رابطك.</p>
  }

  const messages = await getInboxForRecipient(db, { linkId: link.linkId, viewerAccountId })
  const linkUrl = `${env.appOrigin}/c/${link.slug}`
  const visible = messages.filter((m) => m.status !== 'hidden_by_recipient')

  return (
    <div>
      <h1>صندوقك</h1>

      <div className="card">
        <p className="muted">رابطك</p>
        <p className="pre">{linkUrl}</p>
        <p className="muted">{link.enabled ? 'الرابط شغال هلق.' : 'الرابط مطفي هلق.'}</p>
        <form action={setLinkEnabledAction}>
          <input type="hidden" name="linkId" value={link.linkId} />
          <input type="hidden" name="enabled" value={link.enabled ? '0' : '1'} />
          <button type="submit" className="secondary">
            {link.enabled ? 'طفي الرابط' : 'شغل الرابط'}
          </button>
        </form>
      </div>

      {error && ERROR_COPY[error] && <p className="error">{ERROR_COPY[error]}</p>}

      {visible.length === 0 && <p className="muted">لسا ما وصلك شي.</p>}

      {visible.map((m) => (
        <div className="card" key={m.id}>
          <p>{m.body}</p>
          {m.status === 'reported' && <span className="tag">تم الإبلاغ عنها</span>}

          <RevealBlock reveal={m.reveal} confessionId={m.id} />

          <div className="actions">
            <form className="inline" action={hideConfessionAction}>
              <input type="hidden" name="confessionId" value={m.id} />
              <button type="submit" className="secondary">خبيها</button>
            </form>
            <form className="inline" action={blockSenderAction}>
              <input type="hidden" name="confessionId" value={m.id} />
              <button type="submit" className="secondary">احظر صاحبها</button>
            </form>
            <details className="offer">
              <summary>بلغ عنها</summary>
              <form action={reportConfessionAction}>
                <input type="hidden" name="confessionId" value={m.id} />
                <label htmlFor={`r-${m.id}`}>ليش عم تبلغ؟</label>
                <input id={`r-${m.id}`} type="text" name="reason" required minLength={2} maxLength={300} />
                <button type="submit" className="danger">بلغ</button>
              </form>
            </details>
          </div>
        </div>
      ))}
    </div>
  )
}
