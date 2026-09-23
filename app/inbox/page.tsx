import { requireActiveViewerAccountId } from '../_lib/auth.js'
import { getDb } from '../_lib/domain/db.js'
import { getLinkForOwner } from '../_lib/domain/links.js'
import { getInboxForRecipient, countSentForSender } from '../_lib/domain/views.js'
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
import { ACTION_EMOJI, MOOD_EMOJI, STATE_EMOJI } from '../_lib/emoji.js'
import { CopyLink } from '../_components/CopyLink.js'
import { StoryCard } from '../_components/StoryCard.js'
import { SubmitButton } from '../_components/SubmitButton.js'
import { RevealCard, QUESTION_SUGGESTIONS, STAKE_SUGGESTIONS } from '../_components/RevealCard.js'

const ERROR_COPY: Record<string, string> = {
  short: 'كل خانة بدها حرفين على الأقل. كمّلها وجرب كمان مرة.',
  generic: 'صار خلل من عنا، مش منك. جرب كمان مرة بعد شوي.',
}

// Week 15 §3.1. What each action in ./actions.ts just did, said once, where
// the person did it. Only a fixed key travels in the URL; the sentence is
// looked up here, so nothing a visitor types into ?done= can reach the page.
const DONE_COPY: Record<string, string> = {
  hidden: 'خبّيناها من صندوقك.',
  blocked: 'تم الحظر. ما رح توصلك منه رسايل جديدة، وهو ما رح يعرف إنك حظرته.',
  reported: 'وصلنا بلاغك، والإدارة رح تراجعه.',
  offered: 'انبعت العرض. جوابك مخبّى لحد ما يرد الطرف التاني.',
}

const DAILY_SPARKS = [
  'شو الشي يلي مغير فيني ومستحي تقوله؟',
  'شو أول انطباع أخدته عني وطلع غلط؟',
  'كلمة أو موقف بيننا مستحيل تنساه؟',
  'شو أكتر صفة بتحبها فيني وما بتعرف تعبر عنها؟',
  'شو السر يلي كنت حابب تعترفلي فيه من زمان؟',
  'لو فيك تسألني سؤال واحد وتضمن إني أجاوب بصراحة؟',
  'شو الشي يلي بتتمنى نتشاركه سوا وما صار فرصة؟',
]



function RevealBlock({ reveal, confessionId }: { reveal: RecipientConfession['reveal']; confessionId: string }) {
  if (reveal.kind === 'resolved') {
    return (
      <div className="reveal reveal--resolved reveal--glow">
        <div className="reveal-seal">
          <span className="chip chip--resolved">{STATE_EMOJI.resolved} انكشف السر</span>
          <strong className="reveal-seal__identity">{reveal.senderDisplayName}</strong>
          <span className="reveal-seal__affirmation">انكشف السر بينكم، صار فيكم تحكوا براحتكم ✨</span>
        </div>
        <div className="reveal-dialogue">
          <div className="reveal-dialogue__item">
            <span className="hint">جواب {reveal.senderDisplayName}</span>
            <p className="reveal-dialogue__text">{reveal.senderAnswer}</p>
          </div>
          <div className="reveal-dialogue__item">
            <span className="hint">جوابك</span>
            <p className="reveal-dialogue__text">{reveal.recipientAnswer}</p>
          </div>
        </div>
      </div>
    )
  }

  if (reveal.kind === 'offered' && reveal.state === 'pending') {
    return (
      <div className="reveal">
        <span className="chip chip--pending">{STATE_EMOJI.pending} لسا ما رد</span>
        <p>انبعت عرض المصارحة، ولسا ما وصل رد.</p>
      </div>
    )
  }

  if (reveal.kind === 'offered' && reveal.state === 'declined') {
    return (
      <div className="reveal">
        <span className="chip chip--declined">{STATE_EMOJI.declined} ما وافق</span>
        <p>ما وافق على المصارحة. جوابك ضلّ عندك وما حدا شافو.</p>
      </div>
    )
  }

  if (reveal.kind === 'offered' && reveal.state === 'cancelled') {
    return (
      <div className="reveal">
        <span className="chip chip--cancelled">{STATE_EMOJI.cancelled} انسحب العرض</span>
        <p>انسحب عرض المصارحة.</p>
      </div>
    )
  }

  return (
    <div className="reveal">
      <div className="btn btn--reveal btn--sm">صارحني بدورك {ACTION_EMOJI.reveal}</div>
      <RevealCard>
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
            <div className="field-row">
              {QUESTION_SUGGESTIONS.slice(0, 3).map((q) => (
                <button
                  key={q}
                  type="button"
                  className="chip chip--pending"
                  data-target={`q-${confessionId}`}
                  data-prompt={q}
                >
                  {q}
                </button>
              ))}
            </div>
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
            <div className="field-row">
              {STAKE_SUGGESTIONS.slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip chip--pending"
                  data-target={`s-${confessionId}`}
                  data-prompt={s}
                >
                  {s}
                </button>
              ))}
            </div>
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

          <SubmitButton className="btn btn--primary" loadingText="عم يبعت العرض...">ابعت العرض {ACTION_EMOJI.send}</SubmitButton>
        </form>
      </RevealCard>
    </div>
  )
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>
}) {
  const db = getDb()
  const viewerAccountId = await requireActiveViewerAccountId(db)
  const { error, done } = await searchParams

  const link = await getLinkForOwner(db, { ownerAccountId: viewerAccountId })
  if (!link) {
    // Every account gets its link in the same transaction that creates it,
    // so this is a fault, not a state. Say so without alarm; the header nav
    // above is still the way out (week 15 §3.5).
    return (
      <div className="empty">
        <p>ما قدرنا نلاقي رابطك هلق.</p>
        <p>جرب تحدّث الصفحة بعد شوي.</p>
      </div>
    )
  }

  // The list and the other tab's badge do not depend on each other, so they
  // are read together. The badge is a count, not the other tab's whole list
  // (week 15 §2.2).
  const [messages, totalSent] = await Promise.all([
    getInboxForRecipient(db, { linkId: link.linkId, viewerAccountId }),
    countSentForSender(db, { senderAccountId: viewerAccountId }),
  ])
  const confessions = messages
  const visible = messages.filter((m) => m.status !== 'hidden_by_recipient')
  const now = new Date()
  const totalCount = visible.length
  const isInboxEmpty = totalCount === 0
  const dayIndex = Math.floor(now.getTime() / 86400000) % DAILY_SPARKS.length
  const sparkOfTheDay = DAILY_SPARKS[Math.abs(dayIndex)] || DAILY_SPARKS[0]

  return (
    <div className="enter">
      <nav className="app-nav" aria-label="التنقل الرئيسي">
        <a href="/inbox" className="app-nav__tab app-nav__tab--active" aria-current="page">
          <span>صندوقي</span>
          <span className="app-nav__badge">{totalCount}</span>
        </a>
        <a href="/sent" className="app-nav__tab">
          <span>الرسائل المرسلة</span>
          <span className="app-nav__badge">{totalSent}</span>
        </a>
      </nav>

      <div className="inbox-header">
        <h1>صندوقك</h1>
        <span className={isInboxEmpty ? 'inbox-badge inbox-badge--empty' : 'inbox-badge'}>
          {isInboxEmpty ? `جاهز للرسايل ${MOOD_EMOJI.sparkle}` : `${totalCount} ${MOOD_EMOJI.fire}`}
        </span>
      </div>

      {/* What was just done, pinned to the bottom of the viewport: the action
          was taken on a card further down, and a Server Action's redirect
          keeps the scroll position, so a notice in the flow of the page was
          off-screen at exactly the moment it mattered. The key is fresh on
          every render, so hiding two messages in a row shows the second
          confirmation too instead of reusing the faded first one. */}
      {done && DONE_COPY[done] && (
        <div className="toasts flash" key={now.getTime()}>
          <p className="toast toast--citron" role="status">
            {DONE_COPY[done]}
          </p>
        </div>
      )}
      {/* An error stays in the flow, directly under the heading: it has to
          be read and acted on, so it does not leave on its own. Below the
          link block it was off the first screen of a phone. */}
      {error && ERROR_COPY[error] && (
        <p className="notice notice--danger" role="alert">
          {ERROR_COPY[error]}
        </p>
      )}

      <div className="daily-spark" role="region" aria-label="سؤال اليوم">
        <div className="daily-spark__header">
          <span className="daily-spark__badge">{MOOD_EMOJI.sparkle} سؤال اليوم</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm daily-spark__copy"
            data-spark-text={sparkOfTheDay}
            aria-label="نسخ سؤال اليوم"
          >
            نسخ السؤال
          </button>
        </div>
        <p className="daily-spark__prompt">«{sparkOfTheDay}»</p>
        <span className="daily-spark__hint">انشره بستوري أو حالة ليسألوك عنه بالسر</span>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){document.addEventListener('click',function(e){var b=e.target.closest('.daily-spark__copy');if(!b)return;var text=b.getAttribute('data-spark-text')||'';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){var orig=b.textContent;b.textContent='تم النسخ ✅';b.classList.add('btn--copied');setTimeout(function(){b.textContent=orig;b.classList.remove('btn--copied');},1600);});}});})();`,
        }}
      />

      {/* The block breathes while the link is live and is still the moment
          it is switched off (spec §9.10). The state is link.enabled, the
          same field the toggle below submits: motion saying what the word
          «شغال» already says, not a new claim. */}
      <div className={link.enabled ? 'linkblock linkblock--live' : 'linkblock'}>
        <div className="linkblock__head">
          <span>رابطك</span>
          <span>{link.enabled ? 'شغال' : 'مطفي'}</span>
        </div>

        <div className="linkblock__slug" dir="ltr">
          {env.appOrigin}/c/<strong>{link.slug}</strong>
        </div>

        {/* Only when there is something in the inbox. On an empty one the
            .empty block below already says «حط رابطك بستوري أو بالبايو»,
            which is the design system readme's own growth copy (spec §3.2),
            and two near-identical instructions on one short screen read as
            nagging rather than as help. */}
        {!isInboxEmpty && (
          <p className="linkblock__hint">انشر الرابط بستوري أو بالبايو لتوصلك اعترافات جديدة {MOOD_EMOJI.eyes}</p>
        )}

        <div className="linkblock__actions">
          <div className="linkblock__buttons">
            {/* Spec §9, taking up §7.1's deferred decision. The button renders
                itself only where the Clipboard API is actually usable, so the
                slug above stays the guaranteed route to the link and this is
                an accelerator on top of it. */}
            <CopyLink url={`${env.appOrigin}/c/${link.slug}`} />
            {/* Spec §9.7. The card is the same link as a 1080x1920 image,
                because the slug's whole job is to reach a story, and asking
                someone to retype it there is where the funnel leaks. */}
            <StoryCard url={`${env.appOrigin}/c/${link.slug}`} slug={link.slug} />
          </div>
          <form action={setLinkEnabledAction}>
            <input type="hidden" name="linkId" value={link.linkId} />
            <input type="hidden" name="enabled" value={link.enabled ? '0' : '1'} />
            <div className="toggle">
              <span>
                <strong>الرابط شغال</strong>
                <span>{link.enabled ? 'الناس تقدر تبعتلك هلق.' : 'ما حدا يقدر يبعتلك لحد ما تشغلو.'}</span>
              </span>
              <SubmitButton className="btn btn--secondary btn--md">
                {link.enabled ? 'طفي الرابط' : 'شغل الرابط'}
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>


      {(confessions.length === 0 || visible.length === 0) && (
        <div className="empty inbox-empty">
          <p className="inbox-empty__title">{MOOD_EMOJI.emptyInbox} نوّرت الصندوق، لسا عم نستنى أول مصارحة</p>
          <p className="inbox-empty__text">حط رابطك بستوري أو بالبايو، واطلب من رفقاتك يحكولك اللي بقلبهم بالسر.</p>
        </div>
      )}

      {visible.map((m) => {
        const isHidden = m.status === 'hidden_by_recipient'
        const isResolved = m.reveal.kind === 'resolved'
        const isReported = m.status === 'reported'
        const statusLabel = isHidden
          ? `${STATE_EMOJI.hidden} مخبّاها`
          : isReported
            ? `${STATE_EMOJI.reported} تم الإبلاغ عنها`
            : `${STATE_EMOJI.delivered} وصلت`
        return (
        <div className={isHidden ? 'msg msg--hidden' : isResolved ? 'msg msg--resolved' : 'msg'} key={m.id}>
          <div className={isResolved ? 'msg__tag msg__tag--resolved' : 'msg__tag'}>
            <span>{isResolved ? 'اعتراف مكشوف' : 'اعتراف سري'}</span>
            <span>{isResolved ? STATE_EMOJI.resolved : MOOD_EMOJI.secret}</span>
          </div>

          <p className="msg__body">{m.body}</p>

          <div className="msg__meta">
            <span className="hour">{formatHourStamp(m.createdHour, now)}</span>
            <span className={isHidden ? 'chip chip--hidden' : isReported ? 'chip chip--reported' : 'chip chip--delivered'}>
              {statusLabel}
            </span>
          </div>

          <RevealBlock reveal={m.reveal} confessionId={m.id} />

          {/* Spec §9.11. A message used to carry four buttons: the reveal
              plus hide, block and report. Three of those are moderation --
              needed, rarely wanted, and never the reason anyone opened this
              screen. They fold behind one disclosure, so a card reads as a
              message with one thing to do rather than a toolbar.

              The report form is flattened out of its own nested <details>
              in the process: a disclosure inside a disclosure was two taps
              to reach a text field. No form action, no field name and no
              validation attribute changes here, which is what lets §0 and
              acceptance item 17 stay true across the restructure. */}
          <div className="msg__actions">
            <StoryCard
              url={`${env.appOrigin}/c/${link.slug}`}
              slug={link.slug}
              reactionText={m.body}
              buttonText="شارك ردك بالستوري"
              buttonClass="btn btn--ghost btn--sm"
            />
            <details className="msg__more">
              <summary className="btn btn--ghost btn--sm">خيارات</summary>
              <div className="msg__more-body">
                <form action={hideConfessionAction}>
                  <input type="hidden" name="confessionId" value={m.id} />
                  <SubmitButton className="btn btn--secondary btn--sm">خبيها</SubmitButton>
                </form>
                <form action={blockSenderAction}>
                  <input type="hidden" name="confessionId" value={m.id} />
                  <SubmitButton className="btn btn--danger btn--sm">احظر صاحبها</SubmitButton>
                  {/* Said where the decision is taken, not after it (week 15
                      §3.4). True because a blocked sender's send returns
                      success and writes nothing, and v1 has no notifications
                      at all. */}
                  <span className="hint">الحظر بيوقف رسايله إلك، وما بيوصله إشعار.</span>
                </form>
                <form action={reportConfessionAction}>
                  <input type="hidden" name="confessionId" value={m.id} />
                  <div className="field-row">
                    <label className="field" htmlFor={`r-${m.id}`}>ليش عم تبلغ؟</label>
                    <input className="input" id={`r-${m.id}`} type="text" name="reason" required minLength={2} maxLength={300} />
                  </div>
                  <SubmitButton className="btn btn--danger btn--sm">بلغ</SubmitButton>
                </form>
              </div>
            </details>
          </div>
        </div>
        )
      })}

      {/* The account's quiet corner (week 15 §1 item 12). Deleting stays one
          tap away, as data sovereignty requires, beside the two documents
          that say what deleting keeps and removes, instead of sitting alone
          under the messages as the last button on the screen. */}
      <nav className="account-links" aria-label="حسابك">
        <a href="/terms">الشروط والأحكام</a>
        <a href="/privacy">سياسة الخصوصية</a>
        <a href="/account/delete">حذف الحساب</a>
      </nav>
    </div>
  )
}
