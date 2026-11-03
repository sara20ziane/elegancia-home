import { getSupabase } from "./supabase/client";

/**
 * Pack composition writes and the size-guide table parser.
 * Public size-guide reads remain in size-guides.ts.
 */

export type PackItem = {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  sort_order: number;
};

export async function fetchPackItems(productId: string): Promise<PackItem[]> {
  const { data, error } = await getSupabase()
    .from("pack_items")
    .select("id, product_id, variant_id, quantity, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PackItem[];
}

export async function upsertPackItem(input: {
  product_id: string;
  variant_id: string;
  quantity: number;
  sort_order: number;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("pack_items")
    .upsert(input, { onConflict: "product_id,variant_id" });
  if (error) throw new Error(error.message);
}

export async function removePackItem(id: string): Promise<void> {
  const { error } = await getSupabase().from("pack_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Parse a pasted table.
 *
 * Accepts tab- or comma-separated lines, which is what a shop owner actually has
 * when copying measurements out of a spreadsheet. The first line becomes the
 * headers. Blank lines are ignored so a trailing newline is not a phantom row.
 */
export function parseGuideTable(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const split = (line: string) =>
    line.split(line.includes("\t") ? "\t" : ",").map((cell) => cell.trim());

  const [first, ...rest] = lines;
  return { headers: split(first), rows: rest.map(split) };
}
