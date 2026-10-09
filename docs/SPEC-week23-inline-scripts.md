# Week 23 - the chips and copy buttons work on the first visit

Frozen 2026-10-09 21:34 +04, before any code. Measured on staging, which runs
the same tarball as production since week 22 (sha256 `457ca7cc5e30f28d...`).

## §0 What was measured

### §0.1 Four behaviours are dead for anyone who arrives through an action

Driven headless at 390x844 on `stg.masaraha.provefair.app` with fresh
dev-login accounts (`scratch/w23/probe.mjs`). "Same document" means a marker
set on `window` before the action was still there after it, so the page was
rendered by the client router and no document was loaded.

| path | same document | tap | result |
|---|---|---|---|
| new owner: terms screen -> `/inbox` | yes | «نسخ السؤال» (daily spark) | label unchanged, nothing copied |
| new sender: shared link -> sign-in -> terms -> `/c/<slug>` | yes | first starter chip | textarea `""` |
| owner: link toggled off and on, each a redirect to `/inbox` | yes | first reveal chip | input `""` |
| sender: accepts an offer on `/offer/<id>` -> `/sent` | yes | «انسخ النص» | label unchanged, nothing copied |

Controls, same accounts, same run: after a hard reload `/sent`'s copy answers
«تم النسخ ✅», the spark answers «تم النسخ ✅», and a starter chip on a
document load of `/c/<slug>` fills the textarea. No page errors in any step.

So the first screen a new person sees after the terms is broken in the same
way on both sides: the owner cannot copy the day's question to post it, and
the sender's ideas to start do nothing. Both are growth surfaces.

### §0.2 Why

Five click handlers are inline `<script dangerouslySetInnerHTML>` elements:

| file | handler |
|---|---|
| `app/c/[slug]/page.tsx` | starter chips, `button[data-starter-prompt]` |
| `app/inbox/page.tsx` | daily spark copy, `.daily-spark__copy` |
| `app/_components/RevealCard.tsx` | reveal chips, `button[data-target][data-prompt]` |
| `app/offer/[offerId]/page.tsx` | response starters, `button[data-response-prompt]` |
| `app/sent/page.tsx` | copy button, `button[data-copy-text]` |

Each adds one listener on `document`. A script in the server HTML runs once
when the document is parsed and the listener lives as long as the document.
A page that arrives through the client router (every Server Action redirect:
terms, send, toggle, offer, accept, decline) comes as an RSC payload, React
inserts the `<script>` element into the DOM, and browsers do not execute a
script inserted that way. Week 22 §0.3 found the same cause for the draft.

The handler therefore works only if the first document of the tab was the
page that carries it. `/offer/<id>` is only ever reached by an `<a>`, so its
starters survive in practice; the other four do not.

## §1 The change

1. In each of the five files, the handler `<script dangerouslySetInnerHTML>`
   becomes `<Script id="..." strategy="afterInteractive"
   dangerouslySetInnerHTML>` from `next/script`. The handler text does not
   change by one character.
2. Ids, one per handler, all different: `starter-chips`, `daily-spark-copy`,
   `reveal-chips`, `response-starters`, `sent-copy`.
3. Why this works, read in `node_modules/next/dist/client/script.js`
   (Next 15.5.24): for an inline `afterInteractive` script under the app
   directory the component renders nothing on the server and, in a mount
   effect, creates the element with `document.createElement('script')` and
   appends it to `body`. A script created that way does execute. It records
   the id in a module-level `LoadCache` and skips any later mount with the
   same id, so each handler is attached at most once per document however
   many times the page is visited, and `RevealCard` (rendered once per
   message) attaches one listener, not one per card. Its existing
   `window.__revealChipInit` guard stays.
4. The draft removal script in the `sent` block of `app/c/[slug]/page.tsx`
   stays a plain `<script>`. Week 22 kept it on purpose for the document-load
   case, `wireDraft` covers the client-router case, and tests 31, 35 and 72
   pin it.

On a document load the handlers now attach after hydration instead of at
parse time. A tap in that gap (well under a second on a phone that has the
bundle cached) does nothing, which is what every one of these taps does today
on the paths in §0.1.

Nothing on the server changes: no action, route, redirect, schema, log line or
stored value. No new dependency; `next/script` ships with `next`.

## §2 Rejected alternatives

- **One client component in the root layout that owns all five handlers.**
  It would also work, and is the tidier end state. It moves the handler text
  out of the five pages, and tests 48, 49, 50 and 52 read that text in those
  pages; satisfying them would mean editing tests that are right about what
  they protect. Not worth it for the same behaviour.
- **A `useEffect` per page in five new client components.** Five files to fix
  one mechanism, and each would need its own once-per-document guard, which
  `next/script` already has.
- **Turn the chips into `<Link>`s or make the action redirects document
  loads** (`window.location` after the action, or `<form>` without a Server
  Action). Throws away the client router for every action to save five
  listeners, and the week 22 draft fix depends on the router path.
- **Keep the inline scripts and add `next/script` copies beside them.** Two
  listeners on a document load: each chip tap would run twice, and the copy
  buttons would race on their own label.

## §3 What this does not do

- No handler changes behaviour; a chip still replaces the text in its box,
  and the copy labels and timings are as before.
- `/account/delete` and `/onboarding` carry no inline handler and are not
  touched.

## §4 Acceptance (written by a different author, from this file alone)

New file `test/73-inline-handlers.test.ts`, source-text checks read with
`readFileSync` the way tests 48 to 52 do. The browser behaviour is proved by
the drive in §5, not by this file.

1. For each of the five files in §0.2: it imports the default export of
   `next/script`.
2. For each of the five: the handler's selector text from the §0.2 table
   appears inside an element opened with `<Script` whose attributes include
   `strategy="afterInteractive"` and the id from §1.2.
3. The five ids are pairwise different (a shared id would let `LoadCache`
   skip one handler).
4. None of the five files contains a lowercase `<script` element that carries
   an `addEventListener` call.
5. `app/c/[slug]/page.tsx` still contains the plain `<script` element whose
   text includes `sessionStorage.removeItem('confession_draft_`.
6. `RevealCard.tsx` still contains `__revealChipInit`.
7. The handler bodies are unchanged: for each of the five, a fixed distinctive
   substring of today's handler still appears (for example
   `ta.dispatchEvent(new Event('input',{bubbles:true}))` on the compose page,
   `document.execCommand('copy')` on `/sent`).
8. No file under `app/admin/` imports `next/script` (test 17 forbids scripts
   there; this keeps the new mechanism out too).

Items 1, 2 and 4 must be red on `main` at `f116bb4`.

## §5 Deploy and verification (the build session)

Staging first, then production from the same tarball. On staging,
`scratch/w23/probe.mjs` re-runs: every row in §0.1 must now fill or copy on
the same document, the controls must still pass, and a chip tap after a
document load must fill once (the text is not doubled and the input event
fires once, measured by counting `input` events). Production: route table
unchanged from week 22, `check-origins.mjs`, and the container log read for
what the drive wrote.
