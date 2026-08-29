// The process-local throttle state (spec §2.6) lives here as a single
// instance shared by every request this process serves, for the lifetime
// of the process -- not per-request, and not persisted anywhere.
import { createThrottle } from '../../../src/admin-throttle.js'

export const adminThrottleState = createThrottle()
