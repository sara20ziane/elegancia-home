import { getSupabase } from "./supabase/client";

function copyLabel(value: string | null): string | null {
  if (!value) return null;
  return `${value} - copie`.slice(0, 120);
}

function duplicateSlug(slug: string): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${slug}-copie-${suffix}`;
}

/**
 * Duplicate an admin product as a safe draft template.
 *
 * Catalogue structure is copied, but inventory and identifiers are intentionally reset:
 * - status: draft
 * - published_at: null
 * - stock: 0
 * - sku: null
 * - Finance/cost/order history: never copied (new variant ids)
 *
 * Image rows reuse the existing storage URLs. Removing an image from the copy only detaches
 * its database row; the storage object is not deleted by the catalogue image UI.
 */
export async function duplicateProduct(productId: string): Promise<string> {
  const supabase = getSupabase();
  let duplicateId: string | null = null;

  try {
    const { data: source, error: sourceError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();
    if (sourceError) throw new Error(sourceError.message);

    const { data: duplicate, error: productError } = await supabase
      .from("products")
      .insert({
        slug: duplicateSlug(source.slug),
        name: `${source.name} - copie`.slice(0, 120),
        name_fr: copyLabel(source.name_fr),
        description: source.description,
        description_fr: source.description_fr,
        kind: source.kind,
        status: "draft",
        category_id: source.category_id,
        published_at: null,
      })
      .select("id")
      .single();
    if (productError) throw new Error(productError.message);
    duplicateId = duplicate.id;

    const { data: categoryLinks, error: categoriesError } = await supabase
      .from("product_categories")
      .select("category_id, sort_order")
      .eq("product_id", productId)
      .order("sort_order");
    if (categoriesError) throw new Error(categoriesError.message);

    if (categoryLinks.length > 0) {
      const { error } = await supabase.from("product_categories").insert(
        categoryLinks.map((link) => ({
          product_id: duplicateId as string,
          category_id: link.category_id,
          sort_order: link.sort_order,
        })),
      );
      if (error) throw new Error(error.message);
    }

    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order")
      .order("id");
    if (variantsError) throw new Error(variantsError.message);

    for (const variant of variants) {
      const { data: newVariant, error: variantError } = await supabase
        .from("product_variants")
        .insert({
          product_id: duplicateId,
          size: variant.size,
          color_name: variant.color_name,
          color_hex: variant.color_hex,
          sku: null,
          price: variant.price,
          compare_at_price: variant.compare_at_price,
          stock: 0,
          weight_grams: variant.weight_grams,
          length_cm: variant.length_cm,
          width_cm: variant.width_cm,
          height_cm: variant.height_cm,
          fabric: variant.fabric,
          fabric_origin: variant.fabric_origin,
          set_type: variant.set_type,
          piece_count: variant.piece_count,
          composition: variant.composition,
          flat_sheet_size: variant.flat_sheet_size,
          fitted_sheet_size: variant.fitted_sheet_size,
          duvet_cover_size: variant.duvet_cover_size,
          sort_order: variant.sort_order,
          is_active: variant.is_active,
        })
        .select("id")
        .single();
      if (variantError) throw new Error(variantError.message);

      const { data: images, error: imagesError } = await supabase
        .from("variant_images")
        .select("url, alt, sort_order")
        .eq("variant_id", variant.id)
        .order("sort_order");
      if (imagesError) throw new Error(imagesError.message);

      if (images.length > 0) {
        const { error } = await supabase.from("variant_images").insert(
          images.map((image) => ({
            variant_id: newVariant.id,
            url: image.url,
            alt: image.alt,
            sort_order: image.sort_order,
          })),
        );
        if (error) throw new Error(error.message);
      }
    }

    if (source.kind === "pack") {
      const { data: packItems, error: packError } = await supabase
        .from("pack_items")
        .select("variant_id, quantity, sort_order")
        .eq("product_id", productId)
        .order("sort_order");
      if (packError) throw new Error(packError.message);

      if (packItems.length > 0) {
        const { error } = await supabase.from("pack_items").insert(
          packItems.map((item) => ({
            product_id: duplicateId as string,
            variant_id: item.variant_id,
            quantity: item.quantity,
            sort_order: item.sort_order,
          })),
        );
        if (error) throw new Error(error.message);
      }
    }

    return duplicateId;
  } catch (error) {
    if (duplicateId) {
      const { error: cleanupError } = await supabase.from("products").delete().eq("id", duplicateId);
      if (cleanupError) console.error("[duplicate-product] cleanup failed", cleanupError.message);
    }
    throw error instanceof Error ? error : new Error("Impossible de dupliquer ce modèle.");
  }
}
