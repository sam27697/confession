# Week 33 spec: a malformed POST answers 400, not 500

Frozen 2026-11-02 before any code. Supersedes one clause of
`SPEC-week18-action-log-gate.md` (§2, the single-entry matcher); see §4.

## §0 Measured first

Staging and production, from outside, 2026-11-02 21:3x +04, `main` = `43875b3`.
No account, no cookie, no knowledge of the app needed for rows 1 and 2.

| # | Request | Status | Container log |
|---|---------|--------|---------------|
| 1 | `POST /` (or `/c/x`, `/admin/login`, `/inbox`, `/onboarding`, `/account/delete`), `Content-Type: multipart/form-data; boundary=x`, body `garbage` | **500** | `TypeError: Failed to parse body as FormData.` + 1 frame |
| 2 | same paths, a **well-formed** multipart body with no `$ACTION_` field, or with `$ACTION_ID_zzz` | **500** | `Error: Failed to find Server Action. ...` + 4 frames |
| 3 | `POST /admin/login`, `Next-Action: <the real login action id>`, multipart body `garbage` | **500** | `Error: Unexpected end of form` |
| 4 | same, `Content-Type: text/plain`, body `{{{` | **500** | `SyntaxError: Expected property name ... position 1` |
| 5 | same, empty body | **500** | `SyntaxError: Unexpected end of JSON input` |
| 6 | staging `POST /auth/dev`, no body | **500** | `TypeError: Failed to parse body as FormData.` + 2 frames |

The real action ids are in every page's HTML (the hidden `$ACTION_ID_<hex>`
input of a form rendered for no-JS use), so rows 3 to 5 need nothing secret
either. Production `/auth/dev` is 404 (dev login off), so row 6 is staging
only; `/admin/reveal` has the same unguarded `request.formData()` behind the
admin session.

None of these lines carries request content: no client text, no IP, no
header value. **This is not a privacy defect.** It is a server that answers
500 to anyone who sends it junk, with 2 to 6 log lines each, which buries a
real failure in the noise of the next scan.

## §1 Decision

Reject the junk before Next's action handler parses it, with the same
parser behaviour Next will apply, and answer **400 with an empty body**.

`src/body-gate.ts` holds the rules as functions of a standard `Request`;
`middleware.ts` calls it after the week 18 id check.

### §1.1 Rules

`bodyGate(request: Request): Promise<boolean>`, true = pass, false = reject.
It reads the body only through `request.clone()`, so the request Next
receives is untouched.

1. Method is not `POST`: pass.
2. Let `ct` = the `content-type` header, `''` if absent, compared as is (Next's
   own test is `contentType.startsWith('multipart/form-data')`, case
   sensitive, and this gate must agree with Next on what is an action).
3. `ct` starts with `multipart/form-data`:
   - `await request.clone().formData()` throws: **reject**.
   - The request has a `next-action` header (a fetch action from the page's
     own script): **pass**. The body parsed; React decodes the fields.
   - No `next-action` header (a form submitted before or without
     JavaScript): pass exactly when `hasWellFormedFormAction(form)` is true,
     otherwise **reject**.
4. `ct` does not start with `multipart/form-data` and the request has a
   `next-action` header: the body is React's JSON reply encoding.
   `JSON.parse(await request.clone().text())` throws (an empty body
   included): **reject**. Otherwise pass.
5. Anything else: pass. (An urlencoded or bodiless POST to a page is not an
   action to Next and renders the page; route handlers deal with their own
   bodies, §1.3.)

`hasWellFormedFormAction(form: FormData): boolean` mirrors the shape half of
Next's `areAllActionIdsValid`
(`next/dist/server/app-render/action-handler.js`), without the manifest:

- Keys that do not start with `$ACTION_` are ignored.
- A key `$ACTION_ID_<rest>`: `<rest>` must be 42 lowercase hex characters
  (week 18's `isWellFormedActionId`), else **false**. Counts as an action.
- A key `$ACTION_REF_<n>`: at most 2 such keys, else **false**. The form must
  hold exactly one value under `$ACTION_<n>:0`, that value a string starting
  `{"id":"`, and the characters up to the next `"` must be 42 lowercase hex,
  else **false**. Counts as an action.
- Other `$ACTION_` keys (`$ACTION_1:0`, `$ACTION_KEY`, ...) are ignored.
- **true** exactly when at least one action was counted and nothing above
  returned false.

### §1.2 Middleware

- The week 18 check stays first and unchanged: a `next-action` header that is
  not 42 lowercase hex gets 404, empty body.
- Then `bodyGate`; false gives **400, empty body, no `set-cookie`**.
- Otherwise `NextResponse.next()`.
- `config.matcher` is an array of exactly two entries:
  1. `{ source: '/:path*', has: [{ type: 'header', key: 'next-action' }] }`
     (week 18's, unchanged);
  2. `{ source: '/:path*', has: [{ type: 'header', key: 'content-type', value: 'multipart/form-data.*' }] }`.
- `middleware.ts` still reads no header but `next-action` itself and no
  cookie; the content-type read lives in `src/body-gate.ts`. Neither file
  logs anything.

### §1.3 The two route handlers

`app/auth/dev/route.ts` and `app/admin/reveal/route.ts` each call
`request.formData()`. A body that does not parse as a form (no content type,
wrong content type, broken multipart) gets **400** instead of an exception:
`/auth/dev` answers `400` with body `bad request`; `/admin/reveal` answers
`400` with the same «صار خطأ» document it already uses for a failed reveal,
and writes no audit row. Everything they did before for a body that parses
is unchanged, including `/auth/dev`'s 404 when dev login is off (checked
before the body is read) and `/admin/reveal`'s admin redirect (also before).

### §1.4 Rejected

- **Catch it in the page or the action.** The exception is thrown inside
  Next's action handler before any of our code runs.
- **Answer every multipart POST without `next-action` with 400, unparsed.**
  Cheaper, but a person who submits the send form before the page's script
  has loaded posts exactly that, and week 23 measured that window as real
  on a phone. Their confession would be refused.
- **Close the unknown-but-well-formed id case too** (a stale tab after a
  deploy, still a 500 with a generic line). Needs the action manifest in
  middleware; week 18 §1.1 rejected that for an unmeasured runtime question
  and nothing has changed.
- **Validate fetch-action form fields against React's encoding.** That is
  reimplementing `decodeReplyFromBusboy`; a parse check is the part that can
  be done without drifting from React.
- **Wrap Next's standalone `server.js`.** Owns the whole process for one
  error class.

## §2 Residuals, stated

- A well-formed but unknown action id (row 2 of week 18, and the no-JS form
  of it) still answers 404 or 500 with one generic line. A stale tab after a
  deploy is the legitimate source of it.
- A fetch action whose body parses but is not a valid React reply for that
  action can still throw inside React. It needs a real id and a crafted
  body.
- Middleware now buffers the body of every multipart or action POST once
  more. Every real one is a small form.

## §3 What must still work, measured on staging after deploy

Driven in a real browser (Playwright, staging, a fresh dev-login account):

1. Dev login, terms acceptance, the inbox: with JavaScript on.
2. Sending a message from another account to the first account's link: once
   with JavaScript on, once with **JavaScript disabled** (the bound
   `$ACTION_REF_` form), and both messages appear in the recipient's inbox.
3. One inbox action (the link switch) with JavaScript on and off.
4. Rows 1 to 6 of §0 answer 400 (row 6: 400 from the handler or the gate),
   and the container log gains **zero** lines from them.

## §4 Acceptance (written by a different author, from this spec only)

New file `test/84-malformed-posts.test.ts`. The author does not open
`src/body-gate.ts`, `middleware.ts`, `app/auth/dev/route.ts` or
`app/admin/reveal/route.ts`. Covers §1.1 rule by rule (each reject and each
pass, including a form holding a valid `$ACTION_REF_` pair, three refs, a
ref without its `:0` field, a descriptor with a 41-character id, uppercase
hex, an empty body with `next-action`, a body that is valid JSON), §1.2
(status 400, empty body, no `set-cookie`, the body Next would read is still
readable after the gate ran, the two matcher entries exactly), §1.3 (the
dev handler with dev login on and a bodiless POST answers 400; with dev login
off answers 404 without touching the body), and that neither
`src/body-gate.ts` nor `middleware.ts` contains a `console` or
`process.stdout`/`stderr` call.

**One existing item changes, and the same author changes it:**
`test/68-action-log-gate.test.ts` §4.8 asserts `config.matcher` has exactly
one entry. Week 18 §2's single-entry clause is superseded by §1.2 above. §4.8
is re-aimed to assert exactly two entries: the first exactly week 18's
next-action entry, the second exactly the content-type entry of §1.2. It must
not get weaker than that. Every other item in test 68 stays as it is and must
still pass.

## §5 Amendment, 2026-11-02 22:1x, after the test author's first pass

The test author found a conflict this spec did not settle, and four gaps.

- **Test 68 §4.6 versus rule 4.** §4.6 sends a well-formed `next-action` with
  no body and expects a pass-through. Rule 4 rejects an empty body, and §0
  row 5 measured that same request (with the real id) as a 500 from Next.
  §4.6 exists to prove a well-formed id gets past week 18's check; its empty
  body was incidental. Rule 4 stands. §4.6 is re-aimed by the test author to
  send a body that parses (`[]`, `Content-Type: text/plain;charset=UTF-8`,
  what the page's own script sends), with every assertion it has kept.
- **A descriptor with no closing quote** returns false (Next's own
  `isInvalidStringActionDescriptor` treats it as invalid).
- **Repeated `$ACTION_REF_` keys** count once per occurrence, as
  `FormData.keys()` yields them and as Next counts them.
- **An empty `next-action` value** is not 42 lowercase hex, so week 18's
  check answers 404 before the body gate runs.
- **`/admin/reveal`** gets acceptance too: with an admin session, a body that
  does not parse answers 400 with the «صار خطأ» document, and the
  `admin_reveals` audit table gains no row. Use the harness test 17 and 18
  already use for this route.
