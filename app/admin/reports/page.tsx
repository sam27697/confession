import { getDb } from '../../_lib/domain/db.js'
import { getAdminReports } from '../../../src/admin.js'
import { requireAdminUserId } from '../_lib/auth.js'

const LIMIT = 50

const STATUS_COPY: Record<string, string> = {
  delivered: 'وصلت',
  hidden_by_recipient: 'مخبّاها المستلم',
  reported: 'تم الإبلاغ عنها',
}

export default async function AdminReportsPage() {
  const db = getDb()
  await requireAdminUserId(db)

  const rows = await getAdminReports(db, { limit: LIMIT })

  return (
    <div>
      <h1>البلاغات</h1>

      {rows.length === 0 && <p className="muted">ما في بلاغات هلق.</p>}

      {rows.map((r) => (
        <div className="card" key={r.reportId}>
          <p className="muted">#{r.confessionId}</p>
          <p>{r.body}</p>
          <p className="muted">{r.createdHour.toISOString()}</p>
          <span className="tag">{STATUS_COPY[r.status] ?? r.status}</span>

          <p className="muted">سبب البلاغ</p>
          <p>{r.reason}</p>

          <details className="offer">
            <summary>اكشف المرسل</summary>
            <form action="/admin/reveal" method="post">
              <input type="hidden" name="confessionId" value={r.confessionId} />
              <label htmlFor={`reason-${r.reportId}`}>ليش عم تكشفه؟</label>
              <textarea
                id={`reason-${r.reportId}`}
                name="reason"
                required
                minLength={8}
                maxLength={500}
                rows={2}
              />
              <button type="submit" className="danger">اكشف</button>
            </form>
          </details>
        </div>
      ))}
    </div>
  )
}
