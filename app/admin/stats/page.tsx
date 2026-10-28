import { getDb } from '../../_lib/domain/db.js'
import { getAdminStats, STATS_DAYS } from '../../../src/stats.js'
import { requireAdminUserId } from '../_lib/auth.js'

// Counts only (docs/SPEC-week29-admin-numbers.md §1.2, §6). Nothing on this
// page names an account or a message or counts distinct senders; finding out
// who sent something still goes through /admin/reveal and its log.
export default async function AdminStatsPage() {
  const db = getDb()
  await requireAdminUserId(db)

  const s = await getAdminStats(db, { now: new Date(), days: STATS_DAYS })
  const newestFirst = [...s.days].reverse()

  return (
    <div>
      <h1>الأرقام</h1>
      <p className="hint">كل الأيام بتوقيت دبي.</p>

      <div className="card">
        <h2>الحسابات</h2>
        <p>حسابات شغالة: {s.accounts.live}</p>
        <p>منها Google: {s.accounts.google}، Facebook: {s.accounts.facebook}</p>
        <p>موقوفة: {s.accounts.disabled}</p>
        <p>انحذفت: {s.accounts.deleted}</p>
      </div>

      <div className="card">
        <h2>الروابط</h2>
        <p>شغالة: {s.links.on}</p>
        <p>مطفية: {s.links.off}</p>
      </div>

      <div className="card">
        <h2>الرسايل</h2>
        <p>الكل: {s.messages.total}</p>
        <p>وصلت: {s.messages.delivered}</p>
        <p>مخبّاها المستلم: {s.messages.hidden}</p>
        <p>تم الإبلاغ عنها: {s.messages.reported}</p>
        <p>انحجزت لأن المرسل محظور: {s.messages.withheld}</p>
        <p>بلاغات: {s.reports}</p>
        <p>حظر: {s.blocks}</p>
      </div>

      <div className="card">
        <h2>صارحني بدورك</h2>
        <p>عروض: {s.offers.total}</p>
        <p>مستنية: {s.offers.pending}</p>
        <p>انكشفت: {s.offers.resolved}</p>
        <p>انرفضت: {s.offers.declined}</p>
        <p>انلغت: {s.offers.cancelled}</p>
      </div>

      <div className="card">
        <h2>آخر {STATS_DAYS} يوم</h2>
        <div className="stats-table">
          <table>
            <thead>
              <tr>
                <th scope="col">اليوم</th>
                <th scope="col">حسابات جديدة</th>
                <th scope="col">رسايل</th>
                <th scope="col">عروض</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((d) => (
                <tr key={d.day}>
                  <td dir="ltr">{d.day}</td>
                  <td>{d.signups}</td>
                  <td>{d.messages}</td>
                  <td>{d.offers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>آخر حساب جديد: {s.lastSignupDay ? <span className="stats-day" dir="ltr">{s.lastSignupDay}</span> : 'ولا شي'}</p>
        <p>آخر رسالة: {s.lastMessageDay ? <span className="stats-day" dir="ltr">{s.lastMessageDay}</span> : 'ولا شي'}</p>
      </div>
    </div>
  )
}
