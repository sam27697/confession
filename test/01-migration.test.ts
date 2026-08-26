import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './harness.js'

test('4.1.1 every migration file applies cleanly to an empty PGlite database, in order', async () => {
  const { client, migrations } = await freshDb()
  assert.ok(migrations.length >= 2, 'expected at least the generated table migration and the hand-written constraints migration')
  assert.deepEqual(
    [...migrations].sort(),
    migrations,
    'migration files must be applied in filename order',
  )

  const tables = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  )
  const names = tables.rows.map((r) => r.table_name)
  for (const expected of [
    'accounts',
    'terms_acceptances',
    'links',
    'confessions',
    'admin_reveal_log',
    'link_blocks',
    'reports',
    'send_counters',
    'reveal_offers',
    'reveal_answers',
  ]) {
    assert.ok(names.includes(expected), `expected table ${expected} to exist after migrations`)
  }

  await client.close()
})
