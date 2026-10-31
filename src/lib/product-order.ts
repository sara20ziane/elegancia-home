import type { CartItem } from "./cart";
import type { CatalogueProduct, CatalogueVariant } from "./queries";

export function variantLabel(variant: CatalogueVariant): string {
  const bedding = Boolean(variant.fabric || variant.set_type || variant.piece_count !== null);
  const parts = bedding
    ? [
        variant.fabric,
        variant.set_type,
        variant.piece_count !== null ? `${variant.piece_count} pièces` : null,
        variant.size ? `Matelas ${variant.size}` : null,
      ]
    : [variant.size, variant.color_name];
  return parts.filter(Boolean).join(" / ") || "—";
}
export function productOrderLine(
  product: CatalogueProduct,
  name: string,
  variant: CatalogueVariant,
  images: string[],
  quantity: number,
): CartItem {
  return {
    variantId: variant.id,
    productId: product.id,
    slug: product.slug,
    name,
    variantLabel: variantLabel(variant),
    setType: variant.set_type,
    unitPrice: variant.price,
    imageUrl: images[0] ?? null,
    quantity,
  };
}
