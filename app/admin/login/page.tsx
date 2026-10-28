import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '../../_lib/domain/db.js'
import { adminUserIdFromCookie } from '../_lib/auth.js'
import { ADMIN_SID_COOKIE } from '../_lib/session.js'
import { adminLoginAction } from './actions.js'

// One fixed message for every failure case (spec §3.1): unknown username,
// wrong password, a disabled account and a lockout all render identically.
const ERROR_COPY: Record<string, string> = {
  invalid: 'اسم المستخدم أو كلمة السر غير صحيحة',
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  // If the request already carries a valid admin_sid, 307 to /admin
  // instead (spec §3.1). "Valid" is the same full check every protected
  // admin page makes, database included: a revoked or disabled
  // administrator's cookie gets the form, never a redirect /admin would
  // only send back here (week 31b spec §0).
  const store = await cookies()
  if (await adminUserIdFromCookie(getDb(), store.get(ADMIN_SID_COOKIE)?.value)) {
    redirect('/admin')
  }

  const { error } = await searchParams

  return (
    <div>
      <h1>دخول الإدارة</h1>

      {error && ERROR_COPY[error] && <p className="notice notice--danger">{ERROR_COPY[error]}</p>}

      <form action={adminLoginAction} className="card">
        <div className="field-row">
          <label className="field" htmlFor="admin-username">اسم المستخدم</label>
          <input className="input" id="admin-username" type="text" name="username" required autoComplete="username" />
        </div>

        <div className="field-row">
          <label className="field" htmlFor="admin-password">كلمة السر</label>
          <input className="input" id="admin-password" type="password" name="password" required autoComplete="current-password" />
        </div>

        <button type="submit" className="btn btn--primary btn--block">دخول</button>
      </form>
    </div>
  )
}
