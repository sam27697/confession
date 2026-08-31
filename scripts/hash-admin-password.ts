// scripts/hash-admin-password.ts
//
// The developer-side counterpart to scripts/bootstrap-admin.mjs (spec
// §2.5). Reads a password from stdin -- never argv, which any other
// process on the same machine can read via `ps` -- and prints only the
// resulting hash on stdout. Never shipped in the runtime image (it is not
// copied into the Dockerfile).

import { hashAdminPassword } from '../src/admin-auth.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function main(): Promise<void> {
  const raw = await readStdin()

  // A single trailing newline is a shell or editor artefact, not part of
  // the password -- stripped once, from the end only, leaving the password
  // itself exact.
  let password = raw
  if (password.endsWith('\r\n')) {
    password = password.slice(0, -2)
  } else if (password.endsWith('\n')) {
    password = password.slice(0, -1)
  }

  if (password.length === 0) {
    console.error('hash-admin-password: no password read from stdin')
    process.exit(1)
    return
  }

  console.log(hashAdminPassword(password))

  // stderr, never stdout, which is piped by every existing $(...) use of
  // this script (spec week 9 §3, item 3): the hash contains '$' by format,
  // and Docker Compose interpolates $NAME in env_file values, so this value
  // must be wrapped in single quotes in .env or it reaches the container
  // truncated (spec §0.3).
  console.error('hash-admin-password: wrap this value in single quotes in .env -- it contains $ and Compose interpolates unquoted $NAME references')
}

main()
