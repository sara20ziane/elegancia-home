import type { AdminProduct, AdminVariant } from "./admin-products";

export function hasPrincipalDimensions(
  variant: Pick<
    AdminVariant,
    "bedding_provenance" | "set_type" | "flat_sheet_size" | "fitted_sheet_size" | "duvet_cover_size"
  >,
): boolean {
  if (!variant.bedding_provenance)
    return (
      !!variant.fitted_sheet_size &&
      (variant.set_type !== "Parure housse de couette" || !!variant.duvet_cover_size)
    );
  return (["flat_sheet_size", "fitted_sheet_size", "duvet_cover_size"] as const).every((key) => {
    const origin = variant.bedding_provenance?.[key];
    return (
      !!variant[key]?.trim() || (origin?.source === "preset" && origin.state === "not_applicable")
    );
  });
}

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
      ok: variants.every(hasPrincipalDimensions),
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
