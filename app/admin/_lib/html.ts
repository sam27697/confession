// The whole of the escaping surface for admin HTML (spec §8.2). The reveal
// route builds its response through this file and nothing else, because
// react-dom/server cannot be imported from app/** (spec §7, §8.0) and a
// hand-built HTML response needs its own proven escaper rather than a
// template string that happens to look right.
//
// html() returns a branded SafeHtml value, not a string. htmlResponse() only
// accepts that brand, so a concatenated string is a type error at the call
// site -- the type system is the enforcement (spec §8.1).

export type SafeHtml = { readonly __safeHtml: string }

function isSafeHtml(value: unknown): value is SafeHtml {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { __safeHtml?: unknown }).__safeHtml === 'string'
  )
}

// Exactly five characters, & first or every other replacement below would
// get escaped a second time (spec §8.2). Nothing else is touched: Arabic
// text, emoji and astral-plane characters pass through byte for byte.
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function render(value: unknown): string {
  if (value === null || value === undefined || value === false) {
    return ''
  }
  if (Array.isArray(value)) {
    return value.map(render).join('')
  }
  if (isSafeHtml(value)) {
    return value.__safeHtml
  }
  return escape(String(value))
}

// Interleaves the literal chunks of the template -- trusted, because they
// are source text -- with the interpolated values, which are not (spec
// §8.2). A SafeHtml value nested inside is inserted verbatim; anything else
// is stringified and escaped.
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0]
  for (let i = 0; i < values.length; i++) {
    out += render(values[i]) + strings[i + 1]
  }
  return { __safeHtml: out }
}

// The only function that turns admin HTML into a Response. Takes a SafeHtml
// and nothing else -- never a string, at the type level and, for a caller
// that reached this through `any`, at runtime too (spec §8.2).
export function htmlResponse(document: SafeHtml, status: number): Response {
  if (!isSafeHtml(document)) {
    throw new TypeError('htmlResponse requires a SafeHtml value produced by html()')
  }
  return new Response(document.__safeHtml, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // The revealed identity must not be cacheable anywhere between here
      // and the browser (spec §3.3).
      'Cache-Control': 'no-store',
    },
  })
}

// Wraps a body fragment in the full document. A route handler's response
// does not pass through app/layout.tsx, so nothing links globals.css for it
// and the page would render unstyled. The palette and font stack below are
// copied from globals.css rather than linked, because Next hashes the
// stylesheet's filename at build time and this file has no way to know it.
// The block is literally constant -- no `${` anywhere inside it, which is
// what spec §8.4 rule 4 requires.
export function revealDocument(title: string, body: SafeHtml): SafeHtml {
  return html`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
:root {
  color-scheme: dark;
  --bg: #14121a;
  --panel: #1e1b26;
  --border: #322d3d;
  --text: #ece8f5;
  --muted: #a79fc0;
  --accent: #d98a4a;
  --danger: #c25a5a;
}
* { box-sizing: border-box; }
html { direction: rtl; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  line-height: 1.7;
  font-size: 17px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, Arial, sans-serif;
}
main { max-width: 640px; margin: 0 auto; padding: 20px 16px 64px; }
h1 { line-height: 1.4; }
a { color: var(--accent); }
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin: 0 0 16px;
}
.muted { color: var(--muted); font-size: 14px; }
.error { color: var(--danger); font-size: 15px; }
.pre { white-space: pre-line; }
</style>
</head>
<body>
<main>${body}</main>
</body>
</html>`
}
