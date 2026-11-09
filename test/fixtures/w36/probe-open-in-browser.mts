// Drives app/_components/OpenInBrowser.tsx through a small hook runtime (state
// slots, effects run after render, re-render on a state change) with a fake
// navigator and window, and prints what it returned. Run by
// test/88-guest-draft.test.ts in a child process.
import { mock } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const req = createRequire(path.join(ROOT, 'package.json'))
const href = (...p: string[]) => pathToFileURL(path.join(ROOT, ...p)).href

const FRAGMENT = Symbol('fragment')
;(globalThis as any).React = {
  Fragment: FRAGMENT,
  createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
    type,
    props: { ...(props ?? {}), children },
  }),
}

let slots: unknown[] = []
let cursor = 0
let effectRan: boolean[] = []
let pending: Array<() => void> = []
let dirty = false
const real = { ...req('react') }
const patched = {
  ...real,
  useState: (init: unknown) => {
    const i = cursor++
    if (!(i in slots)) slots[i] = typeof init === 'function' ? (init as () => unknown)() : init
    return [
      slots[i],
      (v: unknown) => {
        slots[i] = typeof v === 'function' ? (v as (p: unknown) => unknown)(slots[i]) : v
        dirty = true
      },
    ]
  },
  useEffect: (fn: () => void, deps?: unknown[]) => {
    const i = effectRan.length
    effectRan.push(true)
    void i
    pending.push(() => fn())
    void deps
  },
}
mock.module(pathToFileURL(req.resolve('react')).href, { defaultExport: patched, namedExports: patched })
mock.module(href('app', '_components', 'ToastProvider.tsx'), { namedExports: { useToast: () => ({ toast() {} }), ToastProvider: () => null } })

const { OpenInBrowser } = await import(href('app', '_components', 'OpenInBrowser.tsx'))

function setEnv(ua: string) {
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua, clipboard: undefined }, configurable: true, writable: true })
  ;(globalThis as any).window = { location: { href: 'https://masaraha.test/c/abc' } }
}

const MARKER = { type: 'div', props: { id: 'the-compose-box', children: [] } }

// Render, run the effects queued by that render once, and repeat while a
// state change is waiting. Effects of the first render run once only (the
// component's effect has an empty dependency list).
function render() {
  slots = []
  cursor = 0
  effectRan = []
  let first = true
  let tree: unknown
  for (let n = 0; n < 8; n += 1) {
    cursor = 0
    dirty = false
    pending = []
    effectRan = []
    tree = (OpenInBrowser as any)({ children: MARKER })
    if (first) {
      for (const run of pending) run()
      first = false
    }
    if (!dirty) break
  }
  return tree
}

function rerender() {
  let tree: unknown
  for (let n = 0; n < 8; n += 1) {
    cursor = 0
    dirty = false
    pending = []
    tree = (OpenInBrowser as any)({ children: MARKER })
    if (!dirty) break
  }
  return tree
}

function flat(node: unknown, out: { texts: string[]; nodes: any[] } = { texts: [], nodes: [] }) {
  if (Array.isArray(node)) for (const n of node) flat(n, out)
  else if (typeof node === 'string') out.texts.push(node)
  else if (node && typeof node === 'object') {
    out.nodes.push(node)
    flat((node as any).props?.children, out)
  }
  return out
}

function summarise(tree: unknown) {
  const f = flat(tree)
  const text = f.texts.join(' ').replace(/\s+/g, ' ')
  return { hasBox: f.nodes.includes(MARKER), hasEscape: text.includes('افتح بالمتصفح'), hasOverrideLabel: text.includes('جرّب تسجيل الدخول هون على كل حال') }
}

function scenario(ua: string) {
  setEnv(ua)
  const tree = render()
  const before = summarise(tree)
  const f = flat(tree)
  const override = f.nodes.find((n) => typeof n.props?.onClick === 'function' && flat(n.props.children).texts.join(' ').includes('جرّب تسجيل الدخول هون'))
  let after = null as ReturnType<typeof summarise> | null
  if (override) {
    override.props.onClick()
    after = summarise(rerender())
  }
  return { before, hasOverrideButton: Boolean(override), after }
}

const report = {
  desktop: scenario('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'),
  instagramIos: scenario('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.18.109'),
  facebookAndroid: scenario('Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.0.0;]'),
}
console.log('W36_REPORT ' + JSON.stringify(report))
process.exit(0)
