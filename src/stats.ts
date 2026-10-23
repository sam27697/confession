// src/stats.ts
//
// The numbers behind /admin/stats (docs/SPEC-week29-admin-numbers.md). Counts
// only: nothing in the result names an account, a link or a message. There is
// no count of distinct senders or recipients anywhere (spec §6): beside a
// count of messages it groups the messages by sender, and one logged reveal
// would then name the sender of the whole group. The privacy page promises
// every such lookup is logged.
//
// Days are computed and formatted inside Postgres. node-postgres turns a
// `date` into a JavaScript Date at the server's local midnight, and the
// server does not run in Dubai.

import { sql } from 'drizzle-orm'
import type { Db } from './db.js'
import {
  accounts,
  confessions,
  linkBlocks,
  links,
  reports,
  revealOffers,
  withheldMessages,
} from './schema.js'

export const STATS_TIME_ZONE = 'Asia/Dubai'
export const STATS_DAYS = 14

export type AdminStatsDay = {
  day: string
  signups: number
  messages: number
  offers: number
}

export type AdminStats = {
  timeZone: string
  accounts: { live: number; disabled: number; deleted: number; google: number; facebook: number }
  links: { on: number; off: number }
  messages: { total: number; delivered: number; hidden: number; reported: number; withheld: number }
  reports: number
  blocks: number
  offers: { total: number; pending: number; resolved: number; declined: number; cancelled: number }
  days: AdminStatsDay[]
  lastSignupDay: string | null
  lastMessageDay: string | null
}

// count(*) is a bigint, which node-postgres returns as a string. Every count
// below is cast in SQL and mapped again here, so a driver change cannot turn
// the page's numbers into text.
const n = (expr: ReturnType<typeof sql>) => sql<number>`(${expr})::int`.mapWith(Number)

// drizzle's execute() answers with the driver's own result: PGlite and
// node-postgres both carry the rows on `.rows`.
function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows
}

export async function getAdminStats(
  db: Db,
  { now, days }: { now: Date; days: number },
): Promise<AdminStats> {
  const tz = STATS_TIME_ZONE
  const nowIso = now.toISOString()
  const dayOf = (col: unknown) => sql`to_char((${col}) at time zone ${tz}, 'YYYY-MM-DD')`

  const [acc] = await db
    .select({
      live: n(sql`count(*) filter (where ${accounts.deletedAt} is null)`),
      disabled: n(sql`count(*) filter (where ${accounts.deletedAt} is null and ${accounts.disabledAt} is not null)`),
      deleted: n(sql`count(*) filter (where ${accounts.deletedAt} is not null)`),
      google: n(sql`count(*) filter (where ${accounts.deletedAt} is null and ${accounts.provider} = 'google')`),
      facebook: n(sql`count(*) filter (where ${accounts.deletedAt} is null and ${accounts.provider} = 'facebook')`),
      lastSignupDay: sql<string | null>`${dayOf(sql`max(${accounts.createdAt})`)}`,
    })
    .from(accounts)

  const [lnk] = await db
    .select({
      on: n(sql`count(*) filter (where ${links.enabled})`),
      off: n(sql`count(*) filter (where not ${links.enabled})`),
    })
    .from(links)
    .where(sql`${links.deletedAt} is null`)

  const [msg] = await db
    .select({
      total: n(sql`count(*)`),
      delivered: n(sql`count(*) filter (where ${confessions.status} = 'delivered')`),
      hidden: n(sql`count(*) filter (where ${confessions.status} = 'hidden_by_recipient')`),
      reported: n(sql`count(*) filter (where ${confessions.status} = 'reported')`),
      lastMessageDay: sql<string | null>`${dayOf(sql`max(${confessions.createdHour})`)}`,
    })
    .from(confessions)

  const [withheld] = await db.select({ c: n(sql`count(*)`) }).from(withheldMessages)
  const [rep] = await db.select({ c: n(sql`count(*)`) }).from(reports)
  const [blk] = await db.select({ c: n(sql`count(*)`) }).from(linkBlocks)

  const [off] = await db
    .select({
      total: n(sql`count(*)`),
      pending: n(sql`count(*) filter (where ${revealOffers.state} = 'pending')`),
      resolved: n(sql`count(*) filter (where ${revealOffers.state} = 'resolved')`),
      declined: n(sql`count(*) filter (where ${revealOffers.state} = 'declined')`),
      cancelled: n(sql`count(*) filter (where ${revealOffers.state} = 'cancelled')`),
    })
    .from(revealOffers)

  // One row per calendar day in the window, oldest first, zero-filled. Each
  // source is grouped by its own Dubai date and joined onto the series.
  const series = rowsOf<AdminStatsDay>(
    await db.execute(sql`
      with bounds as (
        select ((${nowIso}::timestamptz) at time zone ${tz})::date as today
      ),
      series as (
        select (generate_series(today - (${days}::int - 1), today, interval '1 day'))::date as d
        from bounds
      ),
      s as (
        select ((${accounts.createdAt}) at time zone ${tz})::date as d, count(*) as c
        from ${accounts} group by 1
      ),
      m as (
        select ((${confessions.createdHour}) at time zone ${tz})::date as d, count(*) as c
        from ${confessions} group by 1
      ),
      o as (
        select ((${revealOffers.createdAt}) at time zone ${tz})::date as d, count(*) as c
        from ${revealOffers} group by 1
      )
      select to_char(series.d, 'YYYY-MM-DD') as day,
             coalesce(s.c, 0)::int as signups,
             coalesce(m.c, 0)::int as messages,
             coalesce(o.c, 0)::int as offers
      from series
      left join s on s.d = series.d
      left join m on m.d = series.d
      left join o on o.d = series.d
      order by series.d
    `),
  ).map((r) => ({
    day: String(r.day),
    signups: Number(r.signups),
    messages: Number(r.messages),
    offers: Number(r.offers),
  }))

  return {
    timeZone: tz,
    accounts: {
      live: acc.live,
      disabled: acc.disabled,
      deleted: acc.deleted,
      google: acc.google,
      facebook: acc.facebook,
    },
    links: { on: lnk.on, off: lnk.off },
    messages: {
      total: msg.total,
      delivered: msg.delivered,
      hidden: msg.hidden,
      reported: msg.reported,
      withheld: withheld.c,
    },
    reports: rep.c,
    blocks: blk.c,
    offers: off,
    days: series,
    lastSignupDay: acc.lastSignupDay ?? null,
    lastMessageDay: msg.lastMessageDay ?? null,
  }
}
