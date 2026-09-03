The one switch in the product: whether your link still accepts messages.

```jsx
<Toggle id="link" checked={on} onChange={setOn} label="الرابط شغال" hint="لما تطفيه، ما حدا يقدر يبعتلك." />
```

RTL: the knob sits on the right when off and travels to the left edge… no — it travels to the **right** edge when on, matching the reading direction. Whole row is tappable, 48px minimum.
