The single most important block in the product — where users get the link they will paste into a story.

```jsx
<LinkBlock slug="k7m2xq9had4v" enabled={on} copied={copied} onCopy={copy} onShare={share} onToggle={setOn} />
```

- Sits at the very top of `/inbox`, above the message list, on the citron veil with the widest radius in the system (28px).
- The URL well is LTR inside the RTL page; the slug itself is citron and bold, the domain muted.
- Disabled link: the well drops to 50% opacity and the hint copy changes. The block never disappears.
