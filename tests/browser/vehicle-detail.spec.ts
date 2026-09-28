import { test, expect } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const vehicle = {
  id, registrationNumber: "DETAIL1", make: "Volvo", model: "V60", variant: null,
  modelYear: 2020, vin: "VIN123456", color: "Blå", notes: null, coverImageUrl: null,
  currentOdometerKm: 0, createdAt: "2026-01-01T10:00:00.000Z", updatedAt: "2026-01-01T10:00:00.000Z",
  odometerReadings: [{ id, valueKm: 0, recordedAt: "2026-01-01T10:00:00.000Z", sourceType: "manual" }], hasMoreReadings: false,
};

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
  await expect(page.getByRole("heading", { name: "Ingen mätarhistorik ännu" })).toBeVisible();
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
