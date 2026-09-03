The product's payoff surface — dusty rose, widest radius, rose veil and glow when it resolves.

```jsx
<RevealPanel state="pending" viewpoint="sender"
  question="شو يلي خلاك تبعتلي هالرسالة هلق بالذات؟"
  stake="رح قلك شو كان رأيي فيك بالحقيقة أول ما تعرفنا."
  footer={<><Button variant="reveal">وافق وجاوب</Button><Button variant="secondary">لأ، مو هلق</Button></>} />

<RevealPanel state="resolved" senderName="سامر" senderAnswer="…" recipientAnswer="…" />
```

- On `resolved` the sender's **display name only** appears, centred at display size. Never an avatar, an initial, or a Facebook id.
- On `pending` neither side's answer is shown — not even to the person who wrote it into the offer.
- `declined` and `cancelled` are quiet: muted body text, no glow.
