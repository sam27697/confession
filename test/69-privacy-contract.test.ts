// test/69-privacy-contract.test.ts
//
// Written from docs/SPEC-week19-privacy-contract.md section 4 alone, by an
// agent that has not read and must not read src/privacy.ts, the rewritten
// app/privacy/page.tsx, app/account/delete/page.tsx or app/terms/page.tsx --
// the implementation of this same slice, being written in parallel in a
// different worktree. Red is the expected and correct result for most items
// in this file today: src/privacy.ts does not exist yet in this worktree,
// TERMS_VERSION has not been bumped yet, and terms clause 6 and
// app/account/delete/page.tsx still carry the Facebook-only wording section
// 4.1 item 13 forbids.
//
// src/privacy.ts does not exist at all in this worktree, so a static
// `import { PRIVACY_AR } from '../src/privacy.js'` would throw
// ERR_MODULE_NOT_FOUND at module link time and crash this entire file before
// a single test ran -- the same hazard test/18-admin-hardening.test.ts and
// test/19-account-deletion.test.ts document for a not-yet-existing export.
// So every lookup into src/privacy.ts below goes through the dynamic
// `loadPrivacy()` helper, a `await import('../src/privacy.js').catch(...)`
// read off the returned module object, so a missing module fails the one
// test that needed it rather than the whole file.
//
// app/privacy/page.tsx, by contrast, already exists in this worktree (it is
// the pre-week-19 page, self-contained, importing nothing from
// src/privacy.ts) and section 2.2 says the rewritten page stays a plain
// synchronous default export, so it is imported statically below and
// rendered with react-dom/server's renderToStaticMarkup (item 12). Today
// that renders the OLD hard-coded copy, which is why item 12 is red until
// the page is rewritten to render PRIVACY_AR/PRIVACY_EN.
//
// src/terms.ts already exists and already exports TERMS_VERSION,
// TERMS_TEXT_AR and TERMS_TEXT_EN with the pre-week-19 shape, so those three
// are imported statically too -- the build session edits this same file in
// place, it does not replace it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { freshDb } from './harness.js'
import { TERMS_VERSION, TERMS_TEXT_AR, TERMS_TEXT_EN } from '../src/terms.js'
import { recordTermsReacceptance } from '../src/accounts.js'
import { createAccount } from './fixtures.js'
import PrivacyPage from '../app/privacy/page.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------------------
// src/privacy.ts -- loaded dynamically, see header comment.
// ---------------------------------------------------------------------------

type PrivacyItem = { tables: readonly string[]; text: string }
type PrivacyText = {
  heading: string
  storedIntro: string
  stored: readonly PrivacyItem[]
  admin: PrivacyItem
  sharing: string
  cookies: string
  deletion: string
  never: string
}
type PrivacyModule = {
  PRIVACY_AR?: PrivacyText
  PRIVACY_EN?: PrivacyText
  PRIVACY_EXEMPT_TABLES?: Readonly<Record<string, string>>
  ACCOUNT_DELETE_ERASED_AR?: string
}

// The specifier is read out of a variable rather than written as a string
// literal directly in the `import(...)` call: with a literal, TypeScript
// tries to resolve and type-check the target module at compile time and
// fails with TS2307 (Cannot find module) for a module that, in this
// worktree, genuinely does not exist yet. Through a variable, `import()`'s
// result type is plain `Promise<any>` and tsc has nothing to resolve --
// the absence still surfaces at runtime, in the `.catch()` below, which is
// where this file wants it (one failing test, not a file that cannot
// typecheck).
const PRIVACY_MODULE_SPECIFIER = '../src/privacy.js'

async function loadPrivacy(): Promise<PrivacyModule> {
  return (await import(PRIVACY_MODULE_SPECIFIER).catch(() => ({}))) as PrivacyModule
}

// ---------------------------------------------------------------------------
// Item 1
// ---------------------------------------------------------------------------

test('item 1: src/privacy.ts exports PRIVACY_AR, PRIVACY_EN, PRIVACY_EXEMPT_TABLES, ACCOUNT_DELETE_ERASED_AR (spec section 4.1 item 1)', async () => {
  const mod = await loadPrivacy()
  assert.equal(typeof mod.PRIVACY_AR, 'object', 'src/privacy.ts must export PRIVACY_AR')
  assert.ok(mod.PRIVACY_AR, 'PRIVACY_AR must not be null')
  assert.equal(typeof mod.PRIVACY_EN, 'object', 'src/privacy.ts must export PRIVACY_EN')
  assert.ok(mod.PRIVACY_EN, 'PRIVACY_EN must not be null')
  assert.equal(typeof mod.PRIVACY_EXEMPT_TABLES, 'object', 'src/privacy.ts must export PRIVACY_EXEMPT_TABLES')
  assert.ok(mod.PRIVACY_EXEMPT_TABLES, 'PRIVACY_EXEMPT_TABLES must not be null')
  assert.equal(typeof mod.ACCOUNT_DELETE_ERASED_AR, 'string', 'src/privacy.ts must export ACCOUNT_DELETE_ERASED_AR as a string')
})

// ---------------------------------------------------------------------------
// Items 2 and 3 share the migrated table list.
// ---------------------------------------------------------------------------

// The harness (test/harness.ts) applies the real files in drizzle/ with
// client.exec(sqlText) against a fresh PGlite instance -- it never calls
// drizzle-orm's migrate() (which is what creates the bookkeeping table
// `__drizzle_migrations` / `drizzle.__drizzle_migrations`, and only inside a
// schema named after its `migrationsSchema` option, never `public` by
// default). grepping drizzle/*.sql and src/ turned up no reference to any
// such bookkeeping table either. So nothing is excluded here: every base
// table information_schema reports in `public` after freshDb() is one of
// the eleven application tables spec section 0.3 counted, and none of them
// is migration bookkeeping.
async function migratedTableNames(): Promise<{ tables: string[]; close: () => Promise<void> }> {
  const { client } = await freshDb()
  const { rows } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  )
  return { tables: rows.map((r) => r.table_name), close: () => client.close() }
}

test('item 2: every table in the migrated public schema is named by a stored item, by admin, or by PRIVACY_EXEMPT_TABLES, in both languages (spec section 4.1 item 2)', async () => {
  const mod = await loadPrivacy()
  assert.ok(mod.PRIVACY_AR && mod.PRIVACY_EN && mod.PRIVACY_EXEMPT_TABLES, 'src/privacy.ts must export PRIVACY_AR, PRIVACY_EN and PRIVACY_EXEMPT_TABLES for this item to mean anything')
  if (!mod.PRIVACY_AR || !mod.PRIVACY_EN || !mod.PRIVACY_EXEMPT_TABLES) return

  const { tables, close } = await migratedTableNames()
  assert.ok(tables.length > 0, 'expected at least one table after migration')

  const exemptKeys = Object.keys(mod.PRIVACY_EXEMPT_TABLES)
  const arNamed = new Set<string>([
    ...mod.PRIVACY_AR.stored.flatMap((item) => item.tables),
    ...mod.PRIVACY_AR.admin.tables,
    ...exemptKeys,
  ])
  const enNamed = new Set<string>([
    ...mod.PRIVACY_EN.stored.flatMap((item) => item.tables),
    ...mod.PRIVACY_EN.admin.tables,
    ...exemptKeys,
  ])

  const missingFromAr = tables.filter((t) => !arNamed.has(t))
  const missingFromEn = tables.filter((t) => !enNamed.has(t))
  assert.deepEqual(missingFromAr, [], `tables not named anywhere in the Arabic privacy text: ${JSON.stringify(missingFromAr)}`)
  assert.deepEqual(missingFromEn, [], `tables not named anywhere in the English privacy text: ${JSON.stringify(missingFromEn)}`)

  await close()
})

test('item 3: every table name in any tables array or in PRIVACY_EXEMPT_TABLES exists in the migrated database (spec section 4.1 item 3)', async () => {
  const mod = await loadPrivacy()
  assert.ok(mod.PRIVACY_AR && mod.PRIVACY_EN && mod.PRIVACY_EXEMPT_TABLES, 'src/privacy.ts must export PRIVACY_AR, PRIVACY_EN and PRIVACY_EXEMPT_TABLES for this item to mean anything')
  if (!mod.PRIVACY_AR || !mod.PRIVACY_EN || !mod.PRIVACY_EXEMPT_TABLES) return

  const { tables, close } = await migratedTableNames()
  const realTables = new Set(tables)

  const named = new Set<string>([
    ...mod.PRIVACY_AR.stored.flatMap((item) => item.tables),
    ...mod.PRIVACY_EN.stored.flatMap((item) => item.tables),
    ...mod.PRIVACY_AR.admin.tables,
    ...mod.PRIVACY_EN.admin.tables,
    ...Object.keys(mod.PRIVACY_EXEMPT_TABLES),
  ])

  const invented = [...named].filter((t) => !realTables.has(t))
  assert.deepEqual(invented, [], `names that do not correspond to any real migrated table: ${JSON.stringify(invented)}`)

  await close()
})

// ---------------------------------------------------------------------------
// Item 4
// ---------------------------------------------------------------------------

test('item 4: PRIVACY_EXEMPT_TABLES has exactly the one key admin_users (spec section 4.1 item 4)', async () => {
  const mod = await loadPrivacy()
  assert.ok(mod.PRIVACY_EXEMPT_TABLES, 'src/privacy.ts must export PRIVACY_EXEMPT_TABLES')
  if (!mod.PRIVACY_EXEMPT_TABLES) return
  assert.deepEqual(Object.keys(mod.PRIVACY_EXEMPT_TABLES), ['admin_users'], 'PRIVACY_EXEMPT_TABLES must have exactly one key, admin_users (spec section 2.1)')
})

// ---------------------------------------------------------------------------
// Item 5
// ---------------------------------------------------------------------------

test('item 5: PRIVACY_AR.stored and PRIVACY_EN.stored have the same length and item-for-item equal tables arrays; admin.tables equals [admin_reveal_log] in both (spec section 4.1 item 5)', async () => {
  const mod = await loadPrivacy()
  assert.ok(mod.PRIVACY_AR && mod.PRIVACY_EN, 'src/privacy.ts must export PRIVACY_AR and PRIVACY_EN')
  if (!mod.PRIVACY_AR || !mod.PRIVACY_EN) return

  assert.equal(mod.PRIVACY_AR.stored.length, mod.PRIVACY_EN.stored.length, 'PRIVACY_AR.stored and PRIVACY_EN.stored must have the same length')
  const len = Math.min(mod.PRIVACY_AR.stored.length, mod.PRIVACY_EN.stored.length)
  for (let i = 0; i < len; i += 1) {
    assert.deepEqual(
      [...mod.PRIVACY_AR.stored[i]!.tables],
      [...mod.PRIVACY_EN.stored[i]!.tables],
      `stored[${i}].tables must be the same array, in the same order, in both languages`,
    )
  }

  assert.deepEqual([...mod.PRIVACY_AR.admin.tables], ['admin_reveal_log'], 'PRIVACY_AR.admin.tables must equal [admin_reveal_log]')
  assert.deepEqual([...mod.PRIVACY_EN.admin.tables], ['admin_reveal_log'], 'PRIVACY_EN.admin.tables must equal [admin_reveal_log]')
})


// ---------------------------------------------------------------------------
// Item 6 -- every PRIVACY_AR/PRIVACY_EN string, frozen byte-for-byte from
// spec section 2.1. Extracted from docs/SPEC-week19-privacy-contract.md by a
// script reading the file at the fixed line numbers section 2.1 occupies,
// not retyped by hand, and diffed back against the spec file itself before
// this file was committed.
// ---------------------------------------------------------------------------

const SPEC_PRIVACY_AR: PrivacyText = {
  heading: "سياسة الخصوصية",
  storedIntro: "هيك منخزن معلومات عنك بالظبط:",
  stored: [
    { tables: ["accounts"], text: "رقم حسابك واسمك من فيسبوك أو غوغل، حسب يلي سجلت فيه، ووقت ما فتحت الحساب. ما منطلب إيميلك، وما منخزن صورتك ولا قائمة رفقاتك." },
    { tables: ["terms_acceptances", "accounts"], text: "موافقتك على الشروط: أي نسخة وافقت عليها ووقتها، وإنك أكدت إنك عمرك ١٨ سنة أو أكتر." },
    { tables: ["links"], text: "رابطك، وإذا كان شغال أو مطفي." },
    { tables: ["confessions"], text: "نص كل رسالة، ومين بعتها ولمين، والساعة يلي انبعتت فيها (مش الدقيقة بالظبط)." },
    { tables: ["reveal_offers", "reveal_answers"], text: "بالمصارحة المتبادلة: السؤال، والجواب يلي بيكتبه كل طرف، ووقت كل خطوة." },
    { tables: ["link_blocks", "reports"], text: "إذا حظرت حدا أو بلّغت عن رسالة: مين حظرت، والتبليغ مع سببه، ووقتهن." },
    { tables: ["send_counters"], text: "عداد لكل ساعة بعدد الرسائل يلي بعتها لكل رابط، مشان نحط حد للإزعاج." },
  ],
  admin: { tables: ["admin_reveal_log"], text: "إدارة التطبيق فيها تشوف مين بعت أي رسالة، وكل مرة حدا من الإدارة يشوف هالشي بينسجل بسجل ثابت ما بيتغير." },
  sharing: "ما منبيع ولا منشارك شي من هالمعلومات مع حدا، وما منستعملها لإعلانات. يلي بيجينا من فيسبوك أو غوغل منستعمله بس لنعرف مين إنت جوا التطبيق.",
  cookies: "منحط بمتصفحك كوكي تسجيل دخول، وكم كوكي بيعيشوا دقايق وقت تسجيل الدخول نفسه. ما في كوكيز إعلانات ولا تتبع. الرسالة يلي عم تكتبها بتنحفظ مسودة بمتصفحك بس، مش عنا.",
  deletion: "إذا حذفت حسابك: منمحي اسمك وربط حسابك بفيسبوك أو غوغل، ورابطك بيبطّل يشتغل. الرسائل يلي بعتها بتضل عند الإدارة مربوطة برقم حساب بلا اسم، والرسائل يلي وصلتك بتضل، وجوابك بأي مصارحة متبادلة ما منقدر نشيله.",
  never: "هيك ما منجمع أبداً: عنوان الـ IP تبعك، نوع جهازك أو متصفحك، موقعك، أو جهات اتصالك.",
}

const SPEC_PRIVACY_EN: PrivacyText = {
  heading: "Privacy policy",
  storedIntro: "What we store, exactly:",
  stored: [
    { tables: ["accounts"], text: "The account id and name from the Facebook or Google account you signed in with, and when you created your account here. We do not ask for your email address, and we do not store your photo or your friends list." },
    { tables: ["terms_acceptances", "accounts"], text: "Your acceptance of the terms: which version, when, and that you confirmed you are 18 or older." },
    { tables: ["links"], text: "Your link, and whether it is switched on or off." },
    { tables: ["confessions"], text: "The text of each message, who sent it and to whom, and the hour it was sent (not the exact minute)." },
    { tables: ["reveal_offers", "reveal_answers"], text: "In a mutual reveal: the question, the answer each side writes, and when each step happened." },
    { tables: ["link_blocks", "reports"], text: "If you block someone or report a message: who you blocked, the report and its reason, and when." },
    { tables: ["send_counters"], text: "An hourly count of the messages you sent to each link, so we can limit spam." },
  ],
  admin: { tables: ["admin_reveal_log"], text: "The app's administrators can see who sent a message, and every such lookup is written to a permanent, unchangeable record." },
  sharing: "We do not sell or share any of this with anyone, and we do not use it for advertising. What we receive from Facebook or Google is used only to know who you are inside the app.",
  cookies: "We set one sign-in cookie in your browser, plus a few that last minutes during sign-in itself. There are no advertising or tracking cookies. A message you are still writing is kept as a draft in your browser only, not on our side.",
  deletion: "If you delete your account: we erase your name and the connection to your Facebook or Google account, and your link stops working. Messages you sent stay with the administration, attached to an account id with no name on it; messages you received stay; and your answer in any mutual reveal cannot be removed.",
  never: "What we never collect: your IP address, your device or browser, your location, or your contacts.",
}

function allPrivacyStrings(t: PrivacyText): Array<{ field: string; value: string }> {
  const out: Array<{ field: string; value: string }> = [
    { field: 'heading', value: t.heading },
    { field: 'storedIntro', value: t.storedIntro },
    { field: 'admin', value: t.admin.text },
    { field: 'sharing', value: t.sharing },
    { field: 'cookies', value: t.cookies },
    { field: 'deletion', value: t.deletion },
    { field: 'never', value: t.never },
  ]
  t.stored.forEach((item, i) => out.push({ field: `stored[${i}]`, value: item.text }))
  return out
}

test('item 6: every string in PRIVACY_AR and PRIVACY_EN is byte-identical to spec section 2.1 (spec section 4.1 item 6)', async () => {
  const mod = await loadPrivacy()
  assert.ok(mod.PRIVACY_AR && mod.PRIVACY_EN, 'src/privacy.ts must export PRIVACY_AR and PRIVACY_EN')
  if (!mod.PRIVACY_AR || !mod.PRIVACY_EN) return

  for (const { field, value } of allPrivacyStrings(SPEC_PRIVACY_AR)) {
    const actual: { field: string; value: string } | undefined = allPrivacyStrings(mod.PRIVACY_AR).find((e) => e.field === field)
    assert.equal(actual?.value, value, `PRIVACY_AR.${field} must be byte-identical to spec section 2.1`)
  }
  assert.equal(mod.PRIVACY_AR.stored.length, SPEC_PRIVACY_AR.stored.length, 'PRIVACY_AR.stored must have exactly 7 items')

  for (const { field, value } of allPrivacyStrings(SPEC_PRIVACY_EN)) {
    const actual: { field: string; value: string } | undefined = allPrivacyStrings(mod.PRIVACY_EN).find((e) => e.field === field)
    assert.equal(actual?.value, value, `PRIVACY_EN.${field} must be byte-identical to spec section 2.1`)
  }
  assert.equal(mod.PRIVACY_EN.stored.length, SPEC_PRIVACY_EN.stored.length, 'PRIVACY_EN.stored must have exactly 7 items')
})

// ---------------------------------------------------------------------------
// Item 7
// ---------------------------------------------------------------------------

// Extended_Pictographic and Regional_Indicator are the Unicode properties
// that identify emoji-like pictographs and flag components, the same
// property test test/21-design-system.test.ts item 7 already uses for the
// same reason: a fixed codepoint list goes stale, a Unicode property does
// not.
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u

test('item 7: no string in PRIVACY_AR or PRIVACY_EN contains U+2013, U+2014, "**", or an emoji character (spec section 4.1 item 7)', async () => {
  const mod = await loadPrivacy()
  assert.ok(mod.PRIVACY_AR && mod.PRIVACY_EN, 'src/privacy.ts must export PRIVACY_AR and PRIVACY_EN')
  if (!mod.PRIVACY_AR || !mod.PRIVACY_EN) return

  const offenders: string[] = []
  for (const [lang, text] of [['PRIVACY_AR', mod.PRIVACY_AR] as const, ['PRIVACY_EN', mod.PRIVACY_EN] as const]) {
    for (const { field, value } of allPrivacyStrings(text)) {
      if (value.includes('\u2013')) offenders.push(`${lang}.${field} contains U+2013`)
      if (value.includes('\u2014')) offenders.push(`${lang}.${field} contains U+2014`)
      if (value.includes('**')) offenders.push(`${lang}.${field} contains **`)
      if (EMOJI_PATTERN.test(value)) offenders.push(`${lang}.${field} contains an emoji character`)
    }
  }
  assert.deepEqual(offenders, [], `disallowed characters found: ${JSON.stringify(offenders)}`)
})

// ---------------------------------------------------------------------------
// Item 8
// ---------------------------------------------------------------------------

test('item 8: both languages name both providers in stored[0] and in deletion (spec section 4.1 item 8)', async () => {
  const mod = await loadPrivacy()
  assert.ok(mod.PRIVACY_AR && mod.PRIVACY_EN, 'src/privacy.ts must export PRIVACY_AR and PRIVACY_EN')
  if (!mod.PRIVACY_AR || !mod.PRIVACY_EN) return

  assert.ok(mod.PRIVACY_AR.stored[0], 'PRIVACY_AR.stored must have at least one item')
  assert.ok(mod.PRIVACY_AR.stored[0]!.text.includes('فيسبوك'), 'PRIVACY_AR.stored[0] must name Facebook (فيسبوك)')
  assert.ok(mod.PRIVACY_AR.stored[0]!.text.includes('غوغل'), 'PRIVACY_AR.stored[0] must name Google (غوغل)')
  assert.ok(mod.PRIVACY_AR.deletion.includes('فيسبوك'), 'PRIVACY_AR.deletion must name Facebook (فيسبوك)')
  assert.ok(mod.PRIVACY_AR.deletion.includes('غوغل'), 'PRIVACY_AR.deletion must name Google (غوغل)')

  assert.ok(mod.PRIVACY_EN.stored[0], 'PRIVACY_EN.stored must have at least one item')
  assert.ok(mod.PRIVACY_EN.stored[0]!.text.includes('Facebook'), 'PRIVACY_EN.stored[0] must name Facebook')
  assert.ok(mod.PRIVACY_EN.stored[0]!.text.includes('Google'), 'PRIVACY_EN.stored[0] must name Google')
  assert.ok(mod.PRIVACY_EN.deletion.includes('Facebook'), 'PRIVACY_EN.deletion must name Facebook')
  assert.ok(mod.PRIVACY_EN.deletion.includes('Google'), 'PRIVACY_EN.deletion must name Google')
})

// ---------------------------------------------------------------------------
// Item 9
// ---------------------------------------------------------------------------

test('item 9: TERMS_VERSION is 2026-09-30.1 and compares greater than 2026-08-31.1 as the onboarding code compares it (spec section 4.1 item 9)', () => {
  // Widened to `string` on purpose: src/terms.ts exports TERMS_VERSION as a
  // bare `const`, so TypeScript infers it as the literal type of whatever
  // value is currently there. Comparing that literal against another
  // literal with assert.equal's `asserts actual is T` signature would
  // narrow the imported binding itself to the intersection of two
  // different string literals, i.e. `never`, and the `>` comparison below
  // would no longer typecheck. Reading it into a plain `string` first is
  // the fix, not a behaviour change.
  const version: string = TERMS_VERSION
  assert.ok(version === '2026-09-30.1', 'TERMS_VERSION must be bumped to 2026-09-30.1 (spec section 2.3)')
  // app/_lib/login-flow.ts compares `account.termsVersion < TERMS_VERSION` and
  // app/onboarding/actions.ts compares `account.termsVersion < TERMS_VERSION`
  // (app/onboarding/page.tsx: `account.termsVersion >= TERMS_VERSION`) -- a
  // plain JavaScript string comparison, not a semver parse. This asserts the
  // same operator the running code uses, not a parsed-version comparison.
  assert.ok(version > '2026-08-31.1', 'TERMS_VERSION must compare greater than 2026-08-31.1 by plain string comparison, the same comparison the app performs')
})


// ---------------------------------------------------------------------------
// Item 10 -- clause 6 frozen to spec section 2.3; clauses 1-5, 7, the intro
// and the closing frozen to their values on main at 9b8163c (confirmed by
// `git show 9b8163c:src/terms.ts` against this worktree's src/terms.ts
// before this file was written -- identical). Extracted from src/terms.ts
// by a script, not retyped by hand.
// ---------------------------------------------------------------------------

const FROZEN_CLAUSE_6_AR = "فيك تطفّي رابطك بأي وقت، وفيك تحذف حسابك بأي وقت. حذف الحساب نهائي وما فيك ترجع عنه: منمحي اسمك وربط حسابك بفيسبوك أو غوغل، وما بتقدر ترجع تفوت على نفس الحساب، ورابطك بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني."
const FROZEN_CLAUSE_6_EN = "You can switch your link off at any time, and you can delete your account at any time. Deleting is permanent and cannot be undone: we erase your display name and the connection to the Facebook or Google account you signed in with, you cannot sign back in to the deleted account, and your link stops working and is never given to anyone else."

const FROZEN_MAIN_9b8163c_INTRO_AR = "قبل ما تبلّش، لازم توافق على هالشروط:"
const FROZEN_MAIN_9b8163c_INTRO_EN = "Before you start, you must agree to these terms:"
const FROZEN_MAIN_9b8163c_CLOSING_AR = "بالضغط على \"موافق\" إنت مقرّ إنك قرأت هالشروط وقبلتها."
const FROZEN_MAIN_9b8163c_CLOSING_EN = "By tapping \"Agree\" you confirm you have read and accepted these terms."
const FROZEN_MAIN_9b8163c_CLAUSES_1_5_AR = ["الرسائل يلي بتوصلك ما بتشوف مين باعتها. هوية المُرسِل مخفية عنك. بس لازم تعرف: إدارة التطبيق بتقدر تشوف حساب المُرسِل، ومنستخدم هالشي فقط لمنع الإساءة أو إذا اضطرينا قانونياً.", "لتبعت رسالة لازم تكون مسجّل دخول. الرسالة بتوصل بدون اسمك للمستلم، بس مربوطة بحسابك عندنا.", "أي إساءة أو تهديد أو تحرّش أو نشر معلومات شخصية عن غيرك ممنوع، وهي مسؤوليتك الكاملة كمُستخدِم.", "منقدر نوقف حسابك أو رابطك بدون إنذار إذا انكسرت هالقواعد.", "الخدمة مخصصة لعمر ١٨ سنة وفوق."]
const FROZEN_MAIN_9b8163c_CLAUSES_1_5_EN = ["You will not see who sent the messages you receive. The sender's identity is hidden from you. But you should know: the app's administrators can see the sender's account, and we use that only to prevent abuse or where we are legally required to.", "You must be signed in to send a message. Your message reaches the recipient without your name, but it is linked to your account on our side.", "Abuse, threats, harassment, and posting other people's personal information are forbidden and are entirely your responsibility as a user.", "We may disable your account or your link without notice if these rules are broken.", "This service is for ages 18 and over."]
const FROZEN_MAIN_9b8163c_CLAUSE_7_AR = "بس لازم تعرف شو بيضل بعد الحذف: الرسائل يلي بعتها بتضل عند الإدارة مربوطة برقم حساب بلا اسم، والرسائل يلي وصلتك بتضل كمان، وجوابك بأي مصارحة متبادلة ما منقدر نشيله. هالشي مشان نقدر نمنع الإساءة وإذا اضطرينا قانونياً."
const FROZEN_MAIN_9b8163c_CLAUSE_7_EN = "You should know what remains after deletion: the messages you sent stay with the administration, attached to an account id with no name on it; the messages you received also stay; and your answer in any mutual reveal cannot be removed. This is so we can prevent abuse and meet a legal requirement if one arises."

test('item 10: clause 6 in both languages is byte-identical to spec section 2.3; clauses 1-5 and 7, the intro and the closing are byte-identical to main at 9b8163c (spec section 4.1 item 10)', () => {
  assert.equal(TERMS_TEXT_AR.clauses[5], FROZEN_CLAUSE_6_AR, 'Arabic clause 6 must be byte-identical to spec section 2.3')
  assert.equal(TERMS_TEXT_EN.clauses[5], FROZEN_CLAUSE_6_EN, 'English clause 6 must be byte-identical to spec section 2.3')

  assert.equal(TERMS_TEXT_AR.intro, FROZEN_MAIN_9b8163c_INTRO_AR, 'Arabic intro must be unchanged from main at 9b8163c')
  assert.equal(TERMS_TEXT_EN.intro, FROZEN_MAIN_9b8163c_INTRO_EN, 'English intro must be unchanged from main at 9b8163c')
  assert.equal(TERMS_TEXT_AR.closing, FROZEN_MAIN_9b8163c_CLOSING_AR, 'Arabic closing must be unchanged from main at 9b8163c')
  assert.equal(TERMS_TEXT_EN.closing, FROZEN_MAIN_9b8163c_CLOSING_EN, 'English closing must be unchanged from main at 9b8163c')

  assert.deepEqual(TERMS_TEXT_AR.clauses.slice(0, 5), FROZEN_MAIN_9b8163c_CLAUSES_1_5_AR, 'Arabic clauses 1-5 must be unchanged from main at 9b8163c')
  assert.deepEqual(TERMS_TEXT_EN.clauses.slice(0, 5), FROZEN_MAIN_9b8163c_CLAUSES_1_5_EN, 'English clauses 1-5 must be unchanged from main at 9b8163c')
  assert.equal(TERMS_TEXT_AR.clauses[6], FROZEN_MAIN_9b8163c_CLAUSE_7_AR, 'Arabic clause 7 must be unchanged from main at 9b8163c')
  assert.equal(TERMS_TEXT_EN.clauses[6], FROZEN_MAIN_9b8163c_CLAUSE_7_EN, 'English clause 7 must be unchanged from main at 9b8163c')
})

// ---------------------------------------------------------------------------
// Item 11
// ---------------------------------------------------------------------------

test('item 11: no terms clause in either language names Facebook without also naming Google (spec section 4.1 item 11)', () => {
  const AR_FACEBOOK = 'فيسبوك'
  const AR_GOOGLE = 'غوغل'
  const offenders: string[] = []

  TERMS_TEXT_AR.clauses.forEach((clause, i) => {
    if (clause.includes(AR_FACEBOOK) && !clause.includes(AR_GOOGLE)) offenders.push(`Arabic clause ${i + 1} names Facebook without Google: ${JSON.stringify(clause)}`)
  })
  TERMS_TEXT_EN.clauses.forEach((clause, i) => {
    if (clause.includes('Facebook') && !clause.includes('Google')) offenders.push(`English clause ${i + 1} names Facebook without Google: ${JSON.stringify(clause)}`)
  })

  assert.deepEqual(offenders, [], `clauses naming Facebook without Google: ${JSON.stringify(offenders)}`)
})

// ---------------------------------------------------------------------------
// Item 12
// ---------------------------------------------------------------------------

// React (react-dom/server's renderToStaticMarkup, same as every other
// server render path) escapes & " ' < > in text content. None of the
// PRIVACY_AR/PRIVACY_EN strings contain " < or >, but PRIVACY_EN.admin
// ("The app's administrators...") contains an apostrophe, so its rendered
// form in the HTML is "app&#x27;s", not "app's". This test asserts against
// the escaped form (react-dom's actual output) rather than decoding the
// rendered HTML back to plain text first -- decoding would have to
// reimplement an HTML entity decoder in the test just to throw the
// information back away.
function reactEscapedText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

test('item 12: the rendered /privacy HTML contains every PRIVACY_AR and PRIVACY_EN string, one li per stored item per language, a link to /account/delete, and .policy-return (spec section 4.1 item 12)', async () => {
  const mod = await loadPrivacy()
  assert.ok(mod.PRIVACY_AR && mod.PRIVACY_EN, 'src/privacy.ts must export PRIVACY_AR and PRIVACY_EN for this item to mean anything')

  const html = renderToStaticMarkup(PrivacyPage())

  if (mod.PRIVACY_AR) {
    for (const { field, value } of allPrivacyStrings(mod.PRIVACY_AR)) {
      assert.ok(html.includes(reactEscapedText(value)), `rendered /privacy HTML must contain PRIVACY_AR.${field}`)
    }
  }
  if (mod.PRIVACY_EN) {
    for (const { field, value } of allPrivacyStrings(mod.PRIVACY_EN)) {
      assert.ok(html.includes(reactEscapedText(value)), `rendered /privacy HTML must contain PRIVACY_EN.${field}`)
    }
  }

  if (mod.PRIVACY_AR && mod.PRIVACY_EN) {
    const hrIndex = html.search(/<hr\s*\/?>/)
    assert.ok(hrIndex >= 0, 'rendered /privacy HTML must contain an <hr /> separating the Arabic and English blocks (spec section 2.2)')
    const arHalf = hrIndex >= 0 ? html.slice(0, hrIndex) : html
    const enHalf = hrIndex >= 0 ? html.slice(hrIndex) : ''
    const arLiCount = (arHalf.match(/<li[\s>]/g) ?? []).length
    const enLiCount = (enHalf.match(/<li[\s>]/g) ?? []).length
    assert.equal(arLiCount, mod.PRIVACY_AR.stored.length, `expected one <li> per PRIVACY_AR.stored item (${mod.PRIVACY_AR.stored.length}) before the <hr />, got ${arLiCount}`)
    assert.equal(enLiCount, mod.PRIVACY_EN.stored.length, `expected one <li> per PRIVACY_EN.stored item (${mod.PRIVACY_EN.stored.length}) after the <hr />, got ${enLiCount}`)
  }

  const deleteLinkCount = (html.match(/href="\/account\/delete"/g) ?? []).length
  assert.ok(deleteLinkCount >= 2, `expected a link to /account/delete in both the Arabic and English blocks, found ${deleteLinkCount} occurrence(s)`)
  assert.ok(html.includes('حذف الحساب'), 'rendered /privacy HTML must contain the Arabic link label حذف الحساب')
  assert.ok(html.includes('Delete your account'), 'rendered /privacy HTML must contain the English link label "Delete your account"')

  assert.match(html, /<a[^>]*policy-return[^>]*>/, 'rendered /privacy HTML must still contain the .policy-return link (spec section 2.2)')
})

// ---------------------------------------------------------------------------
// Item 13
// ---------------------------------------------------------------------------

const SPEC_ACCOUNT_DELETE_ERASED_AR = "اسمك، وربط حسابك بفيسبوك أو غوغل، وقدرتك إنك ترجع تفوت على نفس الحساب، ورابطك، يلي بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني."
const OLD_FACEBOOK_ONLY_AR_PHRASE = "وربط حسابك بفيسبوك،"
const OLD_FACEBOOK_ONLY_EN_PHRASE = "connection to your Facebook account"

// Walks app/ and src/ (source files only -- not node_modules, not .next, not
// build output) looking for the two old Facebook-only forms spec section 2.4
// says must be gone. Both directories are small; a plain recursive walk is
// enough and does not need a glob dependency.
function walkSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...walkSourceFiles(full))
    } else if (st.isFile()) {
      out.push(full)
    }
  }
  return out
}

test('item 13: ACCOUNT_DELETE_ERASED_AR is byte-identical to spec section 2.4, and no file under app/ or src/ contains the old Facebook-only forms (spec section 4.1 item 13)', async () => {
  const mod = await loadPrivacy()
  assert.equal(typeof mod.ACCOUNT_DELETE_ERASED_AR, 'string', 'src/privacy.ts must export ACCOUNT_DELETE_ERASED_AR')
  if (typeof mod.ACCOUNT_DELETE_ERASED_AR === 'string') {
    assert.equal(mod.ACCOUNT_DELETE_ERASED_AR, SPEC_ACCOUNT_DELETE_ERASED_AR, 'ACCOUNT_DELETE_ERASED_AR must be byte-identical to spec section 2.4')
  }

  const offenders: string[] = []
  for (const dir of [path.join(REPO_ROOT, 'app'), path.join(REPO_ROOT, 'src')]) {
    for (const file of walkSourceFiles(dir)) {
      const text = readFileSync(file, 'utf8')
      if (text.includes(OLD_FACEBOOK_ONLY_AR_PHRASE)) offenders.push(`${path.relative(REPO_ROOT, file)} contains the old Arabic Facebook-only phrase`)
      if (text.includes(OLD_FACEBOOK_ONLY_EN_PHRASE)) offenders.push(`${path.relative(REPO_ROOT, file)} contains the old English Facebook-only phrase`)
    }
  }
  assert.deepEqual(offenders, [], `files still carrying the old Facebook-only forms: ${JSON.stringify(offenders)}`)
})

// ---------------------------------------------------------------------------
// Item 14
// ---------------------------------------------------------------------------

// Neither app/_lib/login-flow.ts nor app/onboarding/actions.ts exports a
// reusable "is this account behind on terms" predicate -- both inline the
// same plain JavaScript string comparison at the call site
// (`account.termsVersion < TERMS_VERSION` in login-flow.ts's
// resolveLoginAndRedirect and in onboarding/actions.ts's acceptTermsAction;
// app/onboarding/page.tsx inlines the complementary
// `account.termsVersion >= TERMS_VERSION`). There is no function to import,
// so this test reproduces that exact inline expression rather than
// inventing a predicate the app does not have.
test('item 14: an account on terms_version 2026-08-31.1 is routed to onboarding by the same check the app uses, and is not after recordTermsReacceptance with the new version (spec section 4.1 item 14)', async () => {
  const { db, client } = await freshDb()

  const { id: accountId } = await createAccount(db, { displayName: 'item14 account' })
  // fixtures.createAccount always writes termsVersion '2026-08-25', so it is
  // brought to the exact pre-week-19 version this item names by a direct
  // update -- there is no domain function that only changes terms_version
  // without appending a terms_acceptances row (that is recordTermsReacceptance
  // itself, which is the thing under test).
  await client.query(`update accounts set terms_version = $1 where id = $2`, ['2026-08-31.1', accountId])

  const { rows: beforeRows } = await client.query<{ terms_version: string }>(
    `select terms_version from accounts where id = $1`,
    [accountId],
  )
  const beforeVersion = beforeRows[0]!.terms_version
  assert.ok(
    beforeVersion < TERMS_VERSION,
    `an account on terms_version 2026-08-31.1 must be routed to onboarding, i.e. compare less than TERMS_VERSION (${TERMS_VERSION}) by the same plain string comparison app/_lib/login-flow.ts and app/onboarding/actions.ts use; got ${beforeVersion} < ${TERMS_VERSION} is false`,
  )

  await recordTermsReacceptance(db, { accountId, termsVersion: TERMS_VERSION, locale: 'ar' })

  const { rows: afterRows } = await client.query<{ terms_version: string }>(
    `select terms_version from accounts where id = $1`,
    [accountId],
  )
  const afterVersion = afterRows[0]!.terms_version
  assert.ok(
    !(afterVersion < TERMS_VERSION),
    `after recordTermsReacceptance with the new TERMS_VERSION, the account must no longer compare less than TERMS_VERSION; got ${afterVersion} < ${TERMS_VERSION} is true`,
  )

  await client.close()
})

