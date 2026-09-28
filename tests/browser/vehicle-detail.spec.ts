import { test, expect } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const vehicle = {
  id, registrationNumber: "DETAIL1", make: "Volvo", model: "V60", variant: null,
  modelYear: 2020, vin: "VIN123456", color: "Blå", notes: null, coverImageUrl: null,
  currentOdometerKm: 0, createdAt: "2026-01-01T10:00:00.000Z", updatedAt: "2026-01-01T10:00:00.000Z",
  odometerReadings: [{ id, valueKm: 0, recordedAt: "2026-01-01T10:00:00.000Z", sourceType: "manual" }], hasMoreReadings: false,
};

const emptyBook = { events: [], wheelSets: [], tireBatches: [], fitments: [], maintenance: [], assets: [], totals: [] };
const bookEvent = { id, vehicleId: id, revision: 1, type: "odometer", title: "Mätarställning", occurredAt: vehicle.createdAt, createdAt: vehicle.createdAt, odometerKm: 0, items: [], description: "", vendor: "", costMinor: null, currency: "SEK", wheelBatchId: null, anomaly: false };
test.beforeEach(async ({ page }) => {
  await page.route(`**/api/v1/vehicles/${id}/book`, route => route.fulfill({ json: emptyBook }));
  if (!process.env.E2E_BASE_URL) {
    await page.route("**/api/v1/overview", route => route.fulfill({ json: { events: [], maintenance: [] } }));
    await page.route("**/api/v1/vehicles/*/book", route => route.fulfill({ json: emptyBook }));
  }
});

test("confirm removal, recover from failure, refresh mileage and remove vehicle", async ({ page, request }, testInfo) => {
  let vehicleId = id;
  const registration = `R${Date.now().toString(36)}${testInfo.project.name[0]}`.toUpperCase();
  let removed = false;
  let readingRemoved = false;
  if (process.env.E2E_BASE_URL) {
    const created = await request.post("/api/v1/vehicles", { data: { registrationNumber: registration, make: "Saab", model: "900", currentOdometerKm: 42 } });
    expect(created.status()).toBe(201);
    vehicleId = (await created.json()).id;
  } else {
    const data = { ...vehicle, registrationNumber: registration, make: "Saab", model: "900", currentOdometerKm: 42, odometerReadings: [{ ...vehicle.odometerReadings[0], valueKm: 42 }] };
    await page.route("**/api/v1/vehicles", route => route.fulfill({ json: removed ? [] : [{ ...data, currentOdometerKm: readingRemoved ? null : 42 }] }));
    await page.route(`**/api/v1/vehicles/${id}`, route => {
      if (route.request().method() === "DELETE") { removed = true; return route.fulfill({ status: 204 }); }
      return route.fulfill(removed ? { status: 404, json: {} } : { json: { ...data, currentOdometerKm: readingRemoved ? null : 42, odometerReadings: readingRemoved ? [] : data.odometerReadings } });
    });
    await page.route(`**/api/v1/vehicles/${id}/book`, route => route.fulfill({ json: { ...emptyBook, events: readingRemoved ? [] : [{ ...bookEvent, odometerKm: 42 }] } }));
    await page.route(`**/api/v1/vehicles/${id}/events/*`, route => { readingRemoved = true; return route.fulfill({ status: 204 }); });
  }
  let failures = 1;
  await page.route(`**/api/v1/vehicles/${vehicleId}/events/*`, route => {
    if (failures-- > 0) return route.fulfill({ status: 503, json: {} });
    return route.fallback();
  });
  await page.goto(`/#vehicles/${vehicleId}`);
  const removeReading = page.getByRole("button", { name: /^Ta bort avläsning/ });
  await removeReading.click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Avbryt" })).toBeFocused();
  await expect(dialog).toContainText(registration);
  await page.keyboard.press("Escape");
  await expect(removeReading).toBeFocused();
  await expect(page.locator(".kpi-value").first()).toHaveText("42 km");
  await removeReading.click();
  await dialog.getByRole("button", { name: "Ta bort", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Kunde inte ta bort");
  await page.screenshot({ path: testInfo.outputPath("delete-confirmation.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Ta bort", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Ingen mätarställning registrerad", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Alla fordon" }).click();
  const card = page.locator(".vehicle-card").filter({ hasText: registration });
  await expect(card.locator(".odometer strong")).toHaveText("—");
  await card.getByRole("link").click();
  await page.getByRole("button", { name: "Ta bort fordon", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Avbryt" }).click();
  await expect(page.getByRole("heading", { name: "Saab 900" })).toBeVisible();
  await page.getByRole("button", { name: "Ta bort fordon", exact: true }).click();
  await dialog.getByRole("button", { name: "Ta bort", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mina fordon" })).toBeVisible();
  await expect(page.locator(".vehicle-card").filter({ hasText: registration })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".vehicle-card").filter({ hasText: registration })).toHaveCount(0);
  await page.goto(`/#vehicles/${vehicleId}`);
  await expect(page.getByRole("alert")).toContainText("Fordonet finns inte");
});

test("vehicle card opens detail, timeline survives reload and browser back works", async ({ page, request }, testInfo) => {
  let vehicleId = id;
  const registration = `D${Date.now().toString(36)}${testInfo.project.name[0]}`.toUpperCase();
  if (process.env.E2E_BASE_URL) {
    const created = await request.post("/api/v1/vehicles", { data: { registrationNumber: registration, make: "Volvo", model: "V60", currentOdometerKm: 0, color: "Blå", vin: registration + "VIN" } });
    expect(created.status()).toBe(201);
    vehicleId = (await created.json()).id;
  } else {
    await page.route("**/api/v1/vehicles", route => route.fulfill({ json: [{ ...vehicle, registrationNumber: registration }] }));
    await page.route(`**/api/v1/vehicles/${id}`, route => route.fulfill({ json: { ...vehicle, registrationNumber: registration } }));
    await page.route(`**/api/v1/vehicles/${id}/book`, route => route.fulfill({ json: { ...emptyBook, events: [bookEvent] } }));
  }
  await page.goto("/");
  await page.getByRole("link", { name: `Volvo V60, ${registration}` }).click();
  await expect(page).toHaveURL(new RegExp(`#vehicles/${vehicleId}$`));
  await expect(page.getByRole("heading", { name: "Volvo V60", exact: true })).toBeFocused();
  await expect(page.getByText("Blå", { exact: true })).toBeVisible();
  await expect(page.locator(".kpi-value").first()).toHaveText("0 km");
  await page.screenshot({ path: testInfo.outputPath("vehicle-detail.png"), fullPage: true });
  await page.getByRole("link", { name: "Tidslinje", exact: true }).click();
  await expect(page.locator(".reading-list li")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".reading-list li")).toContainText("0 km");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Fordonsuppgifter" })).toBeVisible();
  await page.getByRole("link", { name: "Alla fordon" }).click();
  await expect(page.getByRole("heading", { name: "Mina fordon" })).toBeVisible();
});

test("direct links handle missing vehicles, retry and empty history", async ({ page }) => {
  await page.route("**/api/v1/vehicles", route => route.fulfill({ json: [] }));
  let missing = true;
  await page.route(`**/api/v1/vehicles/${id}`, route => route.fulfill(missing ? { status: 404, json: {} } : { json: { ...vehicle, currentOdometerKm: null, odometerReadings: [] } }));
  await page.goto(`/#vehicles/${id}`);
  await expect(page.getByRole("alert")).toContainText("Fordonet finns inte");
  missing = false;
  await page.getByRole("button", { name: "Försök igen" }).click();
  await expect(page.getByText("Ingen mätarställning registrerad", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingen historik ännu" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/#vehicles/invalid");
  await expect(page.getByRole("alert")).toContainText("Fordonslänken är ogiltig");
});

test("tablet uses a collapsible navigation and readable detail", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.route("**/api/v1/vehicles", route => route.fulfill({ json: [vehicle] }));
  await page.route(`**/api/v1/vehicles/${id}`, route => route.fulfill({ json: vehicle }));
  await page.goto(`/#vehicles/${id}`);
  await expect(page.getByRole("heading", { name: "Fordonsuppgifter" })).toBeVisible();
  await expect(page.locator(".mobile-nav")).not.toBeVisible();
  await page.getByRole("button", { name: "Meny", exact: true }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await page.locator(".sidebar").getByRole("link", { name: "Fordon", exact: true }).click();
  await expect(page.locator(".sidebar")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Mina fordon" })).toBeVisible();
});
