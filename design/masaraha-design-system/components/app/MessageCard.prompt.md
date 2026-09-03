A received confession. Body first at subtitle size, then hour and state, then actions.

```jsx
<MessageCard
  body="كنت دايماً أحسن مني بهاد الشي وما قلتلك."
  day="اليوم" hour={2} meridiem="ص"
  status="delivered"
  actions={<>
    <Button variant="reveal" size="sm">صارحني بدورك</Button>
    <Button variant="secondary" size="sm">خبيها</Button>
    <Button variant="ghost" size="sm">بلغ</Button>
    <Button variant="destructive" size="sm">احظر صاحبها</Button>
  </>}
/>
```

- No avatar, no initial, no "مجهول" label. The missing sender is the design.
- `status="hidden"` dims the card to 62% but keeps it in the list — hidden and reported messages are never removed.
- Long bodies use `truncate` (4-line clamp) rather than a fixed height.
