// Deleting an account must leave no less behind in the browser than signing
// out does (week 37 spec). Logout answers with Clear-Site-Data itself; the
// deletion is a Server Action, which cannot set a response header, so the
// middleware sets it on the deletion POST instead.
//
// Only a POST to exactly /account/delete whose Origin names this app. A page
// on another site cannot send that Origin, so it cannot wipe a visitor's
// drafts. The middleware reads no cookie (week 18 spec, section 2), so the
// session is not part of the decision (week 37 spec, section 5.1).
export const ACCOUNT_DELETE_PATH = '/account/delete'

export function wipesStorage(
  method: string,
  pathname: string,
  headers: Headers,
  appOrigin: string | undefined,
): boolean {
  if (method !== 'POST' || pathname !== ACCOUNT_DELETE_PATH) return false
  const origin = headers.get('origin')
  if (origin === null || appOrigin === undefined) return false
  try {
    return new URL(origin).host === new URL(appOrigin).host
  } catch {
    return false
  }
}
