# SPEC — week 9: admin session revocation, and two defects the deploy path hides

*Frozen 2026-08-29, before any code was written. Every measurement below was
taken by the session that wrote this document, from outside the box, over the
real certificate, against the running staging stack on image
`confession-web:f13a55e` — the same image production is running.*

Four items. Two were frozen by week 7's spec §10 and left deliberately
unrepaired. Two are new, and both were found the same way everything in this
project gets found: by driving the real thing and watching it break.

---

## §0 What was measured first, and by whom

Nothing here is carried over from a report. Each table below was produced
during this session.

### §0.1 Finding A reproduces exactly as §10.0 recorded it

Staging, admin enabled, over `https://stg.confession.fayad.app`:

```
token: 143 chars
  before logout, the captured token on GET /admin: 200
  POST /admin/logout with that token:               303
  A. a browser after logout (no cookie):            307
  B. the token captured BEFORE logout, replayed:    200   <- the finding
  C. the same token with one byte changed:          307   <- the control
```

C is what makes B a finding rather than noise: a tampered token is refused,
so B's 200 is a genuine signature check and not a surface that answers 200 to
anything.

### §0.2 Finding B is wider than §10.1 recorded — five times wider

§10.1 probed `GET` only, and concluded the leak was two rows. The full method
sweep, run against staging with the admin surface **disabled** (the same image,
recreated with `ADMIN_BOOTSTRAP_*` removed from `.env`):

```
  GET     /admin                 404      GET     /admin/reveal      405  <-
  POST    /admin                 404      POST    /admin/reveal      404
  PUT     /admin                 404      PUT     /admin/reveal      405  <-
  PATCH   /admin                 404      PATCH   /admin/reveal      405  <-
  DELETE  /admin                 404      DELETE  /admin/reveal      405  <-
  OPTIONS /admin                 400  <-  OPTIONS /admin/reveal      204  <-

  GET     /admin/login           404      GET     /admin/logout      405  <-
  POST    /admin/login           404      POST    /admin/logout      404
  PUT     /admin/login           404      PUT     /admin/logout      405  <-
  PATCH   /admin/login           404      PATCH   /admin/logout      405  <-
  DELETE  /admin/login           404      DELETE  /admin/logout      405  <-
  OPTIONS /admin/login           400  <-  OPTIONS /admin/logout      204  <-

  GET     /admin/reports         404      GET     /admin/nosuchthing 404
  POST    /admin/reports         404      POST    /admin/nosuchthing 404
  PUT     /admin/reports         404      PUT     /admin/nosuchthing 404
  PATCH   /admin/reports         404      PATCH   /admin/nosuchthing 404
  DELETE  /admin/reports         404      DELETE  /admin/nosuchthing 404
  OPTIONS /admin/reports         400  <-  OPTIONS /admin/nosuchthing 404
```

`/admin/nosuchthing` is the control: it is what an absent path answers, and it
answers 404 to all six methods. **Thirteen rows differ from the control.**

Two of them are worse than a bare 405:

```
$ curl -X OPTIONS https://stg.confession.fayad.app/admin/reveal
HTTP/2 204
allow: OPTIONS, POST
```

That does not merely say "a route exists here". It names the method the hidden
route accepts.

And the three `OPTIONS ... 400` rows on the page routes are a dimension §10.1
never looked at. A control says they are not an admin-specific behaviour —
`OPTIONS /terms`, `OPTIONS /privacy` and `OPTIONS /` all answer 400 too, while
`OPTIONS /definitely-not-a-page` answers 404. Next rejects an unsupported
method on a page route before the page component runs, so `env.adminEnabled`
is never consulted and the kill switch cannot reach it from inside a page file.

### §0.3 Finding C, new: Compose silently truncates the one credential this deploy carries

Found by causing it. This session rotated the staging administrator's password
by writing the new hash into `/srv/apps/confession/.env` with

```
printf 'ADMIN_BOOTSTRAP_PASSWORD_HASH=%s\n' "$HASH" >> .env
```

and recreating the container. Staging went to 503 and stayed there. Measured:

```
value in /srv/apps/confession/.env  : 83 bytes   (sha256 875a75ff…)
value inside confession-web         : 16 bytes   (sha256 2861eba8…)
```

Masked so the shape is visible and the secret is not (`a` = letter,
`9` = digit):

```
in the file       aaaaaa$99999$9$9$aa9aaa9aaaaaaaaaa9_9aa$aa9a9aaaaaaaaaaaaaa9aaaaaaaa9aaaaaaaaaaaaaa
in the container  aaaaaa$99999$9$9
```

A scrypt hash is `scrypt$N$r$p$salt$key` — **the `$` is part of the format**.
Docker Compose interpolates `$NAME` in `env_file` values. `$16384`, `$8` and
`$1` are digit-led and survive; `$<salt>` and `$<key>` are letter-led, so
Compose read them as references to undefined variables and replaced both with
nothing.

Production is unaffected, and the reason is the whole finding:

```
prod  .env line : 85 bytes   ->  container: 83 bytes
stg   .env line : 83 bytes   ->  container: 16 bytes
```

Production's value is **wrapped in single quotes**, which suppresses
interpolation; the two extra bytes are the quotes. Staging's was not, because
this session wrote it by hand and nothing told it to.

**Nothing in this repository says that value must be quoted.** Not
`docker-compose.yml`, not `deploy.sh`, not `scripts/bootstrap-admin.mjs`, not
`docs/SPEC-week7-admin.md` §2.4 or §2.5, not the README. Week 8's two `.env`
lines were quoted by whoever typed them and it worked; the next hand-written
line is a coin toss whose losing side is a stack that cannot start.

Restoring the value with single quotes, and nothing else, brought staging back:

```
container hash length now: 83
stg healthz:               200
```

### §0.4 Finding D, new: that failure was invisible, and it did not have to be

While staging was down, the entire diagnostic the running system offered was
this line, repeated once per health check:

```
healthz check failed Error
```

`src/env.ts` had in fact detected the exact problem and thrown a precise
message for it:

> `ADMIN_BOOTSTRAP_PASSWORD_HASH is not a valid scrypt hash of the form scrypt$N$r$p$salt$key (spec §2.4)`

That message is **already designed to be safe to print** — spec §2.4 rule 2
requires that "the malformed value is never included in the thrown message,
only the expected shape". It was thrown, caught by `app/healthz/route.ts`, and
reduced to `err.name`, which for a plain `Error` is the word `Error`.

The narrowing in `healthz` is correct and stays: that handler cannot know
whether an error came from `getEnv()` or from a query whose message might
carry a confession body. The defect is that **nothing validates the
environment at startup**, where the error is known to be a configuration
error and its message is known to be safe.

`docker-entrypoint.sh` runs `migrate.mjs` and `bootstrap-admin.mjs`, both of
which read `DATABASE_URL` from `process.env` directly and neither of which
calls `loadEnv`. So a stack can migrate, provision an administrator, print
`entrypoint: starting web server`, report `Ready in 318ms` — and be incapable
of serving a single request.

**One thing this finding is not.** `deploy.sh` would have caught it: it waits
for the container to report healthy and then curls `/healthz`, and it fails on
anything but 200. This session bypassed `deploy.sh` and called
`docker compose up` directly, which is why the breakage reached a running
stack. The deploy pipeline is sound. What is missing is the *reason*: even
through `deploy.sh`, the operator's evidence would have been a 503 and the
word `Error`.

---

## §1 Finding A — the repair: `admin_users.logged_out_before`

### §1.1 The decision

Add a nullable `logged_out_before timestamptz` to `admin_users`. `POST
/admin/logout` sets it. Every admin request compares the session token's `iat`
against it and refuses a token issued at or before that instant.

**Why this one, over §10.0's other two candidates.**

The deciding argument is not in §10.0, and it is measurable in the code as it
stands: `app/admin/_lib/auth.ts` **already** calls `getAdminUserById` on every
protected admin request, and that function already runs a
`select … from admin_users where id = $1 limit 1`. The revocation column is
one more field in a `SELECT` that is already being issued. The repair costs
zero additional round trips.

- **A server-side session table** — rejected. It is complete, and it puts a
  per-request write path next to the one surface whose design principle is
  that it reads identities only under audit. It also adds a table, a cleanup
  concern and an expiry sweep to solve a problem one column solves.
- **Shortening `ADMIN_SESSION_MAX_AGE_MS`** — rejected, as §10.0 already
  rejected it. It narrows the window and never closes it, and it charges the
  operator a shorter working day for a guarantee it does not buy.

### §1.2 The clock, and it is deliberately not the database's

`logged_out_before` is written from the **application** clock
(`new Date()` in the route handler), not from Postgres `now()`.

The value is compared against `iat`, which `src/session.ts` stamps with
`Date.now()` in the web process. Comparing a Postgres-clock timestamp against a
Node-clock timestamp means any skew between the two becomes either a token that
survives logout (skew one way) or an operator who cannot log back in (skew the
other). Both clocks being the same host's clock today is a property of the
current deployment, not of the design. One clock stamps both sides.

### §1.3 The comparison is `<=`, and it fails closed

A token is refused when `logged_out_before !== null` and
`token.iat <= logged_out_before`.

`<=` rather than `<` so that a token issued in the same millisecond as a logout
is refused rather than honoured. The cost is an operator who logs out and logs
back in inside the same millisecond getting one rejected session and a working
one on the next attempt. The alternative cost is a token that survives the
logout that was supposed to kill it. This is the direction to fail in.

### §1.4 What changes

1. **`drizzle/0003_admin_logout.sql`**, hand-written like `0001` and `0002`,
   one statement:
   `ALTER TABLE admin_users ADD COLUMN logged_out_before timestamptz;`
   Nullable with no default: null means "this operator has never logged out",
   which is the correct state for every existing row and for every new one.
   Nothing in `drizzle/0000` or `0001` or `0002` is edited (spec week 7 §1.3
   stands: no existing migration and no existing test is modified).

2. **`src/schema.ts`** — the column on the `adminUsers` table.

3. **`src/admin-auth.ts`** — `verifyAdminSession` must return the token's
   `iat`. `verifyPayload` already returns `T & { iat: number }` and
   `verifyAdminSession` currently discards it. The return type becomes
   `{ adminUserId: string; issuedAtMs: number } | null`. Every existing caller
   destructures `adminUserId` and is unaffected.

4. **`src/admin.ts`**
   - `getAdminUserById` selects `loggedOutBefore` and returns it on `AdminUser`.
   - New `revokeAdminSessions(db, { adminUserId, at })` — sets
     `logged_out_before = at` for that row. Takes the instant as an argument;
     it does not call `new Date()` itself, so a test can pin it (§1.2).

5. **`app/admin/_lib/auth.ts`** — `requireAdminUserId` refuses per §1.3 and
   redirects to `/admin/login`, in exactly the same way and with exactly the
   same response as an absent or invalid cookie. A revoked session and a
   forged one are indistinguishable to the client.

6. **`app/admin/logout/route.ts`** — before clearing the cookie: verify the
   presented `admin_sid`; if it is valid, call `revokeAdminSessions` with
   `new Date()`. Then clear the cookie and 303, exactly as now.
   - An absent, malformed or already-revoked cookie still gets the identical
     303 and the identical cookie clear. Logout tells the caller nothing about
     whether it was carrying a real session.
   - The database write failing must not turn logout into a 500 that leaves
     the cookie in place. If the revoke throws, the cookie is still cleared and
     the 303 is still returned, and the error is logged as its **class only**,
     matching `app/healthz/route.ts`.

### §1.5 What this does not claim

It revokes **every** outstanding token for that operator, not just the one
presented. That is a deliberate property and worth stating: an administrator
logged in on a phone and a laptop who logs out of one is logged out of both.
For a surface whose sessions are keys to every sender's identity, that is the
behaviour to want, and it is the behaviour to write down rather than discover.

It does **not** revoke on password rotation. `scripts/bootstrap-admin.mjs`
updates `password_hash` and leaves `logged_out_before` alone, so a token issued
before a password change stays valid until it expires. Named here as a known
limit rather than left to be found; not repaired in this slice.

---

## §2 Finding B — the repair, and the part of it that is not repaired

### §2.1 What is repaired: the ten rows that belong to route handlers

`app/admin/reveal/route.ts` and `app/admin/logout/route.ts` export only `POST`.
Next answers every other method itself, before any handler runs.

Both files gain the other five methods, all delegating to one shared helper so
the guard exists once:

**`app/admin/_lib/method-guard.ts`**, new:

```
adminMethodNotAllowed()  ->  404 when !env.adminEnabled
                             405 when env.adminEnabled
```

405 in the enabled case is what Next answers today, so an enabled stack's
behaviour is unchanged. Each route file then adds one line per method:

```ts
export const GET = adminMethodNotAllowed
export const PUT = adminMethodNotAllowed
export const PATCH = adminMethodNotAllowed
export const DELETE = adminMethodNotAllowed
export const OPTIONS = adminMethodNotAllowed
```

Exporting `OPTIONS` explicitly is what removes the `allow: OPTIONS, POST`
header, which is the most informative of the thirteen rows.

`HEAD` is not exported. Next derives `HEAD` from `GET`; with `GET` exported
and returning 404, `HEAD` returns 404 with no body. Stated so that its absence
from the list reads as a decision rather than an oversight.

### §2.2 What is NOT repaired: `OPTIONS` on the three page routes

The three `OPTIONS … 400` rows in §0.2 cannot be reached from a page file.
Next rejects the method at the router, before the component runs.

**The only mechanism that could close them is `middleware.ts`, and this slice
does not adopt it — for a reason, not from caution.** Middleware runs on the
Edge runtime. It cannot import `src/env.ts`, because that module transitively
imports `node:crypto`'s `scryptSync` through `isAdminPasswordHash`. So a
middleware guard would have to read `process.env.ADMIN_BOOTSTRAP_USERNAME`
itself, and **whether an Edge-runtime middleware in a `output: standalone`
build reads that variable at runtime or has it inlined at build time is a
question this session has not measured.** Getting it wrong is not a cosmetic
failure: one image is deployed to both environments and a build-time inlined
value would bake one stack's configuration into the other's.

Week 7 §7 is the precedent that makes this worth the paragraph. That session
chose `renderToStaticMarkup` on reasoning, the container build refused it, and
the slice ended PARTIAL. Choosing a second runtime mechanism on reasoning
rather than on a measurement would be the same mistake with a different name.

So: **three rows out of thirteen remain**, they are recorded here with the
control that proves them, and the measurement that would settle the middleware
question is named as the first thing week 10 does. `§3.0`'s
"indistinguishable" is not yet true and this document does not pretend it is.

Rejected: **amend §3.0 to match**. Rejected in §10.1 and rejected again. The
sentence is a control Sam's privacy contract leans on. Weakening the spec to
match the code is the failure this project reviews for.

---

## §3 Finding C — the repair: make the mangling impossible to ship

Three parts, none of them large.

1. **`scripts/check-deploy-pairing.sh` gains a sixth check.** It already reads
   the `.env` it is validating. It now also asserts that, for every key whose
   value contains a `$`, the value is single-quoted in the file. A value with a
   `$` and no single quotes is a deploy refused **before** the build, with a
   message that says what to do:

   > `ADMIN_BOOTSTRAP_PASSWORD_HASH contains '$' and is not single-quoted. Docker Compose interpolates $NAME in env_file values, so this value will reach the container truncated. Wrap it in single quotes.`

   Refusing before the build matters: the whole point of the pairing guard's
   position in `deploy.sh` is that a deploy that will be refused is refused
   before it spends four minutes compiling.

2. **The comment in `docker-compose.yml`, next to `env_file:`**, saying it in
   the file where the behaviour lives.

3. **The generator tells you.** `scripts/hash-admin-password.ts` prints the
   bare hash today. It gains one line on **stderr** — never stdout, which is
   piped — saying the value must be single-quoted in `.env`. stdout stays
   exactly one line so every existing `$(…)` use of it is unchanged.

Rejected: **stop using `env_file` and pass the hash through `environment:`
with `$$` escaping.** It moves the same trap somewhere less visible and makes
the `.env` file no longer the single description of a stack.

Rejected: **change the hash format so it contains no `$`.** The format is
already in two live databases and in a CHECK constraint
(`password_hash LIKE 'scrypt$%'`). Changing a stored credential format to work
around a shell-quoting problem is the tail wagging the dog.

---

## §4 Finding D — the repair: fail loudly, at startup, with the real reason

`docker-entrypoint.sh` gains a step before the migration, not after it: a
configuration check that calls `loadEnv()` and exits non-zero if it throws,
printing the thrown **message**.

Printing the message is safe here and only here, and the reason is specific:
every `throw` in `src/env.ts` is a configuration error whose message spec §2.4
rule 2 already requires to name only the expected shape and never the offending
value. That is not true of an arbitrary runtime error, which is why
`app/healthz/route.ts` keeps printing the class only. The two rules are
different because the two situations are different.

**`scripts/check-env.mjs`**, new, modelled on `migrate.mjs`:

- imports `loadEnv` from the built application, calls it, exits 0 silently on
  success and prints `check-env: <message>` to stderr and exits 1 on a throw;
- it prints **no variable values**, ever — only the thrown message;
- it runs **first** in `docker-entrypoint.sh`, before `migrate.mjs`, because a
  stack that cannot serve a request should not have written to the database.

The effect on tonight's outage, had it existed: instead of a container that
starts, reports healthy-then-unhealthy and logs `healthz check failed Error`
forever, the container exits immediately and `deploy.sh` prints
`ADMIN_BOOTSTRAP_PASSWORD_HASH is not a valid scrypt hash of the form
scrypt$N$r$p$salt$key`.

Note the ordering interaction with §3: the pairing guard catches the unquoted
value on the build host before the build; this catches **any** invalid
configuration inside the container, including one that never went through
`deploy.sh` at all — which is exactly the path this session took.

---

## §5 The tests — written by a different agent, from this document alone

The test author works in its own git worktree and does not read the
implementation. Same rule as weeks 6, 7 and 8, and for the same reason: week 7
recorded what happens when two agents share a tree.

New file `test/18-admin-hardening.test.ts`. Every item is numbered so a
failure names the clause it came from.

**Finding A**

1. `verifyAdminSession` returns `issuedAtMs`, and it equals the `iat` in the
   signed token.
2. `getAdminUserById` returns `loggedOutBefore: null` for a freshly bootstrapped
   administrator.
3. `revokeAdminSessions` sets the column to exactly the instant passed in.
4. A token whose `iat` is strictly **before** `logged_out_before` is refused by
   whatever function `app/admin/_lib/auth.ts` uses to make the decision, which
   must therefore be exported and pure — a boolean over
   `(issuedAtMs, loggedOutBefore)`, not something reachable only through
   `next/headers`.
5. A token whose `iat` is **exactly equal** to `logged_out_before` is refused
   (§1.3, the `<=`).
6. A token whose `iat` is **after** `logged_out_before` is accepted.
7. With `logged_out_before` null, every token is accepted.
8. `revokeAdminSessions` on one administrator does not alter another's row.
9. The migration is additive: after `0003`, `admin_users` still has every
   column `0002` created, and the `admin_users_password_hash_is_scrypt` and
   `admin_users_username_nonblank` constraints are still present.
10. `test/02-tripwire-columns.test.ts` still passes — `logged_out_before` is not
    an identity column and must not trip it. (Assert by running it, not by
    reading it.)

**Finding B**

11. `adminMethodNotAllowed` returns 404 when the admin surface is disabled.
12. It returns 405 when the admin surface is enabled.
13. `app/admin/reveal/route.ts` and `app/admin/logout/route.ts` each export
    `GET`, `PUT`, `PATCH`, `DELETE` and `OPTIONS`, and each of those exports is
    the shared helper — asserted by reading the module's exports, not its text.

**Finding C**

14. `check-deploy-pairing.sh` **rejects** an `.env` whose
    `ADMIN_BOOTSTRAP_PASSWORD_HASH` contains a `$` and is not single-quoted,
    and the message names the variable.
15. It **accepts** the same `.env` with the value single-quoted.
16. It accepts an `.env` with no `ADMIN_BOOTSTRAP_PASSWORD_HASH` at all (a
    stack with no administrator is legal — spec week 7 §2.5).
17. A value containing `$` under **any** key is rejected unquoted, not just
    the admin hash — the rule is about Compose, not about that one variable.
18. `scripts/hash-admin-password.ts` still prints exactly one line on stdout,
    and the quoting warning is on stderr.

**Finding D**

19. `scripts/check-env.mjs` exits 0 on a valid environment.
20. It exits 1, and prints the thrown message, for an
    `ADMIN_BOOTSTRAP_PASSWORD_HASH` that is a truncated scrypt hash —
    specifically the 16-byte `scrypt$16384$8$1` this session actually
    produced.
21. Its output contains **no** part of any environment variable's value. Assert
    with a canary: put a recognisable string in `SESSION_SECRET` and
    `POSTGRES_PASSWORD` and assert it appears zero times in stdout and stderr.
22. `docker-entrypoint.sh` invokes `check-env.mjs` before `migrate.mjs`
    (assert on the file's order of lines — this one is textual because the
    file is a shell script).

---

## §6 Deploy, and the probes that decide whether this shipped

Staging first, then production. No promotion that skipped staging.

1. `tsc --noEmit` exit 0, and the **whole** suite green, re-run by the master
   rather than taken from any agent's report.
2. Mutation check, not trust: revert §1.3's `<=` to `<`, and delete one method
   export from `reveal/route.ts`. Each must turn the suite red on the item that
   claims to catch it. Restore byte for byte and re-verify green.
3. Deploy staging through `./repo/deploy.sh` — **not** `docker compose`
   directly. Tonight is the evidence for why that matters.
4. Re-run §0.1's three-request probe against staging. Required: **B must now
   be 307**, A stays 307, C stays 307, and a fresh login still reaches 200
   before the logout.
5. Recreate staging with the admin variables removed and re-run §0.2's full
   method sweep. Required: every `/admin/reveal` and `/admin/logout` row 404;
   the three `OPTIONS … 400` page rows are expected to remain and are recorded,
   not hidden; `allow: OPTIONS, POST` gone.
6. Restore staging, verify 200 from outside, verify a real admin login and a
   real reveal still work end to end.
7. Promote to production, verify from outside, and re-run the three-request
   probe there. **Production's administrator password is Sam's and is not
   rotated by this session** — the probe therefore runs against a session
   obtained with the credentials already in place, or not at all, and if not,
   the report says so instead of implying otherwise.
8. Privacy re-check against both running systems after the traffic: log line
   counts and their content, no request-header reads, container log retention.

A deploy claim in the run report carries an external status code or it is not
a claim.
