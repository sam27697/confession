// Session lookup for Server Components and Server Actions. Every mutation
// re-derives the viewer's account id from this cookie, server-side, never
// from a form field (spec §5.3).
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SID_COOKIE, verifySessionCookieValue } from './session.js'

export async function getViewerAccountId(): Promise<string | null> {
  const store = await cookies()
  const raw = store.get(SID_COOKIE)?.value
  if (!raw) return null
  const session = verifySessionCookieValue(raw)
  return session ? session.accountId : null
}

// For pages/actions that require a signed-in viewer. Sends an anonymous
// visitor home rather than rendering an error — there is nothing owed to a
// direct hit on a protected URL beyond "go sign in".
export async function requireViewerAccountId(): Promise<string> {
  const accountId = await getViewerAccountId()
  if (!accountId) {
    redirect('/')
  }
  return accountId
}
