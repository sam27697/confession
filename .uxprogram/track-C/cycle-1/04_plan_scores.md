# Plan scores C1

## Scores
| Area | Concept | Tier | Impact | Principles | Distinctiveness | Effort | Safety | Maintainability | Weighted | Reason |
|---|---|---|---|---|---|---|---|---|---|---|
| draft-persistence | Manual Draft Save Button with Status Badge | Safe | 3 | 4 | 2 | 5 | 5 | 5 | 3.75 | Requires manual clicks to save rather than automatic passive resilience |
| draft-persistence | Scoped Ephemeral Draft Auto-Persistence with Interruption Recovery | Bold | 5 | 5 | 4 | 4 | 5 | 5 | 4.70 | Debounces confession text into sessionStorage scoped per slug, restoring on reload |
| draft-persistence | Cross-Device Cloud Draft Synchronization via Encrypted Handshake | Wild | 3 | 2 | 4 | 1 | 2 | 2 | 2.45 | Violates zero-auth and anonymous privacy constraints by introducing remote endpoints |
| reveal-inception | Static Form Labels with Copyable Question Prompt Snippets | Safe | 3 | 4 | 2 | 5 | 5 | 5 | 3.75 | Forces users to copy and paste text manually between DOM elements |
| reveal-inception | 1-Tap Interactive Prompt Insertion Chips with Zero-Keystroke Population | Bold | 5 | 5 | 5 | 4 | 5 | 4 | 4.75 | Converts passive datalist chips into accessible 1-tap triggers that instantly populate fields |
| reveal-inception | Web Speech API Arabic Voice Dictation Inception | Wild | 4 | 5 | 5 | 4 | 4 | 4 | 4.35 | Investigates hands-free Arabic speech recognition; within 10 percent of winner requiring spike |
| outbox-ergonomics | Chronological Pagination with Next/Prev Page Links | Safe | 3 | 4 | 2 | 5 | 5 | 5 | 3.75 | Divides items across page reloads without providing instant cognitive status categorization |
| outbox-ergonomics | Client-Side Instant Status Filter Tabs with Zero-Roundtrip Pill Navigation | Bold | 5 | 5 | 4 | 4 | 5 | 5 | 4.70 | Instant filtering between all, pending, and revealed confessions eliminates cognitive scanning |
| outbox-ergonomics | Swipe-to-Archive Gesture Actions with Off-Screen Tray Management | Wild | 3 | 3 | 4 | 2 | 3 | 3 | 3.00 | Gestural swipe actions conflict with scrolling and risk accidental message archiving |
| ambient-reassurance | Static Text Disclaimer Below Form Noting Unsaved Status Risk | Safe | 2 | 3 | 1 | 5 | 5 | 5 | 3.10 | Passive warning text does not reassure user or confirm that local save succeeded |
| ambient-reassurance | Subtle Live Saved-State Reassurance Indicator with Zero Layout Shift | Bold | 5 | 5 | 5 | 4 | 5 | 5 | 4.85 | Signature micro-indicator integrated beside character counter with polite screen reader announcement |
| ambient-reassurance | Full-Screen Floating Toast Banner on Every Input Keystroke | Wild | 2 | 1 | 3 | 3 | 3 | 3 | 2.30 | Annoying toast alerts flash constantly during typing, causing visual distraction |
