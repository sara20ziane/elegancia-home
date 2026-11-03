import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT } from "@/components/admin/variant-draft";
import { generateSku, skuToken } from "./sku";
import { validateVariant } from "./variant-generator";

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
describe("validation catalogue", () => {
  it("rejette les nombres invalides sans les remplacer par zéro", () => {
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
