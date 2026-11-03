import { expect, test, type Page } from "@playwright/test";

async function noOverflow(page: Page) {
  const excess = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(excess).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ context }) => {
  // Fail closed if the app tries to contact a real Supabase, carrier or telemetry endpoint.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.abort();
  });
});

test("homepage, catalogue, variante, panier, validation, livraison et commande COD", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".product-card").first()).toBeVisible();
  await noOverflow(page);
  await page.goto("/catalogue");
  await page.locator(".product-card").first().click();
  await expect(page.locator("h1")).toContainText("سيرينا");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "King size", exact: true }).click();
  await expect(page.getByRole("button", { name: "King size", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".gallery-main img").first()).toHaveAttribute(
    "alt",
    /Vert sauge.*Elegancia Home/,
  );
  await noOverflow(page);
  await page.getByRole("button", { name: /أضف إلى السلة/ }).click();
  const drawer = page.locator("dialog[open]");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: /إتمام الطلب/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  const form = page.locator("form");
  await page.getByRole("button", { name: /تأكيد الطلب/ }).click();
  expect(await form.evaluate((el: HTMLFormElement) => el.checkValidity())).toBe(false);
  await page.getByLabel(/الاسم الكامل/).fill("SYNTHETIC E2E");
  await page
    .getByLabel(/رقم الهاتف/)
    .fill(info.project.name === "desktop" ? "0555000001" : "0555000002");
  await page.getByLabel(/^الولاية/).selectOption("Alger");
  await page.getByLabel(/البلدية/).fill("Alger Centre");
  await page.getByLabel(/العنوان الكامل/).fill("Adresse synthétique locale");
  // No carrier token is configured; unavailable Stop Desk stays disabled.
  await expect(page.locator('input[value="stopdesk"]')).toBeDisabled();
  await expect(page.locator('input[value="home"]')).toBeChecked();
  await noOverflow(page);
  await page.getByRole("button", { name: /تأكيد الطلب/ }).click();
  await expect(page.getByRole("heading", { name: /تم استلام طلبك/ })).toBeVisible();
  await noOverflow(page);
  // Finance remains OFF: the order succeeds without financial configuration.
  expect(errors).toEqual([]);
});

test("admin et Finance restent fermés et les routes privées non indexables", async ({
  page,
  request,
}) => {
  for (const path of ["/admin", "/admin/finance", "/admin/invoices"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "دخول", exact: true })).toBeVisible();
    await expect(page.locator(".admin-shell")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await noOverflow(page);
  }
  const pdf = await request.get("/api/finance/aaaaaaaa-1111-4111-8111-111111111111/pdf");
  expect(pdf.status()).toBe(401);
  expect(pdf.headers()["cache-control"]).toContain("no-store");
  expect(pdf.headers()["x-robots-tag"]).toContain("noindex");
  const privateRead = await request.get("http://127.0.0.1:54329/rest/v1/orders?select=*");
  expect(privateRead.status()).toBe(403);
});

test("canonical, Product JSON-LD et cartes sociales préservés", async ({ page }) => {
  await page.goto("/product/synthetic-serena");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://elegancia-home.vercel.app/product/synthetic-serena",
  );
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const product = JSON.parse(json!);
  expect(product.offers.priceCurrency).toBe("DZD");
  expect(product.offers.offers).toHaveLength(2);
  expect(product.offers.availability).toBe("https://schema.org/InStock");
  expect(product.aggregateRating).toBeUndefined();
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "product");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
});
