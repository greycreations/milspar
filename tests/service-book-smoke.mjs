import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3080";
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4elQCjhiI4wAAA3EdIbd4yRcAAAAASUVORK5CYII=", "base64");
async function json(path, method = "GET", body) {
  const response = await fetch(base + "/api/v1" + path, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${response.ok ? "" : await response.text()}`);
  return response.json();
}
if (process.argv[2] === "create") {
  const vehicle = await json("/vehicles", "POST", { registrationNumber: "RESTOREBOOK", make: "Volvo", model: "V60" });
  const root = `/vehicles/${vehicle.id}`;
  const event = await json(root + "/events", "POST", { type: "service", title: "Backup service", occurredAt: "2025-01-01T12:00:00Z", odometerKm: 1000, costMinor: 123456 });
  const set = await json(root + "/wheel-sets", "POST", { name: "Backup summer", season: "summer", rimName: "Original", color: "Silver" });
  const batch = await json(root + "/tire-batches", "POST", { wheelSetId: set.id, make: "Test", model: "Summer", acquiredOn: "2024-01-01" });
  await json(root + "/events", "POST", { type: "wheel_change", title: "Backup fitment", occurredAt: "2025-04-01T12:00:00Z", odometerKm: 2000, wheelBatchId: batch.id });
  await json(root + "/maintenance", "POST", { title: "Backup rule", dueKm: 15000 });
  const form = new FormData(); form.append("file", new Blob([bytes], { type: "image/png" }), "original.png");
  const file = await fetch(base + "/api/v1" + root + `/assets?eventId=${event.id}`, { method: "POST", body: form });
  assert.equal(file.status, 201, await file.clone().text());
  await json(root + "/cover", "PUT", { assetId: (await file.json()).id });
} else {
  const vehicle = (await json("/vehicles")).find(v => v.registrationNumber === "RESTOREBOOK");
  assert.ok(vehicle); assert.equal(vehicle.currentOdometerKm, 2000); assert.ok(vehicle.coverImageUrl);
  const book = await json(`/vehicles/${vehicle.id}/book`);
  assert.equal(book.events.length, 2); assert.equal(book.events.find(e => e.type === "service").costMinor, 123456);
  assert.equal(book.fitments.length, 1); assert.equal(book.fitments[0].mountedKm, 2000);
  assert.equal(book.maintenance[0].title, "Backup rule"); assert.equal(book.assets.length, 1);
  const original = await fetch(base + book.assets[0].url);
  assert.equal(original.status, 200); assert.deepEqual(Buffer.from(await original.arrayBuffer()), bytes);
  assert.equal((await fetch(base + book.assets[0].previewUrl)).status, 200);
}
console.log("Service book and original-file persistence verified:", process.argv[2]);
