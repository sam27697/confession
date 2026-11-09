// Renders app/c/[slug]/page.tsx to static markup for four viewers and prints
// one JSON line. The data layer and the server action are replaced by test
// doubles; the page, its components and react-dom/server are the real code.
// Run by test/88-guest-draft.test.ts in a child process.
import { mock } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const req = createRequire(path.join(ROOT, 'package.json'))
const href = (...p: string[]) => pathToFileURL(path.join(ROOT, ...p)).href

const React = req('react')
;(globalThis as any).React = React
const real = { ...React }
const patched = { ...real, cache: (f: unknown) => f }
mock.module(pathToFileURL(req.resolve('react')).href, { defaultExport: patched, namedExports: patched })

let viewer: string | null = null
mock.module(href('app', '_lib', 'auth.ts'), { namedExports: { getViewerAccountId: async () => viewer } })
mock.module(href('app', '_lib', 'domain', 'db.ts'), { namedExports: { getDb: () => ({}) } })
mock.module(href('app', '_lib', 'domain', 'links.ts'), {
  namedExports: { getLinkBySlug: async () => ({ enabled: true, ownerDisplayName: 'سارة', ownerAccountId: 'owner-1' }) },
})
mock.module(href('app', 'c', '[slug]', 'actions.ts'), { namedExports: { sendConfessionAction: async () => {} } })

const { renderToStaticMarkup } = req('react-dom/server')
const mod = await import(href('app', 'c', '[slug]', 'page.tsx'))

const scenarios: Array<[string, string | null, string | undefined]> = [
  ['guest', null, undefined],
  ['guestSent', null, '1'],
  ['user', 'viewer-1', undefined],
  ['userSent', 'viewer-1', '1'],
]
const out: Record<string, string> = {}
for (const [name, who, sent] of scenarios) {
  viewer = who
  try {
    const el = await mod.default({
      params: Promise.resolve({ slug: 'abc' }),
      searchParams: Promise.resolve(sent ? { sent } : {}),
    })
    out[name] = renderToStaticMarkup(el)
  } catch (e) {
    out[name] = 'THREW ' + String(e)
  }
}
console.log('W36_REPORT ' + JSON.stringify(out))
process.exit(0)
