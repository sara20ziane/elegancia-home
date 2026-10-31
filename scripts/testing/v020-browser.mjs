// Run against v020-api.mjs + local Vite, with fake Supabase env values (see audit report).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const origin = "http://127.0.0.1:8080";
const results = [];
async function context(width, height, mobile = false) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: "fr-FR",
    isMobile: mobile,
    hasTouch: mobile,
  });
  await ctx.addCookies([{ name: "openstore-locale", value: "fr", url: origin }]);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  return ctx;
}
async function fill(page) {
  await page.getByLabel(/Nom complet/).fill("CLIENTE TEST");
  await page.getByLabel(/Téléphone/).fill("0555550199");
  await page.getByLabel(/Wilaya/).selectOption("Alger");
  await page.getByLabel(/Commune/).fill("Alger Centre");
  await page.getByLabel(/Adresse complète/).fill("Adresse de recette uniquement");
}
try {
  await fetch("http://127.0.0.1:59999/fixture/reset");
  const ctx = await context(390, 844, true),
    page = await ctx.newPage();
  await page.goto(origin + "/product/test-bedding");
  await page.getByRole("heading", { name: "TEST LITERIE", exact: true }).waitFor();
  await page.waitForTimeout(1000);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
  );
  const track = page.locator(".gallery [tabindex='0']");
  await track.scrollIntoViewIfNeeded();
  const box = await track.boundingBox();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width * 0.85, y: box.y + box.height * 0.5 }],
  });
  for (let i = 1; i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + box.width * (0.85 - 0.07 * i), y: box.y + box.height * 0.5 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  assert.equal(
    await page
      .getByRole("button", { name: "Description 2", exact: true })
      .getAttribute("aria-current"),
    "true",
  );
  results.push("mobile swipe");
  await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
  const cart = page.locator("dialog[aria-labelledby='cart-title']");
  await cart.waitFor({ state: "visible" });
  await cart.getByRole("button", { name: "Quantité + TEST LITERIE", exact: true }).click();
  await cart.getByRole("button", { name: "Quantité − TEST LITERIE", exact: true }).click();
  await cart.getByRole("button", { name: /Retirer|Supprimer/ }).click();
  await cart.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter au panier", exact: true }).click();
  await cart.waitFor({ state: "visible" });
  await cart.getByRole("button", { name: "Fermer", exact: true }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("openstore-cart-v1")));
  await page.getByRole("button", { name: "King", exact: true }).click();
  await page.getByRole("button", { name: "Quantité +", exact: true }).click();
  await fill(page);
  await page.getByRole("button", { name: "Confirmer la commande", exact: true }).click();
  await page.getByRole("heading", { name: "Commande reçue", exact: true }).waitFor();
  await page.getByRole("button", { name: "Copier le numéro de commande", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Numéro copié" }).waitFor();
  const token = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(token, /^aaaaaaaa-/);
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("openstore-cart-v1"))),
    before,
  );
  results.push("direct King quantity 2 + copy + cart preserved");
  await page.goto(origin + "/checkout");
  await fill(page);
  await page.getByRole("button", { name: "Confirmer la commande", exact: true }).click();
  await page.getByRole("heading", { name: "Commande reçue", exact: true }).waitFor();
  await page.waitForTimeout(200);
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("openstore-cart-v1"))),
    [],
  );
  results.push("cart add/remove/quantity + classic checkout");
  await ctx.close();
  for (const [width, height] of [
    [768, 1024],
    [1440, 1000],
  ]) {
    const ctx = await context(width, height);
    const page = await ctx.newPage();
    await page.goto(origin + "/product/test-bedding");
    await page.getByRole("heading", { name: "TEST LITERIE", exact: true }).waitFor();
    await page.waitForTimeout(1000);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    await page.getByRole("button", { name: "Suivant", exact: true }).click();
    await page.getByRole("button", { name: "Description 1", exact: true }).click();
    await page.locator(".gallery [tabindex='0']").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(450);
    assert.equal(
      await page
        .getByRole("button", { name: "Description 2", exact: true })
        .getAttribute("aria-current"),
      "true",
    );
    await page.locator(".gallery-main").nth(1).click();
    await page.locator("dialog[open]").waitFor({ state: "visible" });
    await page.locator("dialog[open]").getByRole("button", { name: "Fermer", exact: true }).click();
    await page.screenshot({ path: `/tmp/elegancia-v020-${width}.png` });
    results.push(`responsive ${width} + gallery arrows/keyboard/thumbs/zoom`);
    await ctx.close();
  }
  const adminContext = await context(1440, 1000);
  const adminPage = await adminContext.newPage();
  await adminPage.goto(origin + "/login");
  await adminPage.waitForTimeout(1000);
  await adminPage.getByLabel(/E-mail/).fill("test@example.invalid");
  await adminPage.getByLabel(/Mot de passe/).fill("fixture-password");
  await adminPage.getByRole("button", { name: "Se connecter", exact: true }).click();
  await adminPage.waitForTimeout(1500);
  await adminPage.getByTestId("order-list").waitFor();
  const countBefore = await adminPage.getByTestId("order-list").locator(":scope > li").count();
  await adminPage
    .getByRole("button", { name: "Détail de la commande", exact: true })
    .first()
    .click();
  await adminPage.getByRole("button", { name: "Supprimer cette commande", exact: true }).click();
  const remove = adminPage.getByRole("button", { name: "Supprimer cette commande", exact: true });
  assert.equal(await remove.isDisabled(), true);
  const reference = await adminPage.locator("section.border-error p[dir='ltr']").textContent();
  await adminPage.getByLabel("Numéro de commande", { exact: true }).fill(reference);
  await remove.click();
  await adminPage.waitForFunction(
    (count) => document.querySelectorAll('[data-testid="order-list"] > li').length === count - 1,
    countBefore,
  );
  results.push("admin login + exact-reference deletion + refreshed list");
  await adminPage.goto(origin + "/admin/product/11111111-1111-4111-8111-111111111111");
  await adminPage.getByRole("heading", { name: "Photos du modèle", exact: true }).waitFor();
  const png = await adminPage.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    canvas.getContext("2d").fillRect(0, 0, 800, 1200);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await adminPage
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "test-literie.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  const preview = adminPage.getByRole("region", { name: "Aperçu avant envoi", exact: true });
  await preview.waitFor();
  await preview.getByRole("checkbox").check();
  await preview.getByRole("slider").fill("0.7");
  const uploadRequest = adminPage.waitForRequest(
    (req) => req.url().includes("/storage/v1/object/") && req.method() === "POST",
  );
  await preview.getByRole("button", { name: "Valider et envoyer", exact: true }).click();
  const uploaded = await uploadRequest;
  assert.match(uploaded.url(), /\.(webp|jpg)$/);
  const state = await (await fetch("http://127.0.0.1:59999/fixture/state")).json();
  assert.equal(state.uploads[0].encoded, true);
  assert.equal(state.uploads[0].bytes > 0, true);
  await preview.waitFor({ state: "detached" });
  results.push("admin image preview + optional 4:5 crop + encoded upload + gallery refresh");
  await adminContext.close();
  console.log(JSON.stringify({ ok: true, results }));
} finally {
  await browser.close();
}
