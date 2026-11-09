// Calls the exported POST of app/auth/logout/route.ts with next/headers
// cookies() replaced by a recording store, and prints one JSON line. Run by
// test/88-guest-draft.test.ts in a child process.
import { mock } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const req = createRequire(path.join(ROOT, 'package.json'))
const href = (...p: string[]) => pathToFileURL(path.join(ROOT, ...p)).href

const calls: unknown[][] = []
const store = {
  get: (name: string) => ({ name, value: 'signed-session-value' }),
  getAll: () => [{ name: 'sid', value: 'signed-session-value' }],
  has: () => true,
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

async function run(args: unknown[]) {
  calls.length = 0
  try {
    const response = await mod.POST(...args)
    return { ...describe(response), calls: calls.slice() }
  } catch (e) {
    return { threw: String(e), calls: calls.slice() }
  }
}

const bare = await run([])
const withRequest = await run([new Request('http://0.0.0.0:3000/auth/logout', { method: 'POST' })])
console.log('W36_REPORT ' + JSON.stringify({ sid: SID_COOKIE, bare, withRequest }))
process.exit(0)
