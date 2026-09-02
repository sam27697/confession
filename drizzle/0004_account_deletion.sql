-- 0004_account_deletion.sql
--
-- Hand-written, like 0001_constraints.sql, 0002_admin.sql and
-- 0003_admin_logout.sql: scripts/migrate.mjs runs the whole file in one
-- transaction, so nothing here is an ALTER TYPE ... ADD VALUE, which cannot
-- be used inside a transaction.
--
-- Account deletion (docs/SPEC-week10-account-deletion.md §1, §2): an
-- immediate, irreversible tombstone of the accounts row, not a hard delete
-- and not ON DELETE CASCADE. See spec §1.1-§1.4 for the four shapes this
-- was rejected in favour of. Every guarantee below is a constraint or a
-- trigger, not a code-review convention, per this project's standing rule.

-- ---------------------------------------------------------------------
-- New columns (spec §2.1).
-- ---------------------------------------------------------------------
ALTER TABLE "accounts" ADD COLUMN "deleted_at" timestamptz;
--> statement-breakpoint

ALTER TABLE "links" ADD COLUMN "deleted_at" timestamptz;
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- A half-finished deletion cannot be committed (spec §2.4 item 1): if
-- deleted_at is set, display_name and provider_user_id must already carry
-- the tombstone values, and provider_user_id must be bound to the row's own
-- id rather than merely carrying the 'deleted:' prefix, so no other string
-- with that prefix can satisfy the check (spec §8.2). The converse is
-- deliberately NOT asserted, because a real user could be named '[deleted]'
-- before ever being deleted, and a rule keyed on the string being present
-- would be wrong about a live person (spec §2.2).
-- ---------------------------------------------------------------------
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_deleted_tombstone_check"
  CHECK (deleted_at IS NULL OR (display_name = '[deleted]' AND provider_user_id = 'deleted:' || id::text));
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- A deleted link cannot be on (spec §2.4 item 2).
-- ---------------------------------------------------------------------
ALTER TABLE "links"
  ADD CONSTRAINT "links_deleted_not_enabled_check"
  CHECK (deleted_at IS NULL OR enabled = false);
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- Deletion cannot be undone (spec §2.4 item 3, terms clause 6). Once
-- accounts.deleted_at is set, the row is frozen: the name cannot be written
-- back, and a second deletion raises rather than quietly re-stamping the
-- timestamp.
-- ---------------------------------------------------------------------
CREATE FUNCTION accounts_tombstone_is_final() RETURNS trigger AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'accounts row % is deleted and frozen (spec §2.4 item 3: deletion cannot be undone)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER accounts_tombstone_is_final_trg
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_tombstone_is_final();
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- The tombstone is the record; nothing removes an accounts row, including a
-- future migration that adds ON DELETE CASCADE without reading this file
-- (spec §2.4 item 4, §1: "an immediate, irreversible tombstone").
-- ---------------------------------------------------------------------
CREATE FUNCTION accounts_never_deleted() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'accounts rows are never deleted, only tombstoned (spec §1)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER accounts_never_deleted_trg
  BEFORE DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_never_deleted();
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- A deleted link can never be re-enabled, or otherwise changed (spec §2.4
-- item 5).
-- ---------------------------------------------------------------------
CREATE FUNCTION links_tombstone_is_final() RETURNS trigger AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'links row % is deleted and frozen (spec §2.4 item 5: a deleted link can never be re-enabled)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER links_tombstone_is_final_trg
  BEFORE UPDATE ON links
  FOR EACH ROW EXECUTE FUNCTION links_tombstone_is_final();
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- src/actions.ts checks this in the application before the insert (spec
-- §3.3); this trigger is what makes it true even if a future route forgets
-- (spec §2.4 item 6).
-- ---------------------------------------------------------------------
CREATE FUNCTION confessions_sender_not_deleted() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounts WHERE id = NEW.sender_account_id AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'confession % has a deleted sender (spec §2.4 item 6)', NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM links WHERE id = NEW.link_id AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'confession % targets a deleted link (spec §2.4 item 6)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER confessions_sender_not_deleted_trg
  BEFORE INSERT ON confessions
  FOR EACH ROW EXECUTE FUNCTION confessions_sender_not_deleted();
