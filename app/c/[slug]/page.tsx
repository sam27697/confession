import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { getLinkBySlug } from '../../_lib/domain/links.js'
import { env } from '../../_lib/domain/env.js'
import { personalisedShareMetadata, storyCardVariant } from '../../../src/share-card.js'
import { sendConfessionAction } from './actions.js'
import { SubmitButton } from '../../_components/SubmitButton.js'
import { Celebrate } from '../../_components/Celebrate.js'
import { CopyLink } from '../../_components/CopyLink.js'
import { ACTION_EMOJI, MOOD_EMOJI, STATE_EMOJI } from '../../_lib/emoji.js'

// Share-card spec §1, §3: an enabled link gets the personalised card; a
// disabled link or a missing slug gets the generic card. Returning {} here
// for the disabled/missing cases lets the root layout's generic metadata
// (app/layout.tsx) apply unchanged, so the two cases are byte-identical and
// neither becomes a second, easier user-enumeration oracle than the page
// underneath already is (§2.6).
//
// generateMetadata and the page component are two independent Next entry
// points, not a shared call frame, and src/links.ts is frozen (builder A's
// signatures), so they cannot share a variable. They share a request
// instead: React's cache() memoises per request, so the slug is read from
// the database once and the second caller gets the same row from memory
// (week 15 §2). This is the page every shared link lands on, the busiest
// read in the app.
const loadLink = cache((slug: string) => getLinkBySlug(getDb(), { slug }))

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string | string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  // ?q= picks which pre-drawn story card Facebook shows when this link is
  // shared to a story (week 16 §2.1). Validated against a fixed list; the page
  // body below never reads it.
  const { q } = await searchParams
  const link = await loadLink(slug)

  if (!link || !link.enabled) return {}

  const share = personalisedShareMetadata({
    appOrigin: env.appOrigin,
    facebookAppId: env.facebookAppId,
    slug,
    ownerDisplayName: link.ownerDisplayName,
    storyVariant: storyCardVariant(q),
  })

  return {
    openGraph: share.openGraph,
    twitter: share.twitter,
    ...(share.facebook ? { facebook: share.facebook } : {}),
  }
}

const ERROR_COPY: Record<string, string> = {
  signin: 'سجّل دخول أول، وبعدها فيك تبعت رسالتك.',
  empty: 'الرسالة فاضية. اكتب شي قبل ما تبعت.',
  ratelimit: 'بعتّ رسايل كتير بوقت قصير. خود استراحة صغيرة وجرب بعد شوي.',
  unavailable: 'هالرابط مش عم يستقبل رسايل هلق.',
  generic: 'صار خلل من عنا، مش منك. جرب كمان مرة بعد شوي.',
}

const STARTER_PROMPTS = [
  'صارحني بشي ما بتسترجي تقوله بوجهي...',
  'شو أكتر موقف حلو ما بتنساه معي؟',
  'كلمة بقلبك من زمان وحابب توصلني...',
  'نصيحة صادقة من قلبك بتفيدني بهالفترة...',
]

function SignInCard({ slug, ownerDisplayName }: { slug: string; ownerDisplayName: string }) {
  return (
    <div className="card send-card">
      <p className="send-pitch">
        صارح {ownerDisplayName} باللي بقلبك بدون ما يعرف هويتك.
      </p>
      {/* True for a first-time visitor too: next rides through /onboarding
          in the after_login cookie (week 15 §2.3). */}
      <p className="hint">تسجيل الدخول بياخد ثواني، وبعدها منرجعك لهون لتكتب رسالتك.</p>
      <a className="btn btn--primary btn--block" href={`/?next=/c/${encodeURIComponent(slug)}`}>سجل دخول {ACTION_EMOJI.send}</a>
    </div>
  )
}

export default async function SendPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const { slug } = await params
  const { sent, error } = await searchParams
  const link = await loadLink(slug)

  if (!link) notFound()

  if (!link.enabled) {
    // A visitor who followed a friend's link to a switched-off box is still
    // a visitor who wanted to write something. Say it is paused rather than
    // gone, and offer them their own box (week 15 §3.5).
    return (
      <div className="veil enter">
        <div className="empty">
          <p>هالرابط مش عم يستقبل رسايل هلق.</p>
          <p>صاحبه طفّاه لفترة. فيك ترجع بعدين، أو تفتح صندوقك وتخلي رفقاتك يصارحوك.</p>
          <a className="btn btn--secondary btn--sm" href="/inbox">
            افتح صندوقك السري
          </a>
        </div>
      </div>
    )
  }

  const viewerAccountId = await getViewerAccountId()
  const isOwner = viewerAccountId === link.ownerAccountId
  const isRateLimit = error === 'ratelimit'

  const action = sendConfessionAction.bind(null, slug)
  const initial = link.ownerDisplayName.trim().slice(0, 1) || 'م'

  return (
    <div className="veil enter">
      <div className="send-hero">
        <div className="send-avatar" aria-hidden="true">
          <span>{initial}</span>
        </div>
        <div className="send-hero__text">
          <span className="send-badge">{MOOD_EMOJI.secret} اعتراف سري</span>
          <h1>ابعتلـ {link.ownerDisplayName}</h1>
        </div>
      </div>

      {sent === '1' && (
        <>
          <p className="notice notice--citron">{STATE_EMOJI.delivered} الرسالة وصلت.</p>
          <script
            dangerouslySetInnerHTML={{
              __html: `try{sessionStorage.removeItem('confession_draft_${slug}');}catch(e){void e;}`,
            }}
          />
          <div className="card reciprocal-card">
            <p className="hint">حابب تعرف شو مخبيلك أصحابك بقلبهم؟</p>
            <p className="reciprocal-card__pitch">افتح صندوقك السري وشارك رابطك مع رفقاتك ليصارحوك.</p>
            <a className="btn btn--primary btn--block" href="/inbox">افتح صندوقك السري {ACTION_EMOJI.send}</a>
            <a className="btn btn--secondary btn--block" href="/sent">عرض الرسائل المرسلة</a>
            <div className="friend-challenge">
              <span className="friend-challenge__label">أو تحدى رفقاتك يصارحوا {link.ownerDisplayName}:</span>
              <CopyLink
                url={`${env.appOrigin}/c/${slug}`}
                label={`انسخ رابط ${link.ownerDisplayName} لتبعتوه بالغروب`}
                className="btn btn--ghost btn--block"
              />
            </div>
          </div>
          <Celebrate />
        </>
      )}
      {error && ERROR_COPY[error] && (
        <p id="body-error" role="alert" className={isRateLimit ? 'notice notice--warning' : 'notice notice--danger'}>{ERROR_COPY[error]}</p>
      )}

      {isOwner ? (
        <div className="card">
          <p className="hint">ما فيك تصارح حالك، هيدا رابطك إنت.</p>
        </div>
      ) : viewerAccountId ? (
        <form action={action}>
          <div className="compose-starters" role="group" aria-label="أفكار للبدء">
            <span className="compose-starters__label">أفكار للبدء:</span>
            <div className="compose-starters__list">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="starter-chip"
                  data-starter-prompt={prompt}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){document.addEventListener('click',function(e){var t=e.target.closest('button[data-starter-prompt]');if(!t)return;var f=t.closest('form');if(!f)return;var ta=f.querySelector('textarea[name="body"]');if(!ta)return;ta.value=t.getAttribute('data-starter-prompt')||'';ta.focus();ta.dispatchEvent(new Event('input',{bubbles:true}));});})();`,
            }}
          />
          <div className="field-row">
            {/* The field had a placeholder and no label, so a screen reader
                announced it as an unnamed text area. The label is visually
                hidden rather than shown because the h1 above already names
                the screen; nothing about the field's name or validation
                changes (spec §0, acceptance item 17). */}
            <label className="sr-only" htmlFor="body">رسالتك</label>
            <textarea
              id="body"
              className="textarea textarea--hero"
              name="body"
              data-draft-slug={slug}
              required
              minLength={1}
              maxLength={4000}
              rows={5}
              placeholder="اكتب اللي بقلبك..."
              aria-describedby={error ? 'body-error' : undefined}
              aria-invalid={error ? 'true' : undefined}
              autoFocus={Boolean(error)}
            />
          </div>
          <div className="compose-meta">
            <span className="hint" aria-live="polite">الحد الأقصى 4000 حرف</span>
            <span className="compose-rule" aria-live="polite">حرفين على الأقل للبدء</span>
            <span id="draft-status" className="draft-indicator" aria-live="polite" />
          </div>
          <p className="notice">
            اسمك ما بيوصل للي عم تبعتله. بس رسالتك مربوطة بحسابك عنا، وإدارة التطبيق بتقدر تشوفه.
          </p>
          <SubmitButton className="btn btn--primary btn--block" loadingText="عم يبعت...">ابعت {ACTION_EMOJI.send}</SubmitButton>
        </form>
      ) : (
        <SignInCard slug={slug} ownerDisplayName={link.ownerDisplayName} />
      )}
    </div>
  )
}
