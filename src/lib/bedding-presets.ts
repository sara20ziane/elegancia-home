import type { VariantDraft } from "@/components/admin/variant-draft";

export const BED_SIZE_OPTIONS = [
  { value: "90 × 190 cm", label: "90 × 190 cm", fittedSheet: "90 × 190 cm", duvetCover: "" },
  {
    value: "Queen size",
    label: "Queen size",
    fittedSheet: "160 × 190 cm",
    duvetCover: "220 × 240 cm",
  },
  {
    value: "King size",
    label: "King size",
    fittedSheet: "180 × 200 cm",
    duvetCover: "260 × 240 cm",
  },
] as const;

export type BeddingPreset = {
  id: string;
  name: string;
  size: string;
  set_type: string;
  piece_count: string;
  composition: string;
  fitted_sheet_size: string;
  flat_sheet_size: string;
  duvet_cover_size: string;
  weight_grams: string;
};

/** Only confirmed measurements. Unknown composition, flat sheet and weight stay empty. */
export function presetValues(size: string, setType: string, presets: BeddingPreset[] = []) {
  const known = BED_SIZE_OPTIONS.find((option) => option.value === size);
  const configured = presets.find((preset) => preset.size === size && preset.set_type === setType);
  return {
    fitted_sheet_size: configured?.fitted_sheet_size || known?.fittedSheet || "",
    duvet_cover_size:
      configured?.duvet_cover_size ||
      (setType === "Parure housse de couette" ? (known?.duvetCover ?? "") : ""),
    flat_sheet_size: configured?.flat_sheet_size || "",
    composition: configured?.composition || "",
    piece_count: configured?.piece_count || "",
    weight_grams: configured?.weight_grams || "",
  };
}

/** Fill blanks only; changing size or type never overwrites an entered measurement. */
export function fillBeddingBlanks(
  draft: VariantDraft,
  presets: BeddingPreset[] = [],
): VariantDraft {
  const values = presetValues(draft.size, draft.set_type, presets);
  return {
    ...draft,
    fitted_sheet_size: draft.fitted_sheet_size || values.fitted_sheet_size,
    duvet_cover_size: draft.duvet_cover_size || values.duvet_cover_size,
    flat_sheet_size: draft.flat_sheet_size || values.flat_sheet_size,
    piece_count: draft.piece_count || values.piece_count,
    composition:
      draft.composition ||
      (!draft.piece_count || draft.piece_count === values.piece_count ? values.composition : ""),
    weight_grams: draft.weight_grams || values.weight_grams,
  };
}

/** Explicit recalculation proposes only preset-owned fields, never price, stock or SKU. */
export function beddingPresetPatch(
  draft: VariantDraft,
  presets: BeddingPreset[] = [],
): Partial<VariantDraft> {
  const values = presetValues(draft.size, draft.set_type, presets);
  const patch: Partial<VariantDraft> = {};
  for (const key of [
    "fitted_sheet_size",
    "flat_sheet_size",
    "duvet_cover_size",
    "weight_grams",
    "piece_count",
    "composition",
  ] as const) {
    if (key === "composition" && draft.piece_count && draft.piece_count !== values.piece_count)
      continue;
    if (values[key]) patch[key] = values[key];
  }
  return patch;
}
