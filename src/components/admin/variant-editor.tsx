import { Button } from "@/components/ui/button";
import { type AdminVariant } from "@/lib/admin-products";
import { useI18n } from "@/lib/i18n-context";
import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { useVariantMutations } from "./use-variant-mutations";
import { EMPTY_DRAFT, type VariantDraft } from "./variant-draft";
import { DraftFields } from "./variant-fields";
import { VariantRow } from "./variant-row";

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
  const { save, remove } = useVariantMutations(productId);
  const [adding, setAdding] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [newDraft, setNewDraft] = useState<VariantDraft>(EMPTY_DRAFT);

  const startBlank = () => {
    setNewDraft(EMPTY_DRAFT);
    setDuplicating(false);
    setAdding(true);
  };

  const startDuplicate = (draft: VariantDraft) => {
    setNewDraft({ ...draft, sku: "" });
    setDuplicating(true);
    setAdding(true);
    requestAnimationFrame(() => {
      document.getElementById("new-configuration")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

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
            onDuplicate={startDuplicate}
            onDelete={() => remove.mutate(variant.id)}
          />
        ))}
      </ul>

      {adding ? (
        <div
          id="new-configuration"
          className="flex scroll-mt-4 flex-col gap-3 rounded-[16px] border border-primary/40 bg-primary/5 p-4"
        >
          <div>
            <p className="font-medium text-on-surface">
              {duplicating ? "Configuration dupliquée" : "Nouvelle configuration"}
            </p>
            {duplicating && (
              <p className="mt-1 text-xs text-on-surface-muted">
                Modifie seulement les champs qui changent, puis enregistre. Le SKU a été vidé pour
                éviter un doublon et sera généré à l’enregistrement. Après un changement de taille,
                utilise « Recalculer depuis le preset » pour vérifier les dimensions.
              </p>
            )}
          </div>
          <DraftFields draft={newDraft} onChange={setNewDraft} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!newDraft.price || save.isPending}
              onClick={() => {
                save.mutate(
                  { draft: newDraft, is_active: true, sort_order: variants.length },
                  {
                    onSuccess: () => {
                      setNewDraft(EMPTY_DRAFT);
                      setDuplicating(false);
                      setAdding(false);
                    },
                  },
                );
              }}
            >
              <Check size={15} aria-hidden="true" />
              {duplicating ? "Enregistrer la copie" : t("common.add")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setDuplicating(false);
                setNewDraft(EMPTY_DRAFT);
              }}
            >
              <X size={15} aria-hidden="true" />
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" className="self-start" onClick={startBlank}>
          <Plus size={15} aria-hidden="true" />
          Ajouter une configuration vierge
        </Button>
      )}
    </div>
  );
}
