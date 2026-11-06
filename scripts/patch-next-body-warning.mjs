// Take the URL out of Next's "Request body exceeded" warning (week 34 spec).
//
//   node scripts/patch-next-body-warning.mjs [dir]           patch dir, default node_modules/next/dist
//   node scripts/patch-next-body-warning.mjs --check <dir>   verify, change nothing
//
// When a POST body that reaches the middleware passes 10 MB, Next's
// cloneBodyStream() logs `Request body exceeded 10MB for <path and query>`.
// The sender picks the path and the query, so the sender picks text in our
// log (week 33 spec §6.1). This rewrites
//
//   urlInfo = readable.url ? ` for ${readable.url}` : ''
//
// to `urlInfo = ''` in every copy of that code under the directory. The
// warning itself stays. A copy this script does not recognise fails the run,
// so a Next upgrade that moves the code stops the build instead of shipping
// the old line. package.json runs the patch and then the check over
// .next/standalone as postbuild, so node_modules is never changed (spec §6).

import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs'
import path from 'node:path'

const WARNING = 'Request body exceeded'
// How far either side of the warning text a url may sit and still be part of
// the same statement. The real copies keep it within about 60 characters.
const WINDOW = 400
const ASSIGNMENT = /([\w$]+)\s*=\s*([\w$]+)\.url\s*\?\s*` for \$\{\2\.url\}`\s*:\s*(''|"")/g
// Any part of the request the sender writes, reached as `.name`, `?.name`,
// `['name']`, a destructure or object key (`{url: u}`, `{ url }`,
// `{url = ''}`) or a bare `${name}` (week 34 spec §7, review F3; week 35
// spec §1). This knows the shapes, nothing more: a url read further away
// than WINDOW, or through a name not listed here, still passes.
const NAMES = 'url|originalUrl|nextUrl|href|pathname|search|searchParams|query|headers|rawHeaders'
const ANY_URL = new RegExp(
  [
    String.raw`(?:[\w$)\]]\s*|\?)\.\s*(?:${NAMES})(?![\w$])`,
    String.raw`\[\s*['"\x60](?:${NAMES})['"\x60]\s*\]`,
    String.raw`[{,]\s*(?:${NAMES}|'(?:${NAMES})'|"(?:${NAMES})")\s*(?:[:,}]|=(?!=))`,
    String.raw`\$\{\s*(?:${NAMES})\s*\}`,
  ].join('|'),
)

function fail(message) {
  console.error(`patch-next-body-warning: ${message}`)
  process.exit(1)
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = lstatSync(full)
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) walk(full, out)
    else if (st.isFile() && name.endsWith('.js')) out.push(full)
  }
  return out
}

function targets(dir) {
  return walk(dir, []).filter((file) => readFileSync(file, 'utf8').includes(WARNING))
}

// True when any occurrence of the warning still has a url within reach.
function carriesUrl(text) {
  let at = text.indexOf(WARNING)
  while (at !== -1) {
    if (ANY_URL.test(text.slice(Math.max(0, at - WINDOW), at + WINDOW))) return true
    at = text.indexOf(WARNING, at + WARNING.length)
  }
  return false
}

function check(dir) {
  const found = targets(dir)
  if (found.length === 0) fail(`no file under ${dir} contains "${WARNING}"; nothing was checked`)
  for (const file of found) {
    const text = readFileSync(file, 'utf8')
    if (text.match(ASSIGNMENT) || carriesUrl(text)) fail(`${file} still puts the request url in the warning`)
  }
  console.log(`patch-next-body-warning: ${found.length} file(s) checked, none carries the url`)
}

function patch(dir) {
  const found = targets(dir)
  if (found.length === 0) fail(`no file under ${dir} contains "${WARNING}"; has Next moved this code?`)
  for (const file of found) {
    const text = readFileSync(file, 'utf8')
    const matches = text.match(ASSIGNMENT) ?? []
    if (matches.length > 1) fail(`${file} has ${matches.length} url assignments, expected one`)
    if (matches.length === 0) {
      if (carriesUrl(text)) fail(`${file} puts the url in the warning in a form this script does not know`)
      console.log(`already patched ${file}`)
      continue
    }
    const patched = text.replace(ASSIGNMENT, (_, name) => `${name} = ''`)
    if (carriesUrl(patched)) fail(`${file} still carries a url after the patch`)
    writeFileSync(file, patched)
    console.log(`patched ${file}`)
  }
  console.log(`patch-next-body-warning: ${found.length} file(s)`)
}

const args = process.argv.slice(2)
if (args[0] === '--check') {
  if (!args[1]) fail('usage: --check <dir>')
  check(args[1])
} else if (args.length <= 1) {
  patch(args[0] ?? path.join('node_modules', 'next', 'dist'))
} else {
  fail(`unknown arguments: ${args.join(' ')}`)
}
