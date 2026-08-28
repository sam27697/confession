# SPEC — week 2: the data model, frozen

*Written 2026-08-26 23:0x by the confession build session (GOALS §10). This
document is **frozen input** for implementation: it contains product decisions
that are not the implementer's to revisit. If something here is impossible or
wrong, stop and say so — do not substitute a judgement call.*

Companion documents, and they outrank convenience:
`work/confession-app/BRIEF.md` (Sam's verbatim words, the terms),
`work/confession-app/STACK.md` (**the revised identity model**),
`work/confession-app/DESIGN.md` (the approved mutual-reveal mechanic).

---

## The one sentence this whole spec exists to serve

**The anonymity claim is a schema decision, not a feature.** Terms clause 1 says
the recipient cannot see the sender and the admin can. Everything below is that
sentence, made true in Postgres — with the constraints in the *database*, not in
application discipline, wherever the database can hold them.

---

## 0. Stack, fixed by `STACK.md` — not open

- TypeScript. Postgres 17 dialect. Drizzle ORM + drizzle-kit for migrations.
- **Tests run against a real Postgres engine.** There is no Postgres server and
  no Docker in this container, so tests run on **PGlite** (`@electric-sql/pglite`),
  which is Postgres compiled to WASM and executes real DDL, real CHECK
  constraints and real PL/pgSQL triggers. A test suite that mocks the database
  proves nothing about a spec whose entire content is database constraints.
- Test runner: **`node:test`** (built in — no vitest/jest dependency).
- Node 22. ESM. `tsx` for running TS directly.
- No Next.js app code this slice. Scaffolding a UI now would be surface area
  ahead of the schema it renders.

---

## 1. Tables

All ids are `uuid` with a random default (`gen_random_uuid()`), **never
sequential** — a sequential confession id leaks send order, which is a
deanonymisation channel against the recipient.

### `accounts`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `provider` | enum(`facebook`) | Instagram is a distribution channel, not an auth surface (`STACK.md`). The enum exists so that stays a deliberate decision. |
| `provider_user_id` | text NOT NULL | unique together with `provider` |
| `display_name` | text NOT NULL | as returned by Facebook Login |
| `terms_version` | text NOT NULL | the version they accepted |
| `terms_accepted_at` | timestamptz NOT NULL | |
| `age_attested_18` | boolean NOT NULL | **an attestation, not a birthdate.** We store that they said yes, not their date of birth. Storing a DOB would be more PII to leak in exchange for no more certainty. |
| `disabled_at` | timestamptz NULL | terms clause 4 |
| `created_at` | timestamptz NOT NULL default now() | accounts are not anonymous; full timestamps are fine here |

Deliberately absent: email, friend list, profile photo URL, gender, locale,
anything past `public_profile`. Each one is App Review scope we would have to
justify and leak surface we would have to defend.

### `terms_acceptances` — append-only

`id`, `account_id` FK, `terms_version` text NOT NULL, `accepted_at` timestamptz
NOT NULL, `locale` text NOT NULL (`ar` | `en`).

Why a log and not just the column on `accounts`: when clause 1 changes again —
and this week proves it changes — we must be able to say who accepted *which*
sentence. The 08-25 rewrite of clause 1 is exactly the event this table exists
for.

### `links`

`id` uuid pk, `owner_account_id` FK NOT NULL, `slug` text UNIQUE NOT NULL,
`enabled` boolean NOT NULL default true, `created_at`.

`enabled` is terms clause 6, the off-switch. It is checked in the send path.

### `confessions` — the table the terms are about

| column | type | notes |
|---|---|---|
| `id` | uuid pk random | |
| `link_id` | uuid FK NOT NULL | |
| `sender_account_id` | uuid FK NOT NULL | **admin-visible only.** Sam's decision 2026-08-25 10:29. |
| `body` | text NOT NULL | |
| `created_hour` | timestamptz NOT NULL | **truncated to the hour** |
| `status` | enum(`delivered`,`hidden_by_recipient`,`reported`) NOT NULL default `delivered` | |

**Database-level, not convention:**

- `CHECK (created_hour = date_trunc('hour', created_hour))`. A future beat that
  writes `now()` into this column gets an error, not a silent deanonymisation
  channel. The threat is the recipient: a message at 02:41 plus knowing who was
  awake at 02:41 narrows the field to one person (`STACK.md`).
- `sender_account_id` is `NOT NULL`. There is no anonymous-to-the-operator path
  any more, and a nullable column would invite one back in.

**Columns that must never exist, enforced by a test (§4.2):** `sender_ip`,
`sender_user_agent`, `session_id`, `device_id`, `referrer`, `fingerprint`,
`geo`, `country`, `sender_ip_hash`.

### `admin_reveal_log` — append-only, in the database

`id`, `admin_account_id` FK NOT NULL, `confession_id` FK NOT NULL,
`revealed_at` timestamptz NOT NULL default now(), `reason` text NOT NULL.

- `CHECK (length(btrim(reason)) >= 8)` — "reason NOT NULL" that accepts `''` or
  `'.'` is a NOT NULL constraint, not a reason.
- **A `BEFORE UPDATE OR DELETE` trigger that raises an exception.** Append-only
  written down in a doc is a promise; append-only in a trigger is a property.
  "The admin can see the sender" without a record becomes "someone looked and
  nobody knows who or why."

### `link_blocks`

`id`, `link_id` FK NOT NULL, `blocked_account_id` FK NOT NULL, `created_at`,
UNIQUE(`link_id`, `blocked_account_id`).

**The property that makes this shippable:** the recipient blocks a *confession*,
and the server resolves that to an account id she never sees. The API takes a
confession id. It does not take, and must never return, an account id. Blocking
must not become the deanonymisation oracle that defeats the whole product.

### `reports`

`id`, `confession_id` FK NOT NULL, `reported_by_account_id` FK NOT NULL,
`reason` text NOT NULL, `created_at`. UNIQUE(`confession_id`,
`reported_by_account_id`).

### `send_counters` — rate limiting, per account

`sender_account_id` FK, `link_id` FK, `window_hour` timestamptz (truncated to
the hour, same CHECK), `count` integer NOT NULL default 0.
PRIMARY KEY (`sender_account_id`, `link_id`, `window_hour`).

Per `STACK.md`: the HMAC/RAM-secret machinery is **deleted**, not ported. Rate
limiting is now a plain per-account counter, and that simplification is one of
the few things the identity change bought us.

Limits for v1 (implement as named constants, not magic numbers):
`MAX_PER_LINK_PER_HOUR = 5`, `MAX_PER_ACCOUNT_PER_DAY = 30`.

### The mutual reveal — `reveal_offers` and `reveal_answers`

This is `DESIGN.md`'s mechanic, approved by Sam, and it is the differentiator.
**All-or-nothing for v1** — no graduated "hint first"; that is the road NGL took
to a regulatory settlement.

`reveal_offers`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `confession_id` | uuid FK NOT NULL UNIQUE | one open offer per confession, ever |
| `question_for_sender` | text NOT NULL | what she asks him, e.g. «مين إنت بالحقيقة؟» |
| `stake_prompt` | text NOT NULL | what she has committed to disclose about herself — the sender sees this **before** deciding |
| `state` | enum(`pending`,`resolved`,`declined`,`cancelled`) NOT NULL default `pending` | |
| `created_at` | timestamptz NOT NULL | |
| `settled_at` | timestamptz NULL | set when leaving `pending` |

`reveal_answers`

`id`, `offer_id` FK NOT NULL, `side` enum(`recipient`,`sender`) NOT NULL,
`body` text NOT NULL, `committed_at` timestamptz NOT NULL default now().
UNIQUE(`offer_id`, `side`).

### The state machine, and it is the product

1. Recipient opens an offer. **Her own answer is written in the same transaction
   as the offer** — she stakes first, sight unseen. An offer without a
   `recipient` answer row must be impossible: enforce with a
   `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` that raises if, at
   commit time, a `reveal_offers` row has no `recipient` answer.
2. Sender sees `question_for_sender` and `stake_prompt`. **He does not see her
   answer body.** He may decline (`declined`, terminal, nothing revealed, no
   penalty, no nag — `DESIGN.md`) or accept.
3. Accept writes the `sender` answer row **and** flips `state` to `resolved`
   **in one transaction**. Both unlock at once. Neither side reads first.
4. `resolved` and `declined` are **terminal**. `cancelled` is only reachable
   from `pending`, and only by the recipient. A `BEFORE UPDATE` trigger enforces
   the legal transitions; anything else raises.
5. `reveal_answers` rows are **immutable** — `BEFORE UPDATE OR DELETE` trigger
   raises. Without this, "committed before shown" is decoration: a side could
   read the other's answer at resolution and rewrite their own.
6. **On `resolved`, and only then, the recipient learns the sender's real
   account identity** — display name and provider id, from `accounts`. Not a
   name typed into a box. This is the whole point of the amendment in
   `STACK.md`: a sender who already has an account has something real to stake.
   It applies to **that confession only**; every other confession in her inbox
   stays masked.

---

## 2. The two view types — separate row shapes, not a filtered one

`STACK.md` rule 1: *"excluded at the serializer, not filtered in the UI — a
field the recipient's API response never contains cannot be found in a network
tab."*

Implement in `src/views.ts` as two **structurally different TypeScript types**
built by two **different SQL queries**. Not one query with a `delete row.x`.
A field that is selected and then removed has already been on the wire between
Postgres and Node, and one forgotten `delete` ships it to the browser.

```ts
type RecipientConfession = {
  id: string
  body: string
  createdHour: Date
  status: 'delivered' | 'hidden_by_recipient' | 'reported'
  reveal:
    | { kind: 'none' }
    | { kind: 'offered'; offerId: string; state: 'pending' | 'declined' | 'cancelled' }
    | { kind: 'resolved'; offerId: string
        senderDisplayName: string      // ONLY on resolved. Sam's approved mechanic.
        senderProviderUserId: string
        senderAnswer: string
        recipientAnswer: string }
}

type AdminConfession = {           // the DEFAULT admin row — masked
  id: string
  body: string
  createdHour: Date
  status: ...
  senderMasked: true               // a literal, so the type cannot carry an id
}

type AdminRevealedSender = {       // returned ONLY by adminReveal(), which logs
  confessionId: string
  senderAccountId: string
  senderDisplayName: string
}
```

`STACK.md` rule 3: **admin lists default to masked.** Identity is one deliberate
call that writes a log row. Defaulting to unmasked turns every routine review
into a mass deanonymisation.

### Functions to implement (`src/views.ts`, `src/actions.ts`)

- `getInboxForRecipient(db, { linkId, viewerAccountId })` → `RecipientConfession[]`
  Throws if `viewerAccountId` does not own `linkId`.
- `getPendingOfferForSender(db, { offerId, senderAccountId })` → the offer with
  `question_for_sender` and `stake_prompt` **and no answer bodies**.
- `getAdminInbox(db, { adminAccountId })` → `AdminConfession[]` (masked).
- `adminReveal(db, { adminAccountId, confessionId, reason })` →
  `AdminRevealedSender`. **One transaction**: insert the log row, then return
  the identity. If the insert fails (blank reason), nothing is returned.
- `sendConfession(db, { senderAccountId, linkSlug, body })` — checks, in order:
  link exists and `enabled`; sender not blocked on that link; sender's account
  not disabled; rate limits; then inserts with `created_hour = date_trunc('hour', now())`.
  Each rejection is a distinct typed error.
  **The block check must be indistinguishable from success to the sender.** A
  blocked sender who gets an error learns he is blocked, which tells him the
  recipient acted on him. Return success; write nothing. Say so in a comment.
- `openRevealOffer(db, { recipientAccountId, confessionId, questionForSender, stakePrompt, recipientAnswer })`
- `acceptRevealOffer(db, { senderAccountId, offerId, senderAnswer })` — one transaction.
- `declineRevealOffer(db, { senderAccountId, offerId })`

---

## 3. Migration

`drizzle-kit generate` for the tables, then a **hand-written SQL migration**
alongside it for the triggers, CHECK constraints and the deferred constraint
trigger, since drizzle-kit does not emit PL/pgSQL. Both live in `drizzle/` and
both are applied, in order, by the test harness and by the (future) deploy path.
The harness must apply the *real* migration files — not a `push`-style schema
sync — because the migration files are what will run on the real box.

---

## 4. Tests — `node:test` against PGlite. These are the deliverable.

A test that does not fail when the property is removed is not a test. Where
practical, assert on **absence of the actual secret string**, not on object
keys: `JSON.stringify(payload)` must not contain the sender's account uuid.
A key check passes if the id is nested under a different name; a substring
check does not.

### 4.1 Migration
1. Every migration file applies cleanly to an empty PGlite database, in order.

### 4.2 The tripwire test — banned columns
2. Query `information_schema.columns` across the whole schema and fail if any
   column name matches the denylist in §1. **This test is the point:** a future
   beat that adds `sender_ip` for "debugging" gets a red build with a message
   pointing at terms clause 1 and `STACK.md`. Write that message into the
   assertion.

### 4.3 The identity model
3. `created_hour` CHECK rejects a non-truncated timestamp.
4. `sender_account_id` NOT NULL is enforced.
5. `getInboxForRecipient` output: `JSON.stringify` contains neither the sender's
   account uuid nor their display name, for an unresolved confession.
6. `getAdminInbox` output: same absence assertions. Masked by default.
7. `adminReveal` returns the identity **and** writes exactly one log row with
   the reason. A blank/whitespace/7-char reason raises and writes nothing.
8. `UPDATE` on `admin_reveal_log` raises. `DELETE` raises.
9. `getInboxForRecipient` throws when the viewer does not own the link.

### 4.4 The mutual reveal
10. An offer cannot be committed without the recipient's answer (deferred
    constraint trigger fires at COMMIT).
11. `getPendingOfferForSender` while `pending`: `JSON.stringify` contains
    neither answer body.
12. Recipient's view while `pending`: does not contain the sender's answer body,
    the sender's uuid, or the sender's display name.
13. Accept: both answers and the sender's identity appear for **that**
    confession, in the recipient's view, after resolution.
14. A **second** confession from the same sender in the same inbox stays masked
    after the first is resolved. (The reveal is per confession, not per person.
    This is the test most likely to catch a lazy join.)
15. Decline: terminal. Recipient's view reveals nothing. Her staked answer is
    not shown to the sender.
16. `UPDATE` on a `reveal_answers` row raises. `DELETE` raises.
17. Illegal transitions raise: `resolved` → anything, `declined` → anything,
    `cancelled` → `resolved`.
18. Accepting an offer on someone else's confession raises.

### 4.5 The send path
19. Disabled link: send rejected with the typed error.
20. Blocked sender: `sendConfession` **returns success and writes no row.**
    Assert the row count is unchanged.
21. Rate limit: the 6th send to one link within an hour is rejected; a send to a
    different link in the same hour is allowed.
22. Disabled account: rejected.

---

## 5. What this slice deliberately does NOT do

- No Next.js pages, no Facebook Login, no UI. Auth is represented as "an
  `accounts` row exists"; the OAuth flow is a later slice and needs App Review.
- No deploy. **Nothing is rented until Sam says yes to the €5.99/month**
  (`STACK.md`). This slice runs entirely in-process.
- No moderation dashboard. `getAdminInbox` + `adminReveal` are the primitives it
  will be built from.
- No analytics of any kind. An analytics SDK on the send page would undo the
  model on day one and is the most likely way this gets broken by accident.

## 6. Repo conventions

- `src/schema.ts`, `src/views.ts`, `src/actions.ts`, `src/errors.ts`,
  `src/limits.ts`, `drizzle/*.sql`, `test/*.test.ts`, `test/harness.ts`.
- `npm test` = apply migrations to a fresh PGlite instance and run every test.
  It must pass from a clean `npm ci` with no external services.
- Every non-obvious constraint carries a comment naming **which promise it
  keeps** — terms clause number, or the `STACK.md` rule. A constraint whose
  reason is not written down is a constraint the next beat deletes.

---

## CORRECTION, 2026-08-28 — `senderProviderUserId` was one field wider than the promise

**This section is a defect in the frozen spec above, found by an adversarial
review of the shipped code and verified against the running system, and
recorded rather than quietly patched.**

Line 218 of this document put `senderProviderUserId: string` into
`RecipientConfession.reveal`, the object handed to a **recipient** when a mutual
reveal resolves. The comment beside it says *"ONLY on resolved. Sam's approved
mechanic."* That comment justifies `senderDisplayName`. It never justified the
field below it, and nothing in `DESIGN.md` asks for it.

### What the sender is actually promised

The consent screen at `/offer/[offerId]`, which is the last thing a sender reads
before accepting:

> «إذا وافقت، اسمك رح ينكشف إلو — وبس إلو، وبس على هالرسالة.»
> ("If you agree, **your name** will be revealed to him — only to him, and only
> for this message.")

The promise is a name. `accounts.provider_user_id` is not a name: it is the
Facebook account id captured at login, and `facebook.com/<id>` resolves to the
profile. It is materially more identifying than a display name, which many
people share with strangers.

### Why this is a real defect and not a nitpick

Nothing renders it today. `app/inbox/page.tsx` reads `senderDisplayName`,
`senderAnswer` and `recipientAnswer`, and every component in this app is a
Server Component, so the unrendered field does not reach the browser. Over the
wire, today, only the name leaks.

That is a property of one file, not of the boundary. `STACK.md` rule 1 says the
sender's identity is *"excluded at the serializer, not filtered in the UI"* —
and here the serializer let it through and the UI is what happens to be holding
it back. `DESIGN.md` frames the reveal as *"an actual reveal"* of a real
account, so linking the revealed name to the sender's Facebook profile is a
natural thing for a future beat to add. That edit would touch `app/inbox/page.tsx`
alone. It would ship the account id to the recipient without anyone opening
`views.ts`, `schema.ts`, or the consent copy. The leak was pre-provisioned.

### The change

- `RecipientReveal`'s `resolved` variant loses `senderProviderUserId`.
- `getInboxForRecipient` stops selecting `accounts.provider_user_id`. The join
  to `accounts` stays, because `display_name` still comes from it.
- Line 218 above is void.

### What this does NOT decide

Whether the mutual reveal *should* show the recipient a link to the sender's
real Facebook profile is a **product question, and it is Sam's**. It is a
stronger reveal and it is arguably what «مصارحة» means. It is also a materially
bigger disclosure than the sentence the sender agrees to.

The rule this project already set, when terms clause 1 was rewritten on
2026-08-25, applies unchanged: **the copy the user reads is changed first, and
the schema is what makes it true.** If the answer is yes, the consent line
changes before the field comes back. Until then the code matches the sentence,
which is the direction this correction moves it.

### The test

`test/04-mutual-reveal.test.ts` asserted this field's presence. That assertion
is not deleted to make a suite green — the requirement changed, so its proof
changes with it, and the replacement is **stronger than what it replaces**: the
recipient payload is serialised and the sender's `provider_user_id` is asserted
**absent from the JSON string**, not merely absent from a key. Same discipline
as the week-2 sender-uuid assertions. Written by an agent that did not write
the fix.
