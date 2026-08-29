# SPEC — week 7: the admin surface

*Frozen 2026-08-29, before any code. Written by the session master, not by the
agent that implements it. Sections §1–§5 are the contract; §6 is the test list
that a different agent writes from this document without reading the
implementation.*

---

## §0 Why this slice, and what is actually broken

Sam's decision of 2026-08-25 10:29 — «وبدي الادمن يعرف المرسل مين .. حساب
المرسل بقصد» — is the reason this product's anonymity is recipient-facing only.
It is written into the schema, into `STACK.md`, and into terms clause 1, which
is **live on the public internet right now** at
`https://confession.fayad.app/terms` and `/privacy`.

Measured on `main` (aa9813d) before writing this:

1. `getAdminInbox` and `adminReveal` exist in `src/views.ts` / `src/actions.ts`
   and are covered by week 2's tests. **No route in `app/` calls either of
   them.** `grep -ri admin app/` returns exactly one hit, and it is a sentence
   in the privacy page. So the capability Sam asked for by name exists in the
   database and is reachable by no human being.
2. There is **no admin identity of any kind**. `getAdminInbox` takes an
   `adminAccountId` and ignores it; `adminReveal` takes one and writes it to the
   audit log without checking it means anything. Nothing distinguishes an
   administrator from any other account, because nothing has ever needed to.
3. `reports` is a **write-only table**. `reportConfession` inserts into it and
   `app/inbox/actions.ts` calls that. Nothing anywhere reads it. The report path
   that `BRIEF.md` lists as baseline abuse mitigation currently ends in a table
   no operator can open, which makes it a button that does nothing visible.

So the live site tells the public that administrators can see who sent a
message and that every such look is recorded. Both halves are true only in the
degenerate sense that nobody can look at all. Week 7 makes the sentence true the
way a user would read it.

**Scope discipline.** Disabling an account from the admin surface is *not* in
this slice, even though terms clause 4 promises it and
`SenderAccountDisabledError` already enforces it in the send path. It needs
either new columns on `accounts` or a second audit table, and the honest
version of that is its own slice. Week 7 is read, reveal, and reports.

---

## §1 Schema — `drizzle/0002_admin.sql`, hand-written

One new file. `scripts/migrate.mjs` runs **each file in one transaction**, so
nothing in this migration may be a statement Postgres refuses inside a
transaction (this is why the administrator is not a new value on the `provider`
enum: `ALTER TYPE ... ADD VALUE` is exactly that statement).

```sql
CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  disabled_at   timestamptz,
  CONSTRAINT admin_users_username_nonblank
    CHECK (length(btrim(username)) >= 3),
  CONSTRAINT admin_users_password_hash_is_scrypt
    CHECK (password_hash LIKE 'scrypt$%')
);

ALTER TABLE admin_reveal_log
  ADD COLUMN admin_user_id uuid REFERENCES admin_users(id);

ALTER TABLE admin_reveal_log
  ALTER COLUMN admin_account_id DROP NOT NULL;

ALTER TABLE admin_reveal_log
  ADD CONSTRAINT admin_reveal_log_exactly_one_actor
  CHECK ((admin_account_id IS NULL) <> (admin_user_id IS NULL));
```

### §1.1 Why the administrator is not a row in `accounts`

Rejected, in writing:

- **`accounts.is_admin boolean`** — makes the operator a product user. An
  administrator would then be a thing that can own a link, receive confessions
  and be a sender, and `test/02-tripwire-columns.test.ts` would be guarding a
  table that has stopped being only about the people the privacy promise is
  about. Rejected.
- **A `'local'` value on the `provider` enum** — `ALTER TYPE ... ADD VALUE` and
  the one-transaction-per-file migration runner. Rejected on that alone.
- **`provider='facebook'` with a fake `provider_user_id`** — a lie in a column
  named `provider`. Rejected.
- **Changing `admin_reveal_log.admin_account_id` to point at `admin_users`** —
  rewrites the foreign key of an append-only audit table and breaks week 2's
  passing tests. Rejected. The nullable-pair-plus-CHECK above keeps the
  "exactly one actor, always recorded" guarantee without touching what already
  works.

### §1.2 The constraint that carries the guarantee

`admin_reveal_log_exactly_one_actor` is the point of the pair of columns. The
audit table's whole purpose is that a reveal cannot happen without a record of
**who** and **why**; making one column nullable without the CHECK would open a
row with neither actor set, which is the failure the table exists to prevent.
`reason` keeps its existing `length(btrim(reason)) >= 8` CHECK from
`0001_constraints.sql` and its append-only trigger, both untouched.

### §1.3 No existing test may be modified

`test/01-migration.test.ts` asserts table presence with `includes`, not set
equality, and asserts migration ordering against the directory listing rather
than a hardcoded file list. No test asserts `admin_account_id` is `NOT NULL`.
Therefore **this slice requires zero edits to any file under `test/` that
already exists.** If the implementer believes an existing test must change, the
implementer stops and reports it rather than changing it.

---

## §2 Admin authentication

### §2.1 `src/admin-auth.ts` — no database, no framework

Pure functions over strings, testable with `node:test` and nothing else, in the
style of `src/session.ts`.

```ts
export const ADMIN_SESSION_MAX_AGE_MS: number   // 8 * 60 * 60 * 1000

export function adminSessionKey(sessionSecret: string): string
export type AdminSessionPayload = { adminUserId: string }
export function signAdminSession(sessionSecret: string, payload: AdminSessionPayload): string
export function verifyAdminSession(sessionSecret: string, token: string, nowMs?: number): AdminSessionPayload | null

export function hashAdminPassword(password: string): string
export function verifyAdminPassword(password: string, stored: string): boolean
export function isAdminPasswordHash(value: string): boolean
```

**The session key is derived, not configured.** `adminSessionKey(secret)` is
`createHmac('sha256', secret).update('confession-admin-session-v1').digest('base64')`.
Reasons: no new required environment variable on either stack, and a
domain-separated key means a valid user `sid` cookie can never be replayed as an
`admin_sid` and vice versa, because the two are signed under different keys.
`signAdminSession` / `verifyAdminSession` reuse `signPayload` / `verifyPayload`
from `src/session.ts` — the HMAC is implemented once in this repo, and week 4
already paid for the version of this project where it was implemented twice.

`verifyAdminSession` returns `null` on any parse failure, any signature
mismatch, an `iat` in the future, an `iat` older than
`ADMIN_SESSION_MAX_AGE_MS`, or a payload whose `adminUserId` is not a non-empty
string. It never throws and never distinguishes the reason.

**Eight hours, not seven days.** A user session is a convenience; an admin
session is a key to every sender's identity in the product. It expires the same
working day.

### §2.2 Password hashing

`hashAdminPassword` uses `node:crypto` `scryptSync` — no dependency is added to
this project for this.

- Parameters: `N=16384, r=8, p=1`, `maxmem` raised as required for those
  parameters, 32-byte derived key, 16-byte salt from `randomBytes`.
- Stored format, exactly:
  `scrypt$<N>$<r>$<p>$<base64url(salt)>$<base64url(key)>`
- `verifyAdminPassword(password, stored)` parses the stored string, recomputes
  with the *stored* parameters and salt, and compares with `timingSafeEqual`.
  It returns `false` — never throws — on a malformed string, an unknown
  algorithm prefix, a bad base64url field, non-integer parameters, or a length
  mismatch.
- `isAdminPasswordHash(value)` is the same parse without the comparison, used
  by `src/env.ts` §2.4 to reject a misconfigured deploy at startup instead of at
  the first login attempt.

### §2.3 `src/admin.ts` — the database half

```ts
export type AdminUser = { id: string; username: string; disabledAt: Date | null }

export async function findAdminUserByUsername(
  db: Db, { username }: { username: string },
): Promise<{ id: string; username: string; passwordHash: string; disabledAt: Date | null } | null>

export async function getAdminUserById(
  db: Db, { adminUserId }: { adminUserId: string },
): Promise<AdminUser | null>

export async function authenticateAdmin(
  db: Db, { username, password }: { username: string; password: string },
): Promise<AdminUser | null>
```

`authenticateAdmin` returns `null` — with no distinction whatsoever between the
cases — for an unknown username, a wrong password, or a `disabled_at` that is
not null. A caller cannot learn from the return value whether the username
exists. It must **not** short-circuit the hash computation when the username is
unknown; it verifies against a fixed dummy hash instead, so that "no such user"
and "wrong password" cost the same wall-clock time.

`getAdminUserById` returns `null` for a disabled admin, so that disabling an
administrator invalidates an already-issued cookie on the next request rather
than eight hours later.

### §2.4 Environment — `src/env.ts`

Two new optional variables, added to the `Env` type:

```ts
adminBootstrapUsername: string | null
adminBootstrapPasswordHash: string | null
adminEnabled: boolean          // === (adminBootstrapUsername !== null)
```

Rules, all fail-closed, all enforced in `loadEnv` so the process refuses to
start rather than misbehaving later:

1. If exactly one of `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD_HASH`
   is set, `loadEnv` throws. Half-configured admin access is a
   configuration error, not a state to run in.
2. If `ADMIN_BOOTSTRAP_PASSWORD_HASH` is set and `isAdminPasswordHash` rejects
   it, `loadEnv` throws, naming the expected format and **not** echoing the
   value.
3. `ADMIN_BOOTSTRAP_USERNAME`, when set, must satisfy the same
   `length(btrim(...)) >= 3` the database CHECK enforces, so the two cannot
   disagree.
4. Every existing rule in `loadEnv` — the `SESSION_SECRET` length floor, the
   `ALLOW_DEV_LOGIN` origin check — is unchanged.

**No plaintext password is ever an environment variable, a build argument, a
compose value or a log line. The server holds a scrypt hash and nothing else.**

### §2.5 Bootstrap — `scripts/bootstrap-admin.mjs`, run by the entrypoint

Plain ESM JavaScript using `pg` directly, exactly like `scripts/migrate.mjs`,
copied into the runtime image the same way and invoked from
`docker-entrypoint.sh` **after** the migration step and before the server
starts.

- If `ADMIN_BOOTSTRAP_USERNAME` is unset, it prints one line saying admin access
  is not configured and exits 0. It is not an error to run a stack without an
  administrator.
- Otherwise it runs
  `INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`
  and exits 0. Idempotent, and doubles as the password-rotation path: change the
  hash in the stack's `.env`, redeploy, done.
- It prints the username and nothing else. **It must not print the hash**, and
  there is no code path in it that can print a password because it never has
  one.
- It performs no hashing. That is the reason the hash is generated off the
  server: `hashAdminPassword` is implemented once, in TypeScript, in
  `src/admin-auth.ts`, and this script never needs a second copy of it. Week 4's
  two-implementations-of-one-HMAC defect is not repeated here.

`scripts/hash-admin-password.ts` is the developer-side counterpart: reads a
password from **stdin** (never `argv`, which is visible in `ps`), prints the
hash on stdout and nothing else, and is never shipped in the runtime image.

### §2.6 Brute force — `src/admin-throttle.ts`

```ts
export const ADMIN_MAX_FAILURES: number      // 5
export const ADMIN_LOCKOUT_MS: number        // 15 * 60 * 1000

export type ThrottleState = Map<string, { failures: number; firstFailureMs: number; lockedUntilMs: number }>
export function createThrottle(): ThrottleState
export function isLockedOut(state: ThrottleState, username: string, nowMs?: number): boolean
export function recordFailure(state: ThrottleState, username: string, nowMs?: number): void
export function clearFailures(state: ThrottleState, username: string): void
```

Keyed on the **username**, never on an IP address, a header or a
device — reading a request header for any purpose is forbidden by §4.4 and by
the build-enforced tripwire from week 6, and that rule does not get an exception
because the request in question is a login.

Honest limitation, stated here rather than discovered later: this is
process-local memory. It resets when the container restarts and it does not
coordinate across replicas. There is one replica and there is no plan for a
second. It raises the cost of an online guessing attack against a strong
password; it is not a defence against a distributed one, and scrypt is what
actually carries that weight.

---

## §3 The surfaces

All under `app/admin/`. Mobile-first, same as every other surface in this app
(his instruction 2026-08-28: «للموبايل بس»), Arabic-first copy.

### §3.0 The kill switch, and it is externally observable

**When `env.adminEnabled` is false, every route under `/admin` returns HTTP
404** — not 401, not a redirect, not a login page. A stack with no administrator
configured must be indistinguishable from a build that has no admin surface at
all.

This is the same control shape as `/auth/dev`, which answers 404 on production
and 303 on staging, and it is verified the same way: from outside the box, over
the real certificate, with a control request that proves the probe itself works.

### §3.1 `GET /admin/login`, `POST /admin/login`

- GET renders a form: `username`, `password`, submit. If the request already
  carries a valid `admin_sid`, 307 to `/admin` instead.
- POST: if `isLockedOut`, re-render with the generic message. Otherwise
  `authenticateAdmin`. On failure, `recordFailure` and re-render with **one
  fixed message for every failure case** — «اسم المستخدم أو كلمة السر غير
  صحيحة» — that does not distinguish unknown user, wrong password, disabled
  account, or lockout. On success, `clearFailures`, set `admin_sid`, 303 to
  `/admin`.
- The password field's value is never echoed back into the re-rendered form.

**`admin_sid` cookie attributes:** `HttpOnly`, `SameSite=Lax`, `Path=/admin`,
`Max-Age` = `ADMIN_SESSION_MAX_AGE_MS / 1000`, and `Secure` whenever
`env.appOrigin` starts with `https://`. `Path=/admin` means the admin cookie is
not attached to any request for a public page, including `/c/<slug>`.

### §3.2 `GET /admin` — the masked list

Requires a valid `admin_sid`; otherwise 307 to `/admin/login`.

Lists confessions newest first, capped at 50, via a **new** view function —
`getAdminInbox` is not modified, so week 2's test 03 keeps passing against the
function it was written for:

```ts
// src/views.ts
export async function getAdminInboxPage(
  db: Db, { limit, offset }: { limit: number; offset: number },
): Promise<AdminConfession[]>
```

`AdminConfession` is the existing type and keeps `senderMasked: true` as a
literal, so the type itself still cannot carry a sender id.

Each row shows: the confession body, `created_hour` (hour-truncated, as
stored), the status, a link count-free identifier, and a **reveal form** —
a reason textarea and a submit button. No sender name, no sender id, no
account id, no avatar, nowhere on this page, ever.

### §3.3 `POST /admin/reveal` — the only place an identity appears

A route handler at `app/admin/reveal/route.ts`, not a server action, and it
returns HTML directly rather than redirecting. That is deliberate and it is the
mechanism that enforces §4.2: the revealed identity exists only in the body of
the response to the POST that wrote the audit row. There is no URL that renders
it again, and a refresh re-posts and writes a **new** audit row, which is the
correct behaviour — a second look is a second look.

- Requires a valid `admin_sid` (404 when admin is disabled, 307 to
  `/admin/login` when unauthenticated).
- Reads `confessionId` and `reason` from `formData`.
- If `reason.trim().length < 8`, it re-renders the form with an error and
  **writes nothing**. The database CHECK is the backstop, not the validation.
- Otherwise calls:

```ts
// src/actions.ts — NEW, alongside the existing adminReveal, which is not changed
export async function adminRevealByAdminUser(
  db: Db,
  { adminUserId, confessionId, reason }: { adminUserId: string; confessionId: string; reason: string },
): Promise<AdminRevealedSender>
```

Same single transaction as the existing `adminReveal`: insert the log row
first, then read the identity, so a failure to record the look rolls back the
look. The existing account-based `adminReveal` is retained unchanged and unused
by any route; it is the path for the day an administrator is a Facebook account,
and deleting it would mean editing a passing test to suit new code.

- The response renders with `renderToStaticMarkup` from `react-dom/server` —
  JSX, so escaping is the framework's job and not a template string's. It shows
  the sender's display name, the sender's account id, the reason just recorded,
  and a link back to `/admin`. It sets `Cache-Control: no-store`. See §3.3.1.

### §3.3.1 Amendment, 2026-08-29, before any code was written

The frozen text of §3.3 also required a `Referrer-Policy` response header on the
reveal response. **That requirement is withdrawn**, and the reason is worth more
than the header was.

`test/14-share-card.test.ts` carries week 6's build-enforced tripwire: it walks
`app/` and `src/` and fails on any file whose text matches a deliberately blunt
regex over request-metadata terms. The withdrawn header's own name is one of
those terms, so setting it in a route under `app/` turns that guard red. The two
ways out were to withdraw a header worth very little here (the reveal page links
only to same-origin `/admin` and loads no third-party resource) or to loosen the
regex of a passing guard so that new code could pass. The second is editing the
proof, so it was never available.

The same collision applies to prose: several sentences in this document would
trip the tripwire if they were pasted into a comment under `app/` or `src/`.
That is a property of a blunt guard, and the guard is worth more than the
convenience of quoting the spec verbatim in a comment.

### §3.4 `GET /admin/reports` — the reader that makes the report button real

Requires a valid `admin_sid`.

```ts
// src/admin.ts
export type AdminReportRow = {
  reportId: string
  confessionId: string
  body: string
  createdHour: Date
  status: 'delivered' | 'hidden_by_recipient' | 'reported'
  reason: string
  createdAt: Date
  senderMasked: true
}
export async function getAdminReports(db: Db, { limit }: { limit: number }): Promise<AdminReportRow[]>
```

Newest first. **Neither the sender nor the reporter is identified in this
list.** The sender is masked because §4.1 says every list is; the reporter —
`reports.reported_by_account_id` — is left out because the operator does not
need it to act on a report, and a column that is not selected cannot leak. Each
row carries the same reveal form as §3.2, so acting on a report goes through the
same logged reveal as everything else.

### §3.5 `POST /admin/logout`

Clears `admin_sid` with the same attributes and a `Max-Age=0`, 303 to
`/admin/login`. Present in the layout of every admin page.

---

## §4 The privacy rules, as constraints

These are not guidelines for the implementer. Each one has a test in §6.

**§4.1 Masked by default.** No list surface — `/admin`, `/admin/reports` — may
contain a sender account id, a sender display name, or a provider user id, in
the HTML, in a `data-` attribute, in a hidden input, or in a serialised props
payload. The only identifier a list may carry is `confessions.id`, which
identifies a message and not a person.

**§4.2 An identity appears only as the direct response to a write.** The
revealed sender is rendered by the POST that recorded the reveal, and by nothing
else. It is not written into the session cookie, not into a query string, not
into any store that survives the response, and there is no GET that renders it.

**§4.3 No look without a record.** The audit insert and the identity read are
one transaction, the reason is validated before the write and constrained in the
database, and `admin_reveal_log_exactly_one_actor` makes an actor-less row
impossible.

**§4.4 No request metadata, on any admin path.** No IP address, no user agent,
no referrer, no `X-Forwarded-For`, no `headers()` read for any purpose other
than reading the `admin_sid` cookie itself. Week 6's build-enforced tripwire
greps `app/` and `src/` for header reads; the admin code is inside its scope and
that test must stay green without being relaxed.

**§4.5 Time stays truncated.** The admin sees `created_hour` as stored. There is
no more precise timestamp anywhere in the schema to show, and none is added.

**§4.6 The cookie separation is cryptographic.** A valid user `sid` presented as
`admin_sid` must fail verification, and vice versa, because of the derived key
in §2.1 — not because of a check on the payload shape.

---

## §5 Deploy

- Staging first, then production. Both stacks get admin enabled, with
  **different passwords**.
- `ADMIN_BOOTSTRAP_USERNAME` and `ADMIN_BOOTSTRAP_PASSWORD_HASH` go into each
  stack's `.env` on the server. The hash is generated in the build container by
  `scripts/hash-admin-password.ts`; the plaintext never touches the server, the
  repository, a compose file or a log.
- `docker-compose.yml` needs **no change**. Its `confession-web` service already
  declares `env_file: - .env`, so both new variables reach the container by
  existing behaviour. Verified by reading the file, not assumed.
- `scripts/check-deploy-pairing.sh` is **not** extended. Its five fields are the
  ones that decide which hostname serves which data; the admin variables do not
  belong to that pairing and adding them would dilute a guard that currently has
  exactly one job.
- Verification is from outside, through the real certificate, in the run report:
  a status code for `/admin/login` on both hosts, and the 404-when-disabled
  control demonstrated rather than asserted.

---

## §6 The tests — written by a different agent, from this document

`test/15-admin-auth.test.ts` and `test/16-admin-surface.test.ts`. The author of
these files does not write the implementation and does not read it before
writing them.

1. **Migration.** `0002_admin.sql` applies to a fresh database; `admin_users`
   exists; `admin_reveal_log` has `admin_user_id`; `admin_account_id` is
   nullable. (§1)
2. **The exactly-one-actor CHECK.** A row with both actors null is rejected. A
   row with both actors set is rejected. Each single-actor row is accepted. (§1.2)
3. **`admin_users` CHECKs.** A two-character username is rejected; a
   `password_hash` not beginning `scrypt$` is rejected. (§1)
4. **Password round-trip.** `verifyAdminPassword(p, hashAdminPassword(p))` is
   true; a wrong password is false; two hashes of the same password differ
   (random salt). (§2.2)
5. **`verifyAdminPassword` never throws.** `''`, `'scrypt$'`, `'scrypt$a$b$c$d$e'`,
   a bcrypt-looking string, a truncated base64 field, and a hash with a
   correct-format but wrong-length key all return `false`. (§2.2)
6. **Cookie separation.** A token from `signSession` fails `verifyAdminSession`
   under the same `SESSION_SECRET`; a token from `signAdminSession` fails
   `verifySession`. (§4.6)
7. **Admin session expiry.** Valid at 7h59m, `null` at 8h01m, `null` for an
   `iat` in the future, `null` for a payload with an empty `adminUserId`. (§2.1)
8. **`authenticateAdmin` does not distinguish.** Unknown username → `null`;
   known username with a wrong password → `null`; correct password on a
   `disabled_at` row → `null`; correct password on a live row → the `AdminUser`.
   (§2.3)
9. **`getAdminUserById` refuses a disabled admin**, so an issued cookie dies
   with the account. (§2.3)
10. **Throttle.** Five failures lock the username; a sixth attempt is locked out
    even with the right password at the route layer; the lock expires after
    `ADMIN_LOCKOUT_MS`; `clearFailures` releases it; one username's failures do
    not lock another. (§2.6)
11. **`loadEnv` fail-closed.** Username without hash throws; hash without
    username throws; a malformed hash throws and **the thrown message does not
    contain the supplied value**; both absent is valid with
    `adminEnabled === false`; both present and well-formed gives
    `adminEnabled === true`. (§2.4)
12. **`getAdminInboxPage` masks.** Every returned row has `senderMasked === true`
    and `JSON.stringify` of the result contains neither the sender's account id
    nor the sender's display name — asserted against the *string*, not against
    the absence of a key. Ordering is newest first and `limit` is respected. (§4.1)
13. **`getAdminReports` masks both sides.** `JSON.stringify` of the result
    contains neither the sender's account id, nor the sender's display name, nor
    the reporter's account id. The report reason and the confession body are
    present. (§3.4, §4.1)
14. **`adminRevealByAdminUser` writes exactly one audit row** with the given
    `admin_user_id`, a null `admin_account_id`, and the given reason, and
    returns the sender's id and display name. A second call writes a **second**
    row. (§3.3, §4.3)
15. **A reveal that cannot be recorded does not happen.** A blank or
    seven-character reason rejects at the database and the transaction returns
    no identity. (§4.3)
16. **The existing `adminReveal` still works unchanged**, writing
    `admin_account_id` with a null `admin_user_id` — the retained path of §3.3.
17. **`created_hour` is what the admin sees.** The value returned by
    `getAdminInboxPage` is truncated to the hour. (§4.5)
18. **`bootstrap-admin.mjs` never prints a password**, and contains no reference
    to a plaintext password variable: a source-level assertion over the file,
    plus the assertion that the file contains no `scrypt` implementation of its
    own. (§2.5)
19. **No header reads in the admin code.** Week 6's tripwire covers `app/` and
    `src/`; this adds the explicit assertion that no file under `app/admin/`
    references `x-forwarded-for`, `user-agent`, `referer`, or `request.ip`, and
    that the only `headers()`/`cookies()` use is for `admin_sid`. (§4.4)
20. **`/admin` is 404 when admin is disabled** — asserted at the level the tests
    can reach (the guard function that the routes call), with the live external
    404-vs-200 proof carried in the run report rather than in the suite.

The suite must be green before deploy, and the master re-runs it rather than
accepting a report of it.

---

## §7 Finding, 2026-08-29, from running it: §3.3's rendering mechanism does not build

The container build fails, and it fails on a design decision in §3.3 of this
document, not on the implementation of it:

```
Failed to compile.
Error: x You're importing a component that imports react-dom/server. To fix it,
render or return the content directly as a Server Component instead for perf
and security.
> Build failed because of webpack errors
```

Next refuses `react-dom/server` anywhere in the `app/` module graph. §3.3 chose
`renderToStaticMarkup` precisely so that escaping would be the framework's job
rather than a template string's, and the framework declines to be used that way
from a route handler.

**The slice is therefore NOT deployed and NOT verified against a running
system.** What did not happen is written here rather than smoothed over.

The three candidate repairs, none of which was taken tonight because each is
security-relevant and the session's budget no longer allowed writing it *and*
having a different agent prove it:

1. **Hand-built HTML with an escape helper.** Smallest change. It replaces the
   framework's escaping with about fifteen lines of new, unproven code on the
   one surface in this product that renders an attacker-influenced string (a
   display name that came from Facebook) to an authenticated operator. Writing
   that at the end of a budget, with no independent test, is how the defect
   class this project reviews for gets introduced.
2. **A Server Action returning the identity into `useActionState`.** Builds, but
   it puts the revealed identity into a client component's state and into the
   RSC payload, where it survives client-side navigation until a reload. That
   weakens §4.2 from "exists only in the response to the write" to "exists in
   the browser until something clears it", and §4.2 is the rule that makes the
   audit log meaningful.
3. **A GET page keyed on a reveal id written by the POST.** Preserves escaping
   and builds, at the cost of a second table and a URL that renders an identity
   more than once. §4.2 exists to prevent exactly that URL.

Option 3 with a single-use, immediately-consumed token is the most likely
answer, and it is a design decision that belongs in a frozen spec written
before the code, which is where the next session starts.

### §7.1 A second unproven thing, hidden behind the first

Every other module under `app/` reaches `src/` through a re-export wrapper in
`app/_lib/domain/`. The admin routes do not: `app/admin/**` imports `src/*`
directly, because §2 and §3 listed the files to create and that list did not
include wrappers.

`tsc --noEmit` is happy with those imports. **Whether webpack agrees has never been tested**, because the build never got past the `react-dom/server` error in
§7. Week 4 lost most of a session to precisely this gap, where webpack and tsc
disagreed about module resolution and only the container build could tell the
difference.

So the next session should expect two build problems, not one, and should not
read a green typecheck as evidence about either.

---

## §8 The repair, frozen 2026-08-29 before any code

*Written by the session master after re-measuring §7 and §7.1, not by the agent
that implements it. §8.6 is the test list that a different agent, working in a
separate worktree, writes from this document without reading the
implementation.*

### §8.0 What was re-measured first

Both claims in §7 were reproduced by hand on `week7/admin-surface` at `3a58e75`
before any decision was taken.

1. **§7 stands.** `npx next build` fails on
   `app/admin/reveal/route.tsx:9`, verbatim: *"You're importing a component that
   imports react-dom/server."* One file, one line, and the build stops there.
2. **§7.1 does not stand, and this is the useful half.** The prediction was two
   build problems. `app/admin/reveal/route.tsx` was temporarily replaced with a
   handler that keeps every direct `src/*` and `app/_lib/domain/*` import and
   drops only the JSX, and the build then **succeeded**, emitting all twenty
   routes including `/admin`, `/admin/login`, `/admin/logout`, `/admin/reports`
   and `/admin/reveal`. So webpack resolves `app/admin/**` → `src/*` exactly as
   `tsc` does, the `extensionAlias` in `next.config.mjs` covers it, and **no
   re-export wrappers under `app/_lib/domain/` are needed or will be added.**
   The probe was reverted; the tree was clean before and after.

There is one problem, not two. §7.1's worry is closed by measurement rather than
by being designed around, and the cost of not measuring it would have been a
wrapper layer built for a resolution failure that does not happen.

### §8.1 The decision, and why the other four lost

**Option 1 of §7 is taken: the reveal response is built by an escaping tagged
template, in `app/admin/_lib/html.ts`.** §7 called this "about fifteen lines of
new, unproven code" and refused to write it at the end of a budget with no
independent proof. That objection was about the *proof*, not about the
mechanism, and this session has the budget the last one did not: the escaper is
written by one agent and attacked by another, from this document, in separate
worktrees.

The rest of §8 exists to make "hand-rolled escaping" a claim the build checks
rather than a thing an implementer got right. Two properties do that work:

- **The escaper cannot be bypassed by accident, because of the type system.**
  `html` returns a branded `SafeHtml` value, not a `string`, and the only
  function in the codebase that builds an HTML response for an admin route
  accepts `SafeHtml` and nothing else. A concatenated string is a type error at
  the point of use, not a review finding.
- **The contexts the escaper does not cover are forbidden, not trusted.** A
  five-character replacement set is complete for HTML text and for
  double-quoted attribute values, and is *not* complete inside `<script>`,
  inside `<style>`, in a URL-bearing attribute, in an event-handler attribute,
  or in a tag or attribute name. §8.4 bans every one of those in admin
  HTML-producing code and §8.6 item 9 fails the build if one appears.

**Option 2 — a Server Action into `useActionState` — stays rejected**, on §7's
own reasoning: it puts the revealed identity into the RSC payload and into a
client component's state, where it survives client-side navigation. §4.2 says
the identity exists only in the response to the write.

**Option 3 — a GET page keyed on a single-use reveal id — is rejected, and it is
worse than §7 estimated.** §7 called it "the most likely answer". Re-argued
here, it fails on three counts and the third is new:

1. It needs a second table holding, however briefly, a row that pairs a
   confession with a revealed identity — the exact shape the schema has avoided
   since week 2.
2. §4.2 says in terms that there is no GET that renders the identity. Option 3
   is that GET. Single-use narrows the window; it does not change the sentence.
3. **§3.3.1 makes it leak.** The reveal URL would be the `Referer` of every
   same-origin navigation off that page, starting with the link back to
   `/admin` that the page is required to carry — and the `Referrer-Policy`
   header that would contain it was *withdrawn* in §3.3.1, because its own name
   trips week 6's request-metadata tripwire. So option 3 would put a
   reveal-bearing URL into browser history and into request headers, on a
   surface whose entire purpose is that a look is recorded exactly once and
   rendered exactly once.

**Option 4 — `text/plain` — is rejected, and it is recorded because it is the
strongest option on security alone.** A plain-text response cannot be injected
into at all; escaping stops being a question by construction. It loses on the
product side: the operator is on a phone (his instruction «للموبايل بس»), and a
text/plain response has no link back to `/admin`, no legibility, and no RTL. The
gap between option 4 and a *proven* option 1 is small enough that the usable
surface wins; had §8.6 been unaffordable this session, option 4 and not option 1
would have been the honest fallback.

**Option 5 — importing `react-dom/server.edge` or `react-dom/server.node` to get
past the check, or hiding the import behind a dynamic `await import()` — is
rejected on principle and is not to be attempted.** Next's rule is a deliberate
guard; routing around a guard so that new code can pass is the same move as
loosening a test's regex, which §3.3.1 already refused once in this document. It
would also be undefined behaviour across any Next release.

### §8.2 `app/admin/_lib/html.ts` — the whole of the escaping surface

```ts
export type SafeHtml = { readonly __safeHtml: string }

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml
export function htmlResponse(document: SafeHtml, status: number): Response
export function revealDocument(title: string, body: SafeHtml): SafeHtml
```

**`html`** interleaves the literal chunks of the template — which are trusted,
because they are source text — with the interpolated values, which are not. For
each value:

- `null` and `undefined` produce the empty string. **`false` also produces the
  empty string**, so that `cond && html\`...\`` is a legal fragment.
- A `SafeHtml` is inserted verbatim and **is not escaped again**. This is what
  makes nesting work and it is the one place the type brand is load-bearing.
- An array is mapped element-wise by these same rules and joined with `''`.
- Anything else is `String(value)` and then escaped.

**The escape function replaces exactly five characters and nothing else:**

| in | out |
|----|-----|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

`&` is replaced first, or every other replacement is double-escaped. No other
codepoint is touched: Arabic text, emoji and astral-plane characters pass
through byte-for-byte, because the document is served as UTF-8 and mangling a
display name is its own kind of wrong answer.

**`htmlResponse`** takes a `SafeHtml` — never a `string`, and this is the
enforcement point — and returns a `Response` with
`Content-Type: text/html; charset=utf-8` and `Cache-Control: no-store`. It
throws a `TypeError` on a value that is not a `SafeHtml` at runtime as well, so
a caller that reaches it through `any` still fails.

**`revealDocument`** wraps a body fragment in the full document: `<!DOCTYPE
html>`, `<html lang="ar" dir="rtl">`, charset and viewport meta, an escaped
`<title>`, and a **static** `<style>` block. Static means literally constant:
§8.4 forbids interpolation inside `<style>`, and a constant block is not
interpolation. The style block carries the same palette as `app/globals.css`
(`--bg: #14121a`, `--panel: #1e1b26`, `--border: #322d3d`, `--text: #ece8f5`,
`--muted: #a79fc0`, `--accent: #d98a4a`) and the same system font stack, because
a route handler's response does not pass through `app/layout.tsx` and therefore
gets no stylesheet. No `@import`, no external URL, no `<script>` anywhere.

### §8.3 `app/admin/reveal/route.tsx` becomes `route.ts`

The file is renamed — there is no JSX in it any more, and a `.tsx` extension
with no JSX is a lie about the file. Its behaviour is **unchanged from §3.3 and
must not be re-litigated here**: the 404 on `env.adminEnabled === false`, the
`requireAdminUserId` redirect, the `reason.trim().length < 8` re-render that
writes nothing, the single-transaction `adminRevealByAdminUser`, and the three
rendered outcomes (reason too short → 400, reveal failed → 400, revealed → 200)
all stay exactly as they are. Only the rendering mechanism changes.

The Arabic copy of the three outcomes is carried over verbatim from the current
file. The success page still shows the display name, the account id, the reason
just recorded, and a link to `/admin`, in that order.

### §8.4 The rules the escaper does not cover, and which are therefore banned

Inside any file under `app/admin/` that produces HTML through `html`:

1. **Every attribute value is double-quoted.** Single-quoted and unquoted
   attribute values are forbidden, because `&#39;` and the space-terminated
   unquoted form respectively make the five-character set incomplete.
2. **No interpolation into a URL-bearing attribute** — `href`, `src`, `action`,
   `formaction`, `srcset`, `poster`, `data`, `cite`. The reveal page's only link
   is the literal `/admin`. Escaping does not stop `javascript:`.
3. **No `<script>` element and no event-handler attribute** (`on*`), with or
   without interpolation.
4. **No interpolation inside `<style>`**, and no interpolation of a tag name, an
   attribute name, or a `<!--` comment.
5. **No `dangerouslySetInnerHTML`** anywhere under `app/admin/`.

These are not style preferences. Each one names a context in which the five
replacements of §8.2 are provably insufficient, and §8.6 item 9 enforces the
list against the source.

### §8.5 What does not change

`src/`, `drizzle/`, `scripts/`, the six existing admin files other than the
reveal route, and every test from 01 to 16 are untouched. If a change to any of
them looks necessary, that is a finding to report, not a change to make: the 106
pre-existing tests and the 20 §6 items are the proof that week 7's behaviour
survived this repair, and editing them to accommodate it would destroy the only
evidence that it did.

### §8.6 The test list — `test/17-admin-html.test.ts`

Written from this document by an agent that has not read `app/admin/_lib/html.ts`
or the rewritten route, in its own worktree.

1. **Character sweep.** For every codepoint from 0 to 0x2FF, and for the set
   `{U+0600 Arabic block sample, U+1F600, U+10FFE}`: the output of
   `` html`${c}` `` equals the input character verbatim **unless** it is one of
   the five, and equals exactly the mapped entity when it is. Nothing else is
   altered, and the length of the output for a non-special character is the
   length of the input.
2. **Ordering.** `` html`${'<'}` `` is `&lt;`, not `&amp;lt;`. `` html`${'&lt;'}` ``
   is `&amp;lt;`. Escaping the already-escaped is visible, not silent.
3. **Payloads.** `<script>alert(1)</script>`, `"><script>alert(1)</script>`,
   `'><img src=x onerror=alert(1)>`, `</title><script>`, `</textarea>`,
   `" onmouseover="alert(1)`, `javascript:alert(1)` as a text value, and a
   500-character name: for each, the output contains no `<` and no `"` that did
   not come from a literal chunk of the template, and the payload is present in
   escaped form.
4. **The brand.** A `SafeHtml` interpolated into another `html` template is
   inserted verbatim; the equivalent plain `string` with the same content is
   escaped. An object shaped like `{ __safeHtml: '<script>' }` that was not
   produced by `html`… is out of scope: the brand is a compile-time guarantee,
   and the test asserts the runtime behaviour that `html` produces, not that
   forgery is impossible.
5. **Value kinds.** `null`, `undefined` and `false` render empty; `0` renders
   `0` and not empty; an array of `SafeHtml` joins with no separator; a nested
   array is handled or rejected, and whichever it is, it is asserted.
6. **`htmlResponse` refuses a string.** Called through `as any` with `'<b>'`, it
   throws a `TypeError` and does not return a `Response`. Called with a
   `SafeHtml`, it returns 200/400 as given, `Content-Type: text/html;
   charset=utf-8`, and `Cache-Control: no-store`.
7. **The type is the enforcement.** A source-level assertion over
   `app/admin/_lib/html.ts` that `htmlResponse`'s first parameter is typed
   `SafeHtml` and not `string`.
8. **The document.** `revealDocument` with a title and body containing
   `<script>alert(1)</script>` as a *value*: the result starts with
   `<!DOCTYPE html>`, contains `lang="ar"`, `dir="rtl"`, `charset`, exactly one
   `<title>`, and **no `<script`** substring at all. The escaped payload is
   present as `&lt;script&gt;`.
9. **§8.4 enforced against the source.** Walk every file under `app/admin/`:
   none contains `dangerouslySetInnerHTML`; none contains a `<script`; none
   contains an `on[a-z]+=` event-handler attribute; none interpolates into a
   URL-bearing attribute (`(href|src|action|formaction|srcset|poster|cite)="\$\{`
   or the JSX `={` equivalent with a non-literal); no `<style>` block in
   `_lib/html.ts` contains `${`. Each violation names the file and the rule.
10. **`text/html` has one origin.** No file under `app/admin/` other than
    `_lib/html.ts` contains the string `text/html`.
11. **Nothing was renamed away.** `app/admin/reveal/route.tsx` no longer exists
    and `app/admin/reveal/route.ts` does; no file under `app/` or `src/`
    imports `react-dom/server` in any form, including `server.edge`,
    `server.node`, `server.browser`, and a dynamic `import(`.

Items 1–8 are behaviour; 9–11 are the build-enforced half, in the shape week 6's
tripwire established. The suite must be green **and** the container build must
succeed before anything is deployed, and the master re-runs both rather than
accepting a report of either.

### §8.2.1 Amendment, 2026-08-29, during integration

§8.2 enumerated six CSS variables for the static style block and `--danger` was
not among them, so the implementer read the omission as deliberate and coloured
the error line with `--accent`. It was an oversight, not a decision:
`app/globals.css` defines `--danger: #c25a5a` and styles `.error` with it, and
the reveal route's error line is the operator's only failure surface. The
variable is added and the block now carries seven. This is recorded rather than
quietly changed because the implementer's reasoning was correct given what the
spec said, and the spec is what was wrong.

### §8.4.1 Amendment, 2026-08-29, from running the tests: `action` is two
different things

§8.6 item 9 said "walk every file under `app/admin/`", which is broader than
§8.4's own scope sentence ("inside any file under `app/admin/` that produces
HTML through `html`"). The test author followed item 9, correctly, and the URL
attribute guard went red on `app/admin/login/page.tsx`:

```
<form action={adminLoginAction} className="card">
```

**That file is not defective.** In hand-built HTML a form's `action` is a URL
string and interpolating into it is exactly what §8.4 rule 2 exists to stop. In
JSX, `action={fn}` is React's server action form: the value is a function
reference that never reaches the document as a URL at all. One attribute name,
two unrelated meanings, and the spec conflated them.

**The resolution, and why it is a correction and not a loosening.** The broad
walk over every file under `app/admin/` is kept, because JSX is not a safe
context for a URL — React does not sanitise `javascript:` in an `href` — and
narrowing the guard to only the `html`-producing files would have thrown that
coverage away to fix a false positive. Instead `action` is removed from the JSX
pattern only, and stays in the template-literal pattern. `href`, `src`,
`formaction`, `srcset`, `poster` and `cite` remain in both.

The guard was then mutation-checked rather than trusted: `href={EVIL}` injected
into `app/admin/page.tsx` turns it red, and the source restored turns it green.

### §8.6.1 Amendment, 2026-08-29: the package name is banned from the prose too

Item 11's guard greps `app/` and `src/` for the banned renderer's package name
in any form. Both new files named it **in a comment**, explaining why it is not
imported, and the guard fired. Same fork as §3.3.1, and the same answer: the
comments changed, the guard did not. A text-match guard that cannot tell an
import from a comment catches import forms nobody has thought of yet, and that
is worth more than the convenience of naming the package in prose. The comments
now say what they mean without the literal string, and say why.

Mutation-checked: reintroducing the literal into `html.ts` turns item 11 red.

---

## §9 Two defects found by deploying it, 2026-08-29, frozen before any repair

*Written by the session master after measuring both on the running staging
stack. Neither was found by a test, by a review or by reading the code. Both
were found by putting the thing on the server and using it over the public
internet, which is the reason that step is not optional.*

### §9.0 What was measured

**Defect 1: the deploy refuses to run once an admin is configured.**
`ADMIN_BOOTSTRAP_PASSWORD_HASH` was appended to `/srv/apps/confession/.env`
in the format §2.2 specifies, `scrypt$16384$8$1$<salt>$<key>`, and the next
`./repo/deploy.sh` died on its own third line with, verbatim:

```
./.env: line 10: $1: unbound variable
```

`deploy.sh` reads the stack's configuration with `set -a; . ./.env; set +a`
under `set -euo pipefail`. Sourcing is not parsing: bash expands the right hand
side of every assignment in that file. The scrypt format is `$`-separated by
design, so `$16384`, `$8` and `$1` were expanded as positional parameters,
`set -u` saw `$1` unset, and the script exited before it built anything. The
deploy failed closed, which is the only good thing about it.

**The narrow reading of this defect is a quoting problem in one file on one
server. The wide reading is the one that matters:** `. ./.env` gives every
value in that file the full power of the shell. A `POSTGRES_PASSWORD`
containing a backtick or `$(...)` would not be a syntax error, it would be
command execution as `deploy` at deploy time, from a file whose entire purpose
is to hold secrets that nobody reviews. Nothing in this project generates such
a value today. The repair is not that it might.

**Defect 2: `POST /admin/logout` sends the operator to the container's own
bind address.** Measured from outside, over the real certificate:

```
logout status=303
location: https://0.0.0.0:3000/admin/login
```

`app/admin/logout/route.ts` builds the target with
`new URL('/admin/login', request.url)`. Inside the container `request.url` is
built from the process bind address, `HOSTNAME=0.0.0.0` and `PORT=3000`, not
from the hostname the request was actually sent to. The `Set-Cookie` clearing
`admin_sid` is correct and does arrive, so the session really does end, but a
browser following that `Location` lands on a dead address. **The logout button
works and looks broken**, which is the worst pairing of the two: the operator
sees a failure page and has no way to tell that the session was destroyed.

Every other redirect in the admin surface was re-checked and every one of them
is relative (`location: /admin/login?error=invalid`, `location: /admin`). This
route is the only one that constructs an absolute URL, because it is the only
one that builds its response with `NextResponse.redirect`, which requires one.

### §9.1 The repairs

**Defect 1, in `deploy.sh`: stop sourcing the file, read the five keys it
needs.** The script needs `STACK_NAME`, `HOST_PORT`, `APP_ORIGIN` and
`ALLOW_DEV_LOGIN`, and nothing else. Every other value in `.env` is the
container's business and reaches it through compose's `env_file`, which parses
rather than executes. A new helper, `scripts/read-env-key.sh`, takes a file and
a key and prints the value with no expansion of any kind, stripping one layer
of matching single or double quotes if present. `deploy.sh` calls it four times
and never sources anything.

Rejected, in writing:

- **Quote the value in `.env` and move on.** It unblocks tonight and leaves the
  next person to find out the same way, with a worse value. It also does not
  touch the execution problem at all. Rejected as a repair, used only as the
  temporary unblock that let this session measure the rest of the slice, and
  recorded here as such.
- **`set +u` around the source.** Turns a loud failure into a silent one:
  `$16384` would expand to empty and the hash would reach compose truncated.
  The container would then refuse to start on a malformed hash (§2.4 rule 2),
  which is at least fail-closed, but the operator would be debugging a hash
  that was correct in the file. Rejected.
- **`export $(grep -v '^#' .env | xargs)`.** The common recipe, and it is worse
  than what is already there: `xargs` applies its own quote and backslash
  rules, and word-splitting mangles any value with a space. Rejected.
- **A `.env` parser in Node, called from `deploy.sh`.** Correct, and it puts a
  Node process and a second parsing implementation into the one script that
  has to work when the application does not. Rejected on that.

**Defect 2, in `app/admin/logout/route.ts`: build the target from
`env.appOrigin`,** the value the stack is already configured with, already
validated by `loadEnv`, and already the source of truth for absolute URLs in
the share card (week 6). The route keeps its 303 and keeps its cookie clear.

Rejected, in writing:

- **A hand-built `new Response` with a relative `Location`.** Valid per
  RFC 7231 and it is what the login action already emits. Rejected because it
  drops `NextResponse`'s cookie handling, and the cookie clear is the part of
  this route that must not break while fixing the part that is cosmetic.
- **Reading the forwarded host header.** Forbidden outright by §4.4, which does
  not get an exception for convenience, and the week 6 tripwire would turn red.
  It is also the wrong answer: the app knows its own origin from configuration
  and does not need to be told by a request.

### §9.2 What this says about the tests, and it is not comfortable

Both defects sit in code that 149 passing tests walked straight past, and the
reason is the same in both cases: **every test in this repository exercises the
application in-process, and neither defect exists in-process.** `request.url` is
whatever the test constructs, and `deploy.sh` is never executed by anything.
`test/13-deploy-pairing.test.ts` runs `check-deploy-pairing.sh` as a real
subprocess and proves the pattern is available; nothing extended it to the
script that calls it.

That is the gap §9.3 closes. It does not close the general form of it. The
honest statement is that this project's suite proves the domain layer and
proves the HTML, and that the deploy path and anything derived from a real
request's transport are covered by deploying and looking, which is a slower
loop with a human in it.

### §9.3 The tests, written by a different agent from this document

Appended to `test/13-deploy-pairing.test.ts` for the deploy half and to
`test/17-admin-html.test.ts` for the route half. The author does not read the
repair.

1. **`read-env-key.sh` does not expand.** A file containing
   `K=scrypt$16384$8$1$abc$def` yields that string byte for byte on stdout.
2. **It does not execute.** A file containing `K=$(touch /tmp/pwned-<unique>)`
   and a second containing a backtick form both yield the literal text, and the
   file the substitution would have created does not exist afterwards.
3. **It strips exactly one layer of matching quotes.** `K='v'` and `K="v"` both
   yield `v`; `K=''v''` yields `'v'`; `K='v` yields `'v` unchanged, because the
   quotes do not match.
4. **It is exact about keys.** With `KEY=a` and `OTHER_KEY=b` in one file,
   asking for `KEY` yields `a`, never `b` and never both. A `#` comment line
   whose text contains the key is not matched. A missing key yields empty
   output and exit 0, because absent and empty are the same thing to
   `deploy.sh`'s existing `:?` checks, which stay where they are.
5. **The last assignment wins**, matching what sourcing did, so replacing the
   mechanism does not silently change which value a duplicated key resolves to.
6. **`deploy.sh` no longer sources `.env`.** The file's text contains no
   `. ./.env` and no `source` of it, and does contain a call to the helper.
   A blunt text guard, and it is the one that would have caught this defect
   before the server did.
7. **`app/admin/logout/route.ts` does not build its target from the request.**
   The file's text contains no `request.url`, and the redirect target is
   derived from the configured origin. Same blunt shape as item 6, same reason.

### §9.4 Deploy, restated for the rest of this session

Staging is redeployed on the repaired tree and `POST /admin/logout` is measured
again from outside: the `Location` must be the public hostname. Production is
then deployed **twice on purpose**: first with no admin variables in its `.env`,
to demonstrate §3.0's kill switch as a 404 on a build that has the routes, and
then with a **different** username and password from staging's. Both hostnames
carry the same code and different credentials, which is the whole point of §5.

---

## §10 Two findings from deploying the repair, 2026-08-29, frozen before any repair

*Both were found the same way §9's pair were: by putting the thing on the
server and driving it over the public internet. Neither is a regression from
§9's repair, and neither is repaired in this session. Writing a fix for either
at the end of a budget, with no independent test, is the defect class this
project reviews for, so both are frozen here instead.*

### §10.0 Finding 1: logout clears the cookie and revokes nothing

`app/admin/_lib/session.ts` holds no session store. `admin_sid` is a signed
token over `{ adminUserId }`, verified by `verifyAdminSession` against a key
derived from `SESSION_SECRET`, and nothing else is consulted. So
`POST /admin/logout`, which §3.5 specifies as "clear the cookie, 303 to the
login page", does exactly that and no more: the token itself stays valid for
the whole of `ADMIN_SESSION_MAX_AGE_MS`.

Measured on staging, from outside, with a control:

```
captured an admin_sid of 143 chars
A. logout with the cookie jar updated:  GET /admin = 307   (a browser is fine)
B. the token captured BEFORE logout:    GET /admin = 200   (still valid)
C. the same token with one byte changed: GET /admin = 307  (the probe is real)
```

C is the part that makes B a finding rather than noise: a tampered token is
rejected, so B's 200 is a genuine signature check and not a surface that
answers 200 to anything.

**This is not a §3.5 violation.** §3.5 asked for a cookie clear and got one.
It is an undocumented property of the surface that reveals identities, and the
gap is that nobody wrote down what logout is worth. Stated plainly: a copy of
the cookie taken before logout — from a shared machine, a proxy, a backup, a
browser profile — is an admin session until it expires.

Candidate repairs, none chosen tonight:

- **A `logged_out_before` timestamp on `admin_users`**, set by logout, checked
  on every verify. One column, one index-free lookup already being made, and
  it revokes every outstanding token for that operator at once. Costs a
  database read on each admin request, which the admin surface can afford and
  the public surface could not.
- **A server-side session table.** Complete, and it puts a per-request write
  path next to the one surface whose whole design principle is that it reads
  identities only under audit. More moving parts than the problem needs.
- **Shorten `ADMIN_SESSION_MAX_AGE_MS`.** Reduces the window, does not close
  it, and trades an operator's session length for a property it does not
  actually buy. Rejected as a repair; it is a mitigation at best.

Whichever is chosen, the test is the three-request probe above, run against a
deployed stack, because it does not exist in-process — the same lesson §9.2
already recorded.

### §10.1 Finding 2: the kill switch leaks route existence through the method

§3.0 requires that with `env.adminEnabled` false, "every route under `/admin`
returns HTTP 404" and that the stack be "indistinguishable from a build that
has no admin surface at all". Measured on production, deployed from the
admin-carrying build with no admin variables in its `.env`:

```
POST /admin/reveal        404      <- the handler runs and the kill switch works
POST /admin/logout        404
GET  /admin               404
GET  /admin/login         404
GET  /admin/reveal        405      <- and this is the leak
GET  /admin/logout        405
GET  /admin/nosuchthing   404      <- what an absent route answers
```

`reveal` and `logout` are `route.ts` files exporting only `POST`. Next answers
a `GET` to them with 405 before any handler runs, so `env.adminEnabled` is
never consulted. A build with no admin surface would answer 404 to that same
request. The method dimension therefore tells an unauthenticated stranger that
this deployment contains an admin surface.

**Severity, stated honestly and not inflated:** it exposes no data, grants no
access, and does not bypass the kill switch — the method those routes actually
accept answers 404. What it costs is the indistinguishability §3.0 asked for
in its own words.

Candidate repairs, none chosen tonight:

- **Export the other methods from both route files**, each returning 404 when
  disabled. Explicit, local, and it duplicates the same guard in more places.
- **A `middleware.ts` matching `/admin/:path*`** that returns 404 when the
  admin variables are absent. One place, catches every current and future
  admin route including ones nobody remembers to guard, and it is the only
  option that makes the guard structural rather than per-file. It needs care:
  middleware runs on the edge runtime and must not read a request header for
  any purpose, which §4.4 forbids and week 6's tripwire enforces.
- **Leave it and amend §3.0.** Rejected. The sentence in §3.0 is the control
  Sam's privacy contract leans on; weakening the spec to match the code is
  backwards, and this project has a rule against it.

The test is the probe table above, from outside, on a stack with admin
disabled, with `GET /admin/nosuchthing` kept as the control row.

### §10.2 One more thing the deploy found, and it was repaired

`deploy.sh` was stored `100644` in git while both §5 and its own header
document invoking it as `./repo/deploy.sh`. Every transfer that unpacks a
clean `git archive` landed it non-executable, so the documented line failed
with `Permission denied` and only ever worked because somebody had chmod'd it
on the server by hand after an earlier upload. The mode is now carried in git.
Small, and it is the kind of thing that only shows up the first time somebody
deploys from a clean tree rather than editing the one already on the box.
