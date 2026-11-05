import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { signInSynthetic } from "./admin-session";

test("avis en attente puis approuvé, filtré par produit, visible publiquement", async ({
  page,
  context,
}, info) => {
  await signInSynthetic(page, context);
  await page.goto("/product/synthetic-serena");
  await page.waitForLoadState("networkidle");
  const form = page.locator("form").filter({ has: page.locator('textarea[maxlength="2000"]') });
  await form.locator('input[autocomplete="name"]').fill(`Cliente E2E ${info.project.name}`);
  await form.locator("textarea").fill(`Literie test ${info.project.name} ${Date.now()}`);
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText(/بانتظار|بعد المراجعة|thanks|Merci|شكراً/).first()).toBeVisible();
  await page.goto("/admin/reviews");
  await page.getByLabel("Filtrer par produit").selectOption("eeeeeeee-1111-4111-8111-111111111111");
  await expect(page.getByText(`Cliente E2E ${info.project.name}`)).toBeVisible();
  const row = page
    .locator("li")
    .filter({ has: page.getByText(`Cliente E2E ${info.project.name}`, { exact: true }) })
    .first();
  await row.locator("button").first().click();
  await page.goto("/product/synthetic-serena");
  await expect(page.getByText(`Cliente E2E ${info.project.name}`, { exact: true })).toBeVisible();
});

test("dashboard, checklist et étiquettes privées restent lisibles sur mobile", async ({
  page,
  context,
  request,
}) => {
  await signInSynthetic(page, context);
  await page.goto("/admin");
  await expect(page.getByText("CA livré · collecté par le transporteur")).toBeVisible();
  await expect(page.getByText(/Configuration ·/)).toBeVisible();
  await expect(page.getByText("Refus et ventes par wilaya", { exact: true }).first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  const response = await request.get("/api/shipping-labels");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await page.goto("/admin/slips");
  await expect(page.getByText(/Étiquettes internes Elegancia Home/)).toBeVisible();
  for (const width of [320, 360, 390, 414, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth), {
        message: `Débordement horizontal après stabilisation à ${width}px`,
      })
      .toBeLessThanOrEqual(1);
  }
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger PDF" }).click();
  const saved = await download;
  const bytes = await readFile((await saved.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
});

test("le catalogue déjà ouvert masque les disponibilités lorsqu'on perd la connexion", async ({
  page,
  context,
}) => {
  await context.route("**/*", (route) =>
    ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/catalogue");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".product-card").first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("status").filter({ hasText: "Connexion requise" })).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(0);
  await context.setOffline(false);
});
