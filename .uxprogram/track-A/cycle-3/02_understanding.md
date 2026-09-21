# Understanding A3

## State of the product
Confession has completed Round 2 across all four UX tracks with 369 automated tests passing and zero AI authorship tells. In Round 3 Cycle A3, our structural UX lens addresses secondary view navigation continuity, data sovereignty transparency, and ambient volume feedback: /terms and /privacy currently form dead ends with zero in-app return navigation; /account/delete fragments warning notices and buries the non-destructive exit below the irreversible submit button; and /inbox and /sent lack summary volume indicators across navigation tabs and list headers.

## Personas
- Samer (26, Mobile Web): Navigating to /terms or /privacy from an in-app link. Cannot find an in-app return button and feels trapped in the legal text on standalone mobile screens. Context: ASSUMPTION.
- Maya (23, iOS Safari): Considering deleting her account. Wants to know exactly what data is purged vs kept, but is intimidated by 3 disjoint danger notices and fears accidentally tapping the delete button before seeing the back link. Context: ASSUMPTION.
- Hani (21, Active Host): Visits /inbox daily. Has received multiple confessions and sent several. Wants to know at a glance how many total confessions exist without scrolling through every card. Context: ASSUMPTION.

## Job stories
- When I read terms or privacy policies from an in-app screen, I want a clear in-app return button, so I can return to my previous flow without losing my place or relying on browser gestures.
- When I consider deleting my account, I want a structured breakdown of what is erased vs what remains with a prominent safe exit, so I can make an informed decision with complete psychological safety.
- When I navigate my inbox and outbox, I want ambient count indicators, so I immediately recognize message volumes across tabs.

## Root causes
- RC-A301: Missing in-app return navigation on secondary informational views (/terms, /privacy) (A3-P01)
- RC-A302: High-anxiety unstructured account deletion view with buried safe exit (/account/delete) (A3-P02, A3-P04)
- RC-A303: Absence of quantitative message count badges in navigation wayfinding (/inbox, /sent) (A3-P03)
- RC-A304: Lack of contextual return breadcrumb or back cues on deep action flows (A3-P04)

## Opportunities
| Rank | ID | Root cause | Impact | Frequency | Reach | Confidence | Effort | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | RC-A301 | In-app return navigation buttons on /terms and /privacy | 4 | 4 | 5 | 3 | 1 | 240.0 |
| 2 | RC-A303 | Quantitative message volume badges on inbox and outbox wayfinding tabs | 4 | 5 | 4 | 3 | 2 | 120.0 |
| 3 | RC-A302 | Structured two-column data sovereignty breakdown with prominent safe exit on /account/delete | 5 | 2 | 3 | 3 | 1 | 90.0 |
| 4 | RC-A304 | Contextual back cues on deep action flows | 3 | 3 | 3 | 3 | 1 | 81.0 |

## Design principles audit
- Absolute anonymity by construction: KEEP (bedrock invariant).
- Sincere, unhurried Arabic voice: KEEP (cultural resonance).
- Reciprocal warmth over cold closure: KEEP (Principle 5 from D1).
- Safe exits and sovereign wayfinding: KEEP (Principle 6 from A2).
- Terminal dead ends on informational views: KILL (violates navigation continuity).
- Unstructured anxiety-inducing destructive warnings: KILL (violates user dignity and emotional safety).
