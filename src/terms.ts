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
// 2026-08-31 (week 10, docs/SPEC-week10-account-deletion.md §5): clause 6
// rewritten and clause 7 added, from BRIEF.md's "REVISED AGAIN 2026-08-31"
// text, on the same rule that rewrote clause 1 — the old clause 6 promised
// account deletion while six NOT NULL foreign keys made every account
// undeletable (spec §0). Clause 7 is new because deletion here is a
// tombstone, not an erasure (spec §1): it says plainly what still survives
// and why, so the confirmation screen at /account/delete is never softer
// than what a user already agreed to.
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

export const TERMS_VERSION = '2026-08-31.1'

export type TermsText = {
  intro: string
  clauses: string[]
  closing: string
}

export const TERMS_TEXT_AR: TermsText = {
  intro: 'قبل ما تبلّش، لازم توافق على هالشروط:',
  clauses: [
    'الرسائل يلي بتوصلك ما بتشوف مين باعتها. هوية المُرسِل مخفية عنك. بس لازم تعرف: إدارة التطبيق بتقدر تشوف حساب المُرسِل، ومنستخدم هالشي فقط لمنع الإساءة أو إذا اضطرينا قانونياً.',
    'لتبعت رسالة لازم تكون مسجّل دخول. الرسالة بتوصل بدون اسمك للمستلم، بس مربوطة بحسابك عندنا.',
    'أي إساءة أو تهديد أو تحرّش أو نشر معلومات شخصية عن غيرك ممنوع، وهي مسؤوليتك الكاملة كمُستخدِم.',
    'منقدر نوقف حسابك أو رابطك بدون إنذار إذا انكسرت هالقواعد.',
    'الخدمة مخصصة لعمر ١٨ سنة وفوق.',
    'فيك تطفّي رابطك بأي وقت، وفيك تحذف حسابك بأي وقت. حذف الحساب نهائي وما فيك ترجع عنه: منمحي اسمك وربط حسابك بفيسبوك، وما بتقدر ترجع تفوت على نفس الحساب، ورابطك بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني.',
    'بس لازم تعرف شو بيضل بعد الحذف: الرسائل يلي بعتها بتضل عند الإدارة مربوطة برقم حساب بلا اسم، والرسائل يلي وصلتك بتضل كمان، وجوابك بأي مصارحة متبادلة ما منقدر نشيله. هالشي مشان نقدر نمنع الإساءة وإذا اضطرينا قانونياً.',
  ],
  closing: 'بالضغط على "موافق" إنت مقرّ إنك قرأت هالشروط وقبلتها.',
}

export const TERMS_TEXT_EN: TermsText = {
  intro: 'Before you start, you must agree to these terms:',
  clauses: [
    "You will not see who sent the messages you receive. The sender's identity is hidden from you. But you should know: the app's administrators can see the sender's account, and we use that only to prevent abuse or where we are legally required to.",
    'You must be signed in to send a message. Your message reaches the recipient without your name, but it is linked to your account on our side.',
    "Abuse, threats, harassment, and posting other people's personal information are forbidden and are entirely your responsibility as a user.",
    'We may disable your account or your link without notice if these rules are broken.',
    'This service is for ages 18 and over.',
    'You can switch your link off at any time, and you can delete your account at any time. Deleting is permanent and cannot be undone: we erase your display name and the connection to your Facebook account, you cannot sign back in to that account, and your link stops working and is never given to anyone else.',
    'You should know what remains after deletion: the messages you sent stay with the administration, attached to an account id with no name on it; the messages you received also stay; and your answer in any mutual reveal cannot be removed. This is so we can prevent abuse and meet a legal requirement if one arises.',
  ],
  closing: 'By tapping "Agree" you confirm you have read and accepted these terms.',
}
