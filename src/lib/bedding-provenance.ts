export const PRESET_FIELDS = [
  "composition",
  "flat_sheet_size",
  "fitted_sheet_size",
  "duvet_cover_size",
] as const;
export type PresetField = (typeof PRESET_FIELDS)[number];
export type PresetValue =
  { state: "known"; value: string } | { state: "unknown" } | { state: "not_applicable" };
type FieldOrigin =
  { source: "preset"; state: PresetValue["state"] } | { source: "manual" } | { source: "legacy" };
export type BeddingProvenance = Record<PresetField, FieldOrigin>;

export function newProvenance(): BeddingProvenance {
  return Object.fromEntries(
    PRESET_FIELDS.map((key) => [key, { source: "preset", state: "unknown" }]),
  ) as BeddingProvenance;
}

/** Missing metadata is unknown legacy provenance, irrespective of the field's value. */
export function readProvenance(value: unknown): BeddingProvenance {
  const object = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    PRESET_FIELDS.map((key) => {
      const origin = object[key];
      if (origin && typeof origin === "object" && "source" in origin) {
        if (origin.source === "manual" || origin.source === "legacy")
          return [key, { source: origin.source }];
        if (
          origin.source === "preset" &&
          "state" in origin &&
          ["known", "unknown", "not_applicable"].includes(String(origin.state))
        )
          return [key, origin];
      }
      return [key, { source: "legacy" }];
    }),
  ) as BeddingProvenance;
}

export function presetText(value: PresetValue): string {
  return value.state === "known" ? value.value : "";
}
