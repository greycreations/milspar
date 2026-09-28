CREATE TABLE IF NOT EXISTS "vehicles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "registration_number" text NOT NULL UNIQUE,
  "vin" text UNIQUE,
  "make" text NOT NULL,
  "model" text NOT NULL,
  "variant" text,
  "model_year" integer,
  "color" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "odometer_readings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vehicle_id" uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE cascade,
  "value_km" integer NOT NULL CHECK ("value_km" >= 0),
  "recorded_at" timestamp with time zone NOT NULL,
  "source_type" text DEFAULT 'manual' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "odometer_vehicle_recorded_idx"
  ON "odometer_readings" ("vehicle_id", "recorded_at" DESC);
