import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { env } from '../_lib/domain/env.js'
import { getDb } from '../_lib/domain/db.js'
import { adminUserIdFromCookie } from './_lib/auth.js'
import { ADMIN_SID_COOKIE } from './_lib/session.js'

// The kill switch (spec §3.0): when no administrator is configured, every
// page under /admin answers 404, not 401 and not a redirect, so a stack
// with no administrator looks, from outside, exactly like a build with no
// admin surface at all. This layout covers every page.tsx nested under
// app/admin/**; the route handlers (route.ts/route.tsx) are not wrapped by
// a layout, so each of those repeats this same check for itself.
//
// The nav shows only to a request carrying a valid admin_sid, by the same
// full check /admin/login and every protected page make (week 31 spec
// §1.1, week 31b §1.3): signed out, the sign-in page shows the mark alone. The admin-shell class
// is what hides the product header above this one (globals.css).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!env.adminEnabled) {
    notFound()
  }

  const signedIn = (await adminUserIdFromCookie(getDb(), (await cookies()).get(ADMIN_SID_COOKIE)?.value)) !== null

  return (
    <div className="admin-shell">
      <header className="site site--plain">
        <a className="brand" href="/admin">
          <span className="brand__mark">م</span>
        </a>
        {signedIn && (
          <nav className="nav">
            <a className="nav__item" href="/admin">لوحة الإدارة</a>
            <a className="nav__item" href="/admin/stats">الأرقام</a>
            <a className="nav__item" href="/admin/reports">البلاغات</a>
            <form action="/admin/logout" method="post">
              <button type="submit" className="btn btn--secondary btn--sm">تسجيل خروج</button>
            </form>
          </nav>
        )}
      </header>
      {children}
    </div>
  )
}
