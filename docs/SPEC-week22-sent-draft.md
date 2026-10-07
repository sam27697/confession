# Week 22 - a sent message leaves the compose box

Frozen 2026-10-07 22:0x +04, before any code. Measured on staging, which runs
the same tarball as production since week 21 (sha256 `8e9d4245512f8591...`).

## §0 What was measured

### §0.1 The sent text comes back as a draft

Driven headless at 390x844 on `stg.masaraha.provefair.app` with two fresh
dev-login accounts, one owning a link and one sending to it. After a successful
send, with no reload:

| step | URL | `sessionStorage` draft | textarea | `#draft-status` |
|---|---|---|---|---|
| typed | `/c/<slug>` | the text | the text | تم الحفظ تلقائياً |
| after send | `/c/<slug>?sent=1` | **the text** | **the text** | **تم استعادة المسودة** |
| client nav to `/sent` | `/sent` | **the text** | - | - |
| hard reload of `?sent=1` | `/c/<slug>?sent=1` | null | empty | empty |

The screen says «الرسالة وصلت.» and, under it, offers the same message back as
a restored draft, ready to send.

### §0.2 One more tap sends it twice

From the "after send" state above, one more tap on «ابعت» delivered a second,
identical confession. `/sent` for that fresh sender then listed the text
twice. The recipient gets the duplicate in their inbox and cannot tell it from
a second message.

### §0.3 Why the cleanup never runs

`app/c/[slug]/page.tsx` clears the key with an inline
`<script dangerouslySetInnerHTML>` inside the `sent === '1'` block. A send is a
Server Action whose `redirect()` is applied by the client router, so the
`?sent=1` page arrives as an RSC payload and React inserts that `<script>`
element into the DOM. Browsers do not execute a script inserted that way. It
only runs when `?sent=1` is loaded as a document, which is the hard-reload row
above and not the path anyone takes.

Meanwhile `SubmitButton`'s mount effect restores whatever the key holds into
an empty textarea, so the stale text is put back.

### §0.4 What the privacy page promises

`/privacy` (src/privacy.ts, `cookies`): «الرسالة يلي عم تكتبها بتنحفظ مسودة
بمتصفحك بس». A message that was already sent is not one "you are still
writing", and keeping it in the tab after delivery is more than that sentence
says. On a shared phone the next person to open the tab finds the text and the
recipient's name together.

## §1 The change

1. `SubmitButton.tsx`: the body of the mount effect moves into an exported
   function `wireDraft(button)` that returns the cleanup function (or
   `undefined` when there is nothing to wire). The effect calls it. Behaviour
   for every existing case is unchanged.
2. `wireDraft` reads `data-draft-sent` on the textarea. When it is `"1"` it
   removes `confession_draft_<slug>` and does **not** restore anything. The
   input and submit listeners are still attached, so a second message typed on
   the `?sent=1` page is saved as a draft like any other.
3. `app/c/[slug]/page.tsx`: the textarea renders `data-draft-sent="1"` only
   when `sent === '1'`, and the `<form>` is keyed so that every server render
   of a successful send mounts a new form: `'compose'` when not sent, a fresh
   random value per render when sent. That makes the mount effect run after
   every successful send, including the second send from a `?sent=1` page,
   where the URL does not change.
4. The inline removal script stays. It is what clears the key when `?sent=1`
   is loaded as a document before hydration, and tests 31 and 35 pin it.
5. Storage access stays inside `try`/`catch` as today: a browser that refuses
   `sessionStorage` (some private modes) gets a compose box without drafts,
   not an error.

Nothing on the server changes: no action, route, redirect target, schema or
log line.

## §2 Rejected alternatives

- **Clear the key on submit.** A send that fails (`?error=ratelimit`,
  `?error=generic`) would lose the text, and that is the case the draft exists
  for.
- **Move the removal into a client component rendered in the `sent` block.**
  It would run, but it races the restore in `SubmitButton`'s effect: whichever
  effect runs last wins, and that order is a React implementation detail.
  One effect that decides both is not a race.
- **Add a nonce to the redirect (`?sent=1&n=...`).** Changes a URL that tests 23, 35 and 53 and the
  post-send blocks read, to fix something the page can fix by itself.
- **Refuse duplicates on the server** (same sender, same link, same body
  within the hour). Worth having against a double submit from a bad network,
  and stated in §3. It is a domain change with its own spec; the defect
  measured here is the client handing the text back, and that is what this
  slice removes.

## §3 What this does not do

- A sender who types the same message again and sends it, sends it twice.
  That is a choice, not this defect. Server-side duplicate refusal is a later
  slice.
- A message still being written stays in `sessionStorage` until the tab
  closes, as `/privacy` says.

## §4 Acceptance (written by a different author, from this file alone)

New file `test/72-sent-draft.test.ts`. Behavioural items call `wireDraft`
from `app/_components/SubmitButton.tsx` with plain fake objects (a button whose
`closest('form')` returns a form; a form whose `querySelector` returns the
textarea and the `#draft-status` element; a textarea with `value`,
`getAttribute`, `addEventListener`, `removeEventListener`, `dispatchEvent`) and
a fake `sessionStorage` installed on `globalThis` for the duration of each
test.

1. **Sent, key present:** `data-draft-sent="1"`, the store holds text for the
   slug, the textarea is empty. After `wireDraft`: the key is gone, the
   textarea is still empty, and the status text is not «تم استعادة المسودة».
2. **Sent, other slugs untouched:** with keys for two slugs stored, only the
   textarea's own slug key is removed.
3. **Not sent, key present, textarea empty:** the text is restored into the
   textarea, the status reads «تم استعادة المسودة», and an `input` event is
   dispatched.
4. **Not sent, textarea already has text:** the stored value does not
   overwrite it.
5. **Storage that throws** on every method: `wireDraft` does not throw, for
   both the sent and the not-sent case.
6. **Typing after a send still saves:** with `data-draft-sent="1"`, firing the
   textarea's `input` listener with a new value stores it under the slug key
   within 150 ms plus a margin.
7. **Cleanup detaches:** calling the returned function removes the listeners
   it added.
8. **Nothing to wire:** a null button, a button outside a form, a form without
   `textarea[name="body"]`, or a textarea without `data-draft-slug` returns
   `undefined` and touches no storage.
9. **Page wiring (source):** in `app/c/[slug]/page.tsx` the textarea's
   `data-draft-sent` is conditional on `sent === '1'`, and the `<form>`
   carrying `action={action}` has a `key` that depends on `sent`.
10. **Kept:** the inline `sessionStorage.removeItem('confession_draft_...)`
    script in the `sent` block is still there.

Item 1 and item 6 must be red on `main` at `7264176` (there is no
`wireDraft` export, and no sent branch).

### §4.1 Amendment after freeze, 2026-10-07 22:2x, found by running the suite

`test/31-draft-persistence.test.ts` AC4 pins the literal `<form action={action}>`.
§1.3 put the key on that tag, which turns test 31 red. The old test is right
about what it protects (the action binding), so the key moves instead: the form
is wrapped in a React `Fragment` carrying the same key, which remounts the form
the same way. Item 9 now reads: the `<form action={action}>` element is wrapped
in an element whose `key` expression references `sent`, and the form tag itself
is unchanged. Nothing else in §4 changes.

## §5 Deploy and verification (the build session)

Staging first, then production from the same tarball. On staging, the drive
in §0.1 and §0.2 re-run: after send the store is null and the textarea empty;
one more tap answers `?error=empty` and `/sent` lists the message once; a
second message typed and sent from the `?sent=1` page also leaves the store
empty. Production: route table unchanged from week 21, `check-origins.mjs`,
and the container log read for what a send writes.
