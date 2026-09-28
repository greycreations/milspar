import { buildApp } from "./app.js";
import { client } from "./db/client.js";

const app = await buildApp();
app.addHook("onClose", async () => { await client.end(); });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void app.close(); });
}
try {
  await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: process.env.API_HOST ?? "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
