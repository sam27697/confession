// test/posix-shell.ts
//
// Resolves the bash the deploy-script tests should spawn.
//
// scripts/check-deploy-pairing.sh, scripts/read-env-key.sh and deploy.sh are
// POSIX shell and are exercised by test/13-deploy-pairing.test.ts and
// test/18-admin-hardening.test.ts through spawnSync. Those tests used to
// spawn the bare name 'bash'. On Linux and macOS that is the right shell. On
// Windows it resolves to C:\Windows\System32\bash.exe, which is the WSL
// launcher, not a shell that shares this filesystem: it is handed a Windows
// path like C:\repo\scripts\check-deploy-pairing.sh, cannot find anything by
// that name under its own root, and exits 127. Twenty-one tests then failed
// on every Windows checkout for a reason that had nothing to do with the
// scripts they were written to protect -- and these are exactly the scripts
// week 5 added after deploy.sh deployed the wrong stack and exited 0, so
// they are the last ones that should be silently unrun on a developer's own
// machine.
//
// Git for Windows ships a real bash that does share this filesystem and does
// understand Windows paths. Prefer it on win32, fall back to whatever is on
// PATH, and leave every other platform exactly as it was.

import { existsSync } from 'node:fs'

const WINDOWS_BASH_CANDIDATES = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
]

function resolveBash(): string {
  if (process.platform !== 'win32') return 'bash'
  const fromEnv = process.env.BASH_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  return WINDOWS_BASH_CANDIDATES.find((candidate) => existsSync(candidate)) ?? 'bash'
}

/**
 * The bash executable to hand to spawnSync for a POSIX script in scripts/.
 * Set BASH_PATH to override the Windows lookup.
 */
export const BASH = resolveBash()
