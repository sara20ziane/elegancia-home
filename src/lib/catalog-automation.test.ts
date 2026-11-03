import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT } from "@/components/admin/variant-draft";
import {
  beddingPresetPatch,
  fillBeddingBlanks,
  presetValues,
  type BeddingPreset,
} from "./bedding-presets";
import { generateSku, skuToken } from "./sku";
import { generateBeddingVariants, validateVariant } from "./variant-generator";

const base = {
  ...EMPTY_DRAFT,
  fabric: "100 % coton",
  fabric_origin: "Espagne",
  set_type: "Parure housse de couette",
  piece_count: "6",
  price: "9500",
  stock: "3",
};
describe("SKU catalogue", () => {
  it("normalise accents, espaces, ligatures et ponctuation en ASCII", () => {
    expect(skuToken("Écru œillet / été")).toBe("ECRU-OEILLET-ETE");
    expect(generateSku("Aveline", base.set_type, "Queen size", "Écru")).toBe(
      "ELG-AVELINE-HC-QN-ECRU",
    );
    expect(generateSku("اسم", "", "", "")).toMatch(/^ELG-MODELE-SET-TAILLE-UNI$/);
  });
  it("alloue des suffixes déterministes sans dépasser 40 caractères", () => {
    const first = generateSku(
      "Très long modèle de literie",
      base.set_type,
      "King size",
      "Vert sauge",
    );
    const second = generateSku(
      "Très long modèle de literie",
      base.set_type,
      "King size",
      "Vert sauge",
      [first],
    );
    expect(second).toBe(`${first}-02`);
    expect(second.length).toBeLessThanOrEqual(40);
    for (const model of ["Parure Serena Test", "Très long modèle de literie", "Aveline"]) {
      expect(generateSku(model, "Un type long", "Autre taille large", "Vert sauge")).toMatch(
        /^[A-Z0-9]+(-[A-Z0-9]+)*$/,
      );
    }
    expect(
      generateSku("Aveline", base.set_type, "Queen size", "Écru", [
        "ELG-AVELINE-HC-QN-ECRU",
        "ELG-AVELINE-HC-QN-ECRU-02",
      ]),
    ).toMatch(/-03$/);
  });
});
describe("presets et génération", () => {
  it("le recalcul explicite ne propose jamais de prix, stock ou SKU obsolète", () => {
    const patch = beddingPresetPatch({
      ...base,
      size: "King size",
      sku: "MANUEL",
      price: "12000",
      stock: "9",
    });
    expect(patch).toEqual({ fitted_sheet_size: "180 × 200 cm", duvet_cover_size: "260 × 240 cm" });
  });

  it("génère Queen et King avec valeurs communes et dimensions confirmées", () => {
    const rows = generateBeddingVariants("Aveline", base, ["Queen size", "King size"]);
    expect(rows.map((row) => row.draft.fitted_sheet_size)).toEqual([
      "160 × 190 cm",
      "180 × 200 cm",
    ]);
    expect(rows.map((row) => row.draft.duvet_cover_size)).toEqual(["220 × 240 cm", "260 × 240 cm"]);
    expect(new Set(rows.map((row) => row.draft.sku)).size).toBe(2);
    expect(
      rows.every(
        ({ draft }) =>
          draft.fabric === base.fabric && draft.price === "9500" && draft.stock === "3",
      ),
    ).toBe(true);
  });
  it("ne devine aucune dimension, composition ou poids inconnus", () => {
    expect(presetValues("90 × 190 cm", base.set_type).fitted_sheet_size).toBe("90 × 190 cm");
    expect(presetValues("90 × 190 cm", base.set_type).duvet_cover_size).toBe("");
    const row = generateBeddingVariants("Aveline", base, ["140 × 190 cm"])[0].draft;
    expect([
      row.flat_sheet_size,
      row.fitted_sheet_size,
      row.duvet_cover_size,
      row.composition,
      row.weight_grams,
    ]).toEqual(["", "", "", "", ""]);
  });
  it("respecte les champs manuels, y compris un SKU", () => {
    const manual = {
      ...base,
      fitted_sheet_size: "sur mesure",
      duvet_cover_size: "personnalisée",
      composition: "Manuelle",
      sku: "MON-SKU",
    };
    expect(generateBeddingVariants("Aveline", manual, ["King size"])[0]).toMatchObject({
      automaticSku: false,
      draft: {
        sku: "MON-SKU",
        composition: "Manuelle",
        fitted_sheet_size: "sur mesure",
        duvet_cover_size: "personnalisée",
      },
    });
    expect(fillBeddingBlanks({ ...manual, size: "Queen size" })).toMatchObject({
      ...manual,
      size: "Queen size",
    });
  });
  it("propose une composition uniquement pour un preset et nombre de pièces exacts", () => {
    const preset: BeddingPreset = {
      id: "fixture",
      name: "Fixture configurée",
      size: "Queen size",
      set_type: base.set_type,
      piece_count: "6",
      composition: "Texte confirmé par la propriétaire",
      fitted_sheet_size: "160 × 190 cm",
      flat_sheet_size: "",
      duvet_cover_size: "220 × 240 cm",
      weight_grams: "",
    };
    expect(fillBeddingBlanks({ ...base, size: "Queen size" }, [preset]).composition).toBe(
      preset.composition,
    );
    expect(
      fillBeddingBlanks({ ...base, size: "Queen size", piece_count: "3" }, [preset]).composition,
    ).toBe("");
    expect(fillBeddingBlanks({ ...base, size: "King size" }, [preset]).composition).toBe("");
  });
  it("rejette les saisies numériques invalides au lieu de les remplacer par zéro", () => {
    for (const patch of [
      { price: "" },
      { price: "abc" },
      { stock: "-1" },
      { price: "1.5" },
      { piece_count: "0" },
      { compare_at_price: "9500" },
    ])
      expect(validateVariant({ ...base, ...patch })).not.toBeNull();
    expect(validateVariant(base)).toBeNull();
  });
});
