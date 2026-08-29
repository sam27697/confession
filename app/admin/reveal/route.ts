// POST /admin/reveal (spec §3.3) -- the only place a sender's identity ever
// appears. A route handler, not a Server Action, so the response body is
// the direct and only place the identity is rendered: there is no URL that
// renders it again, and a refresh re-posts the form and writes a new audit
// row, which is correct -- a second look is a second look.
//
// html() does the escaping here rather than JSX: React's standalone server
// renderer cannot be imported anywhere under app/**, because Next refuses to
// build it (spec §7, §8.0). So this file builds its response through the
// separately proven escaper in ../_lib/html.js. See the note at the top of
// that file for why the package is not named here.
import { getDb } from '../../_lib/domain/db.js'
import { env } from '../../_lib/domain/env.js'
import { adminRevealByAdminUser, type AdminRevealedSender } from '../../../src/actions.js'
import { requireAdminUserId } from '../_lib/auth.js'
import { html, htmlResponse, revealDocument } from '../_lib/html.js'

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
      revealDocument(
        'ما انكتب سبب كافي',
        html`<div>
          <h1>ما انكتب سبب كافي</h1>
          <p class="error">لازم السبب يكون ٨ حروف عالأقل.</p>
          <a href="/admin">رجوع</a>
        </div>`,
      ),
      400,
    )
  }

  let revealed: AdminRevealedSender
  try {
    revealed = await adminRevealByAdminUser(db, { adminUserId, confessionId, reason })
  } catch {
    return htmlResponse(
      revealDocument(
        'صار خطأ',
        html`<div>
          <h1>صار خطأ</h1>
          <p class="error">ما قدرنا نكشف هالرسالة.</p>
          <a href="/admin">رجوع</a>
        </div>`,
      ),
      400,
    )
  }

  return htmlResponse(
    revealDocument(
      'هوية المرسل',
      html`<div>
        <h1>هوية المرسل</h1>
        <div class="card">
          <p class="muted">الاسم</p>
          <p>${revealed.senderDisplayName}</p>
          <p class="muted">رقم الحساب</p>
          <p class="pre">${revealed.senderAccountId}</p>
          <p class="muted">سبب الكشف</p>
          <p>${reason}</p>
        </div>
        <a href="/admin">رجوع</a>
      </div>`,
    ),
    200,
  )
}
