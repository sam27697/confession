// Next refuses a server action whose Origin does not match the host, and
// writes the Origin's host into the container log when it does (week 34 spec,
// section 7). The middleware asks this first and answers a bare 403 instead,
// so the sender's text never reaches the log. The rule is Next's own
// (action-handler.js parseHostHeader): the first x-forwarded-host value,
// trimmed, else host, compared exactly with the Origin's host. A request with
// no Origin is left to Next, whose warning for that case is a fixed string.
export function originAllowed(headers: Headers, method: string): boolean {
  if (method !== 'POST') return true
  const origin = headers.get('origin')
  if (origin === null) return true
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  const expected = headers.get('x-forwarded-host')?.split(',')[0]?.trim() || headers.get('host')
  return expected !== null && originHost === expected
}
