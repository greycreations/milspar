import { createVehicleSchema, vehicleIdSchema } from "@milspar/contracts";
import type { FastifyInstance } from "fastify";
import { isUniqueViolation, vehicleService } from "../services/vehicles.js";

export async function vehicleRoutes(app: FastifyInstance) {
  app.delete<{ Params: { id: string } }>("/vehicles/:id", async (request, reply) => {
    const parsed = vehicleIdSchema.safeParse(request.params.id);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_vehicle_id" });
    if (!await vehicleService.remove(parsed.data)) return reply.code(404).send({ error: "vehicle_not_found" });
    return reply.code(204).send();
  });
  app.delete<{ Params: { id: string; readingId: string } }>("/vehicles/:id/odometer-readings/:readingId", async (request, reply) => {
    const vehicleId = vehicleIdSchema.safeParse(request.params.id);
    const readingId = vehicleIdSchema.safeParse(request.params.readingId);
    if (!vehicleId.success || !readingId.success) return reply.code(400).send({ error: "invalid_id" });
    if (!await vehicleService.removeReading(vehicleId.data, readingId.data)) return reply.code(404).send({ error: "reading_not_found" });
    return reply.code(204).send();
  });
  app.get("/vehicles", () => vehicleService.list());
  app.post("/vehicles", async (request, reply) => {
    const parsed = createVehicleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });
    try {
      return reply.code(201).send(await vehicleService.create(parsed.data));
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: "vehicle_conflict", message: "Registreringsnummer eller VIN finns redan." });
      }
      throw error;
    }
  });
  app.get<{ Params: { id: string } }>("/vehicles/:id", async (request, reply) => {
    const parsed = vehicleIdSchema.safeParse(request.params.id);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_vehicle_id" });
    const vehicle = await vehicleService.get(parsed.data);
    if (!vehicle) return reply.code(404).send({ error: "vehicle_not_found" });
    return vehicle;
  });
}
