// Next refuses a server action whose Origin does not match the host, and
// writes the Origin's host into the container log when it does (week 34 spec,
// section 7). The middleware asks this first and answers a bare 403 instead,
// so the only Origin that ever reaches Next's check is this app's own. The
// host it must match is the one in APP_ORIGIN, not one read off the request.
// A request with no Origin is left to Next, whose warning for that case is a
// fixed string.
export function originAllowed(headers: Headers, method: string, appOrigin: string | undefined): boolean {
  if (method !== 'POST') return true
  const origin = headers.get('origin')
  if (origin === null) return true
  try {
    return appOrigin !== undefined && new URL(origin).host === new URL(appOrigin).host
  } catch {
    return false
  }
}
