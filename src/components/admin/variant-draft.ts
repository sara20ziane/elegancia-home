import {
  PRESET_FIELDS,
  newProvenance,
  readProvenance,
  type BeddingProvenance,
} from "@/lib/bedding-provenance";
import type { AdminVariant } from "@/lib/admin-products";
export type VariantDraft = {
  provenance: BeddingProvenance;
  size: string;
  color_name: string;
  color_hex: string;
  sku: string;
  price: string;
  compare_at_price: string;
  stock: string;
  weight_grams: string;
  fabric: string;
  fabric_origin: string;
  set_type: string;
  piece_count: string;
  composition: string;
  flat_sheet_size: string;
  fitted_sheet_size: string;
  duvet_cover_size: string;
};

export const EMPTY_DRAFT: VariantDraft = {
  provenance: newProvenance(),
  size: "",
  color_name: "",
  color_hex: "",
  sku: "",
  price: "",
  compare_at_price: "",
  stock: "0",
  weight_grams: "",
  fabric: "",
  fabric_origin: "",
  set_type: "",
  piece_count: "",
  composition: "",
  flat_sheet_size: "",
  fitted_sheet_size: "",
  duvet_cover_size: "",
};

export function toDraft(variant: AdminVariant): VariantDraft {
  return {
    provenance: readProvenance(variant.bedding_provenance),
    size: variant.size ?? "",
    color_name: variant.color_name ?? "",
    color_hex: variant.color_hex ?? "",
    sku: variant.sku ?? "",
    price: String(variant.price),
    compare_at_price:
      variant.compare_at_price === null || variant.compare_at_price === undefined
        ? ""
        : String(variant.compare_at_price),
    stock: String(variant.stock),
    weight_grams: variant.weight_grams === null ? "" : String(variant.weight_grams),
    fabric: variant.fabric ?? "",
    fabric_origin: variant.fabric_origin ?? "",
    set_type: variant.set_type ?? "",
    piece_count: variant.piece_count === null ? "" : String(variant.piece_count),
    composition: variant.composition ?? "",
    flat_sheet_size: variant.flat_sheet_size ?? "",
    fitted_sheet_size: variant.fitted_sheet_size ?? "",
    duvet_cover_size: variant.duvet_cover_size ?? "",
  };
}

/** Merge refreshed values field by field, preserving unsaved manual edits and their origin. */
export function mergeRefetchedDraft(
  current: VariantDraft,
  before: VariantDraft,
  after: VariantDraft,
): VariantDraft {
  const next = { ...current, provenance: { ...current.provenance } };
  for (const key of Object.keys(current).filter((key) => key !== "provenance") as Exclude<
    keyof VariantDraft,
    "provenance"
  >[]) {
    const tracked = PRESET_FIELDS.includes(key as (typeof PRESET_FIELDS)[number]);
    const field = key as (typeof PRESET_FIELDS)[number];
    const cleanOrigin =
      !tracked ||
      JSON.stringify(current.provenance[field]) === JSON.stringify(before.provenance[field]);
    if (current[key] !== before[key] || !cleanOrigin) continue;
    next[key] = after[key];
    if (tracked) next.provenance[field] = after.provenance[field];
  }
  return next;
}
