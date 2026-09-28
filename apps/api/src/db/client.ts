import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const client = postgres(connectionString, { max: 10, connect_timeout: 5 });
export const db = drizzle(client, { schema });
