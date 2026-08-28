import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './harness.js'

// spec §4.2: "This test is the point: a future beat that adds sender_ip for
// 'debugging' gets a red build with a message pointing at terms clause 1
// and STACK.md."
const DENYLIST = [
  'sender_ip',
  'sender_user_agent',
  'session_id',
  'device_id',
  'referrer',
  'fingerprint',
  'geo',
  'country',
  'sender_ip_hash',
]

test('4.2.2 no column anywhere in the schema matches the surveillance-column denylist', async () => {
  const { client } = await freshDb()

  const rows = await client.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  )

  const offenders = rows.rows.filter((r) => DENYLIST.includes(r.column_name))

  assert.deepEqual(
    offenders,
    [],
    'terms clause 1 and STACK.md say the recipient cannot be deanonymised and the sender is not put under surveillance: ' +
      `found banned column(s) ${JSON.stringify(offenders)}. A confession app does not need sender_ip, ` +
      'sender_user_agent, session_id, device_id, referrer, fingerprint, geo, country or sender_ip_hash — ' +
      'the account id is sufficient for every purpose Sam named (STACK.md). Remove the column.',
  )

  await client.close()
})
