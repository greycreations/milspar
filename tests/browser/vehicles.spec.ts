import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => { if (!process.env.E2E_BASE_URL) await page.route("**/api/v1/overview", route => route.fulfill({ json: { events: [], maintenance: [] } })); });

test("create a vehicle and retain it after reload", async ({ page }, testInfo) => {
  const vehicles: unknown[] = [];
  if (!process.env.E2E_BASE_URL) {
    await page.route("**/api/v1/vehicles", async (route) => {
      if (route.request().method() === "POST") {
        const data = route.request().postDataJSON();
        vehicles.push({ ...data, id: "test-id", coverImageUrl: null });
        await route.fulfill({ status: 201, json: { id: "test-id" } });
      } else { await route.fulfill({ json: vehicles }); }
    });
  }
  const registration = ("E" + Date.now().toString(36) + (testInfo.project.name === "mobile" ? "M" : "D")).toUpperCase();
  await page.goto("/");
  await page.getByRole("button", { name: "Lägg till fordon", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Registreringsnummer").fill(registration);
  await dialog.getByLabel("Märke", { exact: true }).fill("Volvo");
  await dialog.getByLabel("Modell", { exact: true }).fill("V60");
  await dialog.getByLabel("Aktuell mätarställning").fill("12345");
  await dialog.getByRole("button", { name: "Spara fordon" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(registration, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(registration, { exact: true })).toBeVisible();
});

test("load errors offer retry instead of an empty garage", async ({ page }) => {
  let fails = true;
  await page.route("**/api/v1/vehicles", (route) => route.fulfill(fails ? { status: 503, json: {} } : { json: [] }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Kunde inte hämta");
  await expect(page.getByText("Din servicebok börjar här")).not.toBeVisible();
  fails = false;
  await page.getByRole("button", { name: "Försök igen" }).click();
  await expect(page.getByText("Din servicebok börjar här")).toBeVisible();
});

test("dialog traps focus, closes with Escape and restores focus", async ({ page }) => {
  await page.route("**/api/v1/vehicles", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Lägg till fordon", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Spara fordon" }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Stäng" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});
