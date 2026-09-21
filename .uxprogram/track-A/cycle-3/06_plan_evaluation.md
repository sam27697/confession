# Plan evaluation A3
EVALUATOR: R2
INDEPENDENCE: L2
VERDICT: APPROVE_WITH_CHANGES

## Notes
| ID | Sev | Where | Finding | Reason | Required change |
|---|---|---|---|---|---|
| E01 | S2 | T01 | Form grouping of confirmation checkbox and delete button | The elevated safe return button ("رجوع بلا حذف") should not visually sever the required checkbox from the destructive delete button for users proceeding with deletion. | Ensure the confirmation checkbox and delete button remain grouped within a dedicated deletion form container below the data balance card. |
| E02 | S2 | T02 | Policy return link fallback on standalone or deep tab visits | When /terms or /privacy is opened directly in a new tab without history or referrer, a plain relative back link might fail if unanchored. | Ensure the return navigation anchors to a stable fallback (/inbox for signed-in users, / for guests). |
| E03 | S2 | T03 | Screen-reader label accessibility for tab volume badges | Screen readers reading tab labels with adjacent numeric pills might read disjointed numbers without context. | Ensure the tab link or badge includes accessible context (e.g. aria-label indicating total count). |

## Blind scores
| Concept | Impact | Principles | Distinctiveness | Effort | Safety | Maintainability | Reason |
|---|---|---|---|---|---|---|---|
| Static In-App Return Button | 3 | 4 | 2 | 4 | 5 | 5 | Clean, dependable fallback return anchor for secondary documents. |
| Context-Aware Floating Return Landmark | 4 | 5 | 4 | 4 | 4 | 4 | High-clarity return anchor that provides context of the originating view. |
| Slide-Over Legal Sheet Drawer with Gesture Dismiss | 4 | 4 | 5 | 3 | 3 | 3 | Engaging modal drawer experience, though higher client scripting complexity. |
| Stacked Alert Consolidation into Single Warning | 3 | 4 | 2 | 3 | 5 | 5 | Simplifies multiple alerts into one, but retains visual anxiety. |
| Structured Data Sovereignty Balance Card with Elevated Safe Exit | 5 | 5 | 4 | 4 | 4 | 4 | Transforms high-anxiety deletion into clear data ledger with prominent safe exit. |
| Multi-Step Deletion Audit Stepper with Token Revocation Simulation | 4 | 4 | 5 | 2 | 3 | 3 | Deep multi-step audit simulation, but adds substantial friction and code complexity. |
| Plain Text Message Totals in Subtitle | 3 | 3 | 2 | 3 | 5 | 5 | Low-cost volume recognition, but easy to overlook in secondary text. |
| Inset Numeric Pill Badges on Wayfinding Nav Tabs | 4 | 5 | 4 | 4 | 4 | 4 | Crisp ambient situational awareness directly on primary navigation tabs. |
| Real-Time Animated Pulse Badge with Audio Feedback | 3 | 3 | 5 | 3 | 3 | 3 | Playful auditory and motion feedback, but risks sensory annoyance and battery drain. |
| Plain Static Breadcrumb Trail | 3 | 3 | 2 | 3 | 5 | 5 | Standard desktop breadcrumb trail, but occupies vertical space on mobile. |
| Contextual Action Breadcrumb Header with Tactile Safe Return | 4 | 5 | 4 | 4 | 4 | 4 | Streamlined header component combining parent title context with thumb-friendly return. |
| Floating Gesture-Based Navigation Ring with Quick History Wheel | 3 | 3 | 5 | 3 | 2 | 2 | Novel gesture ring, but high gesture conflict risk with mobile browser back swipes. |
