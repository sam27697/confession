# Week 29 - the admin can see whether anyone is using the product

Frozen 2026-10-23 21:34 +04 (the commit time of `402ec04`), before the change is written. Author of the
change and author of the acceptance file are different (§5).

## §0 What was measured

On production, 2026-10-23 21:3x, one `psql` count per table:

| table | rows |
|---|---|
| accounts | 5 |
| links | 5 |
| confessions | 4 |
| reveal_offers | 1 |
| reveal_answers | 2 |
| reports, link_blocks, withheld_messages, admin_reveal_log | 0 |

On 2026-10-20 00:19 the owner asked whether anybody besides his own two
accounts had used the product. The only way to answer was a shell on the
server and SQL by hand. The admin surface has two pages, the newest 50
messages and the reports, and neither says how many people signed up, how
many of them ever sent anything, or whether anything happened this week.

The approved design (DESIGN.md, "The one thing I would flag") commits to
launching small and watching the first two weeks of real traffic. Without
numbers on the admin surface there is nothing to watch with.

## §1 The change

### §1.1 `src/stats.ts`, `getAdminStats`

```ts
export const STATS_TIME_ZONE = 'Asia/Dubai'
export const STATS_DAYS = 14

export type AdminStatsDay = {
  day: string        // 'YYYY-MM-DD' in STATS_TIME_ZONE
  signups: number    // accounts.created_at on that day, deleted accounts included
  messages: number   // confessions.created_hour on that day, every status
  senders: number    // distinct confessions.sender_account_id that day
  recipients: number // distinct links.owner_account_id of that day's confessions
  offers: number     // reveal_offers.created_at on that day
}

export type AdminStats = {
  timeZone: string
  accounts: {
    live: number      // deleted_at is null
    disabled: number  // deleted_at is null and disabled_at is not null (subset of live)
    deleted: number   // deleted_at is not null
    google: number    // live, provider = 'google'
    facebook: number  // live, provider = 'facebook'
  }
  everSent: number      // live accounts that are sender_account_id of >= 1 confession
  everReceived: number  // live accounts owning a link with >= 1 confession
  links: { on: number; off: number }  // links with deleted_at null, by enabled
  messages: {
    total: number     // every row in confessions
    delivered: number
    hidden: number    // status hidden_by_recipient
    reported: number  // status reported
    withheld: number  // rows in withheld_messages, not part of total
  }
  reports: number
  blocks: number
  offers: { total: number; pending: number; resolved: number; declined: number; cancelled: number }
  days: AdminStatsDay[] // exactly `days` entries, oldest first, the last one is today
  lastSignupDay: string | null   // day of the newest accounts.created_at, or null
  lastMessageDay: string | null  // day of the newest confessions.created_hour, or null
}

export async function getAdminStats(
  db: Db,
  { now, days }: { now: Date; days: number },
): Promise<AdminStats>
```

- "Today" is the calendar date of `now` in `STATS_TIME_ZONE`. The window is
  the `days` calendar dates ending with today. A day with nothing in it is
  present with every count 0.
- Every day string is formatted in the database with `to_char(... at time
  zone 'Asia/Dubai', 'YYYY-MM-DD')`, never through a JavaScript `Date`,
  because node-postgres turns a `date` column into a `Date` at the server's
  local midnight and the server is not in Dubai.
- `created_hour` is truncated to the UTC hour (week 2). Dubai is UTC+4 with
  no daylight saving, so a UTC hour never straddles two Dubai days.
- Every number is a JavaScript `number`, not a string or a bigint. Postgres
  `count(*)` is a bigint and node-postgres hands bigints back as strings.

### §1.2 What the function never returns

This is the privacy half of the slice and it is not negotiable.

- No account id, link id, slug, confession id, display name, provider user
  id, message body, reason text or answer text, anywhere in the result.
- No count crossed with signups. `senders` is not split by account age or
  provider, so the page cannot be used to say "the account that joined
  yesterday sent these three", which would undo the masking on the inbox
  page without a row in `admin_reveal_log`.
- No time finer than a day.

### §1.3 `app/admin/stats/page.tsx`

A server component. First line of work: `requireAdminUserId(db)` (an
unauthenticated request gets the same 307 to `/admin/login` as `/admin`),
then `getAdminStats(db, { now: new Date(), days: STATS_DAYS })`. It writes
nothing to the console and nothing to the database.

Copy, exactly:

- `h1`: «الأرقام»
- under it, `p.hint`: «كل الأيام بتوقيت دبي.»
- `h2` «الحسابات», then one line each:
  «حسابات شغالة: N» / «منها Google: N، Facebook: N» / «موقوفة: N» /
  «انحذفت: N» / «بعتو رسالة وحدة عالأقل: N» / «وصلتهن رسالة وحدة عالأقل: N»
- `h2` «الروابط»: «شغالة: N» / «مطفية: N»
- `h2` «الرسايل»: «الكل: N» / «وصلت: N» / «مخبّاها المستلم: N» /
  «تم الإبلاغ عنها: N» / «انحجزت لأن المرسل محظور: N» / «بلاغات: N» /
  «حظر: N»
- `h2` «صارحني بدورك»: «عروض: N» / «مستنية: N» / «انكشفت: N» /
  «انرفضت: N» / «انلغت: N»
- `h2` «آخر 14 يوم», then a `table` with header row
  «اليوم» «حسابات جديدة» «رسايل» «مرسلين» «مستلمين» «عروض», one row per
  day, **newest first** on the page, the day written as it comes back
  (`YYYY-MM-DD`).
- «آخر حساب جديد: <day>» and «آخر رسالة: <day>», or «ولا شي» for null.

The table sits in a `div` with `overflow-x:auto` so a 280 phone scrolls the
table instead of the page. No new colour, no new token: the classes that
exist (`card`, `hint`) and one table rule in `globals.css`.

### §1.4 `app/admin/layout.tsx`

One more `nav__item`: «الأرقام» linking to `/admin/stats`, between
«لوحة الإدارة» and «البلاغات». The kill switch in this layout already covers
the new page: with no administrator configured `/admin/stats` is 404.

## §2 Rejected

1. **A third-party analytics script.** The design system forbids every
   external asset, and the privacy page promises no trackers.
2. **Page-view counting.** It needs a table written on every request, which
   is a new record of who opened what. The product's numbers are already in
   its own tables.
3. **A per-account list with names and counts.** It is the sender's identity
   next to the number of messages they sent, on a page that does not write
   to `admin_reveal_log`.
4. **Signups split by provider per day.** Cheap, but with this traffic a
   column that reads 1 is an identity. Provider stays a total.
5. **A daily Telegram number from a cron job.** A lane reading the database
   every day is a second reader of the data, outside the admin's audited
   session, and the owner said project lanes do not message him.
6. **Hourly buckets.** Hour-only timestamps exist so a recipient cannot
   narrow a sender by when they were awake; an hourly series of a small
   product gives the admin the same narrowing for every account at once.

## §3 Acceptance, `test/79-admin-numbers.test.ts`

Against `freshDb()` from `test/harness.ts`. Fixtures are inserted with
explicit timestamps; `now` is passed in, never taken from the clock.

1. Empty database: every total 0, `days` has exactly 14 entries, every count
   in them 0, both `last*Day` null, `timeZone` is `Asia/Dubai`.
2. `days` is 14 consecutive calendar dates, oldest first; the last one is
   `now`'s date in Dubai. With `now = 2026-10-23T20:30:00Z` the last day is
   `2026-10-24` and the first `2026-10-11`. With `now = 2026-10-23T19:59:00Z`
   the last day is `2026-10-23`.
3. `days: 3` returns exactly 3 entries.
4. Accounts: live, disabled, deleted and the provider split are counted as
   §1.1 says, with a deleted account (written through `deleteAccount` from
   `src/account-deletion.ts`, not by hand) and an admin-disabled account
   among the fixtures. A deleted account is in `deleted`, not in `live`,
   `google` or `facebook`, and is still counted in its signup day.
5. `everSent` and `everReceived` count accounts, not messages: one sender
   with three messages to one recipient gives 1 and 1. A deleted sender's
   messages stay in `messages.total` but the sender is not in `everSent`.
6. Links: on, off and a deleted account's retired link (not counted in
   either).
7. Messages: each status lands in its own count; `total` is their sum;
   `withheld` (a send to a link that blocked the sender, through the real
   send path) is counted and is not in `total`. `reports` and `blocks`
   count their rows.
8. Offers: each of the four states in its own count, `total` their sum.
9. Per-day buckets: a confession at `created_hour` 2026-10-23T19:00Z is on
   `2026-10-23`, one at 2026-10-23T20:00Z is on `2026-10-24`. Same boundary
   for `accounts.created_at` and `reveal_offers.created_at`.
10. Per-day distinct counts: two senders sending three messages to two
    recipients on one day gives `messages` 3, `senders` 2, `recipients` 2.
11. Outside the window: a confession 20 days before `now` is in
    `messages.total` and in `lastMessageDay` but in no entry of `days`.
12. `lastSignupDay` and `lastMessageDay` are the Dubai day of the newest row.
13. Every number in the result, at every depth, is `typeof 'number'` and an
    integer.
14. §1.2, measured: with fixtures whose display names, slugs, bodies,
    report reasons and offer texts are distinctive strings, `JSON.stringify`
    of the result contains none of them and none of the fixture uuids.
15. The page and the nav (read as files, as the existing admin tests do for
    the layout's kill switch): `app/admin/stats/page.tsx` exists and the
    admin layout links `/admin/stats`. The live behaviour (307 signed out,
    200 signed in, the numbers matching the database) is checked on staging
    after the deploy by the author of the change, not here.

## §4 Mutants the author will run against §3

- the provider split counts deleted accounts;
- `everSent` counts messages instead of accounts;
- day buckets in UTC instead of Dubai;
- the window ends yesterday;
- counts returned as strings;
- `withheld` folded into `total`.

Each must turn at least one item red.

## §5 Hands

The change is written by the session that froze this spec. The acceptance
file is written by a different engine in a worktree that never held the
change, from this document alone.

## §6 Amendment after review, 2026-10-23 22:0x +04: no count of people beside a count of messages

An independent privacy review of the change as first written (`3abc9c5`)
returned FAIL, and it is right. §1.2 forbade crossing senders with signups
and missed the plainer cross: a count of distinct senders next to a count of
messages groups the messages by sender.

- Measured on production tonight: `everSent` would read 1 and
  `messages.total` 4. That says all four messages came from one account. One
  reveal through `/admin/reveal` writes one `admin_reveal_log` row and names
  the sender of all four.
- A day row reading messages 3, senders 1 does the same for that day; a row
  reading 2 and 2 proves two messages have different senders.
- The privacy page is live with: «إدارة التطبيق فيها تشوف مين بعت أي رسالة،
  وكل مرة حدا من الإدارة يشوف هالشي بينسجل بسجل ثابت ما بيتغير»
  (`src/privacy.ts`, `admin`). The first version of this page would have
  made that sentence false for every message after the first one revealed.

So, replacing the parts of §1.1, §1.3 and §3 they contradict:

1. `AdminStats` loses `everSent` and `everReceived`. `AdminStatsDay` loses
   `senders` and `recipients`. Nothing else in the result changes.
2. The page loses the lines «بعتو رسالة وحدة عالأقل» and «وصلتهن رسالة وحدة
   عالأقل» and the table loses the columns «مرسلين» and «مستلمين».
3. §3 item 5 becomes: the result has no key named `everSent`,
   `everReceived`, `senders` or `recipients` at any depth, and the top-level
   keys are exactly `timeZone, accounts, links, messages, reports, blocks,
   offers, days, lastSignupDay, lastMessageDay`; every day entry's keys are
   exactly `day, signups, messages, offers`.
4. §3 item 10 becomes: three messages from two senders to two recipients on
   one day give that day `messages` 3, and the day entry carries no other
   count of them.
5. §3 item 13's leaf counts follow from the new shape.
6. §4's mutant "`everSent` counts messages" is replaced by "a `senders`
   column is put back on the day rows".

What is left and accepted, with the reason:

- `signups` and `messages` share a day row. With five accounts, "one signup
  and three messages on the 20th" suggests the new account sent them. The
  page names no account and lists none, so turning that into a person needs
  data the admin surface does not show; inside the product the reveal is
  still the only way to a name. Rejected to close it: dropping one of the two
  series (the owner's question needs both), weekly buckets (the same
  co-occurrence, coarser), suppressing counts under a threshold (at this
  traffic every number is under it and the page would say nothing).
- The totals are live. An admin reloading the page can see `messages.total`
  step up and time a message more finely than its stored hour. The hour
  truncation exists against the recipient (week 2), and this needs someone
  watching at the moment of the send.
