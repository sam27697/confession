import { NextResponse, type NextRequest } from 'next/server'
import { isWellFormedActionId } from './src/action-gate.js'

// Runs only on requests that carry a next-action header (see config below).
// A malformed id gets a bare 404 here instead of reaching Next's action
// handler, which would log the value. Week 18 spec, sections 0 and 2.
export function middleware(request: NextRequest) {
  const actionId = request.headers.get('next-action')
  if (actionId !== null && !isWellFormedActionId(actionId)) {
    return new NextResponse(null, { status: 404 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    {
      source: '/:path*',
      has: [{ type: 'header', key: 'next-action' }],
    },
  ],
}
