import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { EventInput, WheelSetInput, TireBatchInput, MaintenanceInput } from "@milspar/contracts";

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
  coverAssetId: uuid("cover_asset_id"),
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
  eventId: uuid("event_id").references(() => events.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "odometer_readings_vehicle_id_fkey", columns: [table.vehicleId], foreignColumns: [vehicles.id] }).onDelete("cascade"),
  check("odometer_readings_value_km_check", sql`${table.valueKm} >= 0`),
  index("odometer_vehicle_recorded_idx").on(table.vehicleId, table.recordedAt.desc()),
  uniqueIndex("odometer_event_key").on(table.eventId),
]);

const identity = () => ({
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
export const events = pgTable("events", {
  ...identity(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  data: jsonb("data").$type<EventInput>().notNull(), anomaly: boolean("anomaly").notNull().default(false),
}, t => [index("events_vehicle_date_idx").on(t.vehicleId, t.occurredAt)]);
export const wheelSets = pgTable("wheel_sets", { ...identity(), data: jsonb("data").$type<WheelSetInput>().notNull() });
export const tireBatches = pgTable("tire_batches", {
  ...identity(), wheelSetId: uuid("wheel_set_id").notNull().references(() => wheelSets.id), data: jsonb("data").$type<TireBatchInput>().notNull(),
});
export const maintenanceRules = pgTable("maintenance_rules", {
  ...identity(), data: jsonb("data").$type<MaintenanceInput>().notNull(),
  completedEventId: uuid("completed_event_id").references(() => events.id),
  originEventId: uuid("origin_event_id").references(() => events.id),
});
export const assets = pgTable("assets", {
  ...identity(), eventId: uuid("event_id").references(() => events.id),
  filename: text("filename").notNull(), mime: text("mime").notNull(), size: integer("size").notNull(),
  sha256: text("sha256").notNull(), originalKey: text("original_key").notNull(), previewKey: text("preview_key"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
});
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(), vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  entityId: uuid("entity_id").notNull(), kind: text("kind").notNull(), action: text("action").notNull(),
  before: jsonb("before"), after: jsonb("after"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
