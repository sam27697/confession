# Week 15 - service tuning, and a softer app for the person using it

*Frozen 2026-09-23 before any code. Measured against `main` at `9a54869`, on a
local Postgres 17 with `scripts/seed-dev.mjs` plus three extra confessions, in a
375x812 viewport.*

## §0 What was measured

### §0.1 Finding A - the inbox shows the oldest message first

Three confessions sent 30 hours, 5 hours and 1 hour ago render on `/inbox` in
that order: the one from yesterday is at the top and the one that just arrived
is at the bottom, under the link block, below the fold on a phone.
`getInboxForRecipient` and `getSentForSender` in `src/views.ts` have no
`ORDER BY` at all, so the order is whatever the heap returns, which is
insertion order until the first `VACUUM` moves a row and then it is nothing in
particular. Both lists grow downward from the oldest entry.

Heap order is also a small leak: within one `created_hour` bucket it is the
exact order the messages were sent in, which is the precision the hour stamp
exists to throw away (week 12, `src/hourstamp.ts`).

### §0.2 Finding B - each tab reads the other tab's whole screen to draw one number

`/inbox` calls `getSentForSender` (confessions joined to links and accounts,
then offers, then answers: up to 3 queries and every body the viewer ever sent)
to render the badge on the «الرسائل المرسلة» tab. `/sent` calls
`getInboxForRecipient` (up to 5 queries and every body the viewer ever
received) for the badge on «صندوقي». Both run after the page's own list, one
after the other. `/c/[slug]` reads the same link row twice per request, once
in `generateMetadata` and once in the page.

### §0.3 Finding C - the pool has no error listener and no timeouts

`src/pool.ts` builds a `pg.Pool` with `max: 10` and nothing else.

1. **No `'error'` listener.** When Postgres restarts under an idle pooled
   connection (a redeploy of the db container, an OOM kill), node-postgres
   emits `'error'` on the pool. An `EventEmitter` with no listener for
   `'error'` throws, and the web container exits.
2. **No `connectionTimeoutMillis`.** The default is 0, which means wait
   forever. With the database down or all ten connections busy, a request
   hangs until the proxy gives up, and the user sees a blank spinner rather
   than an answer.
3. **No `statement_timeout` or `idle_in_transaction_session_timeout`.** One
   stuck query or one leaked transaction can hold a connection, and its locks,
   indefinitely.

### §0.4 Finding D - dead ends a user can actually reach

| Where | What renders today | Way out |
|---|---|---|
| `/c/<unknown>` | Next's built-in page: title «404: This page could not be found.», English, left-to-right, inside an Arabic RTL shell | none |
| `/offer/<id>` not found, or not the viewer's | one line, «ما لقينا هالعرض.» | none |
| `/offer/<id>` already settled | one line of `.hint`, «هالعرض خلص، ما بقي فيه شي تعمله.» | none |
| `/c/<slug>` switched off | one notice, «هالرابط مطفي هلق.» | none |
| `/inbox` with no link row | one danger notice, «ما لقينا رابطك.» | none |

### §0.5 Finding E - a friend's link loses the friend on signup

`/c/[slug]` sends a signed-out visitor to `/?next=/c/<slug>`, and the dev
login carries `next` into `resolveLoginAndRedirect`. But:

1. For an identity with no account yet, which is every stranger arriving from a
   story, `resolveLoginAndRedirect` redirects to `/onboarding` and drops
   `next`. `acceptTermsAction` then always redirects to `/inbox`. The visitor
   who came to write to a friend lands in their own empty inbox and has to find
   the friend's link again.
2. The Facebook path drops `next` on the first hop: `/auth/facebook/start`
   takes no parameter and the callback calls `resolveLoginAndRedirect` with no
   destination. Facebook Login is dark today, so this has not cost anyone yet;
   it will on the day the App ID arrives.

This is the growth loop of the product (principles.md, principle 1), and it
leaks at the one step where the visitor has just committed.

### §0.6 Finding F - actions finish silently, and the copy guesses genders

Hiding, blocking and reporting a message, and sending a reveal offer, all
redirect to a bare `/inbox`. Hide removes the card with no word said. Block
says nothing about what blocking does, and it is the action a person reaches
for when upset. Declining an offer on `/offer/[id]` returns to `/sent` with no
acknowledgement.

The reveal copy assigns genders it cannot know: `/sent` labels the recipient's
answer «جوابها» and `/offer/[id]` asks «شو بدها تعرف» / «شو رح تحكيلك عن
حالها», so every recipient is a woman; the inbox labels the sender's answer
«جوابه», so every sender is a man. Both names are on the row already.

The error copy blames nobody and helps nobody: «صار في مشكلة، جرب لاحقاً.»
appears on four screens, and the rate-limit line reads as a reprimand.

---

## §1 Scope

**Service**

1. `src/pool.ts` - timeouts, keep-alive, `application_name`, and an `'error'`
   listener that logs the error class and code only (week 3 §1 rule 3).
2. `src/views.ts` - newest first on both lists; two count functions for the
   tab badges.
3. `app/inbox/page.tsx`, `app/sent/page.tsx` - use the counts, run
   independent reads together.
4. `app/c/[slug]/page.tsx` - one link read per request via React `cache()`.
   `src/links.ts` is not touched.
5. `next.config.mjs` - no `X-Powered-By`; `Referrer-Policy: same-origin`,
   `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, and a
   `Permissions-Policy` that turns off camera, microphone and geolocation.
   `same-origin` and not `no-referrer`, because under `no-referrer` a browser
   sends `Origin: null` on a POST, and Next rejects a Server Action whose
   Origin does not match the host.
6. `app/healthz/route.ts` - `Cache-Control: no-store`.

**Softening**

7. `app/not-found.tsx` - new, server-rendered, Arabic, with a way home.
8. The four other dead ends in §0.4 get a title, one sentence of why, and a
   button to somewhere useful, built from the existing `.empty` block.
9. `?done=` confirmations on `/inbox` (hidden, blocked, reported, offered) and
   on `/sent` (declined), rendered as `.notice--citron` with `role="status"`.
   Only a fixed key is read from the query string, never text.
10. The copy changes in §3, each one held to the week 14 copy contract.
11. `next` survives signup and the Facebook round trip (§2.3).

**UI**

12. A quiet account footer on `/inbox` carrying terms, privacy and delete
    account, replacing the lone ghost button.
13. `viewport` export in the root layout: `themeColor` `#070512` (`--ground`)
    and `colorScheme: 'dark'`, so the phone's browser chrome matches the page.

**Out of scope, named so nobody widens the slice:** the schema, any migration,
the domain rules in `src/actions.ts`, every form `action=` and every field
`name=` (test/21 item 17), the client island (still exactly five components,
test/21 item 10b), the landing page's pinned sentences (test/63), the terms
text, the admin surfaces, and the design-of-record token mirror (test/62).

---

## §2 Service

### §2.1 Ordering

Both lists order by `created_hour DESC, id`. `id` is a random UUID, so within
an hour bucket the order is stable across reloads and says nothing about who
sent first. This removes the §0.1 leak rather than just sorting around it.

### §2.2 Counts

```ts
countSentForSender(db, { senderAccountId }): Promise<number>
countVisibleInboxForLink(db, { linkId }): Promise<number>
```

Each is one `count(*)`. The inbox count excludes `hidden_by_recipient`, the
same filter the pages apply today, so the badge number does not change. Neither
function selects a body, a display name or an account id. `countSentForSender`
filters on `confessions.sender_account_id` for the viewer's own id, which is
the `WHERE` clause `getSentForSender` already uses; nothing about another
person's identity crosses into a recipient-facing path.

### §2.3 `next` through signup

One cookie, `after_login`, holding a path that has already passed
`sanitizeNextDestination`, with `pendingIdentityCookieOptions` (httpOnly,
secure, lax, 30 minutes).

- `/auth/facebook/start?next=` sets it. The landing page passes its own
  `next` to that link.
- The Facebook callback reads it, deletes it, and hands it to
  `resolveLoginAndRedirect`.
- `resolveLoginAndRedirect`, on the two branches that go to `/onboarding`,
  sets it when the destination is anything other than the `/inbox` default.
- `acceptTermsAction` reads it, deletes it, and redirects to
  `sanitizeNextDestination(value)` instead of `/inbox`.

The value is sanitised again on every read. A tampered cookie can only ever
name a same-origin path, the same guarantee the query parameter already has.

---

## §3 Copy

Every line below is Levantine, has no em-dash, and makes no claim the schema
does not keep (test/63). Emoji only from `app/_lib/emoji.ts`.

### §3.1 Confirmations (§1 item 9)

| key | copy |
|---|---|
| `hidden` | خبّيناها من صندوقك. |
| `blocked` | تم الحظر. ما رح توصلك منه رسايل جديدة، وهو ما رح يعرف إنك حظرته. |
| `reported` | وصلنا بلاغك، والإدارة رح تراجعه. |
| `offered` | انبعت العرض. جوابك مخبّى لحد ما يرد الطرف التاني. |
| `declined` | سكّرنا العرض. ما انكشف شي عنك. |

«ما رح يعرف إنك حظرته» is what `sendConfession` already guarantees: a blocked
sender gets a success-shaped result and no row (README, implementation
choices). «ما انكشف شي عنك» is the `declined` state: no sender answer is
written, and the recipient sees only «ما وافق».

### §3.2 Errors

| where | key | copy |
|---|---|---|
| all four | `generic` | صار خلل من عنا، مش منك. جرب كمان مرة بعد شوي. |
| `/c/[slug]` | `signin` | سجّل دخول أول، وبعدها فيك تبعت رسالتك. |
| `/c/[slug]` | `empty` | الرسالة فاضية. اكتب شي قبل ما تبعت. |
| `/c/[slug]` | `ratelimit` | بعتّ رسايل كتير بوقت قصير. خود استراحة صغيرة وجرب بعد شوي. |
| `/c/[slug]` | `unavailable` | هالرابط مش عم يستقبل رسايل هلق. |
| `/inbox` | `short` | كل خانة بدها حرفين على الأقل. كمّلها وجرب كمان مرة. |
| `/offer/[id]` | `short` | جوابك لازم يكون حرفين على الأقل. |

### §3.3 Names instead of guessed pronouns

- `/sent` resolved card: «جوابها» becomes «جواب {recipientDisplayName}».
- `/inbox` resolved card: «جوابه» becomes «جواب {senderDisplayName}».
- `/offer/[id]`: «شو بدها تعرف» becomes «السؤال يلي بدو جوابك», and «شو رح
  تحكيلك عن حالها» becomes «وشو رح تعرف بالمقابل». This page has no display
  name to use, by design, so the wording goes neutral instead.
- `/inbox` pending reveal: «بعتلو عرض مصارحة. لسا ما رد.» becomes «انبعت عرض
  المصارحة، ولسا ما وصل رد.»

The state chips («لسا ما رد», «ما وافق») keep the generic masculine that
Arabic uses for an unknown person; they are labels, not sentences about someone.

### §3.4 Explaining the heavy actions where they are taken

- Under «احظر صاحبها»: «الحظر بيوقف رسايله إلك، وما بيوصله إشعار.» True for
  the reason in §3.1; there are no notifications in v1 at all.
- Under «رفض العرض نهائياً», which keeps its wording (test/40): «إذا رفضت، ما
  في شي بينكشف عنك. الطرف التاني بيعرف بس إنك ما وافقت.»
- `/c/[slug]` signed out: «لازم تسجل دخول قبل ما تبعت.» becomes «تسجيل الدخول
  بياخد ثواني، وبعدها منرجعك لهون لتكتب رسالتك.» This sentence is only true
  once §2.3 lands, and it lands in the same change.

### §3.5 Dead ends (§0.4)

| where | title | line | button |
|---|---|---|---|
| not-found | ما لقينا هالصفحة. | يمكن الرابط ناقص حرف، أو صاحبه غيّره. | رجوع للبداية → `/` |
| offer missing | ما لقينا هالعرض. | يمكن الرابط ناقص، أو العرض مش إلك. كل العروض يلي وصلتك بتلاقيها بالرسائل المرسلة. | الرسائل المرسلة → `/sent` |
| offer settled | هالعرض تسكّر. | انرد عليه من قبل، أو انسحب. آخر أخباره بتلاقيها بالرسائل المرسلة. | الرسائل المرسلة → `/sent` |
| link off | هالرابط مش عم يستقبل رسايل هلق. | صاحبه طفّاه لفترة. فيك ترجع بعدين، أو تفتح صندوقك وتخلي رفقاتك يصارحوك. | افتح صندوقك السري → `/inbox` |
| no link | ما قدرنا نلاقي رابطك هلق. | جرب تحدّث الصفحة بعد شوي. | none, the header nav is on screen |

---

## §4 The tripwire

`test/64-service-softening.test.ts`, new. Source-reading where the property is
a source property, PGlite where it is a query property.

1. **Ordering**, on PGlite: three confessions in three different hours come
   back newest first from both `getInboxForRecipient` and `getSentForSender`.
2. **Counts**, on PGlite: `countVisibleInboxForLink` excludes a hidden
   confession and `countSentForSender` counts only the viewer's own sends;
   both equal the length the full queries give, filtered as the pages filter.
3. **Pool**: `src/pool.ts` sets `connectionTimeoutMillis`,
   `idleTimeoutMillis`, `statement_timeout` and
   `idle_in_transaction_session_timeout`, and registers `.on('error'`.
4. **Headers**: `next.config.mjs` sets `poweredByHeader: false` and a
   `Referrer-Policy` that is not `no-referrer` (§1 item 5's reason is the
   assertion message).
5. **Tabs**: neither `app/inbox/page.tsx` nor `app/sent/page.tsx` calls the
   other tab's full list query.
6. **Not found**: `app/not-found.tsx` exists, has no `'use client'`, and
   contains no Latin letters in its rendered text.
7. **Dead ends**: every early `return` on `/offer/[offerId]` and the
   switched-off branch of `/c/[slug]` renders an `<a href=`.
8. **Confirmations**: the five `done` keys in §3.1 map to copy on the page
   that receives them, and each action that emits one redirects with it.
9. **`next`**: `acceptTermsAction` no longer redirects to a bare `'/inbox'`
   on the signup branch without first consulting the `after_login` cookie, and
   `/auth/facebook/start` reads `next`.
10. **Pronouns**: «جوابها», «بدها تعرف» and «عن حالها» appear in no `.tsx`
    file under `app/`.

No existing test is edited by this slice. If one turns red, the fix is in this
slice's code.

---

## §5 Found while building, after the freeze

Recorded here rather than folded back into §0 to §4, so the frozen text still
says what was known before any code.

### §5.1 A Server Action redirect keeps the scroll position

§1 item 9 put each confirmation in the page flow as a `.notice--citron`.
Measured in the browser: hiding the third message on `/inbox` redirected to
`/inbox?done=hidden` with `scrollY` still at 3096, because a Server Action's
redirect is a soft navigation. The notice rendered at the top of a page the
person was not looking at. The confirmation is rendered instead into a
server-side `.toasts` box (the same fixed, bottom-centred position the client
toasts use) with a `.flash` rule that fades it out after `--flash-life`, a new
app-level token. It is keyed per render so two hides in a row both confirm.
Errors stay in the flow, now directly under the heading instead of below the
link block.

### §5.2 Finding G - the spotlight buried the field being typed into

`body:has(.input:focus-visible, .textarea:focus-visible)::before` lays an 85%
black overlay with a blur at `z-index: 10` over the whole page whenever a
field has focus, and only `.card:has(...)` was lifted above it. Measured on
`/c/[slug]`: focusing the message box put the box itself, the sender
disclosure line and the send button under the overlay. The report reason on
`/inbox` and the answer on `/offer/[id]` went dark the same way. Lifting the
field alone cannot work, because the `.enter` entrance animation leaves every
direct child with a transform and so a stacking context of its own. The fix
lifts `form:has(...)` and `.enter > :has(...)` to `z-index: 11`, and the dim
moves to a lighter, unblurred `--spotlight-dim`.

### §5.3 Toasts were translucent over content

`.toast--citron` and `.toast--danger` used the translucent wash as their whole
background, so the message text scrolled beneath a toast read through it. The
wash now sits over an opaque `--surface-3`. Same colours, readable.

### §5.4 Holding the existing contracts

- test/62 requires token adoption of at least 50%. The new layout rules took
  it to 49.8%. Five raw literals whose values are byte-identical to an
  existing token were swapped for it (`999px` to `--radius-pill`, `700` to
  `--weight-bold` twice, `4px` to `--space-1`, `2px` to `--space-hair`), and
  the flash reuses `.toasts` rather than restating its positioning. Measured
  after: 50.4%.
- test/33 pins the literal `<OfferBlock offer={m.offer} />`. The recipient's
  name for §3.3 rides into the card on the resolved offer itself rather than
  as a second prop.

### §5.5 The tripwire gains one item

11. **Spotlight**: the `form:has(...)` / `.enter > :has(...)` lift exists and
    its `z-index` is above the overlay's.
