import { getSupabase } from "./supabase/client";
export type VariantInput = {
  id?: string;
  product_id: string;
  size: string | null;
  color_name: string | null;
  color_hex: string | null;
  sku: string | null;
  price: number;
  compare_at_price?: number | null;
  stock: number;
  weight_grams: number | null;
  fabric?: string | null;
  fabric_origin?: string | null;
  set_type?: string | null;
  piece_count?: number | null;
  composition?: string | null;
  flat_sheet_size?: string | null;
  fitted_sheet_size?: string | null;
  duvet_cover_size?: string | null;
  sort_order: number;
  is_active: boolean;
};

export async function upsertVariant(input: VariantInput): Promise<void> {
  const { error } = await getSupabase()
    .from("product_variants")
    .upsert(input, input.id ? { onConflict: "id" } : undefined);
  if (error) throw new Error(error.message);
}

export async function deleteVariant(id: string): Promise<void> {
  const { error } = await getSupabase().from("product_variants").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
