import { notFound } from 'next/navigation'
import { getViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { getLinkBySlug } from '../../_lib/domain/links.js'
import { sendConfessionAction } from './actions.js'

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
      <div className="card">
        <p>هالرابط مطفي هلق.</p>
      </div>
    )
  }

  const viewerAccountId = await getViewerAccountId()
  const isOwner = viewerAccountId === link.ownerAccountId

  const action = sendConfessionAction.bind(null, slug)

  return (
    <div>
      <h1>ابعتلـ {link.ownerDisplayName}</h1>

      <p className="notice">
        اسمك ما بيوصل للي عم تبعتله. بس رسالتك مربوطة بحسابك عنا، وإدارة التطبيق بتقدر تشوفه.
      </p>

      {sent === '1' && <p className="muted">الرسالة وصلت.</p>}
      {error && ERROR_COPY[error] && <p className="error">{ERROR_COPY[error]}</p>}

      {isOwner ? (
        <p className="muted">ما فيك تصارح حالك — هيدا رابطك إنت.</p>
      ) : viewerAccountId ? (
        <form action={action}>
          <textarea name="body" required minLength={1} maxLength={4000} rows={5} placeholder="اكتب اللي بقلبك..." />
          <button type="submit">ابعت</button>
        </form>
      ) : (
        <div className="card">
          <p className="muted">لازم تسجل دخول قبل ما تبعت.</p>
          <a className="btn" href="/">سجل دخول</a>
        </div>
      )}
    </div>
  )
}
