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

      {rows.length === 0 && <p className="hint">ما في شي هلق.</p>}

      {rows.map((r) => {
        const isHidden = r.status === 'hidden_by_recipient'
        const isReported = r.status === 'reported'
        return (
        <div className="card card--raised" key={r.id}>
          <p className="hint">#{r.id}</p>
          <p>{r.body}</p>
          <p className="hint">{r.createdHour.toISOString()}</p>
          <span className={isHidden ? 'chip chip--hidden' : isReported ? 'chip chip--reported' : 'chip chip--delivered'}>
            {STATUS_COPY[r.status] ?? r.status}
          </span>

          <details>
            <summary className="btn btn--danger btn--sm">اكشف المرسل</summary>
            <form action="/admin/reveal" method="post">
              <input type="hidden" name="confessionId" value={r.id} />
              <div className="field-row">
                <label className="field" htmlFor={`reason-${r.id}`}>ليش عم تكشفه؟</label>
                <textarea className="textarea" id={`reason-${r.id}`} name="reason" required minLength={8} maxLength={500} rows={2} />
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
