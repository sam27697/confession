// spec §3.2: only when ALLOW_DEV_LOGIN=1; otherwise 404. It resolves an
// identity the same way Facebook login does and hands it to the same
// onboarding-or-sign-in tail (spec §3.4: "OAuth (or dev) login resolves a
// (provider, providerUserId, displayName)") — it does not write an accounts
// row directly, so a dev identity still goes through terms acceptance like
// any other first-time signer-in.
import { randomBytes } from 'node:crypto'
import { env } from '../../_lib/domain/env.js'
import { resolveLoginAndRedirect } from '../../_lib/login-flow.js'

export async function POST(request: Request) {
  if (!env.allowDevLogin) {
    return new Response('not found', { status: 404 })
  }

  const form = await request.formData()
  const displayName = String(form.get('displayName') ?? '').trim().slice(0, 80)
  if (!displayName) {
    return new Response('display name required', { status: 400 })
  }

  // Marker prefix: every dev identity is greppable in one query, and no real
  // Facebook user id can collide with it, because Facebook ids are digits
  // (spec §3.2).
  const providerUserId = `devlogin:${randomBytes(12).toString('hex')}`

  await resolveLoginAndRedirect({ provider: 'facebook', providerUserId, displayName })
  return new Response(null, { status: 302 })
}
