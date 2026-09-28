import type { CreateVehicle, VehicleDetail } from "@milspar/contracts";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { assets, events, odometerReadings, vehicles } from "../db/schema.js";

import { audit, removeEvent } from "./book.js";
import { DomainError } from "./book-domain.js";

export const vehicleService = {
  async list() {
    return db.select({
      id: vehicles.id, registrationNumber: vehicles.registrationNumber,
      make: vehicles.make, model: vehicles.model, variant: vehicles.variant,
      modelYear: vehicles.modelYear,
      currentOdometerKm: sql<number | null>`(
        select reading.value_km from odometer_readings as reading
        where reading.vehicle_id = "vehicles"."id" and reading.deleted_at is null
        order by reading.recorded_at desc, reading.created_at desc, reading.id desc
        limit 1
      )`,
      coverImageUrl: sql<string | null>`case when ${vehicles.coverAssetId} is not null then '/api/v1/vehicles/' || ${vehicles.id} || '/assets/' || ${vehicles.coverAssetId} || '/preview' else null end`,
    }).from(vehicles).where(isNull(vehicles.deletedAt)).orderBy(desc(vehicles.createdAt));
  },
  async create(input: CreateVehicle) {
    return db.transaction(async (tx) => {
      const [vehicle] = await tx.insert(vehicles).values({
        registrationNumber: input.registrationNumber, vin: input.vin || null,
        make: input.make, model: input.model, variant: input.variant || null,
        modelYear: input.modelYear ?? null, color: input.color || null,
      }).returning({ id: vehicles.id });
      if (!vehicle) throw new Error("Vehicle insert returned no row");
      if (input.currentOdometerKm !== undefined) {
        const now = new Date();
        const [event] = await tx.insert(events).values({ vehicleId: vehicle.id, occurredAt: now, data: { type: "odometer", title: "Första mätarställning", occurredAt: now.toISOString(), odometerKm: input.currentOdometerKm, description: "", vendor: "", items: [], costMinor: null, currency: "SEK", wheelBatchId: null, confirmOdometer: false, confirmSchedule: false } }).returning();
        await tx.insert(odometerReadings).values({
          eventId: event!.id,
          vehicleId: vehicle.id, valueKm: input.currentOdometerKm,
          recordedAt: new Date(), sourceType: "manual",
        });
      }
      return vehicle;
    });
  },
  async remove(id: string) {
    const [removed] = await db.update(vehicles).set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(vehicles.id, id), isNull(vehicles.deletedAt))).returning({ id: vehicles.id });
    return removed;
  },
  async removeReading(vehicleId: string, readingId: string) {
    return db.transaction(async tx => {
      // Serialize against vehicle removal; never mutate a different vehicle's reading.
      const [vehicle] = await tx.select({ id: vehicles.id }).from(vehicles)
        .where(and(eq(vehicles.id, vehicleId), isNull(vehicles.deletedAt))).for("update");
      if (!vehicle) return undefined;
      const [reading] = await tx.select().from(odometerReadings).where(and(eq(odometerReadings.id, readingId), eq(odometerReadings.vehicleId, vehicleId), isNull(odometerReadings.deletedAt)));
      if (!reading) return undefined;
      if (reading.eventId) {
        const [event] = await tx.select().from(events).where(eq(events.id, reading.eventId));
        if (event?.data.type !== "odometer") throw new DomainError(409, "Avläsningen hör till en händelse. Redigera den händelsen i tidslinjen.");
        return removeEvent(tx, vehicleId, event.id, event.revision);
      }
      await audit(tx, vehicleId, readingId, "reading", "delete", reading, null);
      const [removed] = await tx.update(odometerReadings).set({ deletedAt: new Date() })
        .where(and(eq(odometerReadings.id, readingId), eq(odometerReadings.vehicleId, vehicleId), isNull(odometerReadings.deletedAt)))
        .returning({ id: odometerReadings.id });
      return removed;
    });
  },
  async get(id: string) {
    const [vehicle] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), isNull(vehicles.deletedAt))).limit(1);
    if (!vehicle) return undefined;
    const readings = await db.select().from(odometerReadings)
      .where(and(eq(odometerReadings.vehicleId, id), isNull(odometerReadings.deletedAt)))
      .orderBy(desc(odometerReadings.recordedAt), desc(odometerReadings.createdAt), desc(odometerReadings.id))
      .limit(51);
    return {
      ...vehicle,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
      currentOdometerKm: readings[0]?.valueKm ?? null,
      coverImageUrl: vehicle.coverAssetId ? `/api/v1/vehicles/${id}/assets/${vehicle.coverAssetId}/preview` : null,
      odometerReadings: readings.slice(0, 50).map((reading) => ({
        id: reading.id, valueKm: reading.valueKm,
        recordedAt: reading.recordedAt.toISOString(), sourceType: reading.sourceType,
      })),
      hasMoreReadings: readings.length > 50,
    } satisfies VehicleDetail;
  },
};

// Drizzle wraps driver errors in cause; only unique violations are conflicts.
export function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error)) {
    seen.add(error);
    if ("code" in error && error.code === "23505") return true;
    error = "cause" in error ? error.cause : undefined;
  }
  return false;
}
