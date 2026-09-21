# Self-review B3

REVIEWER: R3 (implementer self-review)
CYCLE_BASE: e4a9505381d8abbd17442c76c6ab2667a54dfd2f
HEAD: 28324d4
DATE: 2026-09-21

## 1. Scope and diff
- Files changed: 9 (1 product file, 8 test files) -- within the 12-file limit.
- Lines: 571 changed (522 added, 49 removed) -- within the 700-line cycle budget.
- Negative space over the whole cycle: PASS, 0 warnings (.uxprogram/logs/20260921-125650-b3-close-negative.log).
- Authorship over the whole cycle: PASS after the two repairs below (.uxprogram/logs/20260921-124024-b3-t04-authorship.log).
- Only app/globals.css changed under app/. No component, no route, no client JS.

## 2. Visual craft and the design system
- Signature element: one global :focus-visible rule, a 2px citron outline at 2px offset over a 2px --ground-deep separation band with an 8px citron glow (T01). It replaces a bare box-shadow ring that disappeared against the indigo ground, and it is one rule, so every interactive element in the app gets it at once.
- The compose well on /c/[slug] answers focus with an inset citron border and a 16px inset glow, transitioned on --dur-hover and --ease-standard (T02). field-sizing and the height bounds are untouched, so nothing shifts.
- The empty containers on /inbox and /sent carry a citron radial vignette and a codified hairline (T03).
- The class layer no longer writes a colour, a blur or a tap target as a raw literal (T04). 20 white-overlay literals, 14 backdrop blurs and 2 tap targets are now named tokens; 14 new tokens define them, all in a :root block of this app's own, below the five blocks mirrored from design/masaraha-design-system/tokens/. Those five are byte-identical and untouched, which test/62 asserts directly.

## 3. Findings
| ID | Sev | Area | Finding | Status |
|---|---|---|---|---|
| B3-SR01 | S1 | design-of-record | The B3-T03 commit added a veil to /sent, which spec section 3.5 forbids in bold, and in the same edit replaced the comment that was the rule's only trace in the stylesheet. The change itself is defensible -- section 3.5 describes /sent as a list of .msg rows and an empty /sent has no list in it, the same surface the empty /inbox has washed since week 11 -- but a design of record that disagrees with the code and says so nowhere is a defect regardless of which side is right. | RESOLVED in 28324d4. Rule, reading and the one-edit revert written above .sent-empty; judgement recorded as D-011. |
| B3-SR02 | S1 | authorship | Five em-dashes in the T02 and T03 sources. authorship_scan.py bans the character outright and runs inside the project gate, so the cycle could not have closed with them present. | RESOLVED in 6f48845. |
| B3-SR03 | S2 | test-brittleness | Four checks from cycles A2, A3 and B2 asserted a 44px tap target by searching app/globals.css for the string "44px", so codifying that literal broke them although the rendered value never changed. | RESOLVED in 64c588d. Widened to accept var(--tap-compact) as well, the shape test/56 and test/58 already used for var(--tap-min). test/62 pins the token at 44px, so the guarantee is resolved rather than matched as text. |
| B3-SR04 | S3 | process | T01, T02 and T03 shipped with no tasks/T0n.result.md, and the cycle had no 08 through 13 documents at all. The implementing sessions stopped after each checks-pass run. | RESOLVED. Records written at close from each task's checks file and evidence logs, and marked as written after the fact. |

No S0 findings. Every S1 is fixed and re-verified.

## 4. Accessibility and RTL
- The focus halo is the cycle's accessibility work: WCAG 2.4.7 and 2.4.11, one rule, offset chosen so it does not clip on a 390px viewport.
- No directional glyph, no logical property and no text direction changed in this cycle.
- No motion added. T02's transition is on the existing --dur-hover token, which the reduced-motion clamp already pins to 1ms.
- The spike honoured prefers-reduced-motion by drawing one static frame, and was dropped anyway.

## 5. Token and client-JS discipline
- Client component count unchanged at 5. The spike would have made it 6 and was dropped partly for that.
- Token adoption 48.1% -> 50.4% by the cycle scanner, 64.7% -> 67.4% by the test/27 ratio.
- No @import, no url(), no @font-face -- test/62 AC4 asserts all three.
