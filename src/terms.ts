// src/terms.ts
//
// The terms text a user accepts at signup (spec §3.4), copied VERBATIM from
// `work/confession-app/BRIEF.md` → "Draft — signup terms acceptance step" →
// the REVISED text dated 2026-08-25 10:3x. This is not the struck-through
// original in that file's <details> block, which said the admin cannot see
// the sender — that sentence is false under the current schema and must
// never ship again.
//
// Not re-worded, not summarised, not "improved" here. If the wording needs
// to change, the change happens in BRIEF.md first, because that is the copy
// Sam approved; this file follows it, on the next terms_version bump.
//
// A note on the one piece of literal markdown carried over: English clause 1
// bolds "from you" in the source ("...is hidden **from you**. But you should
// know: the app's administrators can see...") — that emphasis is doing real
// work, distinguishing "hidden from the recipient" from "hidden from
// everyone", and BRIEF.md's Arabic clause 1 has no equivalent markup. Kept
// as literal `**from you**` characters rather than silently dropped or
// converted to some other markup, since dropping it would be a rewording
// this file is not authorised to make. Whatever renders this page decides
// how (or whether) to interpret `**...**` — that decision is outside this
// file's scope.

export const TERMS_VERSION = '2026-08-25.1'

export type TermsText = {
  intro: string
  clauses: string[]
  closing: string
}

export const TERMS_AR: TermsText = {
  intro: 'قبل ما تبلّش، لازم توافق على هالشروط:',
  clauses: [
    'الرسائل يلي بتوصلك ما بتشوف مين باعتها — هوية المُرسِل مخفية عنك. بس لازم تعرف: إدارة التطبيق بتقدر تشوف حساب المُرسِل، ومنستخدم هالشي فقط لمنع الإساءة أو إذا اضطرينا قانونياً.',
    'لتبعت رسالة لازم تكون مسجّل دخول. الرسالة بتوصل بدون اسمك للمستلم، بس مربوطة بحسابك عندنا.',
    'أي إساءة أو تهديد أو تحرّش أو نشر معلومات شخصية عن غيرك ممنوع، وهي مسؤوليتك الكاملة كمُستخدِم.',
    'منقدر نوقف حسابك أو رابطك بدون إنذار إذا انكسرت هالقواعد.',
    'الخدمة مخصصة لعمر ١٨ سنة وفوق.',
    'فيك تطفّي رابطك أو تحذف حسابك بأي وقت.',
  ],
  closing: 'بالضغط على "موافق" إنت مقرّ إنك قرأت هالشروط وقبلتها.',
}

export const TERMS_EN: TermsText = {
  intro: 'Before you start, you must agree to these terms:',
  clauses: [
    "You will not see who sent the messages you receive — the sender's identity is hidden **from you**. But you should know: the app's administrators can see the sender's account, and we use that only to prevent abuse or where we are legally required to.",
    'You must be signed in to send a message. Your message reaches the recipient without your name, but it is linked to your account on our side.',
    "Abuse, threats, harassment, and posting other people's personal information are forbidden and are entirely your responsibility as a user.",
    'We may disable your account or your link without notice if these rules are broken.',
    'This service is for ages 18 and over.',
    'You can switch your link off or delete your account at any time.',
  ],
  closing: 'By tapping "Agree" you confirm you have read and accepted these terms.',
}
