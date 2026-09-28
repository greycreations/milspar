import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  registrationNumber: text("registration_number").notNull().unique("vehicles_registration_number_key"),
  vin: text("vin").unique("vehicles_vin_key"),
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
  vehicleId: uuid("vehicle_id").notNull(),
  valueKm: integer("value_km").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  sourceType: text("source_type").default("manual").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "odometer_readings_vehicle_id_fkey", columns: [table.vehicleId], foreignColumns: [vehicles.id] }).onDelete("cascade"),
  check("odometer_readings_value_km_check", sql`${table.valueKm} >= 0`),
  index("odometer_vehicle_recorded_idx").on(table.vehicleId, table.recordedAt.desc()),
]);
