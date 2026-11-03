import { validateVariant } from "@/lib/variant-generator";
import { deleteVariant, upsertVariant } from "@/lib/admin-products";
import { useI18n } from "@/lib/i18n-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { VariantDraft } from "./variant-draft";
export function useVariantMutations(productId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin_product", productId] });
    void queryClient.invalidateQueries({ queryKey: ["admin_products"] });
  };

  const save = useMutation({
    mutationFn: async (input: {
      id?: string;
      draft: VariantDraft;
      is_active: boolean;
      sort_order: number;
    }) => {
      const error = validateVariant(input.draft);
      if (error) throw new Error(error);
      return upsertVariant({
        id: input.id,
        product_id: productId,
        bedding_provenance: input.draft.provenance,
        size: input.draft.size.trim() || null,
        color_name: input.draft.color_name.trim() || null,
        color_hex: input.draft.color_hex.trim() || null,
        sku: input.draft.sku.trim() || null,
        price: Number(input.draft.price) || 0,
        compare_at_price: Number(input.draft.compare_at_price) || null,
        stock: Number(input.draft.stock) || 0,
        weight_grams: input.draft.weight_grams ? Number(input.draft.weight_grams) : null,
        fabric: input.draft.fabric.trim() || null,
        fabric_origin: input.draft.fabric_origin.trim() || null,
        set_type: input.draft.set_type.trim() || null,
        piece_count: input.draft.piece_count ? Number(input.draft.piece_count) : null,
        composition: input.draft.composition.trim() || null,
        flat_sheet_size: input.draft.flat_sheet_size.trim() || null,
        fitted_sheet_size: input.draft.fitted_sheet_size.trim() || null,
        duvet_cover_size: input.draft.duvet_cover_size.trim() || null,
        sort_order: input.sort_order,
        is_active: input.is_active,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("common.save"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteVariant(id),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return { save, remove };
}
