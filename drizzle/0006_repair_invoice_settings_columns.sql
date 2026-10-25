ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "bonus_quantity" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "discount_per_unit" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "discount_type" varchar(8) DEFAULT 'amount' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "commercial_registration_number" varchar(80);--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tax_number" varchar(80);
