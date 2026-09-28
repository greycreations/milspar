import type { CreateVehicle, VehicleDetail } from "@milspar/contracts";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { odometerReadings, vehicles } from "../db/schema.js";

export const vehicleService = {
  async list() {
    return db.select({
      id: vehicles.id, registrationNumber: vehicles.registrationNumber,
      make: vehicles.make, model: vehicles.model, variant: vehicles.variant,
      modelYear: vehicles.modelYear,
      currentOdometerKm: sql<number | null>`(
        select reading.value_km from odometer_readings as reading
        where reading.vehicle_id = "vehicles"."id"
        order by reading.recorded_at desc, reading.created_at desc, reading.id desc
        limit 1
      )`,
      coverImageUrl: sql<null>`null`,
    }).from(vehicles).orderBy(desc(vehicles.createdAt));
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
        await tx.insert(odometerReadings).values({
          vehicleId: vehicle.id, valueKm: input.currentOdometerKm,
          recordedAt: new Date(), sourceType: "manual",
        });
      }
      return vehicle;
    });
  },
  async get(id: string) {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    if (!vehicle) return undefined;
    const readings = await db.select().from(odometerReadings)
      .where(eq(odometerReadings.vehicleId, id))
      .orderBy(desc(odometerReadings.recordedAt), desc(odometerReadings.createdAt), desc(odometerReadings.id))
      .limit(51);
    return {
      ...vehicle,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
      currentOdometerKm: readings[0]?.valueKm ?? null,
      coverImageUrl: null,
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
