import cors from "@fastify/cors";
import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { vehicleRoutes } from "./routes/vehicles.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(",") ?? false });
  app.setErrorHandler((error, request, reply) => {
    if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: "invalid_request" });
    }
    request.log.error({ err: error }, "Request failed");
    return reply.code(500).send({ error: "internal_error", message: "Ett serverfel uppstod. Försök igen senare." });
  });
  app.get("/health", async () => ({ status: "ok", service: "milspar-api" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await db.execute(sql`select id, deleted_at from vehicles limit 0`);
      await db.execute(sql`select id, deleted_at from odometer_readings limit 0`);
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  await app.register(vehicleRoutes, { prefix: "/api/v1" });
  return app;
}
