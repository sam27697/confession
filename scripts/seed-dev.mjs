// scripts/seed-dev.mjs
//
// Fills a local development database with two accounts, one link and three
// confessions, so the inbox, the send page and /sent have something to show
// without clicking through a signup.
//
// THIS SCRIPT IS DESTRUCTIVE. It truncates `accounts` and everything that
// cascades from it. It is not a fixture loader that adds to what is there;
// it replaces it. Two guards stand in front of that, because the cost of
// running it against the wrong DATABASE_URL is somebody's real data:
//
//   1. It refuses to run when NODE_ENV is production.
//   2. It refuses to run against a non-local database host unless
//      SEED_ALLOW_REMOTE=1 is set deliberately.
//
// Connection details come from DATABASE_URL, the same variable the app and
// migrate.mjs read. No credentials live in this file.
//
//   DATABASE_URL=postgres://user:pass@localhost:5432/confession_dev \
//     node scripts/seed-dev.mjs

import { randomUUID } from 'node:crypto'
import pg from 'pg'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', ''])

const url = process.env.DATABASE_URL
if (!url) {
  console.error('seed-dev: DATABASE_URL is not set')
  process.exit(1)
}

if (process.env.NODE_ENV === 'production') {
  console.error('seed-dev: refusing to run with NODE_ENV=production')
  process.exit(1)
}

const parsed = new URL(url)
const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || '(default)'
if (!LOCAL_HOSTS.has(parsed.hostname) && process.env.SEED_ALLOW_REMOTE !== '1') {
  console.error(`seed-dev: refusing to truncate a database on a non-local host (${parsed.hostname}).`)
  console.error('seed-dev: set SEED_ALLOW_REMOTE=1 if that is genuinely what you want.')
  process.exit(1)
}

// The created_hour column carries a CHECK, live since week 2, that rejects
// any value not truncated to the hour. Seeded rows have to satisfy it the
// same way real ones do.
function truncateToHour(at) {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), 0, 0, 0)
}

async function seed() {
  const client = new pg.Client({ connectionString: url })
  await client.connect()

  try {
    console.log(`seed-dev: truncating accounts (cascade) in ${dbName} on ${parsed.hostname || 'localhost'}`)
    await client.query('truncate accounts cascade')

    const createdHour = truncateToHour(new Date())

    const recipient = await client.query(
      `insert into accounts (id, provider, provider_user_id, display_name, terms_version, terms_accepted_at, age_attested_18)
       values ($1, 'facebook', 'devlogin:samer', 'سامر', '2026-08-25', now(), true)
       returning id`,
      [randomUUID()],
    )
    const recipientId = recipient.rows[0].id

    const link = await client.query(
      `insert into links (id, owner_account_id, slug, enabled)
       values ($1, $2, 'samer', true)
       returning id`,
      [randomUUID(), recipientId],
    )
    const linkId = link.rows[0].id

    const sender = await client.query(
      `insert into accounts (id, provider, provider_user_id, display_name, terms_version, terms_accepted_at, age_attested_18)
       values ($1, 'facebook', 'devlogin:maya', 'مايا', '2026-08-25', now(), true)
       returning id`,
      [randomUUID()],
    )
    const senderId = sender.rows[0].id

    await client.query(
      `insert into confessions (id, link_id, sender_account_id, body, created_hour, status)
       values ($1, $2, $3, $4, $7, 'delivered'),
              ($5, $2, $3, $6, $7, 'delivered'),
              ($8, $2, $3, $9, $7, 'delivered')`,
      [
        randomUUID(),
        linkId,
        senderId,
        'ما قدرت قلك وجهاً لوجه، فبعتلك هون.',
        randomUUID(),
        'كنت دايماً أحسن مني بهاد الشي وما قلتلك ولا مرة. صرلي سنتين عم فكر فيها.',
        createdHour,
        randomUUID(),
        'أنت أحسن شخص اتعرفت عليه هالسنة بالجامعة.',
      ],
    )

    console.log('seed-dev: recipient سامر, link slug "samer", sender مايا, 3 confessions')
    console.log('seed-dev: open /c/samer to send, /inbox as سامر to read')
  } finally {
    await client.end()
  }
}

seed().catch((err) => {
  console.error('seed-dev: ' + err.message)
  process.exit(1)
})
