import { useId, useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import type { AdminVariant } from "@/lib/admin-products";

/**
 * Elegancia variants describe a sellable bedding configuration:
 * fabric + set + number of pieces + mattress dimensions, with its own price and stock.
 * Piece count and mattress dimensions are intentionally independent.
 * Legacy colour fields are kept so older OpenStore data remains compatible.
 */
export type VariantDraft = {
  size: string;
  color_name: string;
  color_hex: string;
  sku: string;
  price: string;
  compare_at_price: string;
  stock: string;
  weight_grams: string;
  fabric: string;
  fabric_origin: string;
  set_type: string;
  piece_count: string;
  composition: string;
  flat_sheet_size: string;
  fitted_sheet_size: string;
  duvet_cover_size: string;
};

export const EMPTY_DRAFT: VariantDraft = {
  size: "",
  color_name: "",
  color_hex: "",
  sku: "",
  price: "",
  compare_at_price: "",
  stock: "0",
  weight_grams: "",
  fabric: "",
  fabric_origin: "",
  set_type: "",
  piece_count: "",
  composition: "",
  flat_sheet_size: "",
  fitted_sheet_size: "",
  duvet_cover_size: "",
};

const MATTRESS_SIZES = ["90 × 190 cm", "160 × 190 cm", "180 × 200 cm"] as const;

function isStandardMattressSize(value: string): boolean {
  return MATTRESS_SIZES.some((size) => size === value);
}

export function toDraft(variant: AdminVariant): VariantDraft {
  return {
    size: variant.size ?? "",
    color_name: variant.color_name ?? "",
    color_hex: variant.color_hex ?? "",
    sku: variant.sku ?? "",
    price: String(variant.price),
    compare_at_price:
      variant.compare_at_price === null || variant.compare_at_price === undefined
        ? ""
        : String(variant.compare_at_price),
    stock: String(variant.stock),
    weight_grams: variant.weight_grams === null ? "" : String(variant.weight_grams),
    fabric: variant.fabric ?? "",
    fabric_origin: variant.fabric_origin ?? "",
    set_type: variant.set_type ?? "",
    piece_count: variant.piece_count === null ? "" : String(variant.piece_count),
    composition: variant.composition ?? "",
    flat_sheet_size: variant.flat_sheet_size ?? "",
    fitted_sheet_size: variant.fitted_sheet_size ?? "",
    duvet_cover_size: variant.duvet_cover_size ?? "",
  };
}

export function DraftFields({
  draft,
  onChange,
}: {
  draft: VariantDraft;
  onChange: (next: VariantDraft) => void;
}) {
  const { t } = useI18n();
  const listId = useId();
  const fabricListId = `${listId}-fabrics`;
  const setTypeListId = `${listId}-set-types`;
  const [customMattressSize, setCustomMattressSize] = useState(
    () => Boolean(draft.size) && !isStandardMattressSize(draft.size),
  );
  const set = <K extends keyof VariantDraft>(key: K, value: VariantDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[14px] border border-outline bg-surface-mid/35 p-4">
        <p className="mb-3 text-sm font-semibold text-on-surface">Configuration literie</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tissu" required>
            <Input
              list={fabricListId}
              value={draft.fabric}
              onChange={(e) => set("fabric", e.target.value)}
              placeholder="100 % coton"
              maxLength={60}
            />
            <datalist id={fabricListId}>
              <option value="100 % coton" />
              <option value="Polyester" />
            </datalist>
          </Field>

          <Field label="Origine du tissu">
            <Input
              value={draft.fabric_origin}
              onChange={(e) => set("fabric_origin", e.target.value)}
              placeholder="Espagne"
              maxLength={60}
            />
          </Field>

          <Field label="Type de parure" required>
            <Input
              list={setTypeListId}
              value={draft.set_type}
              onChange={(e) => set("set_type", e.target.value)}
              placeholder="Parure de drap"
              maxLength={80}
            />
            <datalist id={setTypeListId}>
              <option value="Parure de drap" />
              <option value="Parure housse de couette" />
            </datalist>
          </Field>

          <Field label="Nombre de pièces" hint="Indépendant de la dimension du matelas">
            <Input
              type="number"
              min={1}
              value={draft.piece_count}
              onChange={(e) => set("piece_count", e.target.value)}
              placeholder="3"
              dir="ltr"
              className="font-mono"
            />
          </Field>

          <Field label="Dimension du matelas">
            <Select
              value={customMattressSize ? "__other__" : draft.size}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "__other__") {
                  setCustomMattressSize(true);
                  if (isStandardMattressSize(draft.size)) set("size", "");
                  return;
                }
                setCustomMattressSize(false);
                set("size", value);
              }}
            >
              <option value="">Choisir une dimension</option>
              {MATTRESS_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
              <option value="__other__">Autre dimension</option>
            </Select>
          </Field>

          {customMattressSize && (
            <Field label="Autre dimension" hint="Saisis la dimension exacte du matelas">
              <Input
                value={draft.size}
                onChange={(e) => set("size", e.target.value)}
                placeholder="Ex. 140 × 190 cm"
                maxLength={30}
              />
            </Field>
          )}

          <Field label="Couleur / finition">
            <Input
              value={draft.color_name}
              onChange={(e) => set("color_name", e.target.value)}
              placeholder="Écru, vert sauge…"
              maxLength={60}
            />
          </Field>

          <Field label={t("common.price")} required>
            <Input
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => set("price", e.target.value)}
              dir="ltr"
              className="font-mono"
              placeholder="9500"
            />
          </Field>

          <Field label={t("common.quantity")}>
            <Input
              type="number"
              min={0}
              value={draft.stock}
              onChange={(e) => set("stock", e.target.value)}
              dir="ltr"
              className="font-mono"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[14px] border border-outline p-4">
        <p className="mb-3 text-sm font-semibold text-on-surface">Composition et dimensions</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Composition du pack" hint="Ex. Housse de couette + drap-housse + 4 taies">
              <Input
                value={draft.composition}
                onChange={(e) => set("composition", e.target.value)}
                maxLength={220}
              />
            </Field>
          </div>

          <Field label="Drap plat">
            <Input
              value={draft.flat_sheet_size}
              onChange={(e) => set("flat_sheet_size", e.target.value)}
              placeholder="250 × 240 cm"
              maxLength={40}
            />
          </Field>

          <Field label="Drap-housse">
            <Input
              value={draft.fitted_sheet_size}
              onChange={(e) => set("fitted_sheet_size", e.target.value)}
              placeholder="160 × 190 cm"
              maxLength={40}
            />
          </Field>

          <Field label="Housse de couette">
            <Input
              value={draft.duvet_cover_size}
              onChange={(e) => set("duvet_cover_size", e.target.value)}
              placeholder="220 × 240 cm"
              maxLength={40}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-[14px] border border-outline p-4">
        <p className="mb-3 text-sm font-semibold text-on-surface">Gestion</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("admin.variants.compareAt")} hint={t("admin.variants.compareAtHint")}>
            <Input
              type="number"
              min={0}
              value={draft.compare_at_price}
              onChange={(e) => set("compare_at_price", e.target.value)}
              dir="ltr"
              className="font-mono"
            />
          </Field>

          <Field label={t("admin.variants.weight")}>
            <Input
              type="number"
              min={0}
              value={draft.weight_grams}
              onChange={(e) => set("weight_grams", e.target.value)}
              dir="ltr"
              className="font-mono"
            />
          </Field>

          <Field label="SKU">
            <Input
              value={draft.sku}
              onChange={(e) => set("sku", e.target.value)}
              dir="ltr"
              className="font-mono"
              maxLength={40}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}
