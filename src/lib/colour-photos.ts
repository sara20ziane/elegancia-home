import { deleteProductImage } from "./image";
import { getSupabase } from "./supabase/client";

/**
 * Photos shared across a colour's sizes.
 *
 * Every size of a colour shows the same photos, so a photo is uploaded once
 * and referenced by each of those variants. That sharing is why a stored file
 * may only be deleted once nothing points at it any more: deleting it with the
 * first row would blank the photo on every other size.
 */

export async function attachToVariants(
  variantIds: string[],
  url: string,
  sortOrder: number,
): Promise<void> {
  if (variantIds.length === 0) return;
  const { error } = await getSupabase()
    .from("variant_images")
    .insert(variantIds.map((variant_id) => ({ variant_id, url, sort_order: sortOrder })));
  if (error) throw new Error(error.message);
}

export async function detachFromVariants(variantIds: string[], url: string): Promise<void> {
  const { error } = await getSupabase()
    .from("variant_images")
    .delete()
    .in("variant_id", variantIds)
    .eq("url", url);
  if (error) throw new Error(error.message);
  await removeIfUnused(url);
}

/** Assign the first colour to an existing uncoloured configuration matrix. */
export async function assignColourToVariants(
  variantIds: string[],
  colourName: string,
): Promise<void> {
  if (variantIds.length === 0) return;
  const { error } = await getSupabase()
    .from("product_variants")
    .update({ color_name: colourName.trim(), color_hex: null })
    .in("id", variantIds);
  if (error) throw new Error(error.message);
}

/**
 * Clone one existing colour's commercial matrix for a new colour.
 *
 * Prices, stock, sizes, composition and dimensions are copied because they
 * describe the model. SKU is deliberately cleared so the owner can add a
 * colour-specific SKU later without creating duplicates.
 */
export async function cloneVariantsForColour(
  productId: string,
  sourceVariantIds: string[],
  colourName: string,
): Promise<string[]> {
  if (sourceVariantIds.length === 0) return [];

  const supabase = getSupabase();
  const { data: sourceRows, error: readError } = await supabase
    .from("product_variants")
    .select(
      "size, price, compare_at_price, stock, weight_grams, length_cm, width_cm, height_cm, fabric, fabric_origin, set_type, piece_count, composition, flat_sheet_size, fitted_sheet_size, duvet_cover_size, sort_order, is_active",
    )
    .in("id", sourceVariantIds)
    .order("sort_order", { ascending: true });
  if (readError) throw new Error(readError.message);
  if (!sourceRows || sourceRows.length === 0) {
    throw new Error("Aucune configuration modèle à recopier.");
  }

  const rows = sourceRows.map((row) => ({
    ...row,
    product_id: productId,
    color_name: colourName.trim(),
    color_hex: null,
    sku: null,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("product_variants")
    .insert(rows)
    .select("id");
  if (insertError) throw new Error(insertError.message);
  return (inserted ?? []).map((row) => row.id as string);
}

/** Delete the stored file only when no variant still shows it. */
export async function removeIfUnused(url: string): Promise<void> {
  const { count, error } = await getSupabase()
    .from("variant_images")
    .select("id", { count: "exact", head: true })
    .eq("url", url);
  if (error || (count ?? 0) > 0) return;
  await deleteProductImage(url);
}
