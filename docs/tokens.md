# Design Tokens Contract v1

PROJECT: confession
THEME: dark-only
DIRECTION: rtl
AUTHORITATIVE_SOURCE: design/masaraha-design-system/
IMPLEMENTATION_FILE: app/globals.css
BASELINE_TOKEN_ADOPTION: 60.1%

## 1. Colors

### Ground and surfaces
- --ground-deep: #030206 (behind everything, edges and scrims)
- --ground: #070512 (page background)
- --surface-1: #120E22 (default card container, panel)
- --surface-2: #1A1530 (raised card, active input well, hover)
- --surface-3: #231C42 (pressed state, selected row)
- --surface-inset: #05030A (wells: code, slug, textarea)

### Hairlines and borders
- --line: #282142 (default 1px container border)
- --line-strong: #3A315C (border on raised or focused cards)
- --line-faint: #1A142D (dividers inside cards)
- --danger-line: rgba(255,92,77,0.25) (hairline on a destructive panel; the step between --danger-wash and --danger-700)

### Text hierarchy
- --text-1: #F2EFFF (primary body and headings)
- --text-2: #AAA2C2 (muted labels, descriptions, captions)
- --text-3: #6A6187 (disabled state, placeholder, hour stamp)
- --text-on-accent: #1A1F06 (high-contrast dark text on citron buttons)
- --text-on-reveal: #2A1014 (high-contrast dark text on rose buttons)

### Primary brand: Acid Citron
- --citron-100: #F2FBC8
- --citron-300: #E4F78F
- --citron-500: #D6F25B (brand primary action color)
- --citron-700: #A8C233
- --citron-900: #5E6E1C
- --citron-glow: rgba(214,242,91,.22)
- --citron-wash: rgba(214,242,91,.10)

### Signature mechanic: Dusty Rose (Reciprocal Reveal)
- --rose-100: #F8DDE2
- --rose-300: #EFBCC5
- --rose-500: #E39BA8 (reserved strictly for mutual reveal)
- --rose-700: #B06A78
- --rose-900: #5E3038
- --rose-glow: rgba(227,155,168,.24)
- --rose-wash: rgba(227,155,168,.10)

### Semantic statuses
- --danger-500: #FF5C4D (destructive actions, report, delete)
- --danger-700: #B93A2F
- --danger-wash: rgba(255,92,77,.12)
- --pending-500: #F0B95B (waiting on reciprocal confirmation)
- --pending-wash: rgba(240,185,91,.12)
- --hidden-500: #8E7F79 (muted hidden disclosure)
- --hidden-wash: rgba(142,127,121,.12)

### Semantic aliases
- --bg-page: var(--ground)
- --bg-card: var(--surface-1)
- --bg-card-raised: var(--surface-2)
- --bg-field: var(--surface-inset)
- --bg-scrim: rgba(13,9,8,.72)

---

## 2. Typography

### Font families (Zero external CDN, system faces only)
- --font-ar: system-ui,-apple-system,Tahoma,Arial,sans-serif (native Arabic system face)
- --font-latin: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif (Latin fallback)
- --font-mono: ui-monospace,SFMono-Regular,Menlo,Consolas,Courier New,monospace (slugs, code)

### Type scale (Mobile-first at 390px)
- --size-display-xl: 44px (payoff hero, share headline)
- --size-display: 34px (screen title hero)
- --size-title: 26px (section titles)
- --size-subtitle: 20px (card heading, confession hero prose)
- --size-body: 17px (default readable text)
- --size-body-sm: 15px (secondary hints, legal clauses)
- --size-caption: 13px (badges, chips, metadata)
- --size-micro: 12px (hour stamp, technical ids)

### Line heights
- --lh-display: 1.24
- --lh-title: 1.34
- --lh-body: 1.75 (generous breathing room for complex Arabic ascenders/descenders)
- --lh-tight: 1.5

### Weights and tracking
- --weight-regular: 400
- --weight-medium: 500
- --weight-bold: 700
- --weight-black: 800
- --tracking-ar: 0 (STRICT: zero letter-spacing on Arabic to preserve cursive ligatures)
- --tracking-latin: .02em

---

## 3. Spacing and Layout

### Base 4px scale
- --space-1: 4px
- --space-2: 8px
- --space-3: 12px
- --space-4: 16px
- --space-5: 20px
- --space-6: 24px
- --space-8: 32px
- --space-10: 40px
- --space-12: 48px
- --space-16: 64px
- --space-20: 80px

### Layout metrics
- --gutter: 20px (page edge padding on mobile)
- --gutter-desktop: 24px
- --content-max: 640px (desktop maximum width container)
- --stack-card: 14px (vertical gap between stacked message cards)
- --stack-field: 10px (gap between label and input control)
- --card-pad: 18px
- --card-pad-lg: 22px

### Touch and control metrics
- --tap-min: 48px (minimum ergonomic touch target)
- --control-h: 52px (primary button and input height)
- --control-h-sm: 40px (compact action button)
- --safe-bottom: 28px (home-bar avoidance padding on modern iOS/Android)
- --tap-compact: 44px (iOS HIG floor, for secondary in-line navigation: nav tabs and breadcrumbs)
- --space-hair: 2px (sub-4px inset used by pill badges; not part of the 4px scale, which is why it is named)

---

## 4. Radius

### Radius steps
- --radius-xs: 8px
- --radius-sm: 14px
- --radius-md: 18px
- --radius-lg: 28px
- --radius-xl: 36px
- --radius-pill: 999px

### Asymmetric speech notch and components
- --radius-notch: 10px
- --radius-bubble: var(--radius-lg) var(--radius-lg) var(--radius-notch) var(--radius-lg) (RTL incoming confession: notch bottom-left)
- --radius-bubble-out: var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-notch) (RTL outgoing confession)
- --radius-card: 32px
- --radius-field: 20px
- --radius-button: var(--radius-pill)
- --radius-chip: var(--radius-pill)

---

## 5. Effects and Shadows

### Depth and elevation
- --shadow-card: 0 1px 0 rgba(245,239,233,.03) inset, 0 8px 24px -12px rgba(13,9,8,.9)
- --shadow-raised: 0 2px 2px -1px rgba(13,9,8,.6), 0 18px 40px -20px rgba(13,9,8,1)
- --shadow-sheet: 0 -8px 40px -8px rgba(13,9,8,.95)
- --shadow-press: 0 1px 0 rgba(13,9,8,.5) inset

### Luminous glows and focus rings
- --glow-citron: 0 0 0 1px var(--citron-700), 0 10px 30px -12px var(--citron-glow)
- --glow-rose: 0 0 0 1px var(--rose-700), 0 12px 36px -12px var(--rose-glow)
- --glow-danger: 0 0 0 1px var(--danger-700), 0 10px 30px -14px rgba(255,92,77,.3)
- --ring-focus: 0 0 0 2px var(--ground), 0 0 0 4px var(--citron-500)

### Frost overlays and backdrop blur (B3-T04)
The white wash that lifts a glass surface off the indigo ground, named for its
alpha because the alpha is the only thing that varies.
- --frost-05: rgba(255,255,255,0.05) (notice, chip, secondary button fill)
- --frost-06: rgba(255,255,255,0.06) (card hairline, empty-state hairline)
- --frost-08: rgba(255,255,255,0.08) (sticky header hairline, panel hairline)
- --frost-10: rgba(255,255,255,0.1) (chip and notice hairline, nav hover fill)
- --frost-12: rgba(255,255,255,0.12) (selected row hairline)
- --frost-20: rgba(255,255,255,0.2) (nav hover hairline)
- --frost-40: rgba(255,255,255,0.4) (inset top highlight on a filled button)

Backdrop blur scale. Used only with a frost fill; the admin surfaces set
`backdrop-filter: none` and take neither.
- --blur-sm: blur(8px) (chip, compose scrim)
- --blur-md: blur(12px) (secondary button)
- --blur-lg: blur(16px) (notice)
- --blur-glass: blur(24px) saturate(180%) (card, sticky header, empty state)

### Atmospheric veils (Mathematical radial washes, zero assets)
- --veil-citron: radial-gradient(circle at 15% 50%, rgba(214,242,91,0.2), transparent 50%), radial-gradient(circle at 85% 30%, rgba(227,155,168,0.15), transparent 50%), radial-gradient(circle at 50% 80%, rgba(214,242,91,0.1), transparent 50%)
- --veil-rose: radial-gradient(circle at 15% 50%, rgba(227,155,168,0.25), transparent 50%), radial-gradient(circle at 85% 30%, rgba(214,242,91,0.15), transparent 50%), radial-gradient(circle at 50% 80%, rgba(227,155,168,0.1), transparent 50%)
- --veil-deep: linear-gradient(180deg, var(--ground-deep) 0%, var(--ground) 42%)
- --veil-fade-bottom: linear-gradient(180deg, rgba(21,15,14,0) 0%, var(--ground) 88%)

---

## 6. Motion

### Durations and easings
- --dur-instant: 90ms
- --dur-fast: 150ms
- --dur-hover: 150ms (standard hover feedback duration)
- --dur-base: 220ms
- --dur-slow: 420ms
- --dur-reveal: 900ms (unhurried unmasking cadence)
- --ease-out: cubic-bezier(.22,.61,.36,1)
- --ease-standard: cubic-bezier(.22,.61,.36,1) (standard easing curve for interactive controls)
- --ease-in-out: cubic-bezier(.4,0,.2,1)
- --ease-enter: cubic-bezier(.16,.84,.44,1)
- --ease-bounce: cubic-bezier(.34,1.4,.64,1)

### Micro-interaction metrics
- --press-scale: .97
- --hover-lift: -1px
- --transition-control: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-instant) var(--ease-out)

### Accessibility motion clamping
Under @media (prefers-reduced-motion: reduce):
- --dur-fast: 1ms
- --dur-hover: 1ms
- --dur-base: 1ms
- --dur-slow: 1ms
- --dur-reveal: 1ms
- --press-scale: 1 (prevents motion displacement)

---

## 7. Base and Ground Specification
- Theme: Strict Dark Mode only (color-scheme: dark). Light mode is deliberately disabled.
- Direction: Native Right-to-Left (dir=rtl). Directional arrows, icons, and notch positions are mirrored by construction.
- Network Privacy: Absolute zero third-party font, icon, or tracking stylesheet requests.
- Token adoption: Current measured adoption across global CSS rules is 50.4% by the test/62 measure (every `prop: value;` declaration that references a token, floor 50%) and 67.7% by the test/27 ratio (var() references over declarations, floor 60%). B3-T04 raised the first from 48.1% to 50.3% and the second from 64.7% to 67.4%; week 15 (docs/SPEC-week15-service-softening.md section 5.4) holds them at 50.4% and 67.7%. The UX program's own scanner, token_scan.py, was retired with the program on 2026-09-23; test/62 applies the same definition.
