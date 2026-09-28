import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { vehicleDetailSchema } from "@milspar/contracts";

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
  it("removes readings only from their own vehicle and recalculates mileage including empty history", async () => {
    const created = await app.inject({ method: "POST", url: "/api/v1/vehicles", payload });
    const id = created.json().id;
    const other = (await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: { ...payload, registrationNumber: "OTHER" } })).json().id;
    const initial = (await app.inject(`/api/v1/vehicles/${id}`)).json().odometerReadings[0].id;
    const old = (await pg.query<{ id: string }>("INSERT INTO odometer_readings (vehicle_id, value_km, recorded_at) VALUES ($1, 0, '2020-01-01') RETURNING id", [id])).rows[0]!.id;
    const remove = (vehicle: string, reading: string) => app.inject({ method: "DELETE", url: `/api/v1/vehicles/${vehicle}/odometer-readings/${reading}` });
    expect((await remove(other, initial)).statusCode).toBe(404);
    expect((await remove(id, "bad-id")).statusCode).toBe(400);
    expect((await remove(id, initial)).statusCode).toBe(204);
    expect((await remove(id, initial)).statusCode).toBe(404);
    expect((await app.inject(`/api/v1/vehicles/${id}`)).json()).toMatchObject({ currentOdometerKm: 0, odometerReadings: [{ id: old }] });
    expect((await app.inject("/api/v1/vehicles")).json().find((v: { id: string }) => v.id === id).currentOdometerKm).toBe(0);
    expect((await remove(id, old)).statusCode).toBe(204);
    expect((await app.inject(`/api/v1/vehicles/${id}`)).json()).toMatchObject({ currentOdometerKm: null, odometerReadings: [] });
    expect((await pg.query("SELECT id FROM odometer_readings WHERE vehicle_id=$1 AND deleted_at IS NOT NULL", [id])).rows).toHaveLength(2);
    expect((await app.inject(`/api/v1/vehicles/${other}`)).json().currentOdometerKm).toBe(12345);
  });
  it("hides a removed vehicle while preserving history and allowing identity reuse", async () => {
    const input = { ...payload, vin: "VIN12345" };
    const id = (await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: input })).json().id;
    const reading = (await app.inject(`/api/v1/vehicles/${id}`)).json().odometerReadings[0].id;
    expect((await app.inject({ method: "DELETE", url: "/api/v1/vehicles/not-an-id" })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: `/api/v1/vehicles/${id}` })).statusCode).toBe(204);
    expect((await app.inject(`/api/v1/vehicles/${id}`)).statusCode).toBe(404);
    expect((await app.inject("/api/v1/vehicles")).json()).toEqual([]);
    expect((await app.inject({ method: "DELETE", url: `/api/v1/vehicles/${id}/odometer-readings/${reading}` })).statusCode).toBe(404);
    expect((await pg.query("SELECT id FROM vehicles WHERE id=$1 AND deleted_at IS NOT NULL", [id])).rows).toHaveLength(1);
    expect((await pg.query("SELECT id FROM odometer_readings WHERE vehicle_id=$1", [id])).rows).toHaveLength(1);
    const replacement = await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: input });
    expect(replacement.statusCode).toBe(201);
    expect(replacement.json().id).not.toBe(id);
    expect((await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: input })).statusCode).toBe(409);
  });
  it("returns chronological, vehicle-scoped detail with matching current reading and bounded history", async () => {
    const created = await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: { ...payload, currentOdometerKm: undefined, vin: "VIN123456", color: "Blå" } });
    const id = created.json().id;
    await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: { ...payload, registrationNumber: "OTHER", currentOdometerKm: 999999 } });
    await pg.query("INSERT INTO odometer_readings (vehicle_id, value_km, recorded_at) SELECT $1, n, '2025-01-01'::timestamptz + n * interval '1 day' FROM generate_series(0, 50) n", [id]);
    // Most recently recorded, not highest numeric value, determines the displayed reading.
    await pg.query("INSERT INTO odometer_readings (vehicle_id, value_km, recorded_at) VALUES ($1, 0, '2026-01-01')", [id]);
    const detail = vehicleDetailSchema.parse((await app.inject(`/api/v1/vehicles/${id}`)).json());
    expect(detail).toMatchObject({ vin: "VIN123456", color: "Blå", currentOdometerKm: 0, hasMoreReadings: true });
    expect(detail.odometerReadings).toHaveLength(50);
    expect(detail.odometerReadings.slice(0, 3).map(r => r.valueKm)).toEqual([0, 50, 49]);
    const list = (await app.inject("/api/v1/vehicles")).json();
    expect(list.find((v: { id: string }) => v.id === id).currentOdometerKm).toBe(detail.currentOdometerKm);
  });
  it("returns explicit nulls and empty history when no reading exists", async () => {
    const created = await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: { registrationNumber: "EMPTY", make: "Saab", model: "900" } });
    const detail = vehicleDetailSchema.parse((await app.inject(`/api/v1/vehicles/${created.json().id}`)).json());
    expect(detail).toMatchObject({ currentOdometerKm: null, odometerReadings: [], hasMoreReadings: false, vin: null, color: null });
  });
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
    expect((await legacy.query("SELECT * FROM drizzle.__drizzle_migrations")).rows).toHaveLength(2);
  } finally { await legacy.close(); }
}, 30000);
