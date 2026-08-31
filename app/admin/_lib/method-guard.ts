// Shared method guard for the admin route handlers under app/admin/** that
// export only POST (spec week 9 §2.1). Next answers every unexported method
// itself before any handler runs, and that answer names which methods a
// hidden route accepts -- `OPTIONS /admin/reveal` returned `204` with
// `allow: OPTIONS, POST` (spec §0.2). Exporting this helper under every
// other method makes the handler itself answer instead, uniformly.
//
// 404 when the admin surface is disabled, matching the 404 every protected
// admin route already answers in that state (spec §3.0's kill switch). 405
// when enabled, which is what Next answers today for an unexported method,
// so an enabled stack's behaviour does not change (spec §2.1).
import { env } from '../../_lib/domain/env.js'

export function adminMethodNotAllowed(): Response {
  if (!env.adminEnabled) {
    return new Response('not found', { status: 404 })
  }
  return new Response('method not allowed', { status: 405 })
}
