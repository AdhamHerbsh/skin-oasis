ALTER TABLE "cash_transactions" DROP CONSTRAINT IF EXISTS "cash_transactions_cashbox_id_cashboxes_id_fk";
--> statement-breakpoint
ALTER TABLE "cash_transactions" DROP CONSTRAINT IF EXISTS "cash_transactions_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "party_ledger" ADD COLUMN IF NOT EXISTS "cash_transaction_id" uuid;
--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_cashbox_id_cashboxes_id_fk" FOREIGN KEY ("cashbox_id") REFERENCES "public"."cashboxes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
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
WITH ledger_payments AS (
  SELECT
    "id",
    "party_id",
    GREATEST("debit", "credit") AS "amount",
    ROW_NUMBER() OVER (
      PARTITION BY "party_id", GREATEST("debit", "credit")
      ORDER BY "created_at", "id"
    ) AS "payment_order"
  FROM "party_ledger"
  WHERE "kind" = 'payment' AND "invoice_id" IS NULL
),
cashbox_payments AS (
  SELECT
    "id",
    "party_id",
    "amount",
    ROW_NUMBER() OVER (
      PARTITION BY "party_id", "amount", "category"
      ORDER BY "created_at", "id"
    ) AS "payment_order"
  FROM "cash_transactions"
  WHERE "party_id" IS NOT NULL
    AND "invoice_id" IS NULL
    AND (
      ("kind" = 'party_payment' AND "category" = 'تحصيل من عميل')
      OR ("kind" = 'expense' AND "category" = 'سداد مورد')
    )
)
UPDATE "party_ledger" AS ledger
SET "cash_transaction_id" = cash_payment."id"
FROM ledger_payments AS ledger_payment
JOIN cashbox_payments AS cash_payment
  ON cash_payment."party_id" = ledger_payment."party_id"
  AND cash_payment."amount" = ledger_payment."amount"
  AND cash_payment."payment_order" = ledger_payment."payment_order"
WHERE ledger."id" = ledger_payment."id";