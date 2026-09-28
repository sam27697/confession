# Week 18 - nobody on the internet writes into our logs

*Frozen 2026-09-28 21:5x +04 before any code. Every measurement in §0 was taken
against staging over the real certificate, then read back out of the running
container's own log.*

## §0 What was measured

### §0.1 The finding week 14 left open

Week 14's row in BRIEF.md recorded 29 framework error lines in production's
previous container and 13 in staging's, echoing malformed Server Reference Ids
from unauthenticated POSTs to `/`, and deliberately left it out of scope. It was
never picked up. Re-measured tonight on `confession-web` (staging, image built
from `cf945d9`, 12 boot lines before the probe):

```
$ curl -X POST -H 'Next-Action: x'            --data '[]' https://stg.masaraha.provefair.app/   -> 404
$ curl -X POST -H 'Next-Action: canary-7f3a9' --data '[]' https://stg.masaraha.provefair.app/   -> 404

$ docker logs confession-web | tail
[Error: The Server Reference ID did not match the expected format. Received "x".
[Error: The Server Reference ID did not match the expected format. Received "canary-7f3a9".
```

**Any client on the internet can put a string of its choosing into this
product's container log**, one line per request, with no account and no cookie.
Next escapes it with `JSON.stringify` and cuts it at 100 characters
(`next/dist/server/app-render/action-utils.js`, `getInvalidServerReferenceIdError`),
so it cannot forge a line, but the text itself is the sender's. Every privacy
check this project has written since week 4 says "all lines are boot and
migration"; that has only been true on days nobody probed.

No IP, account id or message text is attached to the line, and the proxy keeps
no access log, so terms clause 1 is not broken. What is broken is the claim
that the log holds nothing a request put there.

### §0.2 The three shapes, measured separately

| Request | Status | What reaches the log |
|---|---|---|
| `Next-Action: <anything not 42 chars>` | 404 | the value, quoted, up to 100 chars |
| `Next-Action: <42 lowercase hex, not an action in this build>` | 404 | `Failed to find Server Action "<the 42 hex>"` |
| multipart body with `$ACTION_ID_<junk>` | **500** | `Failed to find Server Action.` plus a 3-frame stack, **no client value** |

Row 2 is also what a real browser tab produces after a deploy changes the ids.
Row 3 carries nothing from the request.

Next's own format check (`mightBeServerReferenceId`,
`next/dist/shared/lib/server-reference-info.js`) is `id.length === 42` and
nothing else. Every id this build emits is 42 lowercase hex characters.

## §1 Decision

A Next middleware, scoped by its matcher to requests that carry a
`next-action` header, answers **404 with an empty body** when that header is not
exactly 42 lowercase hex characters, before Next's action handler sees it. A
well-formed value passes through untouched, so every real form in the app
behaves as it does today.

The format rule lives in `src/action-gate.ts` as a pure function, so the
week 6 header-read tripwire (which sweeps `app/` and `src/`) covers it. The
middleware file must sit at the repository root beside `app/`, where that
tripwire does not look, so §4 extends the sweep to it by name.

### §1.1 Rejected

- **Patch `console.error` / `console.warn` at process start and redact.** It
  would cover row 3 as well, but it rewrites the framework's own diagnostics for
  every error in the process, and one wrong regex swallows a real failure. This
  project does not swallow errors.
- **Node-runtime middleware that reads `server-reference-manifest.json` and
  rejects unknown ids too (closing row 2).** Next 15.5 supports it, but week 9
  §8 already left open whether middleware sees runtime env or build-time
  inlined values, and one image serves both stacks. Closing row 2 buys 42 hex
  characters of attacker text a line; the cost is a runtime question nobody
  has measured.
- **Drop POSTs with a `next-action` header at the reverse proxy.** The proxy is
  root's, not this build's.
- **Leave it.** It will recur every time somebody scans the server, and every
  future privacy check would have to keep saying "except these".

## §2 Implementation contract

- `src/action-gate.ts` exports `isWellFormedActionId(value: string): boolean`,
  true exactly when `value` matches `/^[0-9a-f]{42}$/`. Pure: no I/O, no
  logging, no globals.
- `middleware.ts` at the repository root exports `middleware(request)` and
  `config`.
  - `config.matcher` is an array holding one object whose `has` contains
    `{ type: 'header', key: 'next-action' }`, so the middleware does not run on
    a request without that header.
  - If the header is present and `isWellFormedActionId` is false: return a
    `404` with an empty body and no `set-cookie`. The method does not matter;
    Next only treats the header as an action on POST, and nothing legitimate
    sends it on any other method.
  - Otherwise: `NextResponse.next()`.
  - It reads no request header other than `next-action`, reads no cookie, and
    contains no `console` call and no other logging.
- No other file changes behaviour.

## §3 Residuals, stated rather than hidden

- **Row 2 stays.** A well-formed but unknown id still logs one line with 42 hex
  characters of client text. It carries no identity and cannot carry Arabic,
  a name or a newline.
- **Row 3 stays.** A junk multipart action still answers 500 and logs a
  generic line with a stack. No request content reaches it. Answering 500 to
  garbage is untidy, not a privacy defect, and gating it would mean parsing
  the body in middleware.

## §4 Acceptance (written by a different author, from this spec only)

File: `test/68-action-log-gate.test.ts`. The author does not read
`middleware.ts` or `src/action-gate.ts`.

1. `isWellFormedActionId` accepts 42 lowercase hex characters (at least two
   distinct values, including one starting `00` and one starting `7f`).
2. It rejects: `''`, `'x'`, `'canary-7f3a9'`, 40 hex, 41 hex, 43 hex, 42
   characters with one uppercase hex letter, 42 characters with one `g`, 42 hex
   with a trailing `\n`, 42 hex with a leading space, and a 42-character Arabic
   string.
3. `middleware()` given a POST whose `next-action` is `'canary-7f3a9'` returns
   status 404, a body that reads as the empty string, and no `set-cookie`
   header.
4. The same, for a GET with a malformed `next-action`.
5. The 404 body and every response header value do not contain the rejected
   value.
6. `middleware()` given a POST with a well-formed `next-action` returns a
   pass-through response (Next marks it with `x-middleware-next: 1`), status
   not 404.
7. `middleware()` given a request with no `next-action` header returns a
   pass-through response.
8. `config.matcher` is an array of exactly one entry, and that entry's `has`
   includes `{ type: 'header', key: 'next-action' }`.
9. With comments stripped, `middleware.ts` and `src/action-gate.ts` contain no
   `console.` and no `process.stdout` / `process.stderr`.
10. With comments stripped, every `headers.get(` call in `middleware.ts` has the
    literal `'next-action'` as its argument, and the file contains no
    `cookies`.
11. The week 6 header-read indicators (the `HEADER_READ_INDICATORS` pattern in
    `test/14-share-card.test.ts`, copied, not imported) find nothing in
    `middleware.ts` with comments stripped.
12. Mutation guard: the test file itself asserts at least one case from item 2
    of each length class (short, 40, 41, 43), so loosening the regex to
    `{40,42}` or dropping the anchors turns something red.

No existing test is edited. The suite total rises by exactly the number of
tests in this file.

## §5 Deploy verification (the build session, not the test author)

Staging first. From outside, before and after, count the web container's log
lines:

- `POST /` with `Next-Action: canary-w18-<random>` -> 404, **0 new lines**, and
  the canary appears 0 times in `docker logs`.
- `POST /` with a well-formed unknown id -> 404, exactly the row 2 line (the
  residual, confirmed, not assumed).
- One real server action driven end to end through a browser on staging still
  succeeds.

Then production, same probes, same counts.
