import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { getLinkBySlug } from '../../_lib/domain/links.js'
import { env } from '../../_lib/domain/env.js'
import { personalisedShareMetadata } from '../../../src/share-card.js'
import { sendConfessionAction } from './actions.js'

// Share-card spec §1, §3: an enabled link gets the personalised card; a
// disabled link or a missing slug gets the generic card. Returning {} here
// for the disabled/missing cases lets the root layout's generic metadata
// (app/layout.tsx) apply unchanged, so the two cases are byte-identical and
// neither becomes a second, easier user-enumeration oracle than the page
// underneath already is (§2.6).
//
// This does exactly one read by slug, the same query the page component
// below also runs — it is not combined with it because src/links.ts is
// frozen (builder A's signatures) and generateMetadata and the page
// component are two independent Next entry points, not a shared call
// frame.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const db = getDb()
  const link = await getLinkBySlug(db, { slug })

  if (!link || !link.enabled) return {}

  const share = personalisedShareMetadata({
    appOrigin: env.appOrigin,
    facebookAppId: env.facebookAppId,
    slug,
    ownerDisplayName: link.ownerDisplayName,
  })

  return {
    openGraph: share.openGraph,
    twitter: share.twitter,
    ...(share.facebook ? { facebook: share.facebook } : {}),
  }
}

const ERROR_COPY: Record<string, string> = {
  signin: 'لازم تسجل دخول تبعت رسالة.',
  empty: 'لازم تكتب شي.',
  ratelimit: 'بعتّ كتير رسائل، جرب بعد شوي.',
  unavailable: 'الرابط مش متاح هلق.',
  generic: 'صار في مشكلة، جرب لاحقاً.',
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
  const db = getDb()
  const link = await getLinkBySlug(db, { slug })

  if (!link) notFound()

  if (!link.enabled) {
    return (
      <div className="notice">
        <p>هالرابط مطفي هلق.</p>
      </div>
    )
  }

  const viewerAccountId = await getViewerAccountId()
  const isOwner = viewerAccountId === link.ownerAccountId
  const isRateLimit = error === 'ratelimit'

  const action = sendConfessionAction.bind(null, slug)

  return (
    <div className="veil">
      <h1>ابعتلـ {link.ownerDisplayName}</h1>

      {sent === '1' && <p className="notice notice--citron">الرسالة وصلت.</p>}
      {error && ERROR_COPY[error] && (
        <p className={isRateLimit ? 'notice notice--warning' : 'notice notice--danger'}>{ERROR_COPY[error]}</p>
      )}

      {isOwner ? (
        <p className="hint">ما فيك تصارح حالك، هيدا رابطك إنت.</p>
      ) : viewerAccountId ? (
        <form action={action}>
          <div className="field-row">
            <textarea className="textarea textarea--hero" name="body" required minLength={1} maxLength={4000} rows={5} placeholder="اكتب اللي بقلبك..." />
          </div>
          <p className="notice">
            اسمك ما بيوصل للي عم تبعتله. بس رسالتك مربوطة بحسابك عنا، وإدارة التطبيق بتقدر تشوفه.
          </p>
          <button type="submit" className="btn btn--primary btn--block">ابعت</button>
        </form>
      ) : (
        <div className="card">
          <p className="hint">لازم تسجل دخول قبل ما تبعت.</p>
          <a className="btn btn--primary" href="/">سجل دخول</a>
        </div>
      )}
    </div>
  )
}
