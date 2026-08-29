import { getDb } from '../_lib/domain/db.js'
import { getAdminInboxPage } from '../../src/views.js'
import { requireAdminUserId } from './_lib/auth.js'

// Capped at 50, newest first (spec §3.2).
const LIMIT = 50

const STATUS_COPY: Record<string, string> = {
  delivered: 'وصلت',
  hidden_by_recipient: 'مخبّاها المستلم',
  reported: 'تم الإبلاغ عنها',
}

export default async function AdminInboxPage() {
  const db = getDb()
  await requireAdminUserId(db)

  const rows = await getAdminInboxPage(db, { limit: LIMIT, offset: 0 })

  return (
    <div>
      <h1>الرسايل</h1>

      {rows.length === 0 && <p className="muted">ما في شي هلق.</p>}

      {rows.map((r) => (
        <div className="card" key={r.id}>
          <p className="muted">#{r.id}</p>
          <p>{r.body}</p>
          <p className="muted">{r.createdHour.toISOString()}</p>
          <span className="tag">{STATUS_COPY[r.status] ?? r.status}</span>

          <details className="offer">
            <summary>اكشف المرسل</summary>
            <form action="/admin/reveal" method="post">
              <input type="hidden" name="confessionId" value={r.id} />
              <label htmlFor={`reason-${r.id}`}>ليش عم تكشفه؟</label>
              <textarea id={`reason-${r.id}`} name="reason" required minLength={8} maxLength={500} rows={2} />
              <button type="submit" className="danger">اكشف</button>
            </form>
          </details>
        </div>
      ))}
    </div>
  )
}
