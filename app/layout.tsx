import type { Metadata } from 'next'
import { getViewerAccountId } from './_lib/auth.js'
import './globals.css'

export const metadata: Metadata = {
  title: 'مصارحة',
  description: 'تطبيق مصارحة سرية.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const accountId = await getViewerAccountId()

  return (
    <html lang="ar" dir="rtl">
      <body>
        <header className="site">
          <a href="/"><strong>مصارحة</strong></a>
          <nav>
            {accountId ? (
              <>
                <a href="/inbox">صندوقك</a>
                <a href="/sent">يلي بعتها</a>
                <form className="inline" action="/auth/logout" method="post">
                  <button type="submit" className="secondary">تسجيل خروج</button>
                </form>
              </>
            ) : (
              <a href="/">تسجيل دخول</a>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
