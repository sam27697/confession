# Week 14 - the copy contract, enforced by the build

*Frozen 2026-09-22 before any code. Measured against `main` at `09de582` and
against both live origins, not read off a report.*

## §0 What was measured

### §0.1 Finding A - `main` claims the product is 100% anonymous, and the database says otherwise

`app/page.tsx` on `main` renders, as step 2 of the three-step discovery walk:

```
توصلك رسايل صادقة ومجهولة 100% بدون أي تتبع أو تسجيل لبيانات المرسل.
```

"You receive honest, 100% anonymous messages, with no tracking and no
recording of the sender's data whatsoever."

That sentence is false, and it is false three different ways at once.

1. **The schema contradicts it.** `confessions.sender_account_id` is `NOT NULL`
   by design. `admin_reveal_log` exists precisely so that an operator can
   resolve a confession to the Facebook account that sent it. The sender's data
   is recorded; recording it is the feature.
2. **The app's own pages contradict it.** `app/privacy/page.tsx` line 29 reads
   «إدارة التطبيق فيها تشوف مين بعت أي رسالة، وكل مرة حدا من الإدارة يشوف هالشي
   بينسجل بسجل ثابت مايتغير.» The signup terms a user accepts two screens later
   say the same thing in clause 1. The landing page and the terms disagree about
   the central fact of the product, and the landing page is the one a stranger
   reads first.
3. **It breaks Sam's positioning instruction.** 2026-08-25: «بدنا نضحي بالسرية
   شوي وما شرط نعومها او نتفاخر فيها». No boasting about secrecy. «مجهولة 100%»
   is the boast, in the largest type on the front door.

The same commit (`3756745`, "A2-T03") also replaced the hero. Sam's approved
sentence «تطبيق مصارحة سرية.» is gone from the landing page and in its place is
«مصارحة سرية بصدق وأمان», an unapproved safety claim, above a second overclaim:
«شارك أفكارك ومشاعرك بحرية تامة وبدون أي خوف من كشف الهوية» ("share with
complete freedom and with no fear at all of your identity being revealed"),
which is not true for a sender whose account the operator can read and whose
name a mutual reveal can disclose.

**Measured from outside tonight, and this is the good news:** neither live
origin serves any of it. `https://confession.fayad.app/` and
`https://stg.confession.fayad.app/` both still serve «تطبيق مصارحة سرية» and
neither contains «مجهولة 100%» or «بدون أي تتبع». Production runs
`confession-web:5148cec`, which predates the claim. The defect is on `main`,
staged for a deploy that has not happened. It was caught on the way out, not
after it shipped.

### §0.2 Finding B - the copy rule was written down and did not hold

`docs/SPEC-week13-landing.md` §2 already says this, frozen 2026-09-14:

> **No word of the landing page's user-facing text is added, removed, reworded
> or reordered.** [...] Sentence 1 is Sam's positioning decision of
> 2026-08-25, quoted in `work/confession-app/BRIEF.md`, and this slice is a
> typography repair with no standing to touch it.

Week 13's own landing work is still uncommitted in a worktree, eight days old,
while a later pass rewrote the very sentences that spec froze. A rule that lives
only in a document is a rule that a later pass cannot see. The tripwire in §3 is
the actual deliverable of this slice; the copy repair in §2 is the smaller half.

This repository already knows the pattern. Week 2 turned "no sender IP column"
from a sentence into a test that enumerates `information_schema.columns`. Week 6
found that the "no request-header reads" rule had been a manual grep redone by
hand each week, and made the build enforce it. Product claims are the third
thing in that family and the only one still unguarded.

### §0.3 Finding C - the terms card still shows a fifth of the terms with no affordance

Carried forward from `docs/SPEC-week13-landing.md` §0.2 and re-measured on
`main`: `app/onboarding/page.tsx` puts 2056px of Arabic and English terms into a
`.card--inset` with `max-height` and `overflow-y: auto` and no affordance of any
kind. Seven clauses can be accepted having seen four. Week 13 wrote the repair
and never committed it. It lands here.

---

## §1 Scope

1. `app/page.tsx` - the three user-facing claims named in §0.1.
2. `app/onboarding/page.tsx` + `app/globals.css` - week 13 §4.2's scroll
   affordance, unchanged from that spec.
3. `test/63-copy-contract.test.ts` - new, the tripwire.

**Out of scope, named so nobody widens the slice:** the terms text itself, the
privacy page, the schema, any route, any server action, any form `action=`, any
field `name=`, any redirect target, the inbox, the send page, the outbox, the
offer page, the admin surfaces, and the structure of the three-step walk
(`.home-hero`, `.home-steps`, `.home-step`, `.home-step__badge`,
`.home-step__text` all stay exactly as they are, and so does the ordering
assertion in `test/41-home-discovery.test.ts`).

**No existing test is edited by this slice.** Verified before freezing: no test
under `test/` asserts on the strings being replaced (`grep -n
"100%\|خوف\|بصدق وأمان\|تتبع" test/*.ts` returns nothing), and
`test/41-home-discovery.test.ts` asserts structure and the substring «استقبل»,
which the repair keeps. If a test does turn red, the fix is in this slice's
code, never in that test.

---

## §2 The copy repair

### §2.1 The hero returns to Sam's approved words

`app/page.tsx`, inside `.home-hero`:

```jsx
<h1>تطبيق مصارحة سرية.</h1>
<p className="hint">الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.</p>
```

Both sentences byte for byte as Sam approved them and as week 13 §3.1 and §3.2
froze them. The elements and classes are `main`'s, not week 13's, so no CSS
changes and no class-inventory change.

### §2.2 Step 2 says what the system does

```jsx
<p className="home-step__text"><strong>استقبل بصراحة:</strong> الرسائل توصلك بلا اسم المرسل، وهويته مخفية عنك. إدارة التطبيق بس فيها تشوف مين بعت، ومنستخدمها لمنع الإساءة.</p>
```

This is terms clause 1 restated in the same breath, which is the standing rule
for this product: the truth goes in the sentence a user actually reads, not in a
policy nobody opens. «مخفية عنك» and not «مجهولة»: hidden from *you*, which is
the real guarantee and the only one the schema earns. The admin half is in the
same sentence as the anonymity half, never in a following paragraph.

Levantine, no emoji, no em-dash, no percentage, ends with a full stop.

### §2.3 Steps 1 and 3 are untouched

Step 1 («شارك رابطك») and step 3 («صارحني بدورك») make no claim the system does
not keep. They ship byte for byte.

### §2.4 The terms card affordance

Exactly as `docs/SPEC-week13-landing.md` §4.2 specifies it, including the
requirement that the fade sit outside the scrolling box, carry
`pointer-events: none`, use the existing `--veil-fade-bottom` token, and ship
unconditionally with the reason in the rule's comment. One new string, the hint
that spec permits:

```
مرّر لتقرا كل الشروط.
```

---

## §3 The tripwire - what the build must refuse from now on

`test/63-copy-contract.test.ts`. It reads the source; it does not need a
database or a browser.

### §3.1 The forbidden-claim sweep

Collect every user-facing text run under `app/` (`**/*.tsx`, plus any `.ts` that
holds display copy) and fail on any of these, wherever they appear:

| pattern | why it is forbidden |
|---|---|
| `100%` next to any of «مجهول», «سري», «خصوصية», «أمان», or on its own in a claim sentence | a quantified absolute this product cannot keep |
| «بدون أي تتبع», «ما منتبع», «ما منسجل», «بلا تسجيل» | the sender's account is recorded, always |
| «مجهول تماما», «مجهول تماماً», «مجهولة تماما», «سري تماما», «سرية تامة», «بحرية تامة» | absolute secrecy, which clause 1 denies |
| «ما منعرف مين», «ما حد يعرف مين», «ولا حد يعرف» | the operator knows, by Sam's decision of 2026-08-25 |
| «بدون أي خوف», «ما في خوف» applied to identity disclosure | a mutual reveal discloses identity by design |
| `anonymous` or `anonymity` in user-facing English copy without the admin clause in the same element | same rule, other language |

The assertion message must quote terms clause 1 and Sam's 2026-08-25 sentence,
so that whoever hits this in six months reads the reason and not only the rule.
Week 2's column tripwire is the precedent for that and it is the reason it has
never been "fixed" by deleting it.

Comments are excluded from the sweep. A comment is not shipped to a user, and a
rule that fires on the prose explaining itself is a rule that gets deleted.

### §3.2 The paired-truth invariant on the landing page

If `app/page.tsx` contains any of «مخفية», «متخفية», «بلا اسم», «سرية» in
user-facing text, it must also contain «إدارة التطبيق». The landing page is not
allowed to describe the anonymity half of the system without the operator half
on the same screen.

### §3.3 Sam's approved sentences are pinned

`app/page.tsx` must contain, byte for byte:

- `تطبيق مصارحة سرية.`
- `الناس تقدر تبعتلك أي شي وهي متخفية عنك. وإذا حدا حب يصارحك أكتر، فيه ميزة اسمها «صارحني بدورك» بتكشف مين هو، بس إذا هو وافق.`

Sourced from `work/confession-app/BRIEF.md` and `SPEC-week13-landing.md` §3, not
from the current file. A pin read out of the file it is pinning proves nothing.

### §3.4 The legally approved sender disclosure is still where it was

The line above the send button, «اسمك ما بيوصل للي عم تبعتله. بس رسالتك مربوطة
بحسابك عنا، وإدارة التطبيق بتقدر تشوفه.», is approved copy and is already
asserted elsewhere. This file asserts it too, because §3.1's sweep must never be
satisfiable by deleting the truthful sentence instead of the false one.

### §3.5 The terms affordance

- `app/onboarding/page.tsx` renders the terms card inside a positioned wrapper,
  with the fade as the card's sibling and not its child.
- The fade rule carries `pointer-events:none`.
- The fade uses `var(--veil-fade-bottom)`.
- The hint string from §2.4 is present.
- Every class this slice adds is defined exactly once in `app/globals.css` and
  used at least once under `app/`, so week 11's class-inventory invariant holds.

---

## §4 What must measurably be true afterwards

1. `tsc --noEmit` exits 0.
2. The full suite passes with zero failures and zero skips, and the count is
   higher than tonight's 415 by exactly the number of items §3 adds.
3. Putting the false claim from §0.1 back into `app/page.tsx` turns
   `test/63-copy-contract.test.ts` red. Restoring the repair byte for byte turns
   it green again. Both directions are run, not reasoned about.
4. Staging serves the repaired landing page over the real certificate, verified
   with `bin/asam.sh check` from outside the box, and `curl` from outside finds
   «تطبيق مصارحة سرية» and finds neither «مجهولة 100%» nor «بدون أي تتبع».
5. Production the same, after staging.
6. The running containers' logs are re-measured after that traffic, and the
   report states what is written and for how long.

---

## §5 Rejected alternatives, written down

### §5.1 Rejected - reword step 2 and stop there

The cheapest fix and the one that guarantees a fourth occurrence. Three separate
copy passes have now edited this product's claims: week 12's «جوابها» gender
slip, week 13's frozen rule, and A2-T03's rewrite. The pattern is not
carelessness by one author, it is an unguarded surface. A document that says
"do not overclaim" has already been tried and is what §0.2 records failing.

### §5.2 Rejected - ban the word «مجهول» outright

Too blunt and it would fail on truthful sentences. «مجهولة عنك» is accurate.
The sweep in §3.1 targets absolutes and quantifiers, which are the shape a false
claim actually takes, and §3.2 requires the operator clause alongside, which is
what makes a secrecy word honest in context.

### §5.3 Rejected - restore week 13's landing markup wholesale

Week 13's `.landing` / `.landing-pitch` structure is a clean repair of a problem
`main` has since solved differently: `main`'s `.home-hero` gives `/` a real `h1`
and its explainer is already `.hint`, which was week 13 §0.1's entire complaint.
Reverting to week 13's markup would re-open a solved typography problem in order
to fix a copy problem. The copy is what is wrong. Week 13's CSS half is
therefore dropped and its reason recorded here; only its §4.2 affordance, which
`main` never solved, is carried forward.

### §5.4 Rejected - require scroll-to-bottom before the terms checkbox enables

Still out of scope, for the reason week 13 §6.3 gave: whether consent requires
proof of reading is a product decision for Sam, not a typography repair. It is
not in this slice and it is not smuggled into the tripwire.

### §5.5 Rejected - a release checklist item instead of a test

A checklist is a manual grep with extra steps. Week 6 already measured what
happens to those.

---

## §6 Process rules for this slice

- This spec is committed before any code, and it is not edited to match what
  the code turned out to be. An amendment gets its own numbered section with its
  reason, the same as week 6 §6.1 and week 10 §6.1.
- The acceptance file in §3 is written by a different author than the copy
  repair in §2, in its own worktree, without reading the repair.
- The suite is re-run and the mutation check in §4.3 is performed by the
  reviewer, not reported by the author.
