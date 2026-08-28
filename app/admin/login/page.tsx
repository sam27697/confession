import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_SID_COOKIE, verifyAdminSessionCookieValue } from '../_lib/session.js'
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
  // instead (spec §3.1). "Valid" here is the cookie's own cryptographic
  // validity, not a database lookup -- the database re-check that also
  // covers a disabled administrator happens once, in requireAdminUserId,
  // for the pages that actually need the identity.
  const store = await cookies()
  const raw = store.get(ADMIN_SID_COOKIE)?.value
  if (raw && verifyAdminSessionCookieValue(raw)) {
    redirect('/admin')
  }

  const { error } = await searchParams

  return (
    <div>
      <h1>دخول الإدارة</h1>

      {error && ERROR_COPY[error] && <p className="error">{ERROR_COPY[error]}</p>}

      <form action={adminLoginAction} className="card">
        <label htmlFor="admin-username">اسم المستخدم</label>
        <input id="admin-username" type="text" name="username" required autoComplete="username" />

        <label htmlFor="admin-password">كلمة السر</label>
        <input id="admin-password" type="password" name="password" required autoComplete="current-password" />

        <button type="submit">دخول</button>
      </form>
    </div>
  )
}
