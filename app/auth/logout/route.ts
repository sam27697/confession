import { cookies } from 'next/headers'
import { SID_COOKIE } from '../../_lib/session.js'

// Week 36 §5.2 F1: a draft is kept in the tab's sessionStorage, and since a
// signed-out visitor can see the compose box, a draft left by the person who
// just signed out would show to whoever picks up the phone next.
// Clear-Site-Data clears the origin's storage on this redirect, but only when
// the request carries a session (§5.3): a POST from another site arrives
// without the Lax cookie and must not be able to wipe a visitor's draft.
// The Location is relative, never built from request.url (test/17, §9.3.7).
export async function POST() {
  const store = await cookies()
  const hadSession = store.has(SID_COOKIE)
  store.delete(SID_COOKIE)
  const headers: Record<string, string> = { Location: '/' }
  if (hadSession) headers['Clear-Site-Data'] = '"storage"'
  return new Response(null, { status: 303, headers })
}
