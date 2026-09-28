import { createVehicleSchema } from "@milspar/contracts";
import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { odometerReadings, vehicles } from "../db/schema.js";

export async function vehicleRoutes(app: FastifyInstance) {
  app.get("/vehicles", async () => {
    return db.select({
      id: vehicles.id,
      registrationNumber: vehicles.registrationNumber,
      make: vehicles.make,
      model: vehicles.model,
      variant: vehicles.variant,
      modelYear: vehicles.modelYear,
      currentOdometerKm: sql<number | null>`(
        select ${odometerReadings.valueKm}
        from ${odometerReadings}
        where ${odometerReadings.vehicleId} = ${vehicles.id}
        order by ${odometerReadings.recordedAt} desc
        limit 1
      )`,
      coverImageUrl: sql<null>`null`,
    }).from(vehicles).orderBy(desc(vehicles.createdAt));
  });

  app.post("/vehicles", async (request, reply) => {
    const parsed = createVehicleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const input = parsed.data;
    try {
      const [vehicle] = await db.insert(vehicles).values({
        registrationNumber: input.registrationNumber,
        vin: input.vin || null,
        make: input.make,
        model: input.model,
        variant: input.variant || null,
        modelYear: input.modelYear ?? null,
        color: input.color || null,
      }).returning();

      if (!vehicle) return reply.code(500).send({ error: "vehicle_not_created" });
      if (input.currentOdometerKm !== undefined) await db.insert(odometerReadings).values({ vehicleId: vehicle.id, valueKm: input.currentOdometerKm, recordedAt: new Date(), sourceType: "manual" });
      return reply.code(201).send({ id: vehicle.id });
    } catch (error) {
      request.log.error(error);
      return reply.code(409).send({ error: "vehicle_conflict", message: "Registreringsnummer eller VIN finns redan." });
    }
  });

  app.get("/vehicles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    if (!vehicle) return reply.code(404).send({ error: "vehicle_not_found" });
    return vehicle;
  });
}
