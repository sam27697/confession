The app's only navigation. Two destinations for a signed-in user; none for a visitor.

```jsx
<AppHeader active="inbox" onNavigate={go} />
<AppHeader signedIn={false} />          // landing, /c/[slug]
<AppHeader plain active="reports" />    // /admin — no glass, no warmth
```

Glass (`--glass-bg` + `--glass-blur`) appears here and on bottom bars only. The admin variant drops it deliberately: the operator instrument is plainer than the product.
