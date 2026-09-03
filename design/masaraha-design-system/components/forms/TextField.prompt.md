Single-line input. Inset well against the card so the field reads as a hole, not a raised box.

```jsx
<TextField id="q" label="شو بدك تسأله؟" placeholder="اكتب سؤالك" maxLength={500} counter value={q} onChange={setQ} />
<TextField id="pw" label="كلمة السر" type="password" />
```

Errors replace the hint; the border goes `--danger-700`. Character counters use the mono font (Latin digits) — the only place Latin numerals are allowed.
