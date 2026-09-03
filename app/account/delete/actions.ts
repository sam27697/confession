'use server'
// The viewer's account id is re-derived from the session cookie, server-side,
// and never from a form field (spec §4.2, §4.3 item 32). There is no form
// field named for an account id anywhere on this surface.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireActiveViewerAccountId } from '../../_lib/auth.js'
import { getDb } from '../../_lib/domain/db.js'
import { deleteAccount } from '../../_lib/domain/account-deletion.js'
import { AccountNotFoundError, AccountAlreadyDeletedError } from '../../_lib/domain/errors.js'
import { SID_COOKIE } from '../../_lib/session.js'

export async function deleteAccountAction(formData: FormData) {
  const db = getDb()
  const accountId = await requireActiveViewerAccountId(db)

  const confirm = formData.get('confirm') === 'on'
  if (!confirm) {
    redirect('/account/delete?error=required')
  }

  try {
    await deleteAccount(db, { accountId })
  } catch (err) {
    if (err instanceof AccountNotFoundError || err instanceof AccountAlreadyDeletedError) {
      redirect('/')
    }
    console.error('deleteAccount failed', err instanceof Error ? err.name : 'unknown')
    redirect('/account/delete?error=generic')
  }

  const store = await cookies()
  store.delete(SID_COOKIE)
  redirect('/?deleted=1')
}
