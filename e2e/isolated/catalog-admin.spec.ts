import { expect, test, type Page, type BrowserContext } from "@playwright/test";

test("mode rapide admin : Queen + King, valeurs communes, aperçu éditable et brouillon", async ({
  page,
  context,
}, info) => {
  await signInSynthetic(page, context);
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Nouveau modèle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = `Aveline ${info.project.name}`;
  await dialog.getByLabel("Nom arabe").fill("أفلين");
  await dialog.getByLabel("Nom français").fill(name);
  await dialog.getByRole("button", { name: "Continuer vers les configurations" }).click();
  await expect(dialog.getByLabel("Queen size", { exact: true })).toBeChecked();
  await expect(dialog.getByLabel("King size", { exact: true })).toBeChecked();
  await dialog.getByRole("combobox", { name: "Tissu", exact: true }).fill("100 % coton");
  await dialog.getByLabel("Origine du tissu").fill("Espagne");
  await dialog
    .getByRole("combobox", { name: "Type de parure", exact: true })
    .fill("Parure housse de couette");
  await dialog.getByLabel("Nombre de pièces").fill("6");
  await dialog.locator('input[placeholder="9500"]').fill("9500");
  await dialog.getByLabel("Stock initial", { exact: true }).fill("3");
  await dialog.getByRole("button", { name: "Afficher l’aperçu" }).click();
  const preview = dialog.getByTestId("generated-variant");
  await expect(preview).toHaveCount(2);
  await expect(preview.nth(0)).toContainText("160 × 190 cm");
  await expect(preview.nth(0)).toContainText("220 × 240 cm");
  await expect(preview.nth(1)).toContainText("180 × 200 cm");
  await expect(preview.nth(1)).toContainText("260 × 240 cm");
  await expect(preview.nth(1)).toContainText("9500 DA · Stock 3");
  await preview.nth(0).getByText("Modifier cette configuration", { exact: true }).click();
  await preview
    .nth(0)
    .getByRole("combobox", { name: "Tissu", exact: true })
    .fill("Percale manuelle");
  await preview
    .nth(0)
    .getByText("Composition, dimensions et gestion (facultatif)", { exact: true })
    .click();
  const manualSku = `ELG-MANUEL-${info.project.name.toUpperCase()}`;
  await preview.nth(0).getByLabel("SKU", { exact: true }).fill(manualSku);
  await dialog
    .getByRole("combobox", { name: "Tissu", exact: true })
    .first()
    .fill("Autre tissu commun");
  await expect(preview.nth(0).getByRole("combobox", { name: "Tissu", exact: true })).toHaveValue(
    "Percale manuelle",
  );
  const skus = await preview.locator("p.font-mono").allTextContents();
  expect(new Set(skus).size).toBe(2);
  await dialog.getByRole("button", { name: "Créer les configurations", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/product\//);
  await expect(page.getByRole("heading", { name: "أفلين" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /نشر|Publier|Publish/, exact: true }),
  ).toBeEnabled();
  await page.getByText("Réglages avancés — modifier les configurations", { exact: true }).click();
  const configurations = page.locator("#new-configuration");
  await expect(configurations).toHaveCount(0);
  const fields = page.getByRole("combobox", { name: "Tissu", exact: true });
  await expect(fields).toHaveCount(2);
  await expect(fields.nth(0)).toHaveValue("Percale manuelle");
  await expect(fields.nth(1)).toHaveValue("100 % coton");
  // Read the persisted draft through the isolated adapter with the test-only session.
  const id = new URL(page.url()).pathname.split("/").at(-1);
  const response = await page.request.get(`http://127.0.0.1:54329/rest/v1/products?id=eq.${id}`, {
    headers: { Authorization: "Bearer synthetic-admin-token" },
  });
  const [product] = await response.json();
  expect(product.status).toBe("draft");
  expect(product.product_variants).toHaveLength(2);
  expect(product.product_variants.map((v: { sku: string }) => v.sku).sort()).toEqual(skus.sort());
  const ids = product.product_variants.map((v: { id: string }) => v.id).sort();
  await page.getByText("Valeurs communes — appliquer à toutes", { exact: true }).click();
  await page.getByLabel("Nouvelle valeur").fill("Percale commune");
  await page
    .getByRole("button", { name: "Appliquer à toutes les configurations", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("2 configurations");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(fields.nth(0)).toHaveValue("Percale manuelle");
  await page
    .getByRole("button", { name: "Appliquer à toutes les configurations", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmer pour 2 configurations", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(fields.nth(0)).toHaveValue("Percale commune");
  await expect(fields.nth(1)).toHaveValue("Percale commune");
  const after = await page.request.get(`http://127.0.0.1:54329/rest/v1/products?id=eq.${id}`, {
    headers: { Authorization: "Bearer synthetic-admin-token" },
  });
  expect((await after.json())[0].product_variants.map((v: { id: string }) => v.id).sort()).toEqual(
    ids,
  );
  await page.screenshot({ path: `test-results/catalog-${info.project.name}.png`, fullPage: true });
  await expect(page.getByRole("button", { name: "Dupliquer le modèle", exact: true })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

async function signInSynthetic(page: Page, context: BrowserContext) {
  await context.route("**/*", (route) =>
    ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      "sb-127-auth-token",
      JSON.stringify({
        access_token: "synthetic-admin-token",
        refresh_token: "synthetic-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: {
          id: "cccccccc-1111-4111-8111-111111111111",
          aud: "authenticated",
          role: "authenticated",
          email: "catalog@example.test",
        },
      }),
    );
  });
}
