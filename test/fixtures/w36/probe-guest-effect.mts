// Runs the mount effect of app/_components/GuestSignIn.tsx against a fake DOM
// and a fake sessionStorage, without React. react is replaced so that
// useEffect hands the effect back and useRef returns a plain object;
// wireDraftBox is replaced by a recorder. Prints one JSON line. Run by
// test/88-guest-draft.test.ts in a child process.
import { mock } from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const req = createRequire(path.join(ROOT, 'package.json'))
const href = (...p: string[]) => pathToFileURL(path.join(ROOT, ...p)).href

const log: string[] = []
const effects: Array<() => unknown> = []
const refObj: { current: unknown } = { current: null }
;(globalThis as any).React = { createElement: (type: unknown, props: unknown) => ({ type, props }), Fragment: Symbol('fragment') }
const real = { ...req('react') }
const patched = {
  ...real,
  useEffect: (fn: () => unknown) => {
    effects.push(fn)
  },
  useLayoutEffect: (fn: () => unknown) => {
    effects.push(fn)
  },
  useRef: () => refObj,
}
mock.module(pathToFileURL(req.resolve('react')).href, { defaultExport: patched, namedExports: patched })

let wireMode: 'cleanup' | 'undefined' = 'cleanup'
const cleanupFn = () => {
  log.push('cleanup')
}
mock.module(href('app', '_components', 'SubmitButton.tsx'), {
  namedExports: {
    wireDraftBox: () => {
      log.push('wire')
      return wireMode === 'cleanup' ? cleanupFn : undefined
    },
    wireDraft: () => undefined,
    SubmitButton: () => null,
  },
})

const { GuestSignIn } = await import(href('app', '_components', 'GuestSignIn.tsx'))

const kebab = (s: string) => 'data-' + s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

function run(opts: { throwOn?: 'setItem' | 'removeItem' | 'getItem' | null; initial?: Record<string, string>; wire?: 'cleanup' | 'undefined' }) {
  log.length = 0
  effects.length = 0
  wireMode = opts.wire ?? 'cleanup'
  const store = new Map(Object.entries(opts.initial ?? {}))
  const storage: Record<string, unknown> = {}
  for (const m of ['getItem', 'setItem', 'removeItem'] as const) {
    storage[m] = (key: string, value?: string) => {
      log.push(`storage.${m} ${key}`)
      if (opts.throwOn === m) throw new Error('sessionStorage unavailable')
      if (m === 'getItem') return store.has(key) ? store.get(key) : null
      if (m === 'setItem') store.set(key, String(value))
      else store.delete(key)
      return undefined
    }
  }
  storage.clear = () => {
    log.push('storage.clear')
    store.clear()
  }
  ;(globalThis as any).window = { sessionStorage: storage }
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true, writable: true })

  let disabled = true
  const textarea: any = {
    getAttribute: (n: string) => (n === 'data-draft-slug' ? 'abc' : null),
    addEventListener() {},
    removeEventListener() {},
    value: '',
    setAttribute: (n: string) => log.push(`textarea.attr ${n}`),
    removeAttribute: (n: string) => log.push(`textarea.removeAttr ${n}`),
  }
  Object.defineProperty(textarea, 'disabled', {
    get: () => disabled,
    set: (v: boolean) => {
      disabled = v
      log.push(`textarea.disabled=${v}`)
    },
  })
  const attrs = new Set<string>()
  const root: any = {
    querySelector: (sel: string) => (sel.includes('textarea') ? textarea : null),
    setAttribute: (n: string) => (attrs.add(n), log.push(`root.attr ${n}`)),
    removeAttribute: (n: string) => (attrs.delete(n), log.push(`root.removeAttr ${n}`)),
    toggleAttribute: (n: string, force?: boolean) => {
      if (force === false || (force === undefined && attrs.has(n))) {
        attrs.delete(n)
        log.push(`root.removeAttr ${n}`)
      } else {
        attrs.add(n)
        log.push(`root.attr ${n}`)
      }
    },
    hasAttribute: (n: string) => attrs.has(n),
    dataset: new Proxy({}, {
      set: (_t, k: string) => (attrs.add(kebab(k)), log.push(`root.attr ${kebab(k)}`), true),
      deleteProperty: (_t, k: string) => (attrs.delete(kebab(k)), log.push(`root.removeAttr ${kebab(k)}`), true),
    }),
    addEventListener() {},
    removeEventListener() {},
  }
  const anchor = { closest: (sel: string) => (sel === '[data-compose]' ? root : null) }

  GuestSignIn({ href: '/?next=/c/abc', className: 'btn', children: 'x' })
  refObj.current = anchor
  let threw: string | null = null
  let returned = 'none'
  const cleanups: Array<() => void> = []
  try {
    for (const fn of effects) {
      const out = fn()
      returned = typeof out
      if (typeof out === 'function') cleanups.push(out as () => void)
    }
  } catch (e) {
    threw = String(e)
  }
  const mountLog = log.slice()
  const attrAfterMount = attrs.has('data-draft-ready')
  let cleanupThrew: string | null = null
  for (const c of cleanups) {
    try {
      c()
    } catch (e) {
      cleanupThrew = String(e)
    }
  }
  return {
    log: mountLog,
    logAfterCleanup: log.slice(mountLog.length),
    threw,
    returned,
    effectCount: effects.length,
    disabledAfter: disabled,
    storageAfter: Object.fromEntries(store),
    attrAfterMount,
    attrAfterCleanup: attrs.has('data-draft-ready'),
    cleanupThrew,
  }
}

const report = {
  ok: run({}),
  throwSet: run({ throwOn: 'setItem' }),
  throwRemove: run({ throwOn: 'removeItem' }),
  noCleanup: run({ wire: 'undefined' }),
  existing: run({ initial: { confession_draft_abc: 'kept text' } }),
}
console.log('W36_REPORT ' + JSON.stringify(report))
process.exit(0)
