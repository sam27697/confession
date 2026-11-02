// Turns away a POST body that Next's action handler would throw on, so junk
// gets a 400 from the middleware instead of a 500 and a stack trace in the
// container log. Week 33 spec, section 1.1.
//
// The body is only ever read through request.clone(): the request Next goes
// on to handle still has its own body.
import { isWellFormedActionId } from './action-gate.js'

const MULTIPART = 'multipart/form-data'
const ACTION_ = '$ACTION_'
const ACTION_ID_ = '$ACTION_ID_'
const ACTION_REF_ = '$ACTION_REF_'
const DESCRIPTOR_PREFIX = '{"id":"'

// The shape half of Next's areAllActionIdsValid
// (next/dist/server/app-render/action-handler.js): the same keys, the same
// limits, but ids are checked against week 18's format rule because the
// action manifest is not available here.
export function hasWellFormedFormAction(form: FormData): boolean {
  let refs = 0
  let actions = 0
  for (const key of form.keys()) {
    if (!key.startsWith(ACTION_)) continue
    if (key.startsWith(ACTION_ID_)) {
      if (!isWellFormedActionId(key.slice(ACTION_ID_.length))) return false
      actions++
    } else if (key.startsWith(ACTION_REF_)) {
      if (++refs > 2) return false
      const descriptors = form.getAll(ACTION_ + key.slice(ACTION_REF_.length) + ':0')
      if (descriptors.length !== 1) return false
      const descriptor = descriptors[0]
      if (typeof descriptor !== 'string' || !descriptor.startsWith(DESCRIPTOR_PREFIX)) return false
      const end = descriptor.indexOf('"', DESCRIPTOR_PREFIX.length)
      if (end === -1) return false
      if (!isWellFormedActionId(descriptor.slice(DESCRIPTOR_PREFIX.length, end))) return false
      actions++
    }
  }
  return actions > 0
}

// true lets the request through, false means answer 400.
export async function bodyGate(request: Request): Promise<boolean> {
  if (request.method !== 'POST') return true

  const contentType = request.headers.get('content-type') ?? ''
  const isFetchAction = request.headers.has('next-action')

  if (contentType.startsWith(MULTIPART)) {
    let form: FormData
    try {
      form = await request.clone().formData()
    } catch {
      return false
    }
    return isFetchAction || hasWellFormedFormAction(form)
  }

  if (isFetchAction) {
    try {
      JSON.parse(await request.clone().text())
    } catch {
      return false
    }
  }
  return true
}
