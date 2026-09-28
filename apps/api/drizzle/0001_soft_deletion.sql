ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_registration_number_key";--> statement-breakpoint
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_vin_key";--> statement-breakpoint
ALTER TABLE "odometer_readings" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_active_registration_key" ON "vehicles" USING btree ("registration_number") WHERE "vehicles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_active_vin_key" ON "vehicles" USING btree ("vin") WHERE "vehicles"."deleted_at" IS NULL;