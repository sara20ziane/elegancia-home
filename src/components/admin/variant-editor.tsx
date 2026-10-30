import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { deleteVariant, upsertVariant, type AdminVariant } from "@/lib/admin-products";
import { VariantRow } from "./variant-row";
import { DraftFields, EMPTY_DRAFT, type VariantDraft } from "./variant-fields";

/**
 * Variant editor.
 *
 * For Elegancia, one variant is one sellable bedding configuration: fabric,
 * set type, piece count and bed size determine the price and stock.
 */
export function VariantEditor({
  productId,
  variants,
}: {
  productId: string;
  variants: AdminVariant[];
}) {
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
    }) =>
      upsertVariant({
        id: input.id,
        product_id: productId,
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
      }),
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

  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<VariantDraft>(EMPTY_DRAFT);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {variants.map((variant) => (
          <VariantRow
            key={variant.id}
            variant={variant}
            busy={save.isPending || remove.isPending}
            onSave={(draft, is_active) =>
              save.mutate({ id: variant.id, draft, is_active, sort_order: variant.sort_order })
            }
            onDelete={() => remove.mutate(variant.id)}
          />
        ))}
      </ul>

      {adding ? (
        <div className="flex flex-col gap-3 rounded-[16px] border border-primary/40 bg-primary/5 p-4">
          <DraftFields draft={newDraft} onChange={setNewDraft} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!newDraft.price || save.isPending}
              onClick={() => {
                save.mutate({ draft: newDraft, is_active: true, sort_order: variants.length });
                setNewDraft(EMPTY_DRAFT);
                setAdding(false);
              }}
            >
              <Check size={15} aria-hidden="true" />
              {t("common.add")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              <X size={15} aria-hidden="true" />
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          <Plus size={15} aria-hidden="true" />
          Ajouter une configuration
        </Button>
      )}
    </div>
  );
}
