import cors from "@fastify/cors";
import Fastify from "fastify";
import { vehicleRoutes } from "./routes/vehicles.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? true,
});

app.get("/health", async () => ({ status: "ok", service: "milspar-api" }));
await app.register(vehicleRoutes, { prefix: "/api/v1" });

const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
