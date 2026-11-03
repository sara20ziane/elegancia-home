import { configurationConflicts } from "./catalog-configuration-key";
import { useQuery } from "@tanstack/react-query";
import type { ProductDraft } from "@/components/admin/product-fields";
import type { VariantDraft } from "@/components/admin/variant-draft";
import { suggestSlug } from "./admin-products";
import type { BeddingPreset } from "./bedding-presets";
import { getSupabase } from "./supabase/client";
import type { Json } from "./supabase/types";
import { validateVariant, type GeneratedVariant } from "./variant-generator";

function variantPayload(draft: VariantDraft) {
  const error = validateVariant(draft);
  if (error) throw new Error(error);
  const { provenance, ...values } = draft;
  return {
    bedding_provenance: provenance,
    ...Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        ["price", "stock", "compare_at_price", "weight_grams", "piece_count"].includes(key)
          ? value.trim()
            ? Number(value)
            : null
          : value.trim() || null,
      ]),
    ),
  };
}

export async function saveGenerated(
  requestId: string,
  variants: GeneratedVariant[],
  model?: ProductDraft,
  productId?: string,
) {
  if (configurationConflicts(variants.map((row) => row.draft)).some(Boolean))
    throw new Error("Deux configurations commerciales de l’aperçu sont identiques.");
  const { data, error } = await getSupabase().rpc("catalog_generate", {
    p: {
      request_id: requestId,
      product_id: productId ?? null,
      model: model ? { ...model, slug: suggestSlug(model.name_fr || model.name) } : null,
      variants: variants.map(({ draft, automaticSku }) => ({
        ...variantPayload(draft),
        sku: draft.sku.trim() || null,
        automatic_sku: automaticSku,
      })),
    },
  });
  if (error)
    throw new Error(
      error.message.includes("configuration commerciale")
        ? error.message
        : error.code === "23505"
          ? "Ce nom ou ce SKU existe déjà. Modifie-le puis réessaie."
          : error.message,
    );
  return data;
}

export function useBeddingPresets() {
  return useQuery({
    queryKey: ["catalog_presets"],
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("catalog_presets");
      if (error) throw new Error(error.message);
      return data as unknown as BeddingPreset[];
    },
  });
}

export async function saveBeddingPreset(preset: BeddingPreset) {
  const { error } = await getSupabase().rpc("catalog_presets", { p: { ...preset } });
  if (error)
    throw new Error(
      error.code === "23505"
        ? "Un preset existe déjà pour cette taille, ce type et ce nombre de pièces. Modifie le preset existant."
        : error.message,
    );
}

export async function applyCommon(productId: string, patch: Record<string, Json>) {
  const { data, error } = await getSupabase().rpc("catalog_apply_common", {
    p_product: productId,
    p_patch: patch,
  });
  if (error) throw new Error(error.message);
  return data;
}
