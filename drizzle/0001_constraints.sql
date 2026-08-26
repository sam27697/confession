-- 0001_constraints.sql
--
-- Hand-written: CHECK constraints, PL/pgSQL trigger functions and the
-- deferred constraint trigger. drizzle-kit generate (0000_*.sql) only
-- emits table/column/FK DDL — it does not emit PL/pgSQL (spec §3). Every
-- constraint below carries a comment naming the promise it keeps (spec §6).

-- ---------------------------------------------------------------------
-- terms_acceptances.locale — 'ar' | 'en' only (spec §1 terms_acceptances)
-- ---------------------------------------------------------------------
ALTER TABLE "terms_acceptances"
  ADD CONSTRAINT "terms_acceptances_locale_check"
  CHECK (locale IN ('ar', 'en'));
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- confessions.created_hour truncated to the hour.
-- Threat: the recipient. A message at 02:41 plus knowing who was awake at
-- 02:41 narrows the field to one person (STACK.md, spec §1 confessions).
-- ---------------------------------------------------------------------
ALTER TABLE "confessions"
  ADD CONSTRAINT "confessions_created_hour_truncated_check"
  CHECK (created_hour = date_trunc('hour', created_hour));
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- send_counters.window_hour truncated to the hour, same reason/same shape
-- as confessions.created_hour (spec §1 send_counters).
-- ---------------------------------------------------------------------
ALTER TABLE "send_counters"
  ADD CONSTRAINT "send_counters_window_hour_truncated_check"
  CHECK (window_hour = date_trunc('hour', window_hour));
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- admin_reveal_log.reason must be an actual reason, not a NOT NULL column
-- that accepts '' or '.' (spec §1 admin_reveal_log).
-- ---------------------------------------------------------------------
ALTER TABLE "admin_reveal_log"
  ADD CONSTRAINT "admin_reveal_log_reason_check"
  CHECK (length(btrim(reason)) >= 8);
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- admin_reveal_log is append-only. "The admin can see the sender" without
-- a record becomes "someone looked and nobody knows who or why."
-- (spec §1 admin_reveal_log, STACK.md rule 2)
-- ---------------------------------------------------------------------
CREATE FUNCTION admin_reveal_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_reveal_log is append-only (STACK.md rule 2: every admin unmask is logged, and the log is append-only)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER admin_reveal_log_no_update_or_delete
  BEFORE UPDATE OR DELETE ON admin_reveal_log
  FOR EACH ROW EXECUTE FUNCTION admin_reveal_log_immutable();
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- reveal_answers are immutable. Without this, "committed before shown" is
-- decoration: a side could read the other's answer at resolution and
-- rewrite their own (spec §1 state machine, step 5).
-- ---------------------------------------------------------------------
CREATE FUNCTION reveal_answers_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'reveal_answers rows are immutable once committed (spec state machine step 5: committed before shown)';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER reveal_answers_no_update_or_delete
  BEFORE UPDATE OR DELETE ON reveal_answers
  FOR EACH ROW EXECUTE FUNCTION reveal_answers_immutable();
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- reveal_offers legal state transitions (spec §1 state machine, step 4):
-- 'resolved' and 'declined' are terminal. 'cancelled' is only reachable
-- from 'pending', and is itself terminal once reached (nothing in the
-- spec's state machine ever leaves 'cancelled'). So: once a row's state
-- has left 'pending', no further UPDATE on that row is legal at all; from
-- 'pending', only a move to 'resolved', 'declined' or 'cancelled' is legal.
-- ---------------------------------------------------------------------
CREATE FUNCTION reveal_offers_check_transition() RETURNS trigger AS $$
BEGIN
  IF OLD.state <> 'pending' THEN
    RAISE EXCEPTION 'reveal_offers.state % is terminal (spec state machine step 4: resolved/declined/cancelled do not transition further)', OLD.state;
  END IF;
  IF NEW.state NOT IN ('resolved', 'declined', 'cancelled') THEN
    RAISE EXCEPTION 'illegal reveal_offers transition from pending to %', NEW.state;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER reveal_offers_legal_transition
  BEFORE UPDATE ON reveal_offers
  FOR EACH ROW EXECUTE FUNCTION reveal_offers_check_transition();
--> statement-breakpoint

-- ---------------------------------------------------------------------
-- An offer cannot be committed without the recipient's answer (spec §1
-- state machine, step 1). Deferred to commit time so the recipient's
-- answer row, inserted in the same transaction as the offer, is visible
-- when the check runs.
-- ---------------------------------------------------------------------
CREATE FUNCTION reveal_offers_require_recipient_answer() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM reveal_answers
    WHERE offer_id = NEW.id AND side = 'recipient'
  ) THEN
    RAISE EXCEPTION 'reveal_offers % committed without a recipient answer (spec state machine step 1: an offer without a recipient answer row must be impossible)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER reveal_offers_require_recipient_answer_trg
  AFTER INSERT ON reveal_offers
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION reveal_offers_require_recipient_answer();
