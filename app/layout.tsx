import type { Metadata } from 'next'
import { getViewerAccountId } from './_lib/auth.js'
import { env } from './_lib/domain/env.js'
import { genericShareMetadata } from '../src/share-card.js'
import './globals.css'

// generateMetadata, not a static `export const metadata`, because it must
// read env.appOrigin at request time, not at module-load time. At image
// build time APP_ORIGIN is the Dockerfile placeholder
// http://localhost:3000 (see app/robots.txt/route.ts for the identical
// concern); a static object would risk baking that placeholder into a
// statically-rendered metadata output. The root layout already forces
// dynamic rendering via getViewerAccountId()'s cookies() read below, so
// this runs per request.
export async function generateMetadata(): Promise<Metadata> {
  const share = genericShareMetadata({ appOrigin: env.appOrigin, facebookAppId: env.facebookAppId })

  return {
    metadataBase: new URL(env.appOrigin),
    title: 'مصارحة',
    description: 'تطبيق مصارحة سرية.',
    openGraph: share.openGraph,
    twitter: share.twitter,
    // spec §3: fb:app_id is emitted only when env.facebookAppId is
    // non-null. `facebook` is Next's first-class field for this — it
    // renders <meta property="fb:app_id" ...> and nothing at all when
    // omitted, so an absent app id never claims an app that doesn't exist.
    ...(share.facebook ? { facebook: share.facebook } : {}),
  }
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
