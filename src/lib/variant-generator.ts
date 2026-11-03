import type { VariantDraft } from "@/components/admin/variant-draft";
import { fillBeddingBlanks, type BeddingPreset } from "./bedding-presets";
import { generateSku } from "./sku";

export type GeneratedVariant = { draft: VariantDraft; automaticSku: boolean };

export function generateBeddingVariants(
  model: string,
  base: VariantDraft,
  sizes: string[],
  presets: BeddingPreset[] = [],
  used: string[] = [],
): GeneratedVariant[] {
  const taken = [...used];
  return [...new Set(sizes.map((size) => size.trim()).filter(Boolean))].map((size) => {
    const draft = fillBeddingBlanks({ ...base, size }, presets);
    const sku =
      draft.sku.trim() || generateSku(model, draft.set_type, size, draft.color_name, taken);
    taken.push(sku);
    return { draft: { ...draft, sku }, automaticSku: !draft.sku.trim() };
  });
}

export function validateVariant(draft: VariantDraft): string | null {
  for (const [label, value, required, minimum] of [
    ["prix", draft.price, true, 1],
    ["stock", draft.stock, true, 0],
    ["prix barré", draft.compare_at_price, false, 0],
    ["poids", draft.weight_grams, false, 0],
    ["nombre de pièces", draft.piece_count, false, 1],
  ] as const) {
    if (!required && !value) continue;
    if (!value.trim() || !Number.isSafeInteger(Number(value)) || Number(value) < minimum)
      return `Vérifie le ${label} : un entier supérieur ou égal à ${minimum} est attendu.`;
  }
  if (draft.compare_at_price && Number(draft.compare_at_price) <= Number(draft.price))
    return "Le prix barré doit dépasser le prix de vente.";
  return null;
}
