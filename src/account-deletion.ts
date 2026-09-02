// src/account-deletion.ts
//
// Terms clause 6, week 10 (docs/SPEC-week10-account-deletion.md §1, §3.1):
// deletion is an immediate, irreversible tombstone of the accounts row, not
// a hard delete and not ON DELETE CASCADE. See spec §1.1-§1.4 for the four
// shapes this was rejected in favour of, and §1.5 for the cost it accepts on
// purpose (an administrator can still see that a tombstoned account id sent
// a given confession; only the name is gone).
//
// One transaction, in the order spec §3.1 fixes: lock the account row and
// check it, retire every link it owns, then overwrite the identifying
// columns with the fixed sentinel values of spec §2.2. `now` is computed
// once here and reused for every write, the same reasoning week 9 §3 gave
// for logged_out_before being written from the application clock rather
// than three separate calls to now().

import { eq } from 'drizzle-orm'
import type { Db } from './db.js'
import { accounts, links } from './schema.js'
import { AccountNotFoundError, AccountAlreadyDeletedError } from './errors.js'

export async function deleteAccount(db: Db, { accountId }: { accountId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    // FOR UPDATE: a concurrent double-delete of the same account must not
    // both pass the "already deleted" check below.
    const [row] = await tx
      .select({ deletedAt: accounts.deletedAt, disabledAt: accounts.disabledAt })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .for('update')
      .limit(1)

    if (!row) throw new AccountNotFoundError(accountId)
    if (row.deletedAt !== null) throw new AccountAlreadyDeletedError()

    const now = new Date()

    // spec §2.3: the row and its slug are retained and permanently retired,
    // never rotated or freed: a freed slug is a stranger claiming what a
    // deleted user posted on Facebook.
    await tx
      .update(links)
      .set({ enabled: false, deletedAt: now })
      .where(eq(links.ownerAccountId, accountId))

    // spec §2.2: provider_user_id becomes the account's own uuid, which is
    // already public to the administrator and reveals nothing about the
    // Facebook account. The unique(provider, provider_user_id) index still
    // holds, and the same Facebook user signing in afterwards is not
    // matched to this row by findAccountByProvider, because that function is
    // unchanged, this is the mechanism (spec §3.2).
    await tx
      .update(accounts)
      .set({
        providerUserId: `deleted:${accountId}`,
        displayName: '[deleted]',
        deletedAt: now,
        disabledAt: row.disabledAt ?? now,
      })
      .where(eq(accounts.id, accountId))
  })
}
