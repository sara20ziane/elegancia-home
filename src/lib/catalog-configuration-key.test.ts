import { expect, it } from "vitest";
import { configurationConflicts, configurationKey } from "./catalog-configuration-key";

const base = {
  size: "Queen size",
  set_type: "Parure de drap",
  piece_count: 3,
  color_name: "Écru",
  fabric: "Coton",
  fabric_origin: "Espagne",
};
it("normalise espaces, casse, null et pièces sans utiliser SKU, prix, stock ou dimensions", () => {
  const same = {
    ...base,
    size: " \tQUEEN\u00a0 size ",
    set_type: "PARURE   DE DRAP",
    piece_count: "03",
    color_name: "écru",
    fabric: " coton ",
    sku: "DIFFERENT-02",
    price: 9999,
    stock: 12,
    fitted_sheet_size: "autre",
  };
  expect(configurationKey(same)).toBe(configurationKey(base));
  expect(configurationConflicts([same], [base])).toEqual([true]);
  expect(configurationConflicts([base, same])).toEqual([true, true]);
  expect(configurationKey({ ...base, color_name: null })).toBe(
    configurationKey({ ...base, color_name: " " }),
  );
});
it("autorise de vraies différences commerciales de taille, type, pièces, couleur ou tissu", () => {
  for (const change of [
    { size: "King size" },
    { set_type: "Parure housse de couette" },
    { piece_count: 6 },
    { color_name: "Bleu" },
    { fabric: "Percale" },
    { fabric_origin: "Turquie" },
  ])
    expect(configurationConflicts([{ ...base, ...change }], [base])).toEqual([false]);
});
