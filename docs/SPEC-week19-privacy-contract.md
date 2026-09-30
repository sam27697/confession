# Week 19 - the privacy page describes the product people actually sign in to

*Frozen 2026-09-30 22:0x +04 before any code. Every number in §0 was read off
the production database or the running site tonight.*

## §0 What was measured

### §0.1 Who is signed in

```
production, accounts grouped by provider:
  facebook | terms 2026-08-31.1 | 1 account
  google   | terms 2026-08-31.1 | 4 accounts
```

Four of the five production accounts signed in with Google. Google is the only
login that works for the public (Facebook stays off until Meta publishes the
app). Every one of those four people was shown, and agreed to, text that
describes a Facebook account they never connected.

### §0.2 What the product tells them

| Surface | Sentence | True? |
|---|---|---|
| `/privacy` (AR) | «رقم حسابك واسمك من فيسبوك، لطرفي أي رسالة» | No for 4 of 5 users: we hold their Google `sub` and Google name |
| `/privacy` (EN) | "The Facebook account id and display name of both sides of a message" | Same |
| terms clause 6 (AR/EN), accepted at signup | «منمحي اسمك وربط حسابك بفيسبوك» / "the connection to your Facebook account" | The tombstone erases the Google link too (`src/account-deletion.ts` rewrites `provider_user_id` whatever the provider), so nothing is broken, but a Google user is told about a link they do not have and nothing about the one they do |
| `/account/delete` | «اسمك، وربط حسابك بفيسبوك، ...» | Same as clause 6 |

### §0.3 What `/privacy` leaves out

`/privacy` lists four things: provider id and name, message text, message hour,
terms acceptance. The migrated database has eleven tables. Stored about a user
and not mentioned anywhere on the page:

- the mutual-reveal question, stake prompt and both answers (`reveal_offers`,
  `reveal_answers`), with full timestamps;
- blocks a recipient makes (`link_blocks`) and reports with their free-text
  reason (`reports`), with full timestamps;
- the per-hour send counter per sender and link (`send_counters`);
- the link itself and whether it is switched off (`links`);
- the 18+ attestation, the terms version and full acceptance time, and the
  account creation time (`accounts`, `terms_acceptances`);
- what survives deletion (terms clause 7 says it; the privacy page does not);
- the cookies the site sets and the draft kept in `sessionStorage`.

The page's heading says «هيك منخزن معلومات عنك بالظبط» / "What we store,
exactly". With four items out of the real list, "exactly" is the false word.

Nothing in the test suite ties the page to the schema, which is how a table
added in week 2 (`reveal_answers`) has been undisclosed for five weeks.

## §1 Decision

1. **`/privacy` is rewritten from a data module, `src/privacy.ts`, that names
   the database tables behind every sentence.** The page renders that module and
   nothing else. A test reads the migrated database's table list and fails when
   a table is not named by some item, so a new table cannot ship without a
   sentence on this page.
2. **Terms clause 6 names both providers, and `TERMS_VERSION` moves to
   `2026-09-30.1`.** Every existing account re-accepts on its next visit through
   the existing onboarding path. Five accounts, one screen each.
3. **`/account/delete` names both providers**, in the same words as clause 6.
4. **`BRIEF.md`'s approved terms block gets a dated revision** above the old
   text, on the rule in `src/terms.ts`: the change is made there first, and it
   is reported to Sam as a change to copy he approved.

### §1.1 Rejected

- **Fix `/privacy` only, leave the terms alone.** Avoids the re-acceptance
  screen. Rejected: the terms are the sentence a user actually agrees to, and
  clause 6 is the one that tells them what deletion removes. Leaving it
  Facebook-only means 80% of users agreed to a description of someone else's
  account.
- **Provider-specific terms (show "Google" to Google users).** Two versions of
  an accepted text, and `terms_acceptances` would then need to record which one
  was shown. More schema for a one-word difference.
- **Say "your sign-in account" and name no provider.** Shorter, but the point of
  the sentence is to tell a person which of their outside accounts we are
  linked to. Naming both is the honest version.
- **Hand-written page with a test that greps it for table names.** Table names
  do not belong in user-facing copy, and a grep over JSX is a source-text
  assertion of the kind §8.7 of week 10 retired.

## §2 Implementation contract

### §2.1 `src/privacy.ts`

Exports, exactly these names:

```ts
export type PrivacyItem = { tables: readonly string[]; text: string }
export type PrivacyText = {
  heading: string
  storedIntro: string
  stored: readonly PrivacyItem[]
  admin: PrivacyItem
  sharing: string
  cookies: string
  deletion: string
  never: string
}
export const PRIVACY_AR: PrivacyText
export const PRIVACY_EN: PrivacyText
export const PRIVACY_EXEMPT_TABLES: Readonly<Record<string, string>>
export const ACCOUNT_DELETE_ERASED_AR: string
```

- `stored[i].tables` and `admin.tables` hold database table names as they exist
  after migration (`terms_acceptances`, not the TypeScript name `termsAcceptances`).
- `PRIVACY_AR.stored.length === PRIVACY_EN.stored.length`, and for every `i`
  the two items carry the same `tables` array in the same order. The two
  languages describe the same list.
- `PRIVACY_EXEMPT_TABLES` maps a table name to the reason it holds nothing about
  a user. It contains exactly one entry: `admin_users` (the administrators'
  own usernames and password hashes).
- Every table in the migrated database is named by at least one `stored` item,
  by `admin`, or by `PRIVACY_EXEMPT_TABLES`. No name appears that is not a real
  table.
- `admin.tables` is `['admin_reveal_log']`.
- The text below is frozen. Byte-identical, no markdown, no emoji, no dash
  characters U+2013 or U+2014.

**Arabic (`PRIVACY_AR`)**

- heading: `سياسة الخصوصية`
- storedIntro: `هيك منخزن معلومات عنك بالظبط:`
- stored:
  1. tables `accounts`:
     `رقم حسابك واسمك من فيسبوك أو غوغل، حسب يلي سجلت فيه، ووقت ما فتحت الحساب. ما منطلب إيميلك، وما منخزن صورتك ولا قائمة رفقاتك.`
  2. tables `terms_acceptances`, `accounts`:
     `موافقتك على الشروط: أي نسخة وافقت عليها ووقتها، وإنك أكدت إنك عمرك ١٨ سنة أو أكتر.`
  3. tables `links`:
     `رابطك، وإذا كان شغال أو مطفي.`
  4. tables `confessions`:
     `نص كل رسالة، ومين بعتها ولمين، والساعة يلي انبعتت فيها (مش الدقيقة بالظبط).`
  5. tables `reveal_offers`, `reveal_answers`:
     `بالمصارحة المتبادلة: السؤال، والجواب يلي بيكتبه كل طرف، ووقت كل خطوة.`
  6. tables `link_blocks`, `reports`:
     `إذا حظرت حدا أو بلّغت عن رسالة: مين حظرت، والتبليغ مع سببه، ووقتهن.`
  7. tables `send_counters`:
     `عداد لكل ساعة بعدد الرسائل يلي بعتها لكل رابط، مشان نحط حد للإزعاج.`
- admin (tables `admin_reveal_log`):
  `إدارة التطبيق فيها تشوف مين بعت أي رسالة، وكل مرة حدا من الإدارة يشوف هالشي بينسجل بسجل ثابت ما بيتغير.`
- sharing:
  `ما منبيع ولا منشارك شي من هالمعلومات مع حدا، وما منستعملها لإعلانات. يلي بيجينا من فيسبوك أو غوغل منستعمله بس لنعرف مين إنت جوا التطبيق.`
- cookies:
  `منحط بمتصفحك كوكي تسجيل دخول، وكم كوكي بيعيشوا دقايق وقت تسجيل الدخول نفسه. ما في كوكيز إعلانات ولا تتبع. الرسالة يلي عم تكتبها بتنحفظ مسودة بمتصفحك بس، مش عنا.`
- deletion:
  `إذا حذفت حسابك: منمحي اسمك وربط حسابك بفيسبوك أو غوغل، ورابطك بيبطّل يشتغل. الرسائل يلي بعتها بتضل عند الإدارة مربوطة برقم حساب بلا اسم، والرسائل يلي وصلتك بتضل، وجوابك بأي مصارحة متبادلة ما منقدر نشيله.`
- never:
  `هيك ما منجمع أبداً: عنوان الـ IP تبعك، نوع جهازك أو متصفحك، موقعك، أو جهات اتصالك.`

**English (`PRIVACY_EN`)**

- heading: `Privacy policy`
- storedIntro: `What we store, exactly:`
- stored:
  1. `The account id and name from the Facebook or Google account you signed in with, and when you created your account here. We do not ask for your email address, and we do not store your photo or your friends list.`
  2. `Your acceptance of the terms: which version, when, and that you confirmed you are 18 or older.`
  3. `Your link, and whether it is switched on or off.`
  4. `The text of each message, who sent it and to whom, and the hour it was sent (not the exact minute).`
  5. `In a mutual reveal: the question, the answer each side writes, and when each step happened.`
  6. `If you block someone or report a message: who you blocked, the report and its reason, and when.`
  7. `An hourly count of the messages you sent to each link, so we can limit spam.`
- admin: `The app's administrators can see who sent a message, and every such lookup is written to a permanent, unchangeable record.`
- sharing: `We do not sell or share any of this with anyone, and we do not use it for advertising. What we receive from Facebook or Google is used only to know who you are inside the app.`
- cookies: `We set one sign-in cookie in your browser, plus a few that last minutes during sign-in itself. There are no advertising or tracking cookies. A message you are still writing is kept as a draft in your browser only, not on our side.`
- deletion: `If you delete your account: we erase your name and the connection to your Facebook or Google account, and your link stops working. Messages you sent stay with the administration, attached to an account id with no name on it; messages you received stay; and your answer in any mutual reveal cannot be removed.`
- never: `What we never collect: your IP address, your device or browser, your location, or your contacts.`

English items carry the same `tables` as the Arabic item with the same number.

### §2.2 `app/privacy/page.tsx`

Renders `PRIVACY_AR` in a `dir="rtl"` block, then `<hr />`, then `PRIVACY_EN`
in a `dir="ltr"` block: heading as the page `h1` (Arabic only, as today),
`storedIntro` as a paragraph, `stored` as a `ul` with one `li` per item, then
`admin`, `sharing`, `cookies`, `deletion` (with a link to `/account/delete`
after it, Arabic «حذف الحساب», English "Delete your account"), `never`, each a
paragraph. The English heading is rendered as an `h2`. The `.policy-return`
link to `/inbox` stays. No other copy on the page.

### §2.3 `src/terms.ts`

- `TERMS_VERSION = '2026-09-30.1'`.
- Clause 6, Arabic, replaced by:
  `فيك تطفّي رابطك بأي وقت، وفيك تحذف حسابك بأي وقت. حذف الحساب نهائي وما فيك ترجع عنه: منمحي اسمك وربط حسابك بفيسبوك أو غوغل، وما بتقدر ترجع تفوت على نفس الحساب، ورابطك بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني.`
- Clause 6, English, replaced by:
  `You can switch your link off at any time, and you can delete your account at any time. Deleting is permanent and cannot be undone: we erase your display name and the connection to the Facebook or Google account you signed in with, you cannot sign back in to the deleted account, and your link stops working and is never given to anyone else.`
- Every other clause, the intro and the closing are unchanged, byte for byte.

### §2.4 `app/account/delete/page.tsx`

`src/privacy.ts` also exports `ACCOUNT_DELETE_ERASED_AR`, equal to:
`اسمك، وربط حسابك بفيسبوك أو غوغل، وقدرتك إنك ترجع تفوت على نفس الحساب، ورابطك، يلي بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني.`
The page renders that constant in place of its hard-coded "what is erased"
sentence. Nothing else on the page changes. (The page needs a signed-in
account to render at all, so the constant is what a test can hold.)

### §2.5 Out of scope

The Facebook login button, share targets and story copy mention Facebook
because they are about Facebook. The Meta and Google dashboards are Sam's.

## §3 Residuals, stated rather than hidden

- **The "never collect IP" sentence rests on the reverse proxy keeping no access
  log.** The proxy config is root's and unreadable from this account; the last
  reading of it (2026-08-28) had no `log` directive. The app itself reads no
  request identity (week 18 tests) and its container logs hold boot lines only.
- **Timestamps other than the message hour are full precision.** The new page
  says so ("when"), rather than implying everything is hour-rounded.
- **Re-acceptance.** All five production accounts and every staging account see
  the terms screen once more on their next signed-in visit.

## §4 Acceptance (written by a different author, from this spec only)

A new file `test/69-privacy-contract.test.ts`, plus the amendment in §4.2.

### §4.1 New items

1. `src/privacy.ts` exports `PRIVACY_AR`, `PRIVACY_EN`, `PRIVACY_EXEMPT_TABLES`,
   `ACCOUNT_DELETE_ERASED_AR`.
2. Against a freshly migrated database (the suite's existing PGlite helper and
   the real `drizzle/` migrations), every table in schema `public` is named by a
   `stored` item, by `admin`, or by `PRIVACY_EXEMPT_TABLES`, in both languages.
3. Every table name in any `tables` array or in `PRIVACY_EXEMPT_TABLES` exists
   in that migrated database.
4. `PRIVACY_EXEMPT_TABLES` has exactly the one key `admin_users`.
5. Arabic and English `stored` have the same length and item-for-item equal
   `tables` arrays; `admin.tables` equals `['admin_reveal_log']` in both.
6. Every string in `PRIVACY_AR` and `PRIVACY_EN` is byte-identical to §2.1.
7. No string in either contains U+2013, U+2014, `**`, or a character in an
   emoji block.
8. Both languages name both providers in `stored[0]` and in `deletion`
   (Arabic «فيسبوك» and «غوغل», English "Facebook" and "Google").
9. `TERMS_VERSION === '2026-09-30.1'`, and it compares greater than
   `'2026-08-31.1'` as the onboarding code compares it.
10. Clause 6 in both languages is byte-identical to §2.3; clauses 1 to 5 and 7,
    the intro and the closing are byte-identical to their values on `main` at
    `9b8163c` (frozen as literals in the test file).
11. No terms clause in either language names Facebook without also naming
    Google.
12. The rendered `/privacy` HTML (render the page component to a string, do not
    grep its source) contains every `PRIVACY_AR` and `PRIVACY_EN` string, one
    `li` per stored item in each language, a link to `/account/delete`, and the
    `.policy-return` link.
13. `ACCOUNT_DELETE_ERASED_AR` is byte-identical to §2.4, and no file under
    `app/` or `src/` contains «وربط حسابك بفيسبوك،» or "connection to your
    Facebook account" (the old Facebook-only forms).
14. Re-acceptance, end to end against PGlite: an account whose `terms_version`
    is `'2026-08-31.1'` is routed to onboarding by the same check the app uses
    (`app/_lib/login-flow.ts` / `app/onboarding`), and after
    `recordTermsReacceptance` with the new version it is not.

### §4.2 Amendment to `test/19-account-deletion.test.ts`

Items 24 and 26 pin the week-10 version and clause 6. This spec supersedes
both, so the test author, not the implementer, amends them: item 24 expects
`'2026-09-30.1'`; `FROZEN_CLAUSE_6_AR` and `FROZEN_CLAUSE_6_EN` take the §2.3
text; each amended line carries a dated comment naming this spec. Items 25, 27
and every other item stay as they are.

### §4.3 Amendment after freeze, 2026-09-30 22:4x, found by running the suite

Running the whole suite against the implementation turned two older tests red.
Both are source-text assertions that pin privacy copy to `app/privacy/page.tsx`,
and §1 decision 1 moves that copy into `src/privacy.ts` on purpose. Neither
test was edited by the implementer. The test author amends them as follows,
with a dated comment naming this section on each changed line:

- `test/56-policy-navigation.test.ts` AC4, the privacy half: the two content
  matches (`سياسة الخصوصية`, `What we store, exactly:`) become assertions on the
  page RENDERED to HTML (as in item 12), which must contain both strings. The
  two `dir="rtl"` / `dir="ltr"` source matches stay as they are; the page keeps
  those literals. The terms half of AC4 is untouched.
- `test/14-share-card.test.ts`, the header-read tripwire: the allowance
  `isPrivacyPageCopy` moves from `app/privacy/page.tsx` to `src/privacy.ts`,
  still narrowed to lines matching `/ip address/i`, and the liveness check
  that the tripwire finds the privacy copy must find it in `src/privacy.ts`.
  No other allowance changes, and the pattern `HEADER_READ_INDICATORS` does not
  change.

## §5 Deploy verification (the build session, not the test author)

Staging first, verified from outside, then production from the same image:
`/privacy` 200 and its body contains «غوغل» and "Google"; `/terms` 200 and
clause 6 contains «غوغل»; `/account/delete` 307 when signed out; the other
production routes unchanged from week 18's list. Then the container log and
the absence of IP-shaped lines, as every week.
