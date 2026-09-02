# SPEC — week 10: account deletion, and the terms clause that has been lying since launch

*Frozen 2026-08-31, before any code, per this project's standing rule. The
implementation and the tests are both written against this document. Where the
implementation and this document disagree, this document is wrong and gets an
amendment with its reason recorded — it does not get bent to match the code.*

---

## §0 The defect, measured

Terms clause 6 is serving on the public internet right now, in both languages:

> فيك تطفّي رابطك أو تحذف حسابك بأي وقت.
> You can switch your link off or delete your account at any time.

Half of that is true. The off-switch is real (`links.enabled`, `setLinkEnabled`,
proven by doing it in week 6). **Deleting an account is not implemented
anywhere, and it is not merely absent — the database structurally refuses it.**
Measured 2026-08-29 against the live staging database, inside a transaction that
was rolled back:

```
BEGIN;
DELETE FROM accounts WHERE id = (SELECT id FROM accounts LIMIT 1);
ERROR:  update or delete on table "accounts" violates foreign key constraint
        "links_owner_account_id_accounts_id_fk" on table "links"
ROLLBACK;
```

`links` is the first of **six** NOT NULL references to `accounts.id` with no
`ON DELETE` behaviour declared: `terms_acceptances.account_id`,
`links.owner_account_id`, `confessions.sender_account_id`,
`link_blocks.blocked_account_id`, `reports.reported_by_account_id`,
`send_counters.sender_account_id`. Every account has a `terms_acceptances` row
by construction, because accepting the terms *is* the account-creation
transaction. So no account in either database can be deleted today, at all.

This is the rule this project wrote for itself, broken: *never write a promise
into the terms that the database contradicts.* Week 1a caught clause 1 doing
exactly this and rewrote it within the hour. Clause 6 has been doing it since
the terms first shipped.

---

## §1 The decision, and the four alternatives it was chosen over

**Deletion is an immediate, irreversible tombstone of the `accounts` row.** The
row survives as an opaque identifier so that every foreign key and the whole
admin audit trail stay intact; everything in it that identifies a human is
destroyed, in place, in the same transaction, and can never be written back.

### §1.1 Rejected: hard delete with `ON DELETE CASCADE`

The obvious reading of "delete your account". Rejected because it erases
`confessions.sender_account_id`, which destroys the exact capability Sam ruled
for on 2026-08-25 10:29 — «بدي الادمن يعرف المرسل مين» — and which terms
clause 1 offers the *recipient* as the reason the word «سرية» is defensible at
all. It would also silently delete other people's confessions (everything sent
to the deleting user's link), which is not what "delete my account" asks for.

### §1.2 Rejected: reuse `accounts.disabled_at` and call that deletion

Cheapest option; already built. Rejected because it is the same defect in a new
place. `disabled_at` is terms clause 4, the operator's kill switch. It leaves
`display_name` and `provider_user_id` — the user's real name and the durable
handle to their Facebook identity — sitting in the table untouched. Calling that
"delete your account" swaps one false sentence for another.

### §1.3 Rejected: delete now, purge the identifying fields after a retention window

The industry-standard answer, and the one a reviewer will ask about. Rejected on
a fact about this system rather than on principle: **there is no scheduler.**
Nothing in the container, the compose file or the entrypoint runs periodic work,
and a retention window with no job behind it is a promise that silently never
executes — which is the same class of defect as clause 6 itself, shipped
knowingly. A lazy sweep triggered by unrelated traffic was considered and
rejected for the same reason: an app with no traffic never purges.

If Sam wants an abuse-evidence window, it is a real slice with a real scheduler
and it is his call, not something to fake tonight. **The cost of not having it
is stated in §1.5 and goes to him in the run report.**

### §1.4 Rejected: keep a one-way hash of `provider_user_id` after deletion

Would let an administrator confirm a named suspect without being able to
enumerate. Rejected because it means "deleted" is not deleted — a value derived
from the Facebook id is still a link to the Facebook id for anyone holding a
candidate — and because a privacy contract that needs a cryptography argument to
explain what it destroyed is one nobody can audit by reading the schema. This
project's whole method is that the guarantee is legible in
`information_schema.columns`.

### §1.5 The cost of §1, stated rather than buried

After a sender deletes their account, an administrator can still see **that a
particular account id sent a particular confession**, and the entire
`admin_reveal_log` history survives — but the **name is gone and cannot be
recovered.** A sender can therefore send abuse and then erase their own name.

This is a genuine weakening of the capability Sam asked for, it is the price of
clause 6 being true, and it is his to overturn. It is not softened in the terms
and it is not softened in the run report.

---

## §2 Schema

Migration file: `drizzle/0004_account_deletion.sql`. Hand-written, one
transaction per file, same as every migration in this repo.

### §2.1 New columns

| table | column | type | null |
|---|---|---|---|
| `accounts` | `deleted_at` | `timestamptz` | yes |
| `links` | `deleted_at` | `timestamptz` | yes |

Mirrored in `src/schema.ts` as `deletedAt`.

### §2.2 The tombstone values, fixed here so nothing invents its own

On deletion of account `A`:

- `accounts.provider_user_id` := `'deleted:' || A.id::text`
- `accounts.display_name`     := `'[deleted]'`
- `accounts.deleted_at`       := the transaction's timestamp
- `accounts.disabled_at`      := the transaction's timestamp, if currently null

`provider_user_id` is replaced with the account's **own** uuid, which is already
public to the administrator and reveals nothing about the Facebook account. The
`unique(provider, provider_user_id)` index therefore still holds, and — this is
the point, not a side effect — the same Facebook user signing in afterwards is
**not** matched to the old row by `findAccountByProvider`, so they get a new
account and cannot reach the deleted one.

`'[deleted]'` is a **storage** sentinel. No surface may test for that string to
decide whether an account is deleted; the test is `deleted_at IS NOT NULL`. A
real user could in principle be named `[deleted]`, and a rule keyed on the
string would then be wrong about a live person.

### §2.3 The link

On deletion of account `A`, for every link `A` owns:

- `links.enabled`    := `false`
- `links.deleted_at` := the transaction's timestamp

**The row is retained and its slug is permanently retired.** The slug is not
rotated and not freed. Rotation would return the old slug string to the pool,
and the failure that creates is specific and bad: a stranger claims the slug a
deleted user had posted on Facebook, and confessions written for one person
arrive at another. Slugs are drawn from `crypto.randomBytes` (`src/slug.ts`) and
carry no personal information, so keeping the row costs nothing.

### §2.4 Constraints, not conventions

Every rule below is enforced by Postgres, because this project's guarantees live
in the schema and not in a code review.

1. `accounts_deleted_tombstone_check` — a CHECK on `accounts`:
   `deleted_at IS NULL OR (display_name = '[deleted]' AND provider_user_id LIKE 'deleted:%')`.
   A half-finished deletion cannot be committed. The converse is deliberately
   **not** asserted, for the reason in §2.2.
2. `links_deleted_not_enabled_check` — a CHECK on `links`:
   `deleted_at IS NULL OR enabled = false`. A deleted link cannot be on.
3. `accounts_tombstone_is_final` — a BEFORE UPDATE trigger on `accounts` that
   raises if `OLD.deleted_at IS NOT NULL`. A deleted account row is frozen:
   deletion cannot be undone, the name cannot be written back, and a second
   deletion raises rather than quietly re-stamping the timestamp.
4. `accounts_never_deleted` — a BEFORE DELETE trigger on `accounts` that always
   raises. The tombstone is the record; no path removes it, including a future
   migration that adds `ON DELETE CASCADE` without reading this file.
5. `links_tombstone_is_final` — a BEFORE UPDATE trigger on `links` that raises
   if `OLD.deleted_at IS NOT NULL`. A deleted link can never be re-enabled.
6. `confessions_sender_not_deleted` — a BEFORE INSERT trigger on `confessions`
   that raises if the sender's account or the target link is deleted. The
   application checks this too (§3.3); the trigger is what makes it true even if
   a future route forgets.

Triggers follow the existing pattern in `drizzle/0001_constraints.sql` — a
`plpgsql` function raising `exception`, one trigger per rule, named as above.

---

## §3 Domain layer

### §3.1 `src/account-deletion.ts` — new file

```ts
export async function deleteAccount(db: Db, { accountId }: { accountId: string }): Promise<void>
```

One transaction, in this order:

1. `SELECT id, deleted_at FROM accounts WHERE id = accountId FOR UPDATE`.
   Not found → throw `AccountNotFoundError`.
   `deleted_at IS NOT NULL` → throw `AccountAlreadyDeletedError`.
2. Update every link owned by `accountId`: `enabled = false`, `deleted_at = now`.
3. Update the account to the tombstone values of §2.2.

`now` is one value computed once in the application and used for all three
writes, so a single deletion carries a single timestamp — the same reasoning
week 9 §3 gave for `logged_out_before` being written from the application clock.

Both errors are new classes in `src/errors.ts`, following the existing shape.

### §3.2 `src/accounts.ts`

`Account` gains `deletedAt: Date | null`, and `getAccountById` selects it.
`findAccountByProvider` is **not** changed: it already cannot find a tombstone,
because §2.2 rewrote the column it matches on. That is the mechanism, and a test
asserts it rather than a comment claiming it.

### §3.3 The send path

`sendConfession` in `src/actions.ts` refuses when the sender's account is
deleted, throwing the existing `AccountDisabledError` if one is already used for
`disabled_at`, otherwise a new `SenderAccountDeletedError`. The implementer
picks whichever matches what is already there and records the choice; the
requirement is that the refusal happens in the domain layer and not only in the
page.

### §3.4 The recipient's public page

`getLinkBySlug` already returns `enabled`, which is `false` for a deleted
owner's link, so `/c/<slug>` renders the off state and week 6's **generic** share
card with no display name in it. This is existing, proven behaviour and is
reused rather than reimplemented. The requirement here is a test that proves it
holds for a *deleted* owner specifically, not only for a manually disabled link.

---

## §4 The surfaces

Mobile-first, as every surface in this app is (Sam, 2026-08-28 item 19:
«للموبايل بس»). Arabic copy in the register of `app/inbox/page.tsx`.

### §4.1 `/account/delete` — the confirmation page

A server component behind `requireActiveViewerAccountId` (§4.3). It states, in
Arabic, exactly what §1 does and does not do — the same facts as terms clauses 6
and 7 and no others, because a confirmation screen that is softer than the terms
is where a product starts lying again. It carries:

- what is destroyed: the name, the Facebook connection, the ability to sign back
  in, the link;
- what remains: confessions sent, confessions received, mutual-reveal answers,
  and that the administration keeps them attached to a nameless account id;
- that it cannot be undone;
- a required checkbox, unchecked by default;
- a submit button and a cancel link back to `/inbox`.

Submitting without the checkbox re-renders with an error and **does not delete**.

### §4.2 The action

A server action in `app/account/delete/actions.ts`, following the pattern of
`app/inbox/actions.ts`. It re-derives the viewer's account id from the session
cookie server-side and never from a form field. On success it clears the `sid`
cookie and redirects to `/?deleted=1`; the landing page renders one confirmation
line when that parameter is present.

### §4.3 The session must stop working

`requireViewerAccountId` in `app/_lib/auth.ts` does **not** touch the database —
it trusts the signed cookie for its full seven days. A deleted user's live
cookie would therefore keep working. This is the same class of defect week 9
repaired for administrators.

Add `requireActiveViewerAccountId()` alongside it: it loads the account and
redirects to `/` when the account is missing, `disabled_at` is set, or
`deleted_at` is set. Every authenticated surface — `/inbox`, `/sent`,
`/offer/[offerId]`, `/onboarding`, `/account/delete` — uses it.

`requireViewerAccountId` is **kept, unchanged, and left with no callers** rather
than edited, so the change is one new decision function that a test can call
directly, not a rewrite of a function nine surfaces depend on.

### §4.4 The entry point

`/inbox` gets a link to `/account/delete`. Without it the whole slice is
unreachable and this is week 7's exact lesson: `getAdminInbox` and `adminReveal`
existed, passed their tests, and no route called either.

---

## §5 The terms

The order is fixed by `src/terms.ts`'s own header: **BRIEF.md first**, because
that is the copy Sam approved, then this file follows on a version bump.

`TERMS_VERSION` `'2026-08-25.1'` → `'2026-08-31.1'`.

Clause 6 is rewritten and a clause 7 is added. The text is whatever
`work/confession-app/BRIEF.md` carries at the time of implementation, copied
**verbatim** — not re-worded here, not summarised, not improved.

Clause 6 states the off-switch and the delete right, that deletion is permanent
and cannot be undone, that the name and the Facebook connection are erased, that
the account cannot be signed back into, and that the link stops working and is
never re-issued.

Clause 7 states what remains: confessions sent stay with the administration
attached to a nameless account id, confessions received stay, and a mutual-reveal
answer cannot be removed — the last because `reveal_answers` is append-only by
trigger since week 2, so it is not a policy choice and must not be described as
one.

Both language arrays end with **seven** clauses.

---

## §6 Test items — the acceptance list

Written from this document by an agent that does not read the implementation, in
its own worktree. Numbered so a report can name what failed.

**Schema and constraints**

1. `accounts.deleted_at` and `links.deleted_at` exist, are `timestamptz`, nullable.
2. `test/02-tripwire-columns.test.ts` still passes: no banned column was added.
3. The `accounts` CHECK rejects setting `deleted_at` while leaving `display_name` unchanged.
4. The `accounts` CHECK rejects setting `deleted_at` while leaving `provider_user_id` unchanged.
5. The `links` CHECK rejects a row with `deleted_at` set and `enabled = true`.
6. UPDATE on an already-deleted `accounts` row raises.
7. DELETE on any `accounts` row raises, deleted or not.
8. UPDATE on an already-deleted `links` row raises, including one that only sets `enabled = true`.
9. INSERT into `confessions` with a deleted sender raises.
10. INSERT into `confessions` targeting a deleted link raises.

**Domain**

11. `deleteAccount` sets all four account fields of §2.2 in one transaction.
12. `deleteAccount` disables and stamps every link the account owns.
13. `deleteAccount` on an already-deleted account throws `AccountAlreadyDeletedError` and changes nothing.
14. `deleteAccount` on an unknown id throws `AccountNotFoundError`.
15. After deletion, `findAccountByProvider` with the **original** provider id returns null.
16. After deletion, creating a fresh account with the same original provider id succeeds and yields a **different** account id.
17. `getAccountById` returns `deletedAt` populated.
18. `sendConfession` from a deleted sender is refused by the domain layer.
19. The deleted user's own sent confessions are still present, with `sender_account_id` intact.
20. `adminRevealByAdminUser` on a confession from a deleted sender still returns the account id and writes its audit row — and the display name it returns is `'[deleted]'`, not a crash and not a leak.
21. A confession sent **to** the deleted user before deletion is still present.
22. `getLinkBySlug` for a deleted owner's slug returns `enabled: false`.
23. The deleted owner's display name appears nowhere in the JSON of any recipient-facing view of their own slug.

**Terms**

24. `TERMS_VERSION === '2026-08-31.1'`.
25. `TERMS_TEXT_AR.clauses` and `TERMS_TEXT_EN.clauses` both have length 7.
26. Clause 6 in both languages is byte-identical to the corresponding line in `work/confession-app/BRIEF.md`. *(If BRIEF.md is not reachable from the repo, the test asserts against the literal text frozen into the test file by the spec author instead, and says so.)*
27. No clause in either language still contains the old sentence "delete your account at any time" / «أو تحذف حسابك بأي وده» in its pre-week-10 form.

**Surface**

28. `app/account/delete/page.tsx` exists and calls `requireActiveViewerAccountId`.
29. Every authenticated surface listed in §4.3 calls `requireActiveViewerAccountId` and none of them calls `requireViewerAccountId`.
30. `requireActiveViewerAccountId` is a testable decision — a pure predicate over an account row, exported, so this item does not need `next/headers`.
31. `/inbox` contains a link whose href is `/account/delete` (§4.4).
32. The delete action reads the account id from the session and there is no form field named for an account id anywhere in the delete surface.

---

## §6.1 Amendment to item 27, 2026-09-02, with its reason

*Recorded the way week 6 §6.1 was recorded: the document is amended and the
reason is written down, rather than an assertion being bent to match the code.*

Item 27 above quotes the English half of the old sentence as **"delete your
account at any time"**. That quotation is too loose, and as written the item is
**unsatisfiable together with item 26**, for any implementation whatsoever:

- Item 26 requires English clause 6 to be byte-identical to the approved
  `BRIEF.md` copy, which reads *"You can switch your link off at any time, and
  you can **delete your account at any time**. Deleting is permanent and cannot
  be undone: …"*.
- Item 27, read literally, forbids any clause containing that same substring.

No wording of `TERMS_TEXT_EN.clauses[5]` can pass both. The Arabic half of the
item never had the problem: it quotes «أو تحذف حسابك بأي وقت», and the «أو»
("or") is exactly what the rewritten clause replaces with «وفيك», so the Arabic
discriminator is specific to the pre-week-10 form and the English one was not.

**Amended:** item 27's English discriminator is **"off or delete your account at
any time"**, the same discriminator as the Arabic. It is still a substring
rather than the whole sentence, so it still catches the old wording embedded in
a longer clause, which is the failure the item exists to catch.

**The implementation was not changed to suit this.** The clause text is the copy
Sam approved and it is carried verbatim from `work/confession-app/BRIEF.md`, as
§5 requires; rewording live product copy to dodge a substring check would have
been the tail wagging the dog. **Verified by mutation rather than by argument:**
the real pre-week-10 clause 6 was pasted back into `src/terms.ts`, item 27 went
red, and `src/terms.ts` was then restored byte for byte and the suite re-run
green.

The repair was made by the reviewer, not by the author of the implementation.

---

## §7 Out of scope, named so it is not mistaken for an oversight

- **No retention window and no scheduler** (§1.3). Sam's call.
- **No self-service export.** Not promised by any clause.
- **No deletion of `reveal_answers`, `admin_reveal_log`, `terms_acceptances`,
  `reports`, `link_blocks` or `send_counters` rows.** The first two are
  append-only by trigger and cannot be touched; the rest hold no personal data
  beyond an account id that is now nameless. Clause 7 says so.
- **No admin surface for deleted accounts.** The existing masked list keeps
  working and shows `[deleted]`.
- **No deploy.** See the run report: `bin/asam.sh` cannot reach the server this
  session because `/secrets-deploy/asam_prod01` does not exist in this
  container. That is a host-side mount, this account has no sudo, and it is
  reported rather than worked around.

  **Correction, 2026-09-02, re-measured rather than inherited.** The sentence
  above says "in this container". There is no container: this session runs
  natively on `asam-prod-01` itself, as the unprivileged user `asam`. The
  blocker is real and is narrower than that framing. Measured tonight:
  `/secrets-deploy` does not exist at all (`ls: cannot access '/secrets-deploy':
  No such file or directory`); `~/.ssh` holds a `known_hosts` and no private
  key; and the Docker socket refuses this account
  (`permission denied while trying to connect to the docker API at
  unix:///var/run/docker.sock`), because `asam` is in no docker group. So the
  deploy path is one missing file, the private key `bin/asam.sh` reads from a
  path that only ever existed under the old containerised layout. Both
  hostnames answer **200 from outside** right now, on week 9's build.
