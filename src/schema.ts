// src/schema.ts
//
// The Drizzle table definitions for the confession data model.
//
// This file describes shape only. Everything that is a *promise*, not a
// shape — CHECK constraints, triggers, the deferred constraint trigger — is
// hand-written SQL in drizzle/ because drizzle-kit does not emit PL/pgSQL
// (spec §3). Reading this file alone under-describes the schema; read it
// together with drizzle/0001_constraints.sql.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core'

function sqlDefaultRandomUuid() {
  return sql`gen_random_uuid()`
}

export const providerEnum = pgEnum('provider', ['facebook'])
// Instagram is a distribution channel, not an auth surface (STACK.md). The
// enum exists so that staying Facebook-only is a deliberate decision.

export const confessionStatusEnum = pgEnum('confession_status', [
  'delivered',
  'hidden_by_recipient',
  'reported',
])

export const revealOfferStateEnum = pgEnum('reveal_offer_state', [
  'pending',
  'resolved',
  'declined',
  'cancelled',
])

export const revealAnswerSideEnum = pgEnum('reveal_answer_side', [
  'recipient',
  'sender',
])

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  provider: providerEnum('provider').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  displayName: text('display_name').notNull(),
  termsVersion: text('terms_version').notNull(),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }).notNull(),
  // An attestation, not a birthdate. We store that they said yes, not their
  // date of birth — a DOB would be more PII to leak for no more certainty.
  ageAttested18: boolean('age_attested_18').notNull(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }), // terms clause 4
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('accounts_provider_provider_user_id_key').on(table.provider, table.providerUserId),
])

export const termsAcceptances = pgTable('terms_acceptances', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  termsVersion: text('terms_version').notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  // 'ar' | 'en' — enforced by a CHECK constraint in the hand-written migration.
  locale: text('locale').notNull(),
})

export const links = pgTable('links', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  ownerAccountId: uuid('owner_account_id').notNull().references(() => accounts.id),
  slug: text('slug').notNull().unique(),
  enabled: boolean('enabled').notNull().default(true), // terms clause 6, the off-switch
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const confessions = pgTable('confessions', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  linkId: uuid('link_id').notNull().references(() => links.id),
  // admin-visible only. Sam's decision 2026-08-25 10:29 (STACK.md). NOT NULL:
  // there is no anonymous-to-the-operator path any more.
  senderAccountId: uuid('sender_account_id').notNull().references(() => accounts.id),
  body: text('body').notNull(),
  // Truncated to the hour. CHECK constraint in the hand-written migration:
  // a message at 02:41 plus knowing who was awake at 02:41 narrows the
  // field to one person (STACK.md) — the threat is the recipient.
  createdHour: timestamp('created_hour', { withTimezone: true }).notNull(),
  status: confessionStatusEnum('status').notNull().default('delivered'),
})

// The administrator's own identity (spec §1.1, week 7). Deliberately not a
// row in `accounts`: an administrator is not a product user, does not own a
// link, is not a sender - see drizzle/0002_admin.sql for the full list of
// shapes this was rejected in favour of.
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  // Nullable, null means "never logged out" (week 9 spec §1.1, §1.4 item 2).
  // Set by POST /admin/logout via revokeAdminSessions; every admin request
  // refuses a token whose iat is at or before this instant. Added in
  // drizzle/0003_admin_logout.sql.
  loggedOutBefore: timestamp('logged_out_before', { withTimezone: true }),
  // CHECK admin_users_username_nonblank, CHECK admin_users_password_hash_is_scrypt
  // - both in the hand-written migration drizzle/0002_admin.sql.
})

export const adminRevealLog = pgTable('admin_reveal_log', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  // Nullable as of drizzle/0002_admin.sql: an admin_users row is a second,
  // equally valid actor, and admin_reveal_log_exactly_one_actor (also added
  // in that migration) is what still guarantees every row names exactly one.
  adminAccountId: uuid('admin_account_id').references(() => accounts.id),
  adminUserId: uuid('admin_user_id').references(() => adminUsers.id),
  confessionId: uuid('confession_id').notNull().references(() => confessions.id),
  revealedAt: timestamp('revealed_at', { withTimezone: true }).notNull().defaultNow(),
  // CHECK (length(btrim(reason)) >= 8) in the hand-written migration — a
  // NOT NULL reason that accepts '' or '.' is not a reason.
  reason: text('reason').notNull(),
  // append-only: BEFORE UPDATE OR DELETE trigger raises, in the hand-written
  // migration. "The admin can see the sender" without a record becomes
  // "someone looked and nobody knows who or why."
})

export const linkBlocks = pgTable('link_blocks', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  linkId: uuid('link_id').notNull().references(() => links.id),
  blockedAccountId: uuid('blocked_account_id').notNull().references(() => accounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('link_blocks_link_id_blocked_account_id_key').on(table.linkId, table.blockedAccountId),
])

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  confessionId: uuid('confession_id').notNull().references(() => confessions.id),
  reportedByAccountId: uuid('reported_by_account_id').notNull().references(() => accounts.id),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('reports_confession_id_reported_by_account_id_key').on(table.confessionId, table.reportedByAccountId),
])

export const sendCounters = pgTable('send_counters', {
  senderAccountId: uuid('sender_account_id').notNull().references(() => accounts.id),
  linkId: uuid('link_id').notNull().references(() => links.id),
  // Truncated to the hour, same CHECK as confessions.created_hour, in the
  // hand-written migration.
  windowHour: timestamp('window_hour', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.senderAccountId, table.linkId, table.windowHour] }),
])

export const revealOffers = pgTable('reveal_offers', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  confessionId: uuid('confession_id').notNull().unique().references(() => confessions.id), // one open offer per confession, ever
  questionForSender: text('question_for_sender').notNull(),
  stakePrompt: text('stake_prompt').notNull(),
  state: revealOfferStateEnum('state').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
})

export const revealAnswers = pgTable('reveal_answers', {
  id: uuid('id').primaryKey().default(sqlDefaultRandomUuid()),
  offerId: uuid('offer_id').notNull().references(() => revealOffers.id),
  side: revealAnswerSideEnum('side').notNull(),
  body: text('body').notNull(),
  committedAt: timestamp('committed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('reveal_answers_offer_id_side_key').on(table.offerId, table.side),
])

