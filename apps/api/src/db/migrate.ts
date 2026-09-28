import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  // One connection holds the lock for the entire migration run.
  await client`select pg_advisory_lock(68457321)`;
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  console.log("Database migrations complete");
} finally {
  try { await client`select pg_advisory_unlock(68457321)`; }
  finally { await client.end(); }
}
