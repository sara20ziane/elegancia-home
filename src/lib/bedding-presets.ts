import initialPresets from "./bedding-presets.initial.json";
import type { VariantDraft } from "@/components/admin/variant-draft";
import { PRESET_FIELDS, presetText, type PresetValue } from "./bedding-provenance";
import { normalizeCommercial } from "./catalog-configuration-key";

export const BED_SIZE_OPTIONS = ["90 × 190 cm", "Queen size", "King size"].map((value) => ({
  value,
  label: value,
}));
export type BeddingPreset = {
  id: string;
  name: string;
  size: string;
  set_type: string;
  piece_count: string;
  composition: PresetValue;
  fitted_sheet_size: PresetValue;
  flat_sheet_size: PresetValue;
  duvet_cover_size: PresetValue;
};

const UNKNOWN: PresetValue = { state: "unknown" };
export const INITIAL_BEDDING_PRESETS = initialPresets as BeddingPreset[];
const presetMatch = (preset: BeddingPreset, size: string, setType: string, pieces: string) =>
  normalizeCommercial(preset.size) === normalizeCommercial(size) &&
  normalizeCommercial(preset.set_type) === normalizeCommercial(setType) &&
  Number(preset.piece_count) === Number(pieces);

export function presetValues(
  size: string,
  setType: string,
  pieces: string,
  presets: BeddingPreset[] = [],
) {
  const configured = [...presets, ...INITIAL_BEDDING_PRESETS].find((preset) =>
    presetMatch(preset, size, setType, pieces),
  );
  if (configured) return configured;
  const type = normalizeCommercial(setType);
  const bedding = type === "parure de drap" || type === "parure housse de couette";
  const noFitted = bedding && Number(pieces) === 3;
  const ninety = bedding && Number(pieces) === 6 && normalizeCommercial(size) === "90 × 190 cm";
  return {
    fitted_sheet_size: noFitted
      ? ({ state: "not_applicable" } as PresetValue)
      : ninety
        ? ({ state: "known", value: "90 × 190 cm" } as PresetValue)
        : UNKNOWN,
    duvet_cover_size:
      type === "parure de drap" ? ({ state: "not_applicable" } as PresetValue) : UNKNOWN,
    flat_sheet_size: UNKNOWN,
    composition: UNKNOWN,
  };
}

/** Re-evaluate automatic fields only, even when their old value was nonempty. */
export function updateBeddingSelection(
  draft: VariantDraft,
  selection: Partial<Pick<VariantDraft, "size" | "set_type" | "piece_count">>,
  presets: BeddingPreset[] = [],
): VariantDraft {
  const next = { ...draft, ...selection, provenance: { ...draft.provenance } };
  const values = presetValues(next.size, next.set_type, next.piece_count, presets);
  for (const key of PRESET_FIELDS) {
    if (next.provenance[key].source !== "preset") continue;
    next[key] = presetText(values[key]);
    next.provenance[key] = { source: "preset", state: values[key].state };
  }
  return next;
}

/** A direct edit is explicit, including clearing a field or typing the same value. */
export function editVariantField<K extends Exclude<keyof VariantDraft, "provenance">>(
  draft: VariantDraft,
  key: K,
  value: VariantDraft[K],
): VariantDraft {
  return {
    ...draft,
    [key]: value,
    provenance: PRESET_FIELDS.includes(key as (typeof PRESET_FIELDS)[number])
      ? { ...draft.provenance, [key]: { source: "manual" } }
      : draft.provenance,
  };
}

/** Applied only after the user accepts the displayed changes. */
export function beddingPresetPatch(
  draft: VariantDraft,
  presets: BeddingPreset[] = [],
): Partial<VariantDraft> {
  const automatic = {
    ...draft,
    provenance: Object.fromEntries(
      PRESET_FIELDS.map((key) => [key, { source: "preset", state: "unknown" }]),
    ) as VariantDraft["provenance"],
  };
  const next = updateBeddingSelection(automatic, {}, presets);
  return {
    ...Object.fromEntries(PRESET_FIELDS.map((key) => [key, next[key]])),
    provenance: next.provenance,
  };
}
