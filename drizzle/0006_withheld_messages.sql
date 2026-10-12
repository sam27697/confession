-- 0006_withheld_messages.sql
--
-- Hand-written, like 0001 to 0005. One transaction under
-- scripts/migrate.mjs.
--
-- A message sent to a link whose owner has blocked the sender
-- (docs/SPEC-week24-silent-block.md). Until week 24 such a send wrote
-- nothing, so it was missing from the sender's own /sent list and never
-- counted against his rate limits, and both told him he was blocked. It is
-- kept here, apart from confessions, so that no query written for the
-- recipient or the admin can reach it by forgetting a filter: only the
-- sender's own views read this table (spec §1, §2).
--
-- No status column and nothing the recipient side could use. created_hour
-- carries the same rule as confessions.created_hour, for the same reason.

CREATE TABLE "withheld_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "link_id" uuid NOT NULL REFERENCES "links"("id"),
  "sender_account_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "body" text NOT NULL,
  "created_hour" timestamp with time zone NOT NULL,
  CONSTRAINT "withheld_messages_created_hour_truncated_check"
    CHECK (created_hour = date_trunc('hour', created_hour))
);
--> statement-breakpoint

-- The sender's /sent list and its badge read by sender.
CREATE INDEX "withheld_messages_sender_account_id_idx" ON "withheld_messages" ("sender_account_id");
