import { env } from '../_lib/domain/env.js'
import { robotsBody } from '../../src/robots.js'

// Evaluated per request, not baked into the image (spec §3). At build time
// APP_ORIGIN is the Dockerfile placeholder http://localhost:3000; if this
// route ran once at build time and got cached, that placeholder value would
// be frozen into the production image and de-list the real site. This line
// is the whole reason production does not do that.
export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(robotsBody(env.appOrigin), {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
