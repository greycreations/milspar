import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  registrationNumber: text("registration_number").notNull(),
  vin: text("vin"),
  make: text("make").notNull(),
  model: text("model").notNull(),
  variant: text("variant"),
  modelYear: integer("model_year"),
  color: text("color"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("vehicles_active_registration_key").on(table.registrationNumber).where(sql`${table.deletedAt} IS NULL`),
  uniqueIndex("vehicles_active_vin_key").on(table.vin).where(sql`${table.deletedAt} IS NULL`),
]);

export const odometerReadings = pgTable("odometer_readings", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id").notNull(),
  valueKm: integer("value_km").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  sourceType: text("source_type").default("manual").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "odometer_readings_vehicle_id_fkey", columns: [table.vehicleId], foreignColumns: [vehicles.id] }).onDelete("cascade"),
  check("odometer_readings_value_km_check", sql`${table.valueKm} >= 0`),
  index("odometer_vehicle_recorded_idx").on(table.vehicleId, table.recordedAt.desc()),
]);
