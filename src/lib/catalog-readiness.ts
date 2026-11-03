import type { AdminProduct } from "./admin-products";

export function catalogReadiness(product: AdminProduct) {
  const variants = product.product_variants.filter((variant) => variant.is_active);
  return [
    { label: "Nom", ok: !!product.name.trim(), blocking: true },
    {
      label: "Catégorie",
      ok: !!product.category_id || !!product.product_categories.length,
      blocking: false,
    },
    { label: "Au moins une configuration active", ok: !!variants.length, blocking: true },
    { label: "Prix", ok: !!variants.length && variants.every((v) => v.price > 0), blocking: true },
    {
      label: "SKU renseignés et distincts",
      ok:
        variants.every((v) => !!v.sku?.trim()) &&
        new Set(variants.map((v) => v.sku)).size === variants.length,
      blocking: false,
    },
    {
      label: "Dimensions principales",
      ok: variants.every(
        (v) =>
          !!v.fitted_sheet_size &&
          (v.set_type !== "Parure housse de couette" || !!v.duvet_cover_size),
      ),
      blocking: false,
    },
    {
      label: "Stock renseigné",
      ok: variants.every((v) => Number.isInteger(v.stock) && v.stock >= 0),
      blocking: true,
    },
    {
      label: "Photos",
      ok: !!variants.length && variants.every((v) => v.variant_images.length > 0),
      blocking: false,
    },
  ];
}
