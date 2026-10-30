// Run INSIDE a freshly built image, as the image's own user, before that
// image replaces anything (week 32 spec). deploy.sh feeds this file to the
// image's node on stdin:
//
//   docker run --rm -i --network none --entrypoint node <image> \
//     --input-type=module - /usr/local/bin/docker-entrypoint.sh /app < check-image-readable.mjs
//
// Every argument is a path that must be usable by whoever runs this: a
// directory must be readable and enterable, a file readable, and the first
// argument (the entrypoint) also executable. Directories are walked. A
// symlink is checked by what it points at, and a dangling one is a failure.
//
// Week 31: the tree was untarred under umask 077, every file came out 600
// owned by root inside the image, the container user could not read the
// entrypoint and production answered 503 for eleven minutes while deploy.sh
// waited for a container that could never start. This check is what would
// have refused that image before it was swapped in.

import { accessSync, constants, lstatSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const LIMIT = 20

const [entrypoint, ...roots] = process.argv.slice(2)
if (!entrypoint) {
  console.error('check-image-readable: usage: <entrypoint> [dir-or-file ...]')
  process.exit(2)
}

const bad = []
let checked = 0

function fail(p, why) {
  bad.push(`${p}: ${why}`)
}

function can(p, mode) {
  try {
    accessSync(p, mode)
    return true
  } catch {
    return false
  }
}

function visit(p) {
  checked++
  let st
  try {
    st = lstatSync(p)
  } catch (err) {
    fail(p, `cannot stat (${err.code ?? err.message})`)
    return
  }
  if (st.isSymbolicLink()) {
    try {
      st = statSync(p)
    } catch (err) {
      fail(p, `symlink target missing or unreachable (${err.code ?? err.message})`)
      return
    }
    // A symlinked directory is checked but not walked: its target is
    // either inside a root already being walked or outside the app.
    if (st.isDirectory()) {
      if (!can(p, constants.R_OK | constants.X_OK)) fail(p, 'directory not readable and enterable')
      return
    }
  }
  if (st.isDirectory()) {
    if (!can(p, constants.R_OK | constants.X_OK)) {
      fail(p, 'directory not readable and enterable')
      return
    }
    for (const name of readdirSync(p)) visit(path.join(p, name))
    return
  }
  if (!can(p, constants.R_OK)) fail(p, 'not readable')
}

checked++
if (!can(entrypoint, constants.R_OK | constants.X_OK)) {
  fail(entrypoint, 'entrypoint not readable and executable')
}
for (const root of roots) visit(root)

const uid = typeof process.getuid === 'function' ? process.getuid() : '?'
if (bad.length > 0) {
  console.error(`check-image-readable: ${bad.length} of ${checked} paths are unusable by uid ${uid}:`)
  for (const line of bad.slice(0, LIMIT)) console.error(`  ${line}`)
  if (bad.length > LIMIT) console.error(`  ... and ${bad.length - LIMIT} more`)
  process.exit(1)
}
console.log(`check-image-readable: ${checked} paths usable by uid ${uid}`)
