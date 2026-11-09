# Week 36 - a visitor can write before signing in

Frozen 2026-11-09 22:2x +04, before any code. Measured on staging, which runs
the same tarball as production since week 35 (`898824d`).

## §0 What was measured

### §0.1 A friend's link shows a stranger a login wall and nothing else

Driven headless at 390x844 on `stg.masaraha.provefair.app`
(`work/confession-app/probes/w36-walk.mjs`, workspace repo), one dev-login
account owning a link and a second browser context, signed out, opening it:

- `/c/<slug>` signed out renders the avatar, «ابعتلـ <name>», the pitch line,
  «تسجيل الدخول بياخد ثواني، وبعدها منرجعك لهون لتكتب رسالتك.» and one
  button, «سجل دخول 🚀» to `/?next=/c/<slug>`.
- `textarea` count on that screen: **0**. There is nothing to write in until
  the visitor has been to Google (or Facebook), accepted the terms on a first
  visit, and come back.

This is the screen every shared link lands on. The person who tapped it
wanted to say something to a friend; the first thing they are asked for is an
account.

### §0.2 The way back already restores a draft

Since week 22, `SubmitButton`'s `wireDraft` restores `sessionStorage`
`confession_draft_<slug>` into an empty compose box on mount, with
«تم استعادة المسودة», and the `?sent=1` render removes it. A sign-in returns
to `/c/<slug>` as a document load (server redirect from the OAuth callback or
from `/onboarding`), in the same tab, so a key written before sign-in on this
origin is still there when the signed-in form mounts.

### §0.3 The in-app browser case

Google refuses OAuth in an embedded webview. Today the escape («افتح
بالمتصفح», `OpenInBrowser`) shows on `/`, after the visitor has tapped the
sign-in button. If the visitor could type on `/c/<slug>` first, inside
Instagram's browser, and the escape then moved them to Chrome or Safari, the
text would stay behind in the webview's storage. So the escape has to come
before the box, on `/c/<slug>` itself, for a signed-out visitor.

### §0.4 No-JS

`@media (scripting: none)` measured in this repo's Playwright Chromium: with
`javaScriptEnabled: false` it matches, with JS on it does not. Browsers that
do not know the feature match neither branch.

## §1 The change

### §1.1 Signed-out branch of `app/c/[slug]/page.tsx`

The signed-out branch (no viewer account, link enabled, not owner) renders,
in this order, inside `<OpenInBrowser>`:

1. The existing pitch line «صارح <name> باللي بقلبك بدون ما يعرف هويتك.»
2. A draft block, class `guest-draft`, containing:
   - the starter chips, the same four `STARTER_PROMPTS`, same markup
     (`button type="button" data-starter-prompt`);
   - a visually hidden label «رسالتك» and a `textarea` with `id="body"`,
     `name="body"`, `data-draft-slug={slug}`, `maxLength={4000}`, `rows={5}`,
     placeholder «اكتب اللي بقلبك...», and **no `data-draft-sent`**;
   - `#draft-status` (`aria-live="polite"`);
   - the hint «رسالتك بتضل على جهازك وما بتوصلنا قبل ما تكبس ابعت. سجّل دخول ومنرجعك لهون لتبعتها.»
3. A no-JS hint, class `guest-nojs`, with today's text «تسجيل الدخول بياخد
   ثواني، وبعدها منرجعك لهون لتكتب رسالتك.»
4. The sign-in link, unchanged target `/?next=/c/<encoded slug>`, label
   «سجل دخول وكمّل 🚀».

**The draft block is not a `<form>` and is not inside one.** The container is
a `div` carrying `data-compose`. There is no element in the signed-out branch
that can submit the textarea's value anywhere: no form, no `formaction`, no
`fetch`, no URL built from its value. Its value lives in the page and in
`sessionStorage` only.

### §1.2 CSS, `app/globals.css`

- `.guest-nojs` is `display: none` by default.
- `@media (scripting: none)`: `.guest-draft { display: none }` and
  `.guest-nojs { display: block }`.

So with JS off the visitor sees today's screen (pitch, today's hint, the
button); with JS on, the box; in a browser that does not know the feature, the
box (JS is the overwhelmingly common case there).

### §1.3 Draft wiring for the signed-out box

`app/_components/SubmitButton.tsx` gains an exported
`wireDraftBox(root: Element, textarea: HTMLTextAreaElement)`: the restore and
autosave half of `wireDraft`, same key `confession_draft_<slug>` from the
textarea's `data-draft-slug`, same indicator texts (`#draft-status` inside
`root`: «عم يحفظ...», «تم الحفظ تلقائياً», «تم استعادة المسودة»), same 150 ms
debounce, same try/catch around storage, returns its cleanup. `wireDraft`
keeps its exported signature and behaviour and delegates the restore/autosave
part to it; the `data-draft-sent="1"` removal stays in `wireDraft`.

A new client component `app/_components/GuestSignIn.tsx` renders the sign-in
`<a>` (§1.1 item 4) and, in an effect on mount, finds the closest
`[data-compose]` ancestor and its `textarea[data-draft-slug]`, and calls
`wireDraftBox`. It does nothing else: it does not read the value at click
time, does not change the `href`, and does not navigate itself. Without JS it
is a plain link.

### §1.4 Starter chips

The existing inline `starter-chips` script finds the chip's container with
`t.closest('form,[data-compose]')` instead of `t.closest('form')`. Everything
else in that script stays byte-identical, including
`ta.dispatchEvent(new Event('input',{bubbles:true}))`. It is still rendered
once per page.

### §1.5 Signed-in branch

Unchanged. A visitor who wrote while signed out, signed in and came back sees
the text restored by `wireDraft` with «تم استعادة المسودة» and still has to
press «ابعت». **Nothing is sent automatically.** The terms step on a first
visit still comes before the compose box.

## §2 What must not change

- `sendConfessionAction`, its binding, the signed-in form, `SubmitButton`'s
  signature and pending behaviour, the `?sent=1` cleanup (week 22).
- The sign-in link target. `/?next=` and its validation are week 21's.
- The owner view and the disabled-link view.
- The landing page and its own `OpenInBrowser`.
- No new request, cookie, header read, route, log line or database column.
  The server learns nothing about what a signed-out visitor typed or whether
  they typed.
- The privacy copy already says (`src/privacy.ts` `cookies`): «A message you
  are still writing is kept as a draft in your browser only, not on our
  side.» That stays true and needs no edit. The Arabic copy says the same
  (`src/privacy.ts` `cookies`, ar): «الرسالة يلي عم تكتبها بتنحفظ مسودة
  بمتصفحك بس، مش عنا.»

## §3 Rejected

- **Send the message before sign-in and attach it to the account after.**
  The server would hold text with no account behind it, and the identity
  model (STACK.md, his decision 08-25) is that every message is tied to a
  signed-in sender. Also a spam door.
- **Carry the draft through the sign-in round trip in the URL or a cookie.**
  The text would reach the proxy's access log or every request header. The
  log contract (weeks 18, 33-35) exists to stop exactly that.
- **`localStorage`.** Survives closing the tab, so an unsent confession sits
  on a shared phone for the next person. `sessionStorage` is what week 22
  chose for the signed-in box.
- **A `<form method="get" action="/">` around the box with an unnamed
  textarea, or a `form=` attribute pointing nowhere.** Each makes "the text
  never leaves the device" depend on one attribute someone will tidy away.
- **Send automatically after sign-in.** The sender has not yet seen the
  notice that the admin can see their account (it sits above «ابعت» in the
  signed-in form), and a first-time visitor has just accepted terms; the
  last tap stays theirs.
- **Skip the landing screen and link straight to `/auth/google/start`.** One
  fewer tap, but it loses the dev-login and Facebook choices and the landing's
  terms/privacy links; a separate slice if wanted.

## §4 Acceptance

1. Signed out, JS on, normal browser: `/c/<slug>` shows one `textarea` and
   four starter chips; the sign-in link points at `/?next=/c/<slug>`.
2. Typing writes `confession_draft_<slug>` in `sessionStorage` and sets
   `#draft-status` to «تم الحفظ تلقائياً»; a chip fills the box and saves.
3. Typing then following the sign-in link, signing in (dev login on
   staging), accepting terms on a first visit: back on `/c/<slug>` the box
   holds the text and `#draft-status` says «تم استعادة المسودة». No
   confession exists for that sender until «ابعت» is pressed; after it, one.
4. While signed out, typing sends no request at all (network log empty
   between first keystroke and the click on the sign-in link), and the text
   appears in no URL, cookie or request body at any point before «ابعت».
5. Signed out, JS off: no visible `textarea`, the old hint, the sign-in link.
6. Signed out with an Instagram in-app user agent: the escape card shows on
   `/c/<slug>` and the box does not, until «جرّب تسجيل الدخول هون على كل حال» (the override) is pressed.
7. The signed-in, owner and disabled-link renders are unchanged.
8. Signed in, after a send (`?sent=1`), the week 22 behaviour holds: no draft
   offered back.
9. `tsc --noEmit` 0, the whole suite green.

## §5 Amendments

(none yet)
