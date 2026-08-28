-- 0002_admin.sql
--
-- Hand-written, like 0001_constraints.sql (spec §1): drizzle-kit generate
-- does not emit this and scripts/migrate.mjs runs the whole file in one
-- transaction, so nothing below is a statement Postgres refuses inside a
-- transaction. That is why the administrator is a new table rather than a
-- new value on the `provider` enum -- see spec §1.1 for the full list of
-- rejected shapes.

CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  disabled_at   timestamptz,
  CONSTRAINT admin_users_username_nonblank
    CHECK (length(btrim(username)) >= 3),
  CONSTRAINT admin_users_password_hash_is_scrypt
    CHECK (password_hash LIKE 'scrypt$%')
);
--> statement-breakpoint

-- admin_reveal_log gets a second, nullable actor column rather than having
-- its existing admin_account_id foreign key repointed (spec §1.1: repointing
-- it rewrites the foreign key of an append-only audit table and breaks week
-- 2's passing tests).
ALTER TABLE admin_reveal_log
  ADD COLUMN admin_user_id uuid REFERENCES admin_users(id);
--> statement-breakpoint

ALTER TABLE admin_reveal_log
  ALTER COLUMN admin_account_id DROP NOT NULL;
--> statement-breakpoint

-- The constraint that carries the guarantee (spec §1.2): a reveal cannot
-- happen without a record of who and why, so exactly one of the two actor
-- columns must be set on every row -- never both, never neither.
ALTER TABLE admin_reveal_log
  ADD CONSTRAINT admin_reveal_log_exactly_one_actor
  CHECK ((admin_account_id IS NULL) <> (admin_user_id IS NULL));
