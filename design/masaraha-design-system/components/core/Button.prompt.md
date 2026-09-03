The single action affordance — pill-shaped, Arabic, one `primary` per screen at most.

```jsx
<Button variant="primary" size="lg" block>تسجيل دخول بفيسبوك</Button>
<Button variant="reveal">صارحني بدورك</Button>
<Button variant="secondary" size="sm">خبيها</Button>
<Button variant="destructive" size="sm">احظر صاحبها</Button>
```

- `variant="reveal"` (dusty rose) is reserved for the mutual-reveal mechanic. Do not use it for ordinary confirmations.
- `variant="destructiveSolid"` only on the account-deletion and admin-reveal screens, where the button must feel heavy.
- `block` for anything that is the screen's one action on mobile; keeps the 48px tap floor.
- Disabled is 40% opacity, no glow — used by the onboarding age gate before both boxes are ticked.
