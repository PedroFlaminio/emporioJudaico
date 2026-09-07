ALTER TABLE "payments" ADD COLUMN "received_amount" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
UPDATE "payments" SET "received_amount" = "amount" WHERE "status" = 'pago';
