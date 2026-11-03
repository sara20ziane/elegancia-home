import { Field, Input, Select } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { useId, useState } from "react";
import { BED_SIZE_OPTIONS, updateBeddingSelection } from "@/lib/bedding-presets";
import { useBeddingPresets } from "@/lib/catalog-automation";
import type { VariantDraft } from "./variant-draft";
import { PresetRecalculation } from "./preset-recalculation";
import { VariantSecondaryFields } from "./variant-secondary-fields";

/**
 * Elegancia variants describe a sellable bedding configuration:
 * fabric + set + number of pieces + bed size determine the price and stock.
 * Piece count and bed size remain intentionally independent.
 * Legacy colour fields are kept so older OpenStore data remains compatible.
 */
function isStandardBedSize(value: string): boolean {
  return BED_SIZE_OPTIONS.some((option) => option.value === value);
}

export function DraftFields({
  draft,
  onChange,
  common = false,
}: {
  common?: boolean;
  draft: VariantDraft;
  onChange: (next: VariantDraft) => void;
}) {
  const { fabricListId, setTypeListId, customBedSize, set, setSetType, setBedSize } =
    useBeddingFields(draft, onChange);
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

          <FabricOrigin
            value={draft.fabric_origin}
            onChange={(value) => set("fabric_origin", value)}
          />
          <Field label="Type de parure" required>
            <Input
              list={setTypeListId}
              value={draft.set_type}
              onChange={(e) => setSetType(e.target.value)}
              placeholder="Parure de drap"
              maxLength={80}
            />
            <datalist id={setTypeListId}>
              <option value="Parure de drap" />
              <option value="Parure housse de couette" />
            </datalist>
          </Field>

          <Field label="Nombre de pièces" hint="Indépendant de la taille du lit">
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

          {!common && (
            <Field label="Taille du lit" hint="Queen : 160 × 190 cm · King : 180 × 200 cm">
              <Select
                value={customBedSize ? "__other__" : draft.size}
                onChange={(e) => setBedSize(e.target.value)}
              >
                <option value="">Choisir une taille</option>
                {BED_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="__other__">Autre taille / dimension</option>
              </Select>
            </Field>
          )}

          {!common && customBedSize && (
            <Field label="Autre taille / dimension" hint="Saisis le libellé ou la dimension exacte">
              <Input
                value={draft.size}
                onChange={(e) => set("size", e.target.value)}
                placeholder="Ex. 140 × 190 cm"
                maxLength={30}
              />
            </Field>
          )}

          {!common && (
            <Field label="Couleur / finition">
              <Input
                value={draft.color_name}
                onChange={(e) => set("color_name", e.target.value)}
                placeholder="Écru, vert sauge…"
                maxLength={60}
              />
            </Field>
          )}

          <PricingFields draft={draft} onChange={onChange} common={common} />
        </div>
      </section>

      {!common && <PresetRecalculation draft={draft} onChange={onChange} />}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Composition, dimensions et gestion (facultatif)
        </summary>
        <VariantSecondaryFields draft={draft} onChange={onChange} />
      </details>
    </div>
  );
}

function useBeddingFields(draft: VariantDraft, onChange: (next: VariantDraft) => void) {
  const { data: presets } = useBeddingPresets();
  const listId = useId();
  const fabricListId = `${listId}-fabrics`;
  const setTypeListId = `${listId}-set-types`;
  const [customSelected, setCustomBedSize] = useState(
    () => Boolean(draft.size) && !isStandardBedSize(draft.size),
  );
  const customBedSize = customSelected || (Boolean(draft.size) && !isStandardBedSize(draft.size));
  const set = <K extends Exclude<keyof VariantDraft, "provenance">>(
    key: K,
    value: VariantDraft[K],
  ) =>
    onChange(
      key === "size" || key === "piece_count"
        ? updateBeddingSelection(draft, { [key]: value }, presets)
        : { ...draft, [key]: value },
    );

  const setSetType = (value: string) =>
    onChange(updateBeddingSelection(draft, { set_type: value }, presets));
  const setBedSize = (value: string) => {
    setCustomBedSize(value === "__other__");
    onChange(updateBeddingSelection(draft, { size: value === "__other__" ? "" : value }, presets));
  };

  return { fabricListId, setTypeListId, customBedSize, set, setSetType, setBedSize };
}

function FabricOrigin({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Origine du tissu">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Espagne"
        maxLength={60}
      />
    </Field>
  );
}

function PricingFields({
  draft,
  onChange,
  common,
}: {
  draft: VariantDraft;
  onChange: (draft: VariantDraft) => void;
  common: boolean;
}) {
  const { t } = useI18n();
  const set = (key: "price" | "stock", value: string) => onChange({ ...draft, [key]: value });
  return (
    <>
      <Field
        label={common ? "Prix de vente (DA)" : t("common.price")}
        required
        hint="Même prix pour Queen et King à parure équivalente"
      >
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

      <Field label={common ? "Stock initial" : t("common.quantity")}>
        <Input
          type="number"
          min={0}
          value={draft.stock}
          onChange={(e) => set("stock", e.target.value)}
          dir="ltr"
          className="font-mono"
        />
      </Field>
    </>
  );
}
