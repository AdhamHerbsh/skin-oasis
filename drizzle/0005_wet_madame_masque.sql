ALTER TABLE "invoice_lines" ADD COLUMN "discount_type" varchar(8) DEFAULT 'amount' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "commercial_registration_number" varchar(80);--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "tax_number" varchar(80);