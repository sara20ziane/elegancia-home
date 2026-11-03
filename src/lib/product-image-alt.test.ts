import { expect, it } from "vitest";
import { productImageAlt } from "./product-image-alt";
import type { CatalogueProduct, CatalogueVariant } from "./queries";

function product(alt: string | null): CatalogueProduct {
  return {
    name: "سيرينا",
    name_fr: "Parure Serena",
    product_variants: [
      {
        is_active: true,
        color_name: "Vert sauge",
        sort_order: 0,
        variant_images: [{ url: "/sage.webp", alt, sort_order: 0 }],
      },
      {
        is_active: true,
        color_name: "Bleu",
        sort_order: 1,
        variant_images: [{ url: "/blue.webp", alt: null, sort_order: 0 }],
      },
    ] as CatalogueVariant[],
  } as CatalogueProduct;
}
it("préfère le texte alternatif renseigné", () => {
  expect(productImageAlt(product(" Détail des fleurs "), "/sage.webp", "fr")).toBe(
    "Détail des fleurs",
  );
});
it("décrit la couleur de la photo, sans inventer de taille ni de matière visible", () => {
  expect(productImageAlt(product("  "), "/sage.webp", "fr")).toBe(
    "Parure Serena – Vert sauge – Elegancia Home",
  );
  expect(productImageAlt(product(null), "/blue.webp", "ar")).toBe("سيرينا – Bleu – Elegancia Home");
  expect(productImageAlt(product(null), "/unknown.webp", "fr")).toBe(
    "Parure Serena – Elegancia Home",
  );
});
