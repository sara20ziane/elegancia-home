import type { BeddingProvenance } from "@/lib/bedding-provenance";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInSynthetic } from "./admin-session";

test("presets : transitions automatiques/manuelles et doublons commerciaux dans l’aperçu", async ({
  page,
  context,
}, info) => {
  await signInSynthetic(page, context);
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Nouveau modèle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom arabe").fill("اختبار القواعد");
  await dialog.getByLabel("Nom français").fill(`Presets-${info.project.name}`);
  await dialog.getByRole("button", { name: "Continuer vers les configurations" }).click();
  await fillCommon(dialog);
  await dialog.getByRole("button", { name: "Afficher l’aperçu" }).click();
  const rows = dialog.getByTestId("generated-variant");
  await exercisePresetTransitions(rows.nth(0), dialog);
  await dialog.getByRole("button", { name: "Créer les configurations", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/product\//);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const before = await readProduct(page, id);
  expect(before.product_variants).toHaveLength(2);
  const queen = before.product_variants.find(
    (value: { size: string }) => value.size === "Queen size",
  );
  expect(queen.bedding_provenance.fitted_sheet_size).toEqual({ source: "preset", state: "known" });
  expect(queen.composition).toBe("1 housse de couette + 1 drap-housse + 4 taies d’oreiller");
  await page.getByText("Mode rapide — ajouter plusieurs tailles", { exact: true }).click();
  // Existing configurations are supplied to the preview, irrespective of SKU/price/stock.
  const quick = page
    .locator("details")
    .filter({
      has: page.locator("summary", { hasText: "Mode rapide — ajouter plusieurs tailles" }),
    })
    .first();
  await fillCommon(quick);
  await quick.getByRole("button", { name: "Afficher l’aperçu" }).click();
  await expect(quick.getByRole("alert")).toHaveCount(2);
  await expect(
    quick.getByRole("button", { name: "Créer les configurations", exact: true }),
  ).toBeDisabled();
  await quick.getByText("Prix différents selon la taille", { exact: true }).click();
  await quick.getByLabel("Prix Queen size", { exact: true }).fill("20000");
  await expect(quick.getByRole("alert")).toHaveCount(2);
  const response = await page.request.post("http://127.0.0.1:54329/rest/v1/rpc/catalog_generate", {
    headers: { Authorization: "Bearer synthetic-admin-token" },
    data: {
      p: {
        request_id: crypto.randomUUID(),
        product_id: id,
        variants: [
          {
            size: "Queen size",
            set_type: "Parure housse de couette",
            piece_count: 6,
            fabric: "Coton",
            price: 20000,
            stock: 99,
            sku: "AUTRE-02",
          },
        ],
      },
    },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toContain("configuration commerciale");
  const after = await readProduct(page, id);
  expect(after.product_variants.map((value: { id: string }) => value.id).sort()).toEqual(
    before.product_variants.map((value: { id: string }) => value.id).sort(),
  );
  expect(after.status).toBe("draft");
});

async function fillCommon(scope: Locator) {
  await scope.getByRole("combobox", { name: "Tissu", exact: true }).fill("Coton");
  await scope
    .getByRole("combobox", { name: "Type de parure", exact: true })
    .fill("Parure housse de couette");
  await scope.getByLabel("Nombre de pièces").fill("6");
  await scope.getByLabel("Prix de vente (DA)").fill("9500");
  await scope.getByLabel("Stock initial", { exact: true }).fill("3");
}

async function exercisePresetTransitions(queen: Locator, dialog: Locator) {
  await queen.getByText("Modifier cette configuration", { exact: true }).click();
  const size = queen.getByLabel("Taille du lit", { exact: true });
  await size.selectOption("King size");
  await expect(queen).toContainText("180 × 200 cm");
  await expect(queen).toContainText("260 × 240 cm");
  await expect(dialog.getByRole("alert")).toHaveCount(2);
  await queen.getByText("Composition, dimensions et gestion (facultatif)", { exact: true }).click();
  const fitted = queen.getByLabel("Drap-housse / dimension matelas", { exact: true });
  const cover = queen.getByLabel("Housse de couette", { exact: true });
  await fitted.fill("Personnalisé");
  await fitted.fill("180 × 200 cm");
  await size.selectOption("Queen size");
  await expect(fitted).toHaveValue("180 × 200 cm");
  await expect(cover).toHaveValue("220 × 240 cm");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await size.selectOption("__other__");
  await queen.getByLabel("Autre taille / dimension", { exact: true }).fill("140 × 190 cm");
  await expect(fitted).toHaveValue("180 × 200 cm");
  await expect(cover).toHaveValue("");
  await size.selectOption("Queen size");
  await queen.getByRole("button", { name: "Recalculer depuis le preset", exact: true }).click();
  await queen.getByRole("button", { name: "Appliquer ces changements", exact: true }).click();
  await expect(fitted).toHaveValue("160 × 190 cm");
  await queen.getByLabel("Nombre de pièces").fill("3");
  await expect(fitted).toHaveValue("");
  await expect(queen.getByLabel("Composition du pack")).toHaveValue(
    "1 housse de couette + 2 taies d’oreiller",
  );
  await queen.getByRole("combobox", { name: "Type de parure", exact: true }).fill("Parure de drap");
  await expect(fitted).toHaveValue("");
  await expect(cover).toHaveValue("");
  await expect(queen.getByLabel("Drap plat", { exact: true })).toHaveValue("250 × 240 cm");
  await queen.getByLabel("Nombre de pièces").fill("6");
  await expect(fitted).toHaveValue("160 × 190 cm");
  await queen
    .getByRole("combobox", { name: "Type de parure", exact: true })
    .fill("Parure housse de couette");
  await expect(cover).toHaveValue("220 × 240 cm");
}

type TestProduct = {
  status: string;
  product_variants: {
    id: string;
    size: string;
    composition: string;
    bedding_provenance: BeddingProvenance;
  }[];
};

async function readProduct(page: Page, id: string): Promise<TestProduct> {
  const response = await page.request.get(`http://127.0.0.1:54329/rest/v1/products?id=eq.${id}`, {
    headers: { Authorization: "Bearer synthetic-admin-token" },
  });
  return ((await response.json()) as TestProduct[])[0];
}
