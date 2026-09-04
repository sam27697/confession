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

      {rows.length === 0 && <p className="hint">ما في بلاغات هلق.</p>}

      {rows.map((r) => {
        const isHidden = r.status === 'hidden_by_recipient'
        const isReported = r.status === 'reported'
        return (
        <div className="card card--raised" key={r.reportId}>
          <p className="hint">#{r.confessionId}</p>
          <p>{r.body}</p>
          <p className="hint">{r.createdHour.toISOString()}</p>
          <span className={isHidden ? 'chip chip--hidden' : isReported ? 'chip chip--reported' : 'chip chip--delivered'}>
            {STATUS_COPY[r.status] ?? r.status}
          </span>

          <p className="hint">سبب البلاغ</p>
          <p>{r.reason}</p>

          <details>
            <summary className="btn btn--danger btn--sm">اكشف المرسل</summary>
            <form action="/admin/reveal" method="post">
              <input type="hidden" name="confessionId" value={r.confessionId} />
              <div className="field-row">
                <label className="field" htmlFor={`reason-${r.reportId}`}>ليش عم تكشفه؟</label>
                <textarea
                  className="textarea"
                  id={`reason-${r.reportId}`}
                  name="reason"
                  required
                  minLength={8}
                  maxLength={500}
                  rows={2}
                />
              </div>
              <button type="submit" className="btn btn--danger">اكشف</button>
            </form>
          </details>
        </div>
        )
      })}
    </div>
  )
}
