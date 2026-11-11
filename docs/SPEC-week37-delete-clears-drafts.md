# Week 37 - deleting an account clears the drafts it left in the browser

Frozen 2026-11-11 21:5x +04, before any code. Measured on staging, which runs
the same tarball as production since week 36 (`04541f1`).

## §0 What was measured

### §0.1 A deleted person's draft is waiting in the guest box

Driven headless at 390x844 on `stg.masaraha.provefair.app`
(`work/confession-app/probes/w37-delete-draft.mjs`, workspace repo). Owner A
makes a link. Sender B signs in, types a draft on A's link (it goes to
`sessionStorage` `confession_draft_<slug>`, week 22), opens `/account/delete`
in the same tab, ticks the box and deletes:

- B lands on `/?deleted=1`, signed out. The draft key is **still there**.
- B's tab, now signed out, opens A's link again. Week 36's guest box restores
  the draft into the box: the deleted person's words, typed out, on a phone
  that is now nobody's. Whoever picks it up next can read it, or sign in and
  send it under their own account.
- A second tab of B's with its own draft on the same link keeps it too.
- «رجوع بلا حذف» and a submit with the box unticked keep the draft (correct).

Week 36 §6 recorded "Account deletion does not clear drafts in the tab (F1)"
and left it.

### §0.2 Logout already does this, and does it for every tab

Same browser, staging, measured tonight: a signed-in tab and a second tab each
hold a `confession_draft_` key; the first posts the logout form. Both keys are
gone, and the second tab's is still gone after a reload. The same holds when
the logout POST is made with `fetch()`: Chromium applies `Clear-Site-Data` on
a response to a script request, redirect included, and clears the origin's
`sessionStorage` in every tab. That is week 36 §5.2/§5.3: logout answers with
`Clear-Site-Data: "storage"` when the request carries the session cookie.

So today a person who signs out leaves less behind than a person who deletes
their account. Clause 6 is the stronger request.

### §0.3 Why the action cannot say it itself

`deleteAccountAction` (`app/account/delete/actions.ts`) is a Server Action.
Next gives an action no way to set a response header other than a cookie. The
middleware can: a header set on `NextResponse.next()` is carried onto the
response Next sends for that request. Both ways the deletion form is
submitted reach the middleware's matcher today: with script, a POST with a
`next-action` header and a multipart body; without, a native multipart POST
carrying `$ACTION_ID_<id>`.

## §1 The change

### §1.1 `src/storage-wipe.ts` (new)

```ts
export const ACCOUNT_DELETE_PATH = '/account/delete'
export function wipesStorage(method: string, pathname: string, hasSession: boolean): boolean
```

`true` exactly when `method === 'POST'`, `pathname === '/account/delete'`
and `hasSession`. Nothing else: no other path, no other method, no case or
trailing-slash variants, no reading of the body.

### §1.2 `middleware.ts`

After the three existing gates have let the request through, the middleware
returns `NextResponse.next()` as before, and when
`wipesStorage(request.method, request.nextUrl.pathname, request.cookies.has(SID_COOKIE))`
is true it sets `Clear-Site-Data: "storage"` on that response. The three gates
and their order do not change; a 403, 404 or 400 answer never carries the
header. The matcher does not change.

The cookie name is not written out a second time. `app/_lib/session.ts`
imports the session secret and the HMAC helpers, which have no business in
the middleware bundle, so `SID_COOKIE` moves to a new one-line module,
`src/sid-cookie.ts`, and `app/_lib/session.ts` re-exports it under the same
name. Every existing importer keeps working unchanged.

### §1.3 Why the session cookie is the gate

The same gate as logout (week 36 §5.3), for the same reason. A POST from
another site is turned away by the Origin gate (403) when it carries an
Origin, and the `sid` cookie is `SameSite=Lax`, so it is not sent on a
cross-site POST at all. A same-origin POST to `/account/delete` with a
session comes from this app's own deletion form: the page has one Server
Action form, and the header's logout form posts to `/auth/logout`.

### §1.4 When it fires, said plainly

The header is decided before the action runs, so it does not depend on the
outcome. The browser blocks a submit with the box unticked (`required`), so
in practice it fires when the person has ticked the box and pressed «احذف
حسابي». If the deletion then fails (`?error=generic`, a database fault) the
drafts are gone and the account is not. That is the accepted cost: someone
who has just asked to erase their account is not hurt by losing an unsent
draft, and deciding after the fact would need either a header from inside the
action (§0.3) or Next's internal redirect handling (§3).

No copy changes. The deletion page already says what is erased on the
server; drafts were never on the server.

## §2 What must not change

- Every existing middleware outcome for every request that is not a POST to
  `/account/delete` with a session: same status, same headers.
- The 403/404/400 answers, their order, and their bodies.
- The matcher.
- `deleteAccountAction`, its redirects, `/account/delete`'s page.
- Logout's behaviour (week 36 §5.3).
- Nothing new is logged. The middleware reads one cookie's presence, never
  its value, and writes nothing.

## §3 Rejected

- **Clearing `sessionStorage` from a submit listener in the page.** Clears
  one tab only; §0.1 measured a second tab keeping its draft, and logout
  clears all of them. It would also mean a new client hook on the deletion
  form for a weaker result.
- **A one-shot cookie set by the action and a header on the redirect
  target.** Works only because Next's action handler fetches the redirect
  target on the server and copies that response's headers onto the action
  response (`createRedirectRenderResult`, Next 15.5.24). That is internal
  behaviour with no contract, and a target that redirects again loses the
  header entirely.
- **A GET route that clears storage.** Any site can send a top-level GET
  with the Lax cookie attached, so a link anywhere could wipe a signed-in
  visitor's drafts.
- **Matching `confirm=on` in the body.** With script, React encodes the form
  fields under a reference prefix, so the field name is not stable to match,
  and the browser's `required` already covers the unticked case.
- **`Clear-Site-Data: "*"` or `"cookies"`.** The action already deletes the
  one cookie that matters; `"cookies"` would also drop cookies this slice has
  no reason to touch.

## §4 Acceptance

Unit (no server):

1. `wipesStorage('POST', '/account/delete', true)` is `true`.
2. It is `false` for each of: method `GET`, `PUT`, `post` (lowercase);
   path `/account/delete/`, `/account/DELETE`, `/account/delete/x`,
   `/account`, `/auth/logout`, `/`, `/c/x`; and `hasSession` false.
3. `middleware()` given a POST to `/account/delete` with a well-formed
   `next-action`, a valid multipart body, a same-origin `Origin` and a `sid`
   cookie passes it through (`x-middleware-next: 1`) with
   `Clear-Site-Data: "storage"`.
4. The same without the `sid` cookie: passes through, no `Clear-Site-Data`.
5. The same with a foreign `Origin`: 403, no `Clear-Site-Data`. With a
   malformed `next-action`: 404, none. With a malformed multipart body: 400,
   none.
6. A no-JS shaped POST (multipart with a well-formed `$ACTION_ID_`, no
   `next-action` header) to `/account/delete` with `sid`: passes through with
   the header.
7. POSTs with `sid` and a well-formed action to `/`, `/c/x`, `/inbox`,
   `/onboarding`, `/admin/login`: pass through, no `Clear-Site-Data`.
8. `middleware.ts` takes the cookie name from `SID_COOKIE`, not a literal
   `'sid'`; `SID_COOKIE` from `app/_lib/session.ts` and from
   `src/sid-cookie.ts` are both `'sid'`; `middleware.ts` does not import
   `app/_lib/session.ts`.

On staging (Chromium, `w37-delete-draft.mjs`):

9. After deletion, the deleting tab's `confession_draft_<slug>` is `null`,
   and A's link opened signed out in that tab shows an empty guest box.
10. A second tab's draft on the same link is `null` after the deletion.
11. «رجوع بلا حذف» and an unticked submit keep the draft.
12. The deletion still lands on `/?deleted=1`, signed out, and the account is
    tombstoned (its link answers as week 10 specifies).
13. A same-origin POST to `/account/delete` without a session cookie (curl)
    answers without `Clear-Site-Data`; with a foreign Origin, 403.
14. The staging web log gains no line from any of this.

## §5 Amendments

### §5.1 The middleware reads no cookie, so the gate is the Origin (22:2x)

The first build put `request.cookies.has(SID_COOKIE)` in `middleware.ts`.
`test/68` §4.10 failed on it: week 18 §2 says the middleware "reads no
cookie", and that rule is why the log gate can be trusted to carry no
identity. Moving the cookie read into a `src/` helper would pass the test's
wording and break its rule, so it is not done. The rule stands; the gate
changes.

**Supersedes §1.1, §1.2's call and its `SID_COOKIE` paragraph, §1.3, and §4
items 1 to 8.** `src/sid-cookie.ts` is not created and `app/_lib/session.ts`
does not change.

`src/storage-wipe.ts`:

```ts
export const ACCOUNT_DELETE_PATH = '/account/delete'
export function wipesStorage(
  method: string,
  pathname: string,
  headers: Headers,
  appOrigin: string | undefined,
): boolean
```

`true` exactly when `method === 'POST'`, `pathname === '/account/delete'`,
the request has an `Origin` header, `appOrigin` is defined, and both parse
as URLs with the same `host` (the comparison `src/origin-gate.ts` makes). An
unparseable Origin (including `null`) or `appOrigin` is `false`. It reads no
header but `origin`.

`middleware.ts` calls
`wipesStorage(request.method, request.nextUrl.pathname, request.headers, process.env.APP_ORIGIN)`
after the three gates and sets the header on `NextResponse.next()` when it
is true. With comments stripped it still contains no `cookies` and no
`headers.get(` other than `'next-action'`.

**Why the Origin is enough.** The threat the gate exists for is another site
wiping a visitor's drafts. A browser sends `Origin` on every cross-origin
POST, form or script; a foreign one is already a 403 before this code runs,
and `Origin: null` (a page with `Referrer-Policy: no-referrer`, a sandboxed
frame) is too. A same-origin POST to `/account/delete` comes from this app's
own pages. Without a session the action redirects to sign-in and deletes
nothing, and the header then wipes the drafts of the person whose own tab
sent it: no one else's. A POST with no `Origin` (curl, a browser too old to
send it on a same-origin form) gets no header, so drafts survive there, as
they did before tonight.

**Acceptance, replacing §4 items 1 to 8:**

1. `wipesStorage('POST', '/account/delete', h, A)` is `true` where `h` has
   `Origin` equal to `A`, and also where `h`'s Origin differs from `A` only in
   scheme or path (host equal).
2. It is `false` for each of: method `GET`, `PUT`, `post`; path
   `/account/delete/`, `/account/DELETE`, `/account/delete/x`, `/account`,
   `/auth/logout`, `/`, `/c/x`; no `Origin`; `Origin` of another host
   (including a subdomain of A's host and A's host with another port);
   `Origin: null`; an unparseable Origin; `appOrigin` undefined; an
   unparseable `appOrigin`.
3. `middleware()` given a POST to `/account/delete` with a well-formed
   `next-action`, a valid multipart body and a same-origin `Origin`, with
   `APP_ORIGIN` set, passes it through (`x-middleware-next: 1`) with
   `Clear-Site-Data: "storage"`, whether or not a `sid` cookie is present.
4. The same with no `Origin` header: passes through, no `Clear-Site-Data`,
   with or without a `sid` cookie.
5. The same with a foreign `Origin`: 403, no `Clear-Site-Data`. With a
   malformed `next-action` and a same Origin: 404, none. With a malformed
   multipart body and a same Origin: 400, none.
6. A no-JS shaped POST (multipart with a well-formed `$ACTION_ID_`, no
   `next-action` header) to `/account/delete` with a same Origin: passes
   through with the header.
7. POSTs with a same Origin and a well-formed action to `/`, `/c/x`,
   `/inbox`, `/onboarding`, `/admin/login`: pass through, no
   `Clear-Site-Data`. A GET to `/account/delete` with a well-formed
   `next-action` and a same Origin: no `Clear-Site-Data`.
8. `src/storage-wipe.ts`, comments stripped, contains no `cookies`, no
   `console.`, and every `headers.get(` in it takes the literal `'origin'`.
   `middleware.ts` imports `wipesStorage` from `./src/storage-wipe.js`.

§4 item 13 on staging becomes: a POST to `/account/delete` with no Origin
(curl) answers without `Clear-Site-Data`; with a foreign Origin, 403.

### §5.2 Review pass 1: PASS, two should-fix taken (22:5x)

The independent review (app-adversary, staging and 32 mutants) passed the
slice with no must-fix. Its findings, and what was done:

- **F1, a tab left open writes the draft back.** Tab 1 deletes; tab 2's
  storage is emptied, but its page still shows the text in its signed-in
  box, one keystroke writes it back to `sessionStorage`, and after a reload
  the signed-out guest box restores it. `Clear-Site-Data` clears storage,
  not a page already on screen, and nothing tells that tab it is signed
  out. Week 36 §6 recorded the same for logout. Taken: the comment in
  `middleware.ts` no longer says the drafts "in every tab go with the
  account", and §6 lists it. Not fixed in code: it would need a signal to
  other tabs that `sessionStorage` cannot give (it fires no cross-tab
  event) and a check on every keystroke, for a page the person left open.
- **F2, the second argument to `wipesStorage` was unpinned.** Replacing
  `process.env.APP_ORIGIN` with `request.nextUrl.origin` passed all 27
  tests, because every fixture's URL host equals `APP_ORIGIN`. Behind the
  proxy the two differ, and the wipe would then never fire. Taken: one more
  acceptance item, 9 below, written by a hand that has not seen the code.
- **N1, Next's action forwarding.** A same-origin POST to `/inbox` carrying
  the deletion action's id came back with the header: Next forwards an
  action it does not find on that page to the page that owns it, that
  internal request goes through the middleware as a POST to
  `/account/delete`, and Next copies its headers back. Same-origin only, so
  no other site can reach it. Listed in §6; the path `wipesStorage` sees is
  the path Next routes the action to.
- **N2, scheme.** `Origin: http://<host>` gets the header, as §5.1 says
  (host comparison, like the Origin gate). HSTS covers the host. Left.

**Acceptance item 9 (added).** `middleware()` given a POST to
`/account/delete` whose URL host differs from `APP_ORIGIN`'s host (as behind
the proxy, for example `http://0.0.0.0:3000/account/delete`), with a
well-formed `next-action`, a valid multipart body and `Origin` equal to
`APP_ORIGIN`: passes through with `Clear-Site-Data: "storage"`. And with
`Origin` equal to the request URL's own origin instead (not `APP_ORIGIN`):
403 and no header.

## §6 Residual, known and left

- Safari before 17 ignores `Clear-Site-Data`; there a draft outlives deletion
  as it outlives logout (week 36 §6).
- A deletion that fails after the header was sent costs the drafts (§1.4).
- A browser that sends no `Origin` on a same-origin form POST keeps the
  drafts after deletion (§5.1).
- A tab left open on a link still shows its text after the deletion in
  another tab, and writes it back to storage on the next keystroke; after a
  reload the guest box restores it (§5.2 F1, the same as week 36 §6 for
  logout).
- A same-origin POST at another path carrying the deletion action's id gets
  the header through Next's action forwarding (§5.2 N1).
