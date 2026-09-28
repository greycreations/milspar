import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

// Run the same route/service code against PostgreSQL's WASM build locally.
const state = vi.hoisted(() => ({ database: null as unknown }));
vi.mock("./db/client.js", () => ({ get db() { return state.database; } }));

const pg = new PGlite();
const database = drizzle(pg);
state.database = database;
const { buildApp } = await import("./app.js");
const app = await buildApp();
const payload = { registrationNumber: "abc123", make: "Volvo", model: "V60", currentOdometerKm: 12345 };

beforeAll(async () => {
  await migrate(database, { migrationsFolder: "./drizzle" });
  await app.ready();
}, 30000);
beforeEach(async () => { await pg.exec("TRUNCATE vehicles CASCADE"); });
afterAll(async () => { await app.close(); await pg.close(); });

describe("vehicle API and persistence", () => {
  it("creates, lists and retrieves a vehicle with a historical odometer reading", async () => {
    const created = await app.inject({ method: "POST", url: "/api/v1/vehicles", payload });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const list = await app.inject("/api/v1/vehicles");
    expect(list.json()).toEqual([expect.objectContaining({ id, registrationNumber: "ABC123", currentOdometerKm: 12345 })]);
    expect((await app.inject("/api/v1/vehicles/" + id)).json()).toMatchObject({ id, make: "Volvo" });
    expect((await pg.query("SELECT value_km FROM odometer_readings")).rows).toEqual([{ value_km: 12345 }]);
  });
  it("accepts zero and permits omitted odometer values", async () => {
    await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: { ...payload, currentOdometerKm: 0 } });
    expect((await app.inject("/api/v1/vehicles")).json()[0].currentOdometerKm).toBe(0);
    await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: { registrationNumber: "DEF456", make: "Saab", model: "900" } });
    expect((await app.inject("/api/v1/vehicles")).json().find((v: { registrationNumber: string }) => v.registrationNumber === "DEF456").currentOdometerKm).toBeNull();
  });
  it("returns 409 only for duplicate identities", async () => {
    await app.inject({ method: "POST", url: "/api/v1/vehicles", payload });
    const duplicate = await app.inject({ method: "POST", url: "/api/v1/vehicles", payload });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toBe("vehicle_conflict");
  });
  it("rejects malformed input and IDs and returns 404 for missing vehicles", async () => {
    expect((await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: { ...payload, currentOdometerKm: -1 } })).statusCode).toBe(400);
    expect((await app.inject("/api/v1/vehicles/not-a-uuid")).statusCode).toBe(400);
    expect((await app.inject("/api/v1/vehicles/11111111-1111-4111-8111-111111111111")).statusCode).toBe(404);
  });
  it("rolls back the vehicle when the odometer insert fails, without claiming a duplicate", async () => {
    await pg.exec(`CREATE FUNCTION reject_reading() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test storage failure'; END $$;
      CREATE TRIGGER reject_reading BEFORE INSERT ON odometer_readings FOR EACH ROW EXECUTE FUNCTION reject_reading();`);
    try {
      const result = await app.inject({ method: "POST", url: "/api/v1/vehicles", payload });
      expect(result.statusCode).toBe(500);
      expect(result.json()).toMatchObject({ error: "internal_error" });
      expect(JSON.stringify(result.json())).not.toContain("test storage failure");
      expect((await pg.query("SELECT id FROM vehicles")).rows).toHaveLength(0);
    } finally {
      await pg.exec("DROP TRIGGER reject_reading ON odometer_readings; DROP FUNCTION reject_reading()");
    }
  });
  it("reports readiness separately from liveness when the schema is missing", async () => {
    expect((await app.inject("/ready")).statusCode).toBe(200);
    await pg.exec("ALTER TABLE odometer_readings RENAME TO readings_temporarily_unavailable");
    try {
      expect((await app.inject("/health")).statusCode).toBe(200);
      expect((await app.inject("/ready")).statusCode).toBe(503);
    } finally { await pg.exec("ALTER TABLE readings_temporarily_unavailable RENAME TO odometer_readings"); }
  });
});

it("adopts the old init-SQL database without deleting data and can migrate twice", async () => {
  const legacy = new PGlite();
  try {
    await legacy.exec(readFileSync("./drizzle/0000_vehicle_foundation.sql", "utf8"));
    await legacy.exec("INSERT INTO vehicles (registration_number, make, model) VALUES ('OLD123', 'Volvo', '240')");
    const legacyDb = drizzle(legacy);
    await migrate(legacyDb, { migrationsFolder: "./drizzle" });
    await migrate(legacyDb, { migrationsFolder: "./drizzle" });
    expect((await legacy.query("SELECT registration_number FROM vehicles")).rows).toEqual([{ registration_number: "OLD123" }]);
    expect((await legacy.query("SELECT * FROM drizzle.__drizzle_migrations")).rows).toHaveLength(1);
  } finally { await legacy.close(); }
}, 30000);
