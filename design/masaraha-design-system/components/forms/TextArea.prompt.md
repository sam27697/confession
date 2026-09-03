The writing surface. `hero` turns it into the whole screen on `/c/[slug]`.

```jsx
<TextArea id="body" hero rows={7} placeholder="اكتب اللي بقلبك…" maxLength={4000} value={body} onChange={setBody} />
<TextArea id="ans" label="جوابك" hint="جوابك محفوظ من هلق وما فيك تغيّره بعدين." rows={4} />
```

Never auto-grows past the viewport; never shows a resize handle. What the visitor typed must survive a sign-in redirect — keep the value in state, not in the DOM.
