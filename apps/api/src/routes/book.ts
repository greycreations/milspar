import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { bookService } from "../services/book.js";

const idSchema = z.string().uuid();
export async function bookRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async request => {
    for (const value of Object.values(request.params as Record<string, string>)) idSchema.parse(value);
  });
  type Params = { id: string; entryId: string };
  app.get<{ Params: Params }>("/vehicles/:id/book", r => bookService.get(r.params.id));
  app.put<{ Params: Params }>("/vehicles/:id", r => bookService.updateVehicle(r.params.id, r.body));
  app.post<{ Params: Params }>("/vehicles/:id/events", async (r, reply) => reply.code(201).send(await bookService.saveEvent(r.params.id, r.body)));
  app.put<{ Params: Params }>("/vehicles/:id/events/:entryId", r => bookService.saveEvent(r.params.id, r.body, r.params.entryId));
  app.delete<{ Params: Params }>("/vehicles/:id/events/:entryId", async (r, reply) => {
    await bookService.removeEvent(r.params.id, r.params.entryId, z.object({ revision: z.number().int().positive() }).parse(r.body).revision);
    return reply.code(204).send();
  });
  for (const [route, kind, save] of [
    ["wheel-sets", "wheel_sets", bookService.saveSet],
    ["tire-batches", "tire_batches", bookService.saveBatch],
    ["maintenance", "maintenance_rules", bookService.saveMaintenance],
  ] as const) {
    app.post<{ Params: Params }>(`/vehicles/:id/${route}`, async (r, reply) => reply.code(201).send(await save(r.params.id, r.body)));
    app.put<{ Params: Params }>(`/vehicles/:id/${route}/:entryId`, r => save(r.params.id, r.body, r.params.entryId));
    app.delete<{ Params: Params }>(`/vehicles/:id/${route}/:entryId`, async (r, reply) => {
      await bookService.removeResource(r.params.id, kind, r.params.entryId, z.object({ revision: z.number().int().positive() }).parse(r.body).revision);
      return reply.code(204).send();
    });
  }
  app.post<{ Params: Params }>("/vehicles/:id/maintenance/:entryId/complete", r => bookService.completeMaintenance(r.params.id, r.params.entryId, r.body));
}
