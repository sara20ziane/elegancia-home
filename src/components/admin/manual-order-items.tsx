import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { formatDzd } from "@/lib/format";
import { Minus, Plus, Trash2 } from "lucide-react";
import { variantLabel, type ManualOrderState } from "./manual-order-state";
export function ManualOrderItems({ state }: { state: ManualOrderState }) {
  const {
    selectedVariantId,
    setSelectedVariantId,
    catalog,
    variants,
    locale,
    addVariant,
    selectedLines,
    changeQuantity,
    setLines,
  } = state;
  return (
    <section className="flex flex-col gap-3 rounded-[16px] border border-outline bg-surface p-5">
      <div>
        <h3 className="font-display text-lg font-semibold">Articles</h3>
        <p className="text-xs text-on-surface-muted">
          Les prix et le stock viennent directement du catalogue Elegancia Home.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={selectedVariantId}
          onChange={(event) => setSelectedVariantId(event.target.value)}
          disabled={catalog.isPending}
          className="flex-1"
          aria-label="Configuration à ajouter"
        >
          <option value="">
            {catalog.isPending
              ? "Chargement du catalogue…"
              : "Choisir un produit / une configuration"}
          </option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id} disabled={variant.stock < 1}>
              {variantLabel(variant)} — {formatDzd(variant.price, locale)} — stock {variant.stock}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          onClick={addVariant}
          disabled={!selectedVariantId}
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter
        </Button>
      </div>

      {catalog.isError && (
        <p className="text-sm text-error" role="alert">
          Impossible de charger le catalogue : {catalog.error.message}
        </p>
      )}

      {selectedLines.length === 0 ? (
        <p className="rounded-[10px] bg-surface-mid px-3 py-3 text-sm text-on-surface-muted">
          Aucun article ajouté.
        </p>
      ) : (
        <ul className="divide-y divide-outline rounded-[12px] border border-outline">
          {selectedLines.map((line) => (
            <li key={line.variantId} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="min-w-[12rem] flex-1">
                <p className="text-sm font-medium">{variantLabel(line.variant)}</p>
                <p className="text-xs text-on-surface-muted">
                  {formatDzd(line.variant.price, locale)} · stock disponible {line.variant.stock}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => changeQuantity(line.variant, -1)}
                  aria-label="Retirer une unité"
                >
                  <Minus size={14} aria-hidden="true" />
                </Button>
                <span className="w-8 text-center font-mono text-sm">{line.quantity}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={line.quantity >= line.variant.stock}
                  onClick={() => changeQuantity(line.variant, 1)}
                  aria-label="Ajouter une unité"
                >
                  <Plus size={14} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((item) => item.variantId !== line.variantId),
                    )
                  }
                  aria-label="Supprimer cet article"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </div>
              <span className="w-28 text-end font-mono text-sm" dir="ltr">
                {formatDzd(line.variant.price * line.quantity, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
