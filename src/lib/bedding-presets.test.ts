import { describe, expect, it } from "vitest";
import { mergeRefetchedDraft, EMPTY_DRAFT } from "@/components/admin/variant-draft";
import {
  beddingPresetPatch,
  editVariantField,
  presetValues,
  updateBeddingSelection,
  type BeddingPreset,
} from "./bedding-presets";
import { newProvenance, readProvenance } from "./bedding-provenance";
import { generateBeddingVariants } from "./variant-generator";

const base = {
  ...EMPTY_DRAFT,
  size: "Queen size",
  set_type: "Parure housse de couette",
  piece_count: "6",
  price: "9500",
  stock: "3",
  fabric: "Coton",
};
const preset = (pieces: string, composition: string): BeddingPreset => ({
  id: pieces,
  name: `Fixture ${pieces}`,
  size: "Queen size",
  set_type: "Parure de drap",
  piece_count: pieces,
  composition: { state: "known", value: composition },
  flat_sheet_size: { state: "unknown" },
  fitted_sheet_size:
    pieces === "3" ? { state: "not_applicable" } : { state: "known", value: "160 × 190 cm" },
  duvet_cover_size: { state: "not_applicable" },
});
describe("provenance de la literie", () => {
  it("recalcule une dimension automatique non vide lors du changement Queen vers King", () => {
    const queen = updateBeddingSelection(base, {});
    expect(queen.fitted_sheet_size).toBe("160 × 190 cm");
    const king = updateBeddingSelection(queen, { size: "King size" });
    expect(king.fitted_sheet_size).toBe("180 × 200 cm");
    expect(king.duvet_cover_size).toBe("260 × 240 cm");
  });
  it("conserve la saisie manuelle, y compris vide ou identique à l’ancien preset", () => {
    const automatic = updateBeddingSelection(base, {});
    for (const text of ["160 × 190 cm", "Sur mesure", ""]) {
      const manual = editVariantField(automatic, "fitted_sheet_size", text);
      expect(updateBeddingSelection(manual, { size: "King size" }).fitted_sheet_size).toBe(text);
      expect(manual.provenance.fitted_sheet_size).toEqual({ source: "manual" });
    }
  });
  it("vide l’ancien champ automatique si inconnu ou non applicable, sans effacer un champ manuel", () => {
    const automatic = updateBeddingSelection(base, {});
    const sheets = updateBeddingSelection(automatic, {
      set_type: "Parure de drap",
      piece_count: "3",
    });
    expect([sheets.fitted_sheet_size, sheets.duvet_cover_size]).toEqual(["", ""]);
    expect(sheets.provenance.fitted_sheet_size).toEqual({
      source: "preset",
      state: "not_applicable",
    });
    const unknown = updateBeddingSelection(automatic, { size: "Autre taille" });
    expect(unknown.fitted_sheet_size).toBe("");
    expect(unknown.provenance.fitted_sheet_size).toEqual({ source: "preset", state: "unknown" });
    const manual = editVariantField(automatic, "duvet_cover_size", "Manuelle");
    expect(
      updateBeddingSelection(manual, { set_type: "Parure de drap", piece_count: "3" })
        .duvet_cover_size,
    ).toBe("Manuelle");
  });
  it("n’infère pas la provenance depuis le contenu et conserve les anciennes valeurs inconnues", () => {
    const legacy = {
      ...base,
      fitted_sheet_size: "Valeur ancienne",
      provenance: readProvenance(null),
    };
    expect(updateBeddingSelection(legacy, { size: "King size" }).fitted_sheet_size).toBe(
      "Valeur ancienne",
    );
    expect(legacy.provenance.fitted_sheet_size).toEqual({ source: "legacy" });
    expect(readProvenance(JSON.parse(JSON.stringify(newProvenance())))).toEqual(newProvenance());
  });
});
it("une actualisation bulk conserve une édition locale manuelle tout en actualisant les autres provenances", () => {
  const before = updateBeddingSelection(base, {});
  const current = editVariantField(before, "fitted_sheet_size", before.fitted_sheet_size);
  const after = editVariantField(before, "composition", "Composition bulk manuelle");
  const merged = mergeRefetchedDraft(current, before, after);
  expect(merged.provenance.fitted_sheet_size).toEqual({ source: "manual" });
  expect(merged.composition).toBe("Composition bulk manuelle");
  expect(merged.provenance.composition).toEqual({ source: "manual" });
});
describe("clés et états des presets", () => {
  it("sépare les règles 3 et 6 pièces et ne fait aucun fallback pour un non applicable explicite", () => {
    const presets = [
      preset("3", "Composition confirmée 3"),
      preset("6", "Composition confirmée 6"),
    ];
    const three = updateBeddingSelection(
      base,
      { set_type: "Parure de drap", piece_count: "3" },
      presets,
    );
    const six = updateBeddingSelection(three, { piece_count: "6" }, presets);
    expect(three.composition).toBe("Composition confirmée 3");
    expect(three.fitted_sheet_size).toBe("");
    expect(six.composition).toBe("Composition confirmée 6");
    expect(six.fitted_sheet_size).toBe("160 × 190 cm");
    expect(presetValues(" Queen SIZE ", "PARURE DE DRAP", "03", presets).fitted_sheet_size).toEqual(
      { state: "not_applicable" },
    );
  });
  it.each([
    ["Parure de drap", "3", "1 drap plat + 2 taies d’oreiller", false, false],
    ["Parure de drap", "6", "1 drap plat + 1 drap-housse + 4 taies d’oreiller", true, false],
    ["Parure housse de couette", "3", "1 housse de couette + 2 taies d’oreiller", false, true],
    [
      "Parure housse de couette",
      "6",
      "1 housse de couette + 1 drap-housse + 4 taies d’oreiller",
      true,
      true,
    ],
  ] as const)("preset initial %s %s pièces", (type, pieces, composition, fitted, duvet) => {
    for (const [size, fit, cover] of [
      ["Queen size", "160 × 190 cm", "220 × 240 cm"],
      ["King size", "180 × 200 cm", "260 × 240 cm"],
    ]) {
      const row = updateBeddingSelection(base, { size, set_type: type, piece_count: pieces });
      expect(row.composition).toBe(composition);
      expect(row.fitted_sheet_size).toBe(fitted ? fit : "");
      expect(row.duvet_cover_size).toBe(duvet ? cover : "");
      expect(row.flat_sheet_size).toBe(type === "Parure de drap" ? "250 × 240 cm" : "");
      expect(row.provenance.fitted_sheet_size).toEqual({
        source: "preset",
        state: fitted ? "known" : "not_applicable",
      });
    }
  });
  it("une règle inconnue explicite n’est pas remplacée par une mesure générique", () => {
    const configured = {
      ...preset("6", "Composition"),
      fitted_sheet_size: { state: "unknown" } as const,
    };
    expect(
      presetValues("Queen size", "Parure de drap", "6", [configured]).fitted_sheet_size,
    ).toEqual({ state: "unknown" });
  });
  it("génère Queen et King sans toucher aux prix, stocks, poids, tissu ou origine manuels", () => {
    const rows = generateBeddingVariants(
      "Aveline",
      { ...base, weight_grams: "1700", fabric_origin: "Espagne" },
      ["Queen size", "King size"],
    );
    expect(rows.map((row) => row.draft.fitted_sheet_size)).toEqual([
      "160 × 190 cm",
      "180 × 200 cm",
    ]);
    for (const row of rows)
      expect(row.draft).toMatchObject({
        price: "9500",
        stock: "3",
        weight_grams: "1700",
        fabric: "Coton",
        fabric_origin: "Espagne",
      });
    const patch = beddingPresetPatch(base);
    for (const key of ["price", "stock", "weight_grams", "fabric", "fabric_origin", "sku"])
      expect(patch).not.toHaveProperty(key);
  });
});
