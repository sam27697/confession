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
