ALTER TABLE "party_ledger"
ADD COLUMN IF NOT EXISTS "cash_transaction_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'party_ledger_cash_transaction_id_cash_transactions_id_fk'
  ) THEN
    ALTER TABLE "party_ledger"
    ADD CONSTRAINT "party_ledger_cash_transaction_id_cash_transactions_id_fk"
    FOREIGN KEY ("cash_transaction_id")
    REFERENCES "public"."cash_transactions"("id")
    ON DELETE set null
    ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "party_ledger_cash_transaction_uq"
ON "party_ledger" USING btree ("cash_transaction_id");
