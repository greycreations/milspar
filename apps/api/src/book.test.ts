import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import type { BookEvent, ServiceBook } from "@milspar/contracts";
import { addMonths } from "./services/book-domain.js";

const state = vi.hoisted(() => ({ database: null as unknown }));
vi.mock("./db/client.js", () => ({ get db() { return state.database; } }));
const pg = new PGlite(), database = drizzle(pg); state.database = database;
const uploadRoot = await mkdtemp(path.join(tmpdir(), "milspar-files-test-"));
const priorPath = process.env.UPLOAD_PATH; process.env.UPLOAD_PATH = uploadRoot;
const { buildApp } = await import("./app.js");
const app = await buildApp();
beforeAll(async () => { await migrate(database, { migrationsFolder: "./drizzle" }); await app.ready(); }, 30000);
beforeEach(async () => { await pg.exec("TRUNCATE vehicles CASCADE"); });
afterAll(async () => { await app.close(); await pg.close(); await rm(uploadRoot, { recursive: true, force: true }); if (priorPath === undefined) delete process.env.UPLOAD_PATH; else process.env.UPLOAD_PATH = priorPath; });
async function vehicle(reg = "BOOK1") { const r = await app.inject({ method: "POST", url: "/api/v1/vehicles", payload: { registrationNumber: reg, make: "Volvo", model: "V60" } }); expect(r.statusCode).toBe(201); return r.json().id as string; }
const event = (overrides = {}) => ({ type: "service", title: "Årsservice", occurredAt: "2025-01-01T12:00:00.000Z", odometerKm: 1000, items: ["Olja", "Filter"], costMinor: 125050, ...overrides });
const call = (id: string, route: string, method: "POST" | "PUT" | "DELETE", payload?: Record<string, unknown>) => app.inject({ method, url: `/api/v1/vehicles/${id}/${route}`, ...(payload === undefined ? {} : { payload }) });
const book = async (id: string): Promise<ServiceBook> => { const response = await app.inject(`/api/v1/vehicles/${id}/book`); expect(response.statusCode).toBe(200); return response.json(); };

it("creates, edits and deletes linked events atomically with costs, revision checks and audit history", async () => {
  const id = await vehicle();
  const created = await call(id, "events", "POST", event()); expect(created.statusCode).toBe(201);
  const eid = created.json().id;
  const initial = (await book(id)).events[0]!;
  expect(initial).toMatchObject({ id: eid, revision: 1, costMinor: 125050, items: ["Olja", "Filter"] });
  expect((await call(id, `events/${eid}`, "PUT", event({ title: "Uppdaterad", odometerKm: 1200, revision: 1 }))).statusCode).toBe(200);
  expect((await call(id, `events/${eid}`, "PUT", event({ revision: 1 }))).statusCode).toBe(409);
  expect((await app.inject(`/api/v1/vehicles/${id}`)).json().currentOdometerKm).toBe(1200);
  expect((await call(id, `events/${eid}`, "DELETE", { revision: 2 })).statusCode).toBe(204);
  expect((await book(id)).events).toHaveLength(0);
  expect((await app.inject(`/api/v1/vehicles/${id}`)).json().currentOdometerKm).toBeNull();
  expect((await pg.query("SELECT action FROM audit_log WHERE entity_id=$1 ORDER BY created_at", [eid])).rows).toEqual([{ action: "create" }, { action: "update" }, { action: "delete" }]);
});
it("requires explicit mileage anomaly confirmation, checks both neighbours and keeps zero", async () => {
  const id = await vehicle();
  await call(id, "events", "POST", event({ type: "odometer", odometerKm: 100 }));
  await call(id, "events", "POST", event({ type: "odometer", odometerKm: 300, occurredAt: "2025-03-01T12:00:00.000Z" }));
  const conflict = event({ type: "odometer", odometerKm: 500, occurredAt: "2025-02-01T12:00:00.000Z" });
  expect((await call(id, "events", "POST", conflict)).json().error).toBe("odometer_conflict");
  expect((await call(id, "events", "POST", { ...conflict, confirmOdometer: true })).statusCode).toBe(201);
  expect((await book(id)).events.find(e => e.odometerKm === 500)?.anomaly).toBe(true);
  expect((await call(id, "events", "POST", event({ type: "odometer", odometerKm: 0, occurredAt: "2024-01-01T12:00:00.000Z" }))).statusCode).toBe(201);
  expect((await call(id, "events", "POST", event({ occurredAt: "2200-01-01T00:00:00Z" }))).statusCode).toBe(400);
});
it("does not duplicate a manual event when a saved request is retried", async () => {
  const id = await vehicle(), input = event({ requestId: randomUUID() });
  const first = await call(id, "events", "POST", input), retry = await call(id, "events", "POST", input);
  expect(first.statusCode).toBe(201); expect(retry.statusCode).toBe(201);
  expect(retry.json().id).toBe(first.json().id);
  expect((await book(id)).events).toHaveLength(1);
  expect((await call(id, "events", "POST", { ...input, title: "Different" })).statusCode).toBe(409);
});
it("validates input and isolates vehicles, batches, events and deletion", async () => {
  const id = await vehicle(), other = await vehicle("OTHER");
  const eid = (await call(id, "events", "POST", event())).json().id;
  expect((await call(other, `events/${eid}`, "PUT", event({ revision: 1 }))).statusCode).toBe(404);
  expect((await call(other, `events/${eid}`, "DELETE", { revision: 1 })).statusCode).toBe(404);
  expect((await call(id, "events", "POST", event({ costMinor: 1.5 }))).statusCode).toBe(400);
  expect((await app.inject("/api/v1/vehicles/bad/book")).statusCode).toBe(400);
  await app.inject({ method: "DELETE", url: `/api/v1/vehicles/${id}` });
  expect((await call(id, "events", "POST", event())).statusCode).toBe(404);
  expect((await app.inject(`/api/v1/vehicles/${id}/book`)).statusCode).toBe(404);
});
it("updates vehicle data with optimistic concurrency and active identity uniqueness", async () => {
  const id = await vehicle(), other = await vehicle("OTHER");
  const detail = (await app.inject(`/api/v1/vehicles/${id}`)).json();
  const input = { registrationNumber: "NEWREG", make: "Saab", model: "900", variant: null, vin: null, modelYear: null, color: "Blå", notes: "Ny anteckning", expectedUpdatedAt: detail.updatedAt };
  expect((await app.inject({ method: "PUT", url: `/api/v1/vehicles/${id}`, payload: input })).statusCode).toBe(200);
  expect((await app.inject({ method: "PUT", url: `/api/v1/vehicles/${id}`, payload: input })).statusCode).toBe(409);
  const od = (await app.inject(`/api/v1/vehicles/${other}`)).json();
  expect((await app.inject({ method: "PUT", url: `/api/v1/vehicles/${other}`, payload: { ...input, expectedUpdatedAt: od.updatedAt } })).statusCode).toBe(409);
});
async function wheels(id: string) {
  const summer = (await call(id, "wheel-sets", "POST", { name: "Sommar 19", season: "summer", rimName: "Original", rimDiameter: 19, color: "Svart" })).json().id;
  const winter = (await call(id, "wheel-sets", "POST", { name: "Vinter 18", season: "winter" })).json().id;
  const sb = (await call(id, "tire-batches", "POST", { wheelSetId: summer, make: "Michelin", model: "Primacy", acquiredOn: "2024-01-01" })).json().id;
  const wb = (await call(id, "tire-batches", "POST", { wheelSetId: winter, make: "Nokian", model: "Hakka" })).json().id;
  return { summer, winter, sb, wb };
}
const change = (batch: string | null, date: string, km: number | null) => event({ type: "wheel_change", title: "Hjulbyte", wheelBatchId: batch, occurredAt: `${date}T12:00:00.000Z`, odometerKm: km, costMinor: null });
it("replays summer/winter/summer periods and keeps new tire batches separate", async () => {
  const id = await vehicle(), { sb, wb, summer } = await wheels(id);
  for (const input of [change(sb, "2024-04-01", 1000), change(wb, "2024-11-01", 7000), change(sb, "2025-04-01", 10000)]) expect((await call(id, "events", "POST", input)).statusCode).toBe(201);
  await call(id, "events", "POST", event({ type: "odometer", occurredAt: "2025-05-01T12:00:00Z", odometerKm: 11000 }));
  expect((await book(id)).fitments.map(f => f.distanceKm)).toEqual([6000, 3000, 1000]);
  const next = (await call(id, "tire-batches", "POST", { wheelSetId: summer, make: "Continental", model: "Eco" })).json().id;
  expect((await call(id, "events", "POST", change(next, "2025-06-01", 12000))).statusCode).toBe(201);
  const result = await book(id);
  expect(result.fitments[0]?.batchId).toBe(sb);
  expect(result.fitments.at(-1)?.batchId).toBe(next);
  expect(result.tireBatches.find(b => b.id === sb)?.make).toBe("Michelin");
});
it("rejects impossible wheel corrections, handles missing km and serializes simultaneous changes", async () => {
  const id = await vehicle(), { sb, wb } = await wheels(id);
  const first = await call(id, "events", "POST", change(sb, "2024-04-01", null));
  const second = await call(id, "events", "POST", change(wb, "2024-11-01", 7000));
  const b = await book(id); expect(b.fitments[0]?.distanceKm).toBeNull();
  expect((await call(id, "events", "POST", change(wb, "2025-01-01", 8000))).statusCode).toBe(409);
  expect((await call(id, `events/${second.json().id}`, "PUT", { ...change(sb, "2024-11-01", 7000), revision: 1 })).statusCode).toBe(409);
  const outcomes = await Promise.all([call(id, "events", "POST", change(sb, "2025-04-01", 10000)), call(id, "events", "POST", change(sb, "2025-04-01", 10000))]);
  expect(outcomes.map(o => o.statusCode).sort()).toEqual([201, 409]);
  expect((await call(id, `tire-batches/${sb}`, "DELETE", { revision: 1 })).statusCode).toBe(409);
  expect((await call(id, `events/${first.json().id}`, "DELETE", { revision: 1 })).statusCode).toBe(204);
  expect((await book(id)).fitments).toHaveLength(2);
});
it("recalculates periods on edits and deletion, and does not permit isolated wheel readings to disappear", async () => {
  const id = await vehicle(), { sb, wb } = await wheels(id);
  const first = (await call(id, "events", "POST", change(sb, "2024-04-01", 1000))).json().id;
  const second = (await call(id, "events", "POST", change(wb, "2024-11-01", 7000))).json().id;
  const reading = (await app.inject(`/api/v1/vehicles/${id}`)).json().odometerReadings[0].id;
  expect((await call(id, `odometer-readings/${reading}`, "DELETE")).statusCode).toBe(409);
  expect((await call(id, `events/${second}`, "PUT", { ...change(wb, "2024-11-01", 7500), revision: 1 })).statusCode).toBe(200);
  expect((await book(id)).fitments[0]?.distanceKm).toBe(6500);
  expect((await call(id, `events/${second}`, "DELETE", { revision: 2 })).statusCode).toBe(204);
  expect((await book(id)).fitments).toMatchObject([{ eventId: first, removedAt: null, distanceKm: 0 }]);
});
it("completes recurring maintenance, reschedules on correction and reverses completion on removal", async () => {
  const id = await vehicle();
  const rule = (await call(id, "maintenance", "POST", { title: "Service", dueOn: "2025-01-31", dueKm: 1000, intervalMonths: 1, intervalKm: 15000 })).json().id;
  const completed = await call(id, `maintenance/${rule}/complete`, "POST", event({ occurredAt: "2025-01-31T12:00:00Z", revision: 1 }));
  expect(completed.statusCode).toBe(200);
  let data = await book(id);
  expect(data.maintenance.find(r => r.status !== "done")).toMatchObject({ dueOn: "2025-02-28", dueKm: 16000 });
  const saved = data.events[0]!;
  expect((await call(id, `events/${saved.id}`, "PUT", { ...saved, odometerKm: 2000 })).statusCode).toBe(409);
  expect((await call(id, `events/${saved.id}`, "PUT", { ...saved, odometerKm: 2000, confirmSchedule: true })).statusCode).toBe(200);
  expect((await book(id)).maintenance.find(r => r.status !== "done")?.dueKm).toBe(17000);
  expect((await call(id, `events/${saved.id}`, "DELETE", { revision: 2 })).statusCode).toBe(204);
  data = await book(id); expect(data.maintenance).toHaveLength(1); expect(data.maintenance[0]?.completedEventId).toBeNull();
  expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
});
it("counts each event cost once, keeps currencies separate and updates dashboard status", async () => {
  const id = await vehicle(), now = new Date().toISOString();
  await call(id, "events", "POST", event({ occurredAt: now, costMinor: 10000 }));
  await call(id, "events", "POST", event({ occurredAt: now, costMinor: 250, currency: "EUR", odometerKm: null }));
  await call(id, "maintenance", "POST", { title: "Besiktning", dueKm: 900 });
  const data = await book(id); expect(data.totals).toEqual(expect.arrayContaining([{ currency: "SEK", amountMinor: 10000 }, { currency: "EUR", amountMinor: 250 }]));
  expect(data.maintenance[0]?.status).toBe("overdue");
  expect((await app.inject("/api/v1/overview")).json().events).toHaveLength(2);
});
function multipartBody(buffer: Buffer, mime: string, filename = "foto.png") {
  const boundary = "milspar-" + randomUUID();
  return { headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`), buffer, Buffer.from(`\r\n--${boundary}--\r\n`)]) };
}
it("preserves image originals, generates previews, links files and updates cover without leaking across vehicles", async () => {
  const id = await vehicle(), other = await vehicle("OTHER");
  const eid = (await call(id, "events", "POST", event())).json().id;
  const original = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#f5c518" } }).png().toBuffer();
  const response = await app.inject({ method: "POST", url: `/api/v1/vehicles/${id}/assets?eventId=${eid}`, ...multipartBody(original, "image/png") });
  expect(response.statusCode).toBe(201);
  const assetId = response.json().id;
  expect((await book(id)).assets[0]).toMatchObject({ id: assetId, eventId: eid, mime: "image/png", size: original.length });
  const download = await app.inject(`/api/v1/vehicles/${id}/assets/${assetId}/original`);
  expect(download.rawPayload).toEqual(original); expect(download.headers["content-disposition"]).toContain("attachment");
  expect((await app.inject(`/api/v1/vehicles/${id}/assets/${assetId}/preview`)).headers["content-type"]).toContain("image/webp");
  expect((await call(other, "cover", "PUT", { assetId })).statusCode).toBe(400);
  expect((await call(id, "cover", "PUT", { assetId })).statusCode).toBe(200);
  expect((await app.inject(`/api/v1/vehicles/${id}`)).json().coverImageUrl).toContain(assetId);
  expect((await app.inject(`/api/v1/vehicles/${other}/assets/${assetId}/original`)).statusCode).toBe(404);
  await call(id, `events/${eid}`, "DELETE", { revision: 1 });
  expect((await book(id)).assets[0]?.eventId).toBeNull();
  expect((await call(id, `assets/${assetId}`, "DELETE")).statusCode).toBe(204);
  expect((await app.inject(`/api/v1/vehicles/${id}`)).json().coverImageUrl).toBeNull();
  expect((await app.inject(`/api/v1/vehicles/${id}/assets/${assetId}/original`)).statusCode).toBe(404);
  expect(await readFile(path.join(uploadRoot, `${assetId}.bin`))).toEqual(original);
});
it("rejects disguised/oversized files and foreign event links", async () => {
  const id = await vehicle(), other = await vehicle("OTHER");
  const eid = (await call(other, "events", "POST", event())).json().id;
  expect((await app.inject({ method: "POST", url: `/api/v1/vehicles/${id}/assets`, ...multipartBody(Buffer.from("<script>alert(1)</script>"), "image/png") })).statusCode).toBe(400);
  expect((await app.inject({ method: "POST", url: `/api/v1/vehicles/${id}/assets?eventId=${eid}`, ...multipartBody(Buffer.from("%PDF-1.4\n%%EOF"), "application/pdf", "receipt.pdf") })).statusCode).toBe(404);
  const large = Buffer.alloc(21 * 1024 * 1024); large.write("%PDF-1.4");
  expect((await app.inject({ method: "POST", url: `/api/v1/vehicles/${id}/assets`, ...multipartBody(large, "application/pdf", "large.pdf") })).statusCode).toBe(413);
});
