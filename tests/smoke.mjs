import assert from "node:assert/strict";
const mode = process.argv[2];
const base = mode === "legacy" ? "http://127.0.0.1:3002" : "http://127.0.0.1:3000";
if (mode === "create") {
  const response = await fetch(base + "/api/v1/vehicles", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ registrationNumber: "PERSIST1", make: "Saab", model: "900", currentOdometerKm: 45678 }),
  });
  assert.equal(response.status, 201);
} else {
  const response = await fetch(base + "/api/v1/vehicles");
  assert.equal(response.status, 200);
  const vehicle = (await response.json()).find(v => v.registrationNumber === (mode === "legacy" ? "LEGACY1" : "PERSIST1"));
  assert.ok(vehicle, "Existing vehicle must survive migration/recreation");
  if (mode !== "legacy") assert.equal(vehicle.currentOdometerKm, 45678);
}
console.log("Compose smoke check passed:", mode);
