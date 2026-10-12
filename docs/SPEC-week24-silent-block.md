# Week 24 - a blocked sender cannot tell he was blocked

Frozen 2026-10-12 21:40 +04, before any code. Measured on staging, which runs
the same tarball as production since week 23 (sha256 `100814ad6b671786...`).

## §0 What was measured

### §0.1 The promise

Week 2 §2, test 4.5.20, and the comment above the block check in
`src/actions.ts`:

> The block check must be indistinguishable from success to the sender. A
> blocked sender who gets an error learns he is blocked, which tells him the
> recipient acted on him.

The owner is told the same thing at the moment of deciding, under «احظر
صاحبها» on `/inbox`: «الحظر بيوقف رسايله إلك، وما بيوصله إشعار.»

### §0.2 Two ways the blocked sender can tell anyway

Driven headless at 390x844 on `stg.masaraha.provefair.app` with three fresh
dev-login accounts (`scratch/w24/block.mjs`): owner A, sender B, control
sender C, all on A's link.

| step | B (blocked after his first send) | C (never blocked) |
|---|---|---|
| send 1 | `?sent=1`, `/sent` badge 1, body listed | `?sent=1` |
| A taps «احظر صاحبها» on B's message | | |
| sends 2 to 6 | `?sent=1` each time | `?sent=1` each time (C's 2 to 5) |
| `/sent` afterwards | badge still **1**, none of sends 2 to 7 listed | badge 5, all five listed |
| 6th send in the hour | B's 7th: `?sent=1` | C's 6th: `?error=ratelimit` |

1. **`/sent` (week 15) lists only rows that exist.** A blocked send writes
   nothing, so the message he was just told «وصلت» is not in his own sent
   list and the badge does not move. One send after the block is enough.
2. **The per-link limit never reaches him.** `send_counters` is incremented in
   the same transaction as the `confessions` insert, and the blocked path
   returns before it. Every other sender is refused at the sixth message in an
   hour; a blocked one is never refused. The daily limit has the same hole.

Neither needs any skill. The first is visible to anyone who looks at the tab
the app itself sends him to after sending (`عرض الرسائل المرسلة`).

### §0.3 Why it matters

The block is the one tool the owner has. Moderation is the participant's
responsibility (Sam, 2026-08-22), so it carries more weight here than in an
app with a moderation team. A harasser who learns he is blocked opens a second
Google account and carries on, now knowing the owner reacts to him. The silent
block exists to stop that, and today it does not.

## §1 The change

A blocked send is **stored where only the sender's own views read it**.

1. New table `withheld_messages`, migration `drizzle/0006_withheld_messages.sql`:
   `id` uuid primary key (`gen_random_uuid()`), `link_id` uuid NOT NULL
   references `links(id)`, `sender_account_id` uuid NOT NULL references
   `accounts(id)`, `body` text NOT NULL, `created_hour` timestamptz NOT NULL
   with CHECK `created_hour = date_trunc('hour', created_hour)`, the same rule
   `confessions` has. No status column, no recipient-facing column. Drizzle
   definition `withheldMessages` in `src/schema.ts`.
2. `sendConfession` keeps its signature and its error classes. The order
   becomes: link exists and is enabled (unchanged); the sender's account is
   not disabled or deleted (now checked for blocked senders too); then one
   transaction that reads the block, applies **both** rate limits, inserts
   the message into `confessions` if not blocked or into `withheld_messages`
   if blocked, and increments `send_counters` in both cases. It returns
   `{ confessionId }` = the id of the row it inserted, from whichever table.
3. `getSentForSender` returns the sender's `withheld_messages` rows alongside
   his `confessions` rows, each shaped exactly like a delivered message with
   no offer: `{ confessionId, body, createdHour, recipientDisplayName (the
   link owner's display name), offer: { kind: 'none' } }`. One list, ordered
   newest hour first and then by id ascending across both sources, the order
   week 15 §2.1 fixed.
4. `countSentForSender` counts both tables.
5. `src/privacy.ts`: the stored item whose tables are `['confessions']` becomes
   `['confessions', 'withheld_messages']` in both languages. **No text
   changes.** «نص كل رسالة، ومين بعتها ولمين، والساعة يلي انبعتت فيها» is
   already exactly true of a withheld message; test 69 item 2 requires every
   table to be named.

Nothing else reads `withheld_messages`. In particular no recipient-facing
view, no count on `/inbox`, no admin view, and none of the owner actions
(hide, report, block, open offer) can address a withheld id: they all resolve
ids through `confessions`, so a withheld id is "no such confession" to them.

## §2 Rejected alternatives

- **A `withheld` value on `confessions.status`.** One table, one insert path,
  and the existing sent view would pick it up for free. Rejected on its
  failure mode: every recipient-facing query (inbox, inbox count, owner
  actions, the reveal offer, the story card that renders the body) would have
  to remember to exclude it, and a single missed `where` delivers the blocked
  man's message to the person who blocked him. In a separate table the same
  mistake is impossible, and the worst a missed query can do is the bug we
  have today.
- **Fake the sent list in the page** (remember the send in the session or the
  browser). The badge and the list would disagree across devices and after a
  cookie clear, and the rate-limit hole stays.
- **Increment `send_counters` but keep writing nothing.** Closes the rate
  limit and leaves `/sent` saying the message vanished.
- **Show the blocked sender an error and own it.** Simpler and honest, and it
  breaks the week 2 rule and the sentence the owner was shown when deciding.
  Not ours to change without the owner of the product; not proposed.
- **Erase withheld rows on the sender's account deletion.** Less retention,
  but `/privacy` says «الرسائل يلي بعتها بتضل عند الإدارة مربوطة برقم حساب بلا
  اسم» about every message he sent, and these are messages he sent. Treating
  them like delivered ones keeps that sentence true without touching frozen
  text. If the policy changes it changes for both.

## §3 What this does not do

- It does not show withheld messages to the admin. Nobody can see a blocked
  send today, so this keeps what the admin sees exactly as it is.
- It does not deliver withheld messages if a block is ever lifted. There is
  no unblock in the product.
- It does not touch messages sent **before** the block; those stay in the
  owner's inbox as they are today.
- No UI or copy changes. `/sent` renders a withheld message the same way it
  renders any delivered message nobody has answered.

## §4 Acceptance (written by a different author, from this file alone)

New file `test/74-silent-block.test.ts`, PGlite through `test/harness.ts`,
fixtures from `test/fixtures.ts`. "Control" below means a second sender on
the same link who was never blocked, driven through the same calls.

1. Migration: after `freshDb()`, `withheld_messages` exists with columns
   `id, link_id, sender_account_id, body, created_hour`; inserting a row whose
   `created_hour` is not on the hour is rejected by the database; a
   `link_id` or `sender_account_id` that does not exist is rejected.
2. A blocked send returns `{ confessionId }` (a uuid string), adds **no**
   `confessions` row, and adds exactly one `withheld_messages` row whose `id`
   equals the returned `confessionId`, with the sender, the link, the body as
   sent and an hour-truncated `created_hour`.
3. Sender's view parity: after one send each, the blocked sender's
   `getSentForSender` gains exactly one entry and the control's gains exactly
   one entry; the two entries have the same set of keys, `offer` is
   `{ kind: 'none' }` in both, `recipientDisplayName` is the owner's display
   name in both, and the blocked entry's `confessionId` is the id from item 2.
   `countSentForSender` goes up by 1 for each.
4. Ordering: a sender with delivered messages on one link and withheld
   messages on another (blocked there) gets one list ordered by
   `createdHour` descending, then `confessionId` ascending, with both kinds
   interleaved by those keys alone. Seed `created_hour` values directly to
   get distinct hours.
5. Per-link limit parity: a sender blocked on a link is refused with
   `PerLinkRateLimitExceededError` on the 6th send to that link in one hour,
   counting sends made before and after the block together, exactly where
   the control is refused.
6. Daily limit parity: with `send_counters` seeded so the sender is at 30 for
   today across other links, a blocked send is refused with
   `PerAccountRateLimitExceededError`, as the control is.
7. A blocked sender whose account is disabled, and one whose account is
   deleted through `deleteAccount`, gets `SenderAccountDisabledError` and
   nothing is written to either table.
8. A blocked sender on a disabled link gets `LinkDisabledError`, as today.
9. The recipient never sees it: after a blocked send, `getInboxForRecipient`
   for the owner contains no entry with that body or that id,
   `countVisibleInboxForLink` is unchanged, and `getAdminInbox` /
   `getAdminInboxPage` contain no entry with that body or id.
10. Owner actions cannot address a withheld id: `hideConfession`,
    `reportConfession`, `blockSenderOfConfession` and `openRevealOffer`
    called by the owner with the withheld id each reject, and no row in
    `confessions`, `reports`, `link_blocks`, `reveal_offers` or
    `reveal_answers` changes.
11. Privacy contract: the `PRIVACY_AR` and `PRIVACY_EN` stored item that
    names `confessions` names `withheld_messages` too, and its `text` is
    byte-identical to what it was before this change (copy the current
    strings from `src/privacy.ts` on `main`).

Every existing test stays as it is. In particular 4.5.20 in
`test/05-send-path.test.ts` and the block test in
`test/08-recipient-actions.test.ts` assert that a blocked send writes no
`confessions` row; that remains true and they are not to be edited.

Items 2, 3, 5, 6, 7 and 11 (and 1, which needs the table) must fail on the
tree before §1. Item 8, 9 and 10 may pass on it; they guard the change.

## §5 Deploy and verification (the build session)

Staging first. Re-drive `scratch/w24/block.mjs`: after the block, B's
`/sent` badge and list move with every send, and B's 6th send in the hour
gets `?error=ratelimit` like C's. A's inbox does not show any of B's sends
after the block. Then production from the same tarball, the week 23 route
table from outside, and what the containers log after the drive.
