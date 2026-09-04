import { notFound } from 'next/navigation'
import { env } from '../_lib/domain/env.js'

// The kill switch (spec §3.0): when no administrator is configured, every
// page under /admin answers 404, not 401 and not a redirect, so a stack
// with no administrator looks, from outside, exactly like a build with no
// admin surface at all. This layout covers every page.tsx nested under
// app/admin/**; the route handlers (route.ts/route.tsx) are not wrapped by
// a layout, so each of those repeats this same check for itself.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!env.adminEnabled) {
    notFound()
  }

  return (
    <div>
      <header className="site site--plain">
        <a className="brand" href="/admin">
          <span className="brand__mark">م</span>
        </a>
        <nav className="nav">
          <a className="nav__item" href="/admin">لوحة الإدارة</a>
          <a className="nav__item" href="/admin/reports">البلاغات</a>
          <form action="/admin/logout" method="post">
            <button type="submit" className="btn btn--secondary btn--sm">تسجيل خروج</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  )
}
