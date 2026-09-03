# UI kit — مصارحة mobile app

Click-through recreation of every user-facing screen, designed at 390×844 and capped at 640px on desktop.

| File | Contains |
| --- | --- |
| `index.html` | The interactive prototype. Screen switcher at the top; the phone below is the real thing. |
| `desktop.html` | Desktop variants of `/inbox` and `/c/[slug]` side by side. |
| `Shell.jsx` | `PhoneShell` (390×844), shared style constants, re-exports of the design-system components. |
| `ScreensAuth.jsx` | `Landing` (`/`), `Onboarding` (`/onboarding`, the 18+ gate), `Legal` (`/terms`, `/privacy`). |
| `ScreensInbox.jsx` | `Inbox` (`/inbox`) with the link block, message list, the `OfferComposer` sheet, and `AccountDelete` (`/account/delete`). |
| `ScreensSend.jsx` | `SendPage` (`/c/[slug]`) in all six states, and `SentList` (`/sent`). |
| `ScreensReveal.jsx` | `OfferScreen` (`/offer/[offerId]`) — four states × two viewpoints. |
| `App.jsx` | The screen list and the click-through state machine. |

## States covered

- Inbox: empty, full, long message truncated, offer pending on a message, hidden, reported, link off.
- Send page: ready, typing, signed-out (typed text preserved), sent confirmation, link off, rate limit, blocked sender.
- Reveal: pending (sender deciding), pending (recipient waiting), resolved, declined, cancelled.
- Account deletion: confirm (type «حذف») and completed.

## Rules the kit obeys

- RTL everywhere; no English in the UI. Numbers are Arabic-Indic; the slug is the only Latin run.
- Timestamps are hour-only — `HourStamp`, never a minute or a relative phrase.
- No sender identity anywhere except a resolved `RevealPanel`, and there only a display name.
- No web fonts, no CDN icon sets, no images. Every shape is CSS.
