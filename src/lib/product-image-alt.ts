import { localized, type Locale } from "./i18n";
import { sortVariants, type CatalogueProduct } from "./queries";

/** Describe the image's owning variant, never a different selected colour or bed size. */
export function productImageAlt(product: CatalogueProduct, url: string, locale: Locale): string {
  const variants = sortVariants(product.product_variants);
  for (const variant of variants) {
    const image = variant.variant_images.find((image) => image.url === url);
    if (image?.alt?.trim()) return image.alt.trim();
  }
  const owner = variants.find((variant) =>
    variant.variant_images.some((image) => image.url === url),
  );
  return [
    localized(locale, product.name, product.name_fr),
    owner?.color_name?.trim(),
    "Elegancia Home",
  ]
    .filter(Boolean)
    .join(" – ");
}
