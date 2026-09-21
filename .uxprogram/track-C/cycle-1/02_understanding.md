# Understanding C1: Effort, Ergonomics & Cognitive Load

## Core user problems
1. **Fear of Lost Confession Work:** Users writing heartfelt, vulnerable Arabic confessions often spend several minutes composing. If an interruption occurs (tab reload, incoming phone call, low battery shutdown), the entire draft vanishes instantly.
2. **High Friction in Mutual Reveal Inception:** Proposing a reciprocal question currently requires typing from scratch or manually copying text from passive datalists/chips, introducing up to 40 unnecessary keystrokes.
3. **Outbox Clutter & Cognitive Scanning:** As the outbox grows, users cannot easily distinguish between pending, resolved, and declined confessions without scanning every card.

## Root causes
- RC-C01: Ephemeral compose state without local draft auto-persistence or session restoration (CP-01, CP-04)
- RC-C02: Manual entry friction on mutual reveal inputs due to passive non-interactive prompt suggestion elements (CP-02)
- RC-C03: Flat unfiltered outbox structure causing cognitive fatigue when tracking multiple sent messages (CP-03)
- RC-C04: Lack of immediate visual draft saving status indicator, leaving users anxious about work retention (CP-04)

## Opportunities
| Rank | ID | Root cause | Impact | Frequency | Reach | Confidence | Effort | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | RC-C01 | Auto-saving draft engine with instant reload restoration | 5 | 5 | 5 | 5 | 2 | 312.5 |
| 2 | RC-C02 | 1-tap interactive prompt chip insertion for mutual reveal | 4 | 5 | 5 | 5 | 2 | 250.0 |
| 3 | RC-C04 | Subtle live draft status indicator (تم الحفظ محلياً) | 4 | 5 | 5 | 4 | 1 | 400.0 |
| 4 | RC-C03 | Instant outbox status filter tabs (الكل / معلّق / مكشوف) | 3 | 4 | 4 | 4 | 2 | 96.0 |

## Strategic approach
1. Implement client-side draft auto-persistence in `DraftManager` / `CharacterMeter` using safe browser storage scoped strictly per link slug, with clean clearing upon confirmed successful delivery.
2. Transform passive prompt chips in `RevealCard` into interactive 1-tap accelerators that instantly populate the corresponding form field with zero keystrokes.
3. Provide an accessible, reassuring draft indicator showing saved state without creating ambient distraction or layout shift.
