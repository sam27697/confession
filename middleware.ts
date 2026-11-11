import { NextResponse, type NextRequest } from 'next/server'
import { isWellFormedActionId } from './src/action-gate.js'
import { bodyGate } from './src/body-gate.js'
import { originAllowed } from './src/origin-gate.js'
import { wipesStorage } from './src/storage-wipe.js'

// Runs only on requests that carry a next-action header or a multipart body
// (see config below). A malformed id gets a bare 404 here instead of reaching
// Next's action handler, which would log the value (week 18 spec, sections 0
// and 2). A body Next's action handler would throw on gets a bare 400 (week
// 33 spec, section 1.2). An action from a foreign Origin gets a bare 403
// before Next would log that Origin (week 34 spec, section 7). The account
// deletion POST, once through all three, carries Clear-Site-Data so the
// drafts in every tab go with the account (week 37 spec, section 5.1).
export async function middleware(request: NextRequest) {
  if (!originAllowed(request.headers, request.method, process.env.APP_ORIGIN)) {
    return new NextResponse(null, { status: 403 })
  }
  const actionId = request.headers.get('next-action')
  if (actionId !== null && !isWellFormedActionId(actionId)) {
    return new NextResponse(null, { status: 404 })
  }
  if (!(await bodyGate(request))) {
    return new NextResponse(null, { status: 400 })
  }
  const response = NextResponse.next()
  if (wipesStorage(request.method, request.nextUrl.pathname, request.headers, process.env.APP_ORIGIN)) {
    response.headers.set('Clear-Site-Data', '"storage"')
  }
  return response
}

export const config = {
  matcher: [
    {
      source: '/:path*',
      has: [{ type: 'header', key: 'next-action' }],
    },
    {
      source: '/:path*',
      has: [{ type: 'header', key: 'content-type', value: 'multipart/form-data.*' }],
    },
  ],
}
