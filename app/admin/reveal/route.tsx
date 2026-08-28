// POST /admin/reveal (spec §3.3) -- the only place a sender's identity ever
// appears. A route handler, not a Server Action, so the response body is
// the direct and only place the identity is rendered: there is no URL that
// renders it again, and a refresh re-posts the form and writes a new audit
// row, which is correct -- a second look is a second look.
//
// renderToStaticMarkup does the escaping here, not a template string, so
// nothing in this file builds HTML by concatenating strings.
import { renderToStaticMarkup } from 'react-dom/server'
import { getDb } from '../../_lib/domain/db.js'
import { env } from '../../_lib/domain/env.js'
import { adminRevealByAdminUser, type AdminRevealedSender } from '../../../src/actions.js'
import { requireAdminUserId } from '../_lib/auth.js'

function renderPage(title: string, body: React.ReactNode): string {
  return (
    '<!DOCTYPE html>' +
    renderToStaticMarkup(
      <html lang="ar" dir="rtl">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
        </head>
        <body>
          <main>{body}</main>
        </body>
      </html>,
    )
  )
}

function htmlResponse(markup: string, status: number): Response {
  return new Response(markup, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // The revealed identity must not be cacheable anywhere between here
      // and the browser (spec §3.3).
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: Request) {
  if (!env.adminEnabled) {
    return new Response('not found', { status: 404 })
  }

  const db = getDb()
  // Redirects to /admin/login on an unauthenticated or now-disabled
  // administrator (spec §3.3) -- this throw propagates past the try/catch
  // below, which only wraps the reveal call itself.
  const adminUserId = await requireAdminUserId(db)

  const formData = await request.formData()
  const confessionId = String(formData.get('confessionId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  // The database CHECK is the backstop, not the validation (spec §3.3):
  // this re-renders with an error and writes nothing.
  if (reason.length < 8) {
    return htmlResponse(
      renderPage(
        'ما انكتب سبب كافي',
        <div>
          <h1>ما انكتب سبب كافي</h1>
          <p className="error">لازم السبب يكون ٨ حروف عالأقل.</p>
          <a href="/admin">رجوع</a>
        </div>,
      ),
      400,
    )
  }

  let revealed: AdminRevealedSender
  try {
    revealed = await adminRevealByAdminUser(db, { adminUserId, confessionId, reason })
  } catch {
    return htmlResponse(
      renderPage(
        'صار خطأ',
        <div>
          <h1>صار خطأ</h1>
          <p className="error">ما قدرنا نكشف هالرسالة.</p>
          <a href="/admin">رجوع</a>
        </div>,
      ),
      400,
    )
  }

  return htmlResponse(
    renderPage(
      'هوية المرسل',
      <div>
        <h1>هوية المرسل</h1>
        <div className="card">
          <p className="muted">الاسم</p>
          <p>{revealed.senderDisplayName}</p>
          <p className="muted">رقم الحساب</p>
          <p className="pre">{revealed.senderAccountId}</p>
          <p className="muted">سبب الكشف</p>
          <p>{reason}</p>
        </div>
        <a href="/admin">رجوع</a>
      </div>,
    ),
    200,
  )
}
