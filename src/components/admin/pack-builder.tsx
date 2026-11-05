import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { getSupabase } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n-context";
import type { PickerVariant } from "@/lib/product-picker";
import { fetchPackItems, removePackItem, upsertPackItem, type PackItem } from "@/lib/admin-content";

/** "M / أبيض", matching how the storefront labels a variant. */
function label(variant: PickerVariant | undefined): string {
  if (!variant) return "—";
  const parts = [variant.size, variant.color_name].filter(Boolean);
  return [variant.product_name, parts.length > 0 ? parts.join(" / ") : variant.id.slice(0, 8)]
    .filter(Boolean)
    .join(" — ");
}

/**
 * Pack contents editor.
 *
 * A pack is a product whose price is set on its own variants, and whose contents
 * are a list of references to other products' variants. The contents are
 * snapshotted and reserved atomically at checkout. Price remains seller-defined.
 */
export function PackBuilder({
  productId,
  variants,
}: {
  productId: string;
  /** Every variant in the catalogue, so a pack can reference other products. */
  variants: PickerVariant[];
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const capacity = useQuery({
    queryKey: ["pack_capacity", productId],
    queryFn: async () => {
      const result = await getSupabase().rpc("pack_availability", { p_product: productId });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["pack_items", productId],
    queryFn: () => fetchPackItems(productId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pack_items", productId] });
    void queryClient.invalidateQueries({ queryKey: ["admin_product", productId] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["pack_capacity", productId] });
    void queryClient.invalidateQueries({ queryKey: ["catalogue"] });
    void queryClient.invalidateQueries({ queryKey: ["product"] });
  };

  const save = useMutation({
    mutationFn: (input: { variant_id: string; quantity: number }) =>
      upsertPackItem({ product_id: productId, ...input, sort_order: items?.length ?? 0 }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removePackItem(id),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const byId = new Map(variants.map((v) => [v.id, v]));
  const listed = items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-on-surface-muted">
        Le prix global et la réduction se règlent sur les configurations du pack. La disponibilité
        est limitée par son stock et celui de chaque composant. Seules les nouvelles commandes
        réservent les composants ; les anciennes réservations restent inchangées.
      </p>
      {capacity.isError ? (
        <p role="alert">Disponibilité du pack non vérifiée.</p>
      ) : (
        <p className="text-sm">
          Stock vendable par configuration : {capacity.data?.map((v) => v.stock).join(" / ") || "0"}
        </p>
      )}
      {listed.length === 0 ? (
        <p className="text-sm text-on-surface-muted">{t("admin.pack.empty")}</p>
      ) : (
        <ul className="divide-y divide-outline rounded-[16px] border border-outline">
          {listed.map((item: PackItem) => {
            const variant = byId.get(item.variant_id);
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{label(variant)}</span>
                  <span className="font-mono text-xs text-on-surface-muted" dir="ltr">
                    {variant?.sku ?? item.variant_id.slice(0, 8)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone="primary">×</Badge>
                  <Input
                    aria-label={`Quantité ${label(variant)}`}
                    className="w-20"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={item.quantity}
                    disabled={save.isPending}
                    onBlur={(e) => {
                      const quantity = Number(e.target.value);
                      if (
                        Number.isInteger(quantity) &&
                        quantity >= 1 &&
                        quantity <= 100 &&
                        quantity !== item.quantity
                      )
                        save.mutate({ variant_id: item.variant_id, quantity });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => remove.mutate(item.id)}
                    disabled={remove.isPending || save.isPending}
                    aria-label={t("common.delete")}
                    className="text-on-surface-muted hover:text-error"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <AddPackItem
        variants={variants}
        onAdd={(input) => save.mutate(input)}
        busy={save.isPending}
      />
    </div>
  );
}

function AddPackItem({
  variants,
  onAdd,
  busy,
}: {
  variants: PickerVariant[];
  onAdd: (input: { variant_id: string; quantity: number }) => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");

  return (
    <div className="grid gap-3 sm:grid-cols-[3fr_1fr_auto] sm:items-end">
      <Field label={t("admin.products.packContents")}>
        <Select value={variantId} onChange={(event) => setVariantId(event.target.value)}>
          <option value="">{t("common.add")}…</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {label(variant)} — {variant.sku ?? variant.id.slice(0, 6)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("common.quantity")}>
        <Input
          type="number"
          min={1}
          max={100}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          dir="ltr"
          className="font-mono"
        />
      </Field>
      <Button
        type="button"
        variant="secondary"
        disabled={
          !variantId ||
          busy ||
          !Number.isInteger(Number(quantity)) ||
          Number(quantity) < 1 ||
          Number(quantity) > 100
        }
        onClick={() => {
          onAdd({ variant_id: variantId, quantity: Number(quantity) || 1 });
          setVariantId("");
          setQuantity("1");
        }}
      >
        {t("common.add")}
      </Button>
    </div>
  );
}
