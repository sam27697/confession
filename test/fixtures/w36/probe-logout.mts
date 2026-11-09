// Calls the exported POST of app/auth/logout/route.ts with next/headers
// cookies() replaced by a recording store, once with the session cookie, once
// with no cookie and once with an unrelated cookie, and prints one JSON line. Run by
// test/88-guest-draft.test.ts in a child process.
import { mock } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const req = createRequire(path.join(ROOT, 'package.json'))
const href = (...p: string[]) => pathToFileURL(path.join(ROOT, ...p)).href

const calls: unknown[][] = []
// What the request carries: the cookies cookies() reports. The scenarios below
// also put the same cookies in the Cookie header of the Request they pass, so
// a handler may read either.
let jar: Array<{ name: string; value: string }> = []
const store = {
  get: (name: string) => jar.find((c) => c.name === name),
  getAll: () => jar.slice(),
  has: (name: string) => jar.some((c) => c.name === name),
  delete: (...args: unknown[]) => {
    calls.push(['delete', ...args])
  },
  set: (...args: unknown[]) => {
    calls.push(['set', ...args])
  },
}
const nextHeadersUrl = pathToFileURL(req.resolve('next/headers')).href
mock.module(nextHeadersUrl, {
  namedExports: { cookies: async () => store, headers: async () => new Headers(), draftMode: async () => ({ isEnabled: false }) },
})

const { SID_COOKIE } = await import(href('app', '_lib', 'session.ts'))
const mod = await import(href('app', 'auth', 'logout', 'route.ts'))

function describe(response: Response) {
  const raw = (response.headers as any).getSetCookie ? (response.headers as any).getSetCookie() : []
  return {
    status: response.status,
    location: response.headers.get('location'),
    clearSiteData: response.headers.get('clear-site-data'),
    setCookie: raw.length ? raw : response.headers.get('set-cookie'),
  }
}

async function run(cookiesPresent: Array<{ name: string; value: string }>) {
  calls.length = 0
  jar = cookiesPresent
  const headers: Record<string, string> = {}
  if (cookiesPresent.length) headers.cookie = cookiesPresent.map((c) => `${c.name}=${c.value}`).join('; ')
  try {
    const response = await mod.POST(new Request('http://0.0.0.0:3000/auth/logout', { method: 'POST', headers }))
    return { ...describe(response), calls: calls.slice() }
  } catch (e) {
    return { threw: String(e), calls: calls.slice() }
  }
}

const withSid = await run([{ name: SID_COOKIE, value: 'signed-session-value' }])
const noSid = await run([])
const otherCookie = await run([{ name: 'theme', value: 'dark' }])
console.log('W36_REPORT ' + JSON.stringify({ sid: SID_COOKIE, withSid, noSid, otherCookie }))
process.exit(0)
