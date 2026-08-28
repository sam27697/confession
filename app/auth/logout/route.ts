import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SID_COOKIE } from '../../_lib/session.js'

export async function POST() {
  const store = await cookies()
  store.delete(SID_COOKIE)
  redirect('/')
}
