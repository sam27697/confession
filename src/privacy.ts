// src/privacy.ts
//
// Everything /privacy says, in both languages, and the database tables each
// sentence is about (week 19 spec, section 2.1). The page renders this module
// and nothing else, so the words a user reads and the list a test checks
// against the migrated schema are the same object.
//
// A new table is not finished until an item here names it, or it is listed
// in PRIVACY_EXEMPT_TABLES with the reason it holds nothing about a user.
// test/69 reads the real migrated database and fails otherwise.
//
// The strings are frozen by the spec. Change them there first.

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

export const PRIVACY_AR: PrivacyText = {
  heading: 'سياسة الخصوصية',
  storedIntro: 'هيك منخزن معلومات عنك بالظبط:',
  stored: [
    { tables: ['accounts'], text: 'رقم حسابك واسمك من فيسبوك أو غوغل، حسب يلي سجلت فيه، ووقت ما فتحت الحساب. ما منطلب إيميلك، وما منخزن صورتك ولا قائمة رفقاتك.' },
    { tables: ['terms_acceptances', 'accounts'], text: 'موافقتك على الشروط: أي نسخة وافقت عليها ووقتها، وإنك أكدت إنك عمرك ١٨ سنة أو أكتر.' },
    { tables: ['links'], text: 'رابطك، وإذا كان شغال أو مطفي.' },
    { tables: ['confessions'], text: 'نص كل رسالة، ومين بعتها ولمين، والساعة يلي انبعتت فيها (مش الدقيقة بالظبط).' },
    { tables: ['reveal_offers', 'reveal_answers'], text: 'بالمصارحة المتبادلة: السؤال، والجواب يلي بيكتبه كل طرف، ووقت كل خطوة.' },
    { tables: ['link_blocks', 'reports'], text: 'إذا حظرت حدا أو بلّغت عن رسالة: مين حظرت، والتبليغ مع سببه، ووقتهن.' },
    { tables: ['send_counters'], text: 'عداد لكل ساعة بعدد الرسائل يلي بعتها لكل رابط، مشان نحط حد للإزعاج.' },
  ],
  admin: { tables: ['admin_reveal_log'], text: 'إدارة التطبيق فيها تشوف مين بعت أي رسالة، وكل مرة حدا من الإدارة يشوف هالشي بينسجل بسجل ثابت ما بيتغير.' },
  sharing: 'ما منبيع ولا منشارك شي من هالمعلومات مع حدا، وما منستعملها لإعلانات. يلي بيجينا من فيسبوك أو غوغل منستعمله بس لنعرف مين إنت جوا التطبيق.',
  cookies: 'منحط بمتصفحك كوكي تسجيل دخول، وكم كوكي بيعيشوا دقايق وقت تسجيل الدخول نفسه. ما في كوكيز إعلانات ولا تتبع. الرسالة يلي عم تكتبها بتنحفظ مسودة بمتصفحك بس، مش عنا.',
  deletion: 'إذا حذفت حسابك: منمحي اسمك وربط حسابك بفيسبوك أو غوغل، ورابطك بيبطّل يشتغل. الرسائل يلي بعتها بتضل عند الإدارة مربوطة برقم حساب بلا اسم، والرسائل يلي وصلتك بتضل، وجوابك بأي مصارحة متبادلة ما منقدر نشيله.',
  never: 'هيك ما منجمع أبداً: عنوان الـ IP تبعك، نوع جهازك أو متصفحك، موقعك، أو جهات اتصالك.',
}

export const PRIVACY_EN: PrivacyText = {
  heading: 'Privacy policy',
  storedIntro: 'What we store, exactly:',
  stored: [
    { tables: ['accounts'], text: 'The account id and name from the Facebook or Google account you signed in with, and when you created your account here. We do not ask for your email address, and we do not store your photo or your friends list.' },
    { tables: ['terms_acceptances', 'accounts'], text: 'Your acceptance of the terms: which version, when, and that you confirmed you are 18 or older.' },
    { tables: ['links'], text: 'Your link, and whether it is switched on or off.' },
    { tables: ['confessions'], text: 'The text of each message, who sent it and to whom, and the hour it was sent (not the exact minute).' },
    { tables: ['reveal_offers', 'reveal_answers'], text: 'In a mutual reveal: the question, the answer each side writes, and when each step happened.' },
    { tables: ['link_blocks', 'reports'], text: 'If you block someone or report a message: who you blocked, the report and its reason, and when.' },
    { tables: ['send_counters'], text: 'An hourly count of the messages you sent to each link, so we can limit spam.' },
  ],
  admin: { tables: ['admin_reveal_log'], text: "The app's administrators can see who sent a message, and every such lookup is written to a permanent, unchangeable record." },
  sharing: 'We do not sell or share any of this with anyone, and we do not use it for advertising. What we receive from Facebook or Google is used only to know who you are inside the app.',
  cookies: 'We set one sign-in cookie in your browser, plus a few that last minutes during sign-in itself. There are no advertising or tracking cookies. A message you are still writing is kept as a draft in your browser only, not on our side.',
  deletion: 'If you delete your account: we erase your name and the connection to your Facebook or Google account, and your link stops working. Messages you sent stay with the administration, attached to an account id with no name on it; messages you received stay; and your answer in any mutual reveal cannot be removed.',
  never: 'What we never collect: your IP address, your device or browser, your location, or your contacts.',
}

export const PRIVACY_EXEMPT_TABLES: Readonly<Record<string, string>> = {
  admin_users: 'the administrators\' own usernames and password hashes, nothing about a user of the app',
}

// The 'what is erased' line on /account/delete. It lives here rather than in
// the page because the page cannot render without a signed-in account, and
// this is the sentence that has to match terms clause 6.
export const ACCOUNT_DELETE_ERASED_AR = 'اسمك، وربط حسابك بفيسبوك أو غوغل، وقدرتك إنك ترجع تفوت على نفس الحساب، ورابطك، يلي بيبطّل يشتغل ونهائياً ما منعطيه لحدا تاني.'
