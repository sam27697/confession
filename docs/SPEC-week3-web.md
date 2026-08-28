# SPEC — week 3: authentication, the first surfaces, and a staging deploy

*Frozen 2026-08-28 before any code, by the session master. Builders implement
this; they do not redesign it. Anything this document does not answer is a
question back to the master, not a judgement call taken quietly.*

Companion documents, all of which outrank this one where they conflict:
`work/confession-app/BRIEF.md` (Sam's words, the terms draft),
`work/confession-app/STACK.md` (the identity model),
`work/confession-app/DESIGN.md` (the mutual reveal),
`docs/SPEC-week2-data-model.md` (the schema this builds on).

---

## §0. What this slice is

Week 2 built the data model and proved it with 22 tests. It has no user
interface, no way for a person to sign in, and nothing running anywhere.

Week 3 makes it a running web application on staging:

- Facebook Login for both sides, at `public_profile` scope and nothing more.
- Terms acceptance at signup, which is where an `accounts` row is created —
  the schema makes acceptance NOT NULL, so an account cannot exist without it.
- The four surfaces the approved mechanic needs: the send page, the inbox, the
  offer composer, and the sender's own view of a pending offer.
- Deployed to `stg.confession.fayad.app`, verified from outside.

Explicitly NOT in this slice: production promotion, the admin/moderation
dashboard, share-card image generation, any Instagram surface, any payment.

---

## §1. The privacy rules — these are constraints, not style

The identity model (`STACK.md`) is a contract with the user, written into the
terms in a sentence they read. A deployment is where such a contract gets
broken by accident. The following are hard rules for every file in this slice.

1. **No request identity is ever read.** No code path reads `x-forwarded-for`,
   `x-real-ip`, `user-agent`, `referer`, or any geo/IP header. Not to log it,
   not to rate-limit on it, not to "enrich" anything. The reverse proxy sets
   `X-Forwarded-For`; the application must behave as though it does not exist.
   Rate limiting is per account, in Postgres, and week 2 already built it.
2. **No third-party network request from any page.** No CDN font, no Google
   Fonts, no analytics, no error-reporting SDK, no external image. A font
   request from the send page hands the sender's IP and the referring URL to a
   third party, which is the single most likely way this contract gets broken
   without anybody deciding to break it. System font stack only.
3. **Nothing that identifies a sender is logged.** No `console.log` /
   `console.error` in any request path may contain a confession body, an
   account id, a provider user id, a link slug, or a session cookie value.
   Error logs carry the error class and message only.
4. **The recipient's rendered HTML never contains a sender identity.** Use the
   week-2 view functions, which are separate queries returning separate types
   (`views.ts`). Do not write a new query that selects
   `confessions.sender_account_id` for a recipient-facing page. The only place
   a sender's display name may reach a recipient is a **resolved** reveal,
   which `getInboxForRecipient` already handles.
5. **No new identity column, ever.** `test/02-tripwire-columns.test.ts` fails
   the build if one appears. It stays.
6. **Nothing that touches an account is logged at info level in production.**
   Next.js does not log requests by default; do not add a request logger.

---

## §2. Environment and configuration

All configuration comes from environment variables, read once at startup
through a single module `src/env.ts` that validates and throws on a missing
required value. No `process.env` reads scattered through the app.

| Name | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://…`, the Postgres 17 service |
| `SESSION_SECRET` | yes | ≥32 bytes, HMAC key for the session cookie |
| `APP_ORIGIN` | yes | e.g. `https://stg.confession.fayad.app` — used to build the OAuth redirect URI and absolute link URLs |
| `FACEBOOK_APP_ID` | no | when absent, the Facebook login button is not rendered and `/auth/facebook/*` returns 503 |
| `FACEBOOK_APP_SECRET` | no | as above |
| `ALLOW_DEV_LOGIN` | no | `1` enables the local test-identity login. **Must be absent in production.** |
| `PORT` | no | default 3000, container-internal |

**`ALLOW_DEV_LOGIN` is the one genuinely dangerous switch in this slice.**
`src/env.ts` must refuse to start if `ALLOW_DEV_LOGIN=1` and `APP_ORIGIN` does
not begin with `https://stg.` or `http://localhost`. That check is a test.

---

## §3. Authentication

### 3.1 Facebook OAuth — scope is `public_profile`, and that is load-bearing

`BRIEF.md` records the measured finding that `public_profile` needs no App
Review. Requesting anything else — `email` included — re-opens Business
Verification and a document from Sam personally. **The scope string is
`public_profile` and it appears in exactly one constant, `FACEBOOK_SCOPE`, in
`src/facebook.ts`, with that reason in a comment above it.**

Graph API version pinned in one constant: `v21.0`.

- Authorize: `https://www.facebook.com/v21.0/dialog/oauth`
  with `client_id`, `redirect_uri` = `${APP_ORIGIN}/auth/facebook/callback`,
  `state`, `scope=public_profile`, `response_type=code`.
- Token: `GET https://graph.facebook.com/v21.0/oauth/access_token` with
  `client_id`, `client_secret`, `redirect_uri`, `code`.
- Profile: `GET https://graph.facebook.com/v21.0/me?fields=id,name` with the
  access token. **`fields` is `id,name` and nothing else.**
- The access token is used for that one call and then discarded. It is never
  stored, never put in a cookie, never logged.

`state` is 32 random bytes, base64url, written to a short-lived `__Host`-style
cookie (`fb_oauth_state`, httpOnly, secure, sameSite=lax, 10 min) and compared
on callback. A mismatch is a 400 with no detail.

### 3.2 The dev login, and why it exists

There are no Facebook app credentials yet — that is the one input only Sam
holds (see §8). Without a second identity provider, nothing in this slice could
be exercised end to end on staging, and an unexercised deploy is a hope.

So: when `ALLOW_DEV_LOGIN=1`, `POST /auth/dev` with a display name signs in a
test identity. It writes an `accounts` row with `provider = 'facebook'` (the
enum has one value and this slice does not migrate it) and
`provider_user_id = 'devlogin:' + <random>`. **That prefix is the marker: every
dev identity is greppable in one query, and no real Facebook user id can
collide with it, because Facebook ids are digits.** Say this in a comment.

### 3.3 Sessions

A signed cookie, no session table, no JWT library.

- Value: `base64url(JSON({accountId, iat})) + '.' + base64url(HMAC-SHA256(SESSION_SECRET, payload))`.
- Verify with `crypto.timingSafeEqual`. Reject on any parse failure without detail.
- Cookie `sid`: httpOnly, secure, sameSite=lax, path=/, maxAge 7 days.
- `iat` older than 7 days is rejected server-side too, so shortening the
  lifetime does not depend on the browser honouring maxAge.
- The cookie holds the viewer's own account id and nothing else. No display
  name, no provider id, no link slug.

### 3.4 Terms acceptance is account creation

The schema makes `terms_version`, `terms_accepted_at` and `age_attested_18`
NOT NULL on `accounts`. That was deliberate. So the order is:

1. OAuth (or dev) login resolves a `(provider, providerUserId, displayName)`.
2. If an `accounts` row exists for that pair → set `sid`, go to `/inbox`.
3. If not → **no row is written**. The identity goes into a second signed
   cookie `pending_identity` (same signing helper, 30 min), and the user is
   sent to `/onboarding`.
4. `/onboarding` shows the terms from `src/terms.ts` in full, with two
   checkboxes: agree to the terms, and confirm 18+. Both required.
5. `POST /onboarding` creates, **in one transaction**: the `accounts` row, a
   `terms_acceptances` row, and the user's `links` row with a fresh slug.
   Then sets `sid`, clears `pending_identity`, redirects to `/inbox`.

A returning user whose `accounts.terms_version` is older than
`TERMS_VERSION` is sent back through `/onboarding` to re-accept; this updates
`accounts.terms_version` / `terms_accepted_at` and appends a new
`terms_acceptances` row. The acceptance table is a history and is never updated
in place.

`TERMS_VERSION = '2026-08-25.1'`, one constant in `src/terms.ts`, matching the
revision date of clause 1 in `BRIEF.md`.

**The terms text in `src/terms.ts` is copied verbatim from `BRIEF.md`'s revised
draft — all six clauses, Arabic and English. It is not re-worded, not
summarised, and not "improved". If it needs to change, the change happens in
`BRIEF.md` first, because that file is what Sam approved.**

---

## §4. Domain functions to add (builder A)

New code goes in `src/` beside the week-2 code, in the same style. Existing
functions are not rewritten.

### 4.1 Widen the `Db` type — this is the blocker for a real deploy

`src/db.ts` currently aliases `PgliteDatabase`. The tests run on PGlite and the
server runs Postgres 17 over `node-postgres`. Change the alias to the
driver-agnostic drizzle type so both satisfy it:

```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './schema.js'
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
```

`npm run typecheck` must pass and all 22 existing tests must still pass
unchanged. **If a week-2 call site does not typecheck under the widened type,
fix the call site — do not narrow the type back and do not add `any`.**

Add `src/pool.ts`: creates the `node-postgres` Pool and the drizzle handle from
`DATABASE_URL`, exported as a lazily-initialised singleton. Pool max 10.
`ssl: false` (Postgres is on the same Docker network, not over the internet).

### 4.2 New functions

Signatures are frozen. Builder B codes against exactly these.

In `src/accounts.ts` (new):

```ts
findAccountByProvider(db, { provider: 'facebook', providerUserId }):
  Promise<{ id: string; displayName: string; termsVersion: string; disabledAt: Date | null } | null>

createAccountWithTerms(db, {
  provider: 'facebook', providerUserId, displayName,
  termsVersion, locale: 'ar' | 'en', ageAttested18: true,
}): Promise<{ accountId: string; linkSlug: string }>
// One transaction: accounts + terms_acceptances + links. Throws if
// ageAttested18 is false — clause 5 is not optional.

recordTermsReacceptance(db, { accountId, termsVersion, locale }): Promise<void>
// UPDATE accounts.terms_version/terms_accepted_at + INSERT terms_acceptances.

getAccountById(db, { accountId }):
  Promise<{ id: string; displayName: string; termsVersion: string; disabledAt: Date | null } | null>
```

Slug generation lives in `src/slug.ts`: 12 characters from the alphabet
`23456789abcdefghjkmnpqrstuvwxyz` (no `0/1/i/l/o`), from
`crypto.randomBytes` via rejection sampling, **not** `% alphabet.length` — a
modulo bias in a public identifier is the kind of detail that is embarrassing
later and free to get right now. On unique-violation, retry up to 5 times.

In `src/links.ts` (new):

```ts
getLinkBySlug(db, { slug }):
  Promise<{ linkId: string; ownerAccountId: string; ownerDisplayName: string; enabled: boolean } | null>
// ownerAccountId is returned because the SEND page needs to know whether the
// viewer is the owner (you cannot confess to yourself). It is used server-side
// and must never be rendered.

getLinkForOwner(db, { ownerAccountId }):
  Promise<{ linkId: string; slug: string; enabled: boolean } | null>

setLinkEnabled(db, { ownerAccountId, linkId, enabled }): Promise<void>
// Throws ViewerNotLinkOwnerError if the caller does not own it. Terms clause 6.
```

In `src/actions.ts` (extend):

```ts
blockSenderOfConfession(db, { recipientAccountId, confessionId }): Promise<void>
// Verifies the caller owns the confession's link (ViewerNotLinkOwnerError
// otherwise), resolves the sender server-side, inserts into link_blocks.
// RETURNS NOTHING. The sender's id must not be in the return type, because a
// return value is a thing a route handler can accidentally render.
// ON CONFLICT DO NOTHING — blocking twice is not an error.

reportConfession(db, { reporterAccountId, confessionId, reason }): Promise<void>
// Caller must own the confession's link. Inserts a `reports` row and sets
// confessions.status = 'reported'. ON CONFLICT DO NOTHING on the unique
// (confession_id, reported_by_account_id).

hideConfession(db, { recipientAccountId, confessionId }): Promise<void>
// Caller must own the link. status = 'hidden_by_recipient'. Idempotent.
```

In `src/views.ts` (extend):

```ts
getSentForSender(db, { senderAccountId }): Promise<SentConfession[]>

type SentConfession = {
  confessionId: string
  body: string
  createdHour: Date
  recipientDisplayName: string
  offer:
    | { kind: 'none' }
    | { kind: 'pending'; offerId: string; questionForSender: string; stakePrompt: string }
    | { kind: 'resolved'; offerId: string; senderAnswer: string; recipientAnswer: string }
    | { kind: 'declined' }
}
```

**Why this function exists and why it is not optional:** the mutual reveal is
the product. Without a page where a sender can see that someone has staked
something and is waiting, the mechanic is unreachable and the whole approved
design is dead code. There are no notifications in v1; this page is the only
delivery channel.

**The one thing to get right in it:** on a **pending** offer, the recipient's
staked answer must NOT be returned. She stakes sight unseen; if the sender can
read her answer before committing his own, the mechanic is broken and the
deferred-constraint work in week 2 was pointless. Only `kind: 'resolved'`
carries `recipientAnswer`. A test asserts this by string-searching the JSON.

---

## §5. The web application (builder B)

Next.js 15, App Router, TypeScript, `output: 'standalone'`. Server Components
by default; Server Actions for mutations; Route Handlers only for OAuth and
`/healthz`. No client-side data fetching, no state library, no UI framework.

### 5.1 Look and language

Arabic-first, `<html lang="ar" dir="rtl">`. Levantine register, matching
`work/confession-app/COPY-ar.md` where it has a phrase for the surface. One
global stylesheet, system font stack, dark, one accent colour. Nothing
decorative that costs a network request. **No English fallback UI** — English
appears only in the terms, beside the Arabic.

Positioning, per Sam's own instruction «ما شرط نعومها او نتفاخر فيها»: the
product is described as **«تطبيق مصارحة سرية»**, plainly. **No page anywhere may
claim the app does not know who sent a message.** That sentence is false under
the current schema and `STACK.md` names it as a tripwire.

### 5.2 Routes

| Route | Method | Auth | What |
|---|---|---|---|
| `/` | GET | — | What it is, in three lines. Sign-in button, or a link to `/inbox` if signed in. |
| `/terms` | GET | — | The full bilingual terms. Public URL, needed for Meta's Dev→Live switch. |
| `/privacy` | GET | — | Privacy notice. Public URL, same reason. Must agree with the schema — see §5.4. |
| `/auth/facebook/start` | GET | — | 302 to Facebook, sets `fb_oauth_state`. 503 without credentials. |
| `/auth/facebook/callback` | GET | — | Verifies state, exchanges code, resolves identity, → `/inbox` or `/onboarding`. |
| `/auth/dev` | POST | — | Only when `ALLOW_DEV_LOGIN=1`; otherwise 404. |
| `/auth/logout` | POST | — | Clears `sid`, → `/`. |
| `/onboarding` | GET/POST | pending or session | Terms acceptance. §3.4. |
| `/inbox` | GET | session | The recipient's messages, link URL, off-switch. |
| `/c/[slug]` | GET | — | The send page. Renders the owner's display name. |
| `/c/[slug]` | POST (action) | session | Send. Sender notice line above the box. |
| `/sent` | GET | session | The sender's own messages and any offer waiting on him. |
| `/offer/[offerId]` | GET/POST | session | The sender accepts or declines a stake. |
| `/healthz` | GET | — | `SELECT 1`; 200 `ok`, or 503. No body detail. |

### 5.3 Behaviour that is not obvious

- **The sender notice, terms clause 2, above the send box, always visible, not
  behind a link:** «رسالتك بتوصل للمستلم بدون اسمك، بس مربوطة بحسابك عندنا.»
  `DESIGN.md` item 2 requires this and it is the sentence that keeps «سرية»
  honest for the person whose expectation is at stake.
- **A disabled link** (`enabled = false`) renders a plain "this link is off"
  page, not an error and not the owner's name.
- **You cannot send to your own link.** The send page tells the owner so
  instead of rendering the box.
- **Blocked senders see success.** `sendConfession` already returns a
  success-shaped result for a blocked sender and writes nothing. The UI must
  render the ordinary "sent" confirmation. Do not special-case it, do not log
  it, do not add a counter that would reveal it.
- **Rate-limit errors** render a plain Arabic "you have sent a lot, try later"
  — the limit numbers are not shown.
- **The offer composer** (inbox, per message) takes the question for the sender
  and the recipient's own staked answer in one form. Both required, both
  min 2 characters. Copy comes from `COPY-ar.md`'s question/stake sets, offered
  as pickable suggestions with a free-text field.
- **`/offer/[offerId]`** shows the question and the stake prompt and **not** her
  answer, then Accept (with a required answer) or Decline. Decline is
  terminal, no nag, no penalty — `DESIGN.md`.
- Every Server Action re-reads the session server-side and re-checks ownership
  through the domain function. **No ownership decision is made from a form
  field.**

### 5.4 `/privacy` must not out-run the schema

The privacy page states, in Arabic and English, exactly what is stored: the
Facebook account id and display name of both sides, the message text, the hour
(not the minute) it was sent, and the terms acceptance. It states that the
administrators can see who sent a message and that every such lookup is
logged. It states what is **not** collected: IP address, device, browser,
location, contacts.

**That last sentence is a promise the code has to earn, and §1 rule 1 is what
earns it. If any code in this slice reads a request IP, the sentence comes out
of the page in the same commit.** Same tripwire discipline as clause 1.

---

## §6. Tests (a different agent than the one that wrote the code)

The build law: the hand that writes a thing does not write the proof of it.

- `test/06-accounts-terms.test.ts` — account creation is a transaction;
  no `accounts` row without a `terms_acceptances` row; re-acceptance appends
  rather than updates; `ageAttested18: false` throws and writes nothing.
- `test/07-sent-view.test.ts` — **a pending offer's recipient answer is absent
  from `JSON.stringify(getSentForSender(...))`**, and present once resolved.
- `test/08-recipient-actions.test.ts` — block/report/hide each reject a
  non-owner; `blockSenderOfConfession` returns `undefined`; a blocked sender's
  subsequent send writes no row while returning success-shaped.
- `test/09-session.test.ts` — the cookie signer: a tampered payload, a
  tampered signature, a foreign secret and an expired `iat` are all rejected;
  a valid one round-trips.
- `test/10-env.test.ts` — `ALLOW_DEV_LOGIN=1` with a production-looking
  `APP_ORIGIN` refuses to start.
- `test/11-slug.test.ts` — the alphabet contains no `0/1/i/l/o`; 10,000 slugs
  are unique; character distribution is not modulo-biased.

All tests run against real Postgres via PGlite, as week 2 does. `npm test` runs
everything, old and new. **A failing test is reported as a failing test. It is
never edited to pass, and neither is the code it accuses, unless the accusation
is correct.**

---

## §7. Deploy (the master, not a subagent)

- Multi-stage `Dockerfile`, `node:22-alpine`, `output: 'standalone'`, non-root
  user, `HEALTHCHECK` on `/healthz`.
- `docker-compose.yml`: `web` + `postgres:17-alpine`. Web publishes on
  `127.0.0.1:8182` only. Postgres publishes **nothing** — internal network only.
  `json-file` logging, 10 MB × 3, on both services.
- Migrations run at container start, before the server listens, from the
  checked-in `drizzle/*.sql` in order. A failed migration exits non-zero.
- `deploy.sh` verifies after deploying and exits non-zero if the check fails.
- Verification is `bin/asam.sh check stg.confession.fayad.app` from outside,
  over the real certificate. A `curl` to `127.0.0.1` on the server is not
  verification.
- After the deploy, and before the slice is called done: read the container
  logs and the reverse-proxy configuration and **write down what is actually
  logged about a request, and for how long.** If a sender's IP is being written
  anywhere with a confession's link slug beside it, the privacy contract is
  broken in production regardless of what the schema says, and that is a
  finding, not a footnote.

---

## §8. The one input only Sam holds

A Facebook App ID and App Secret, from a Meta app created under his own
Facebook account. Nothing in this slice can create one — it needs his login.
Until they exist, `/auth/facebook/*` is dark on staging and the dev login is
the only way in, which is exactly why the dev login exists.

Asked for once, plainly, with the exact steps. Not three times.
