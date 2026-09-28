import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  registrationNumber: text("registration_number").notNull().unique(),
  vin: text("vin").unique(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  variant: text("variant"),
  modelYear: integer("model_year"),
  color: text("color"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const odometerReadings = pgTable("odometer_readings", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }).notNull(),
  valueKm: integer("value_km").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  sourceType: text("source_type").default("manual").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
