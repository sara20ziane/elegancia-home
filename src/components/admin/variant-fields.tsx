import { Field, Input, Select } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { useId, useState } from "react";
import type { VariantDraft } from "./variant-draft";
import { VariantSecondaryFields } from "./variant-secondary-fields";

/**
 * Elegancia variants describe a sellable bedding configuration:
 * fabric + set + number of pieces + bed size determine the price and stock.
 * Piece count and bed size remain intentionally independent.
 * Legacy colour fields are kept so older OpenStore data remains compatible.
 */
const BED_SIZE_OPTIONS = [
  {
    value: "90 × 190 cm",
    label: "90 × 190 cm",
    fittedSheet: "90 × 190 cm",
    duvetCover: "",
  },
  {
    value: "Queen size",
    label: "Queen size",
    fittedSheet: "160 × 190 cm",
    duvetCover: "220 × 240 cm",
  },
  {
    value: "King size",
    label: "King size",
    fittedSheet: "180 × 200 cm",
    duvetCover: "260 × 240 cm",
  },
] as const;

function bedSizeOption(value: string) {
  return BED_SIZE_OPTIONS.find((option) => option.value === value);
}

function isStandardBedSize(value: string): boolean {
  return BED_SIZE_OPTIONS.some((option) => option.value === value);
}

export function DraftFields({
  draft,
  onChange,
}: {
  draft: VariantDraft;
  onChange: (next: VariantDraft) => void;
}) {
  const { t } = useI18n();
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

          {customBedSize && (
            <Field label="Autre taille / dimension" hint="Saisis le libellé ou la dimension exacte">
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

          <Field
            label={t("common.price")}
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

      <VariantSecondaryFields draft={draft} onChange={onChange} />
    </div>
  );
}

function useBeddingFields(draft: VariantDraft, onChange: (next: VariantDraft) => void) {
  const listId = useId();
  const fabricListId = `${listId}-fabrics`;
  const setTypeListId = `${listId}-set-types`;
  const [customBedSize, setCustomBedSize] = useState(
    () => Boolean(draft.size) && !isStandardBedSize(draft.size),
  );
  const set = <K extends keyof VariantDraft>(key: K, value: VariantDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const setSetType = (value: string) => {
    const mapped = bedSizeOption(draft.size);
    onChange({
      ...draft,
      set_type: value,
      fitted_sheet_size: mapped?.fittedSheet ?? draft.fitted_sheet_size,
      duvet_cover_size:
        value === "Parure housse de couette" ? (mapped?.duvetCover ?? draft.duvet_cover_size) : "",
    });
  };

  const setBedSize = (value: string) => {
    if (value === "__other__") {
      setCustomBedSize(true);
      if (isStandardBedSize(draft.size)) {
        onChange({
          ...draft,
          size: "",
          fitted_sheet_size: "",
          duvet_cover_size:
            draft.set_type === "Parure housse de couette" ? "" : draft.duvet_cover_size,
        });
      }
      return;
    }

    setCustomBedSize(false);
    const mapped = bedSizeOption(value);
    onChange({
      ...draft,
      size: value,
      fitted_sheet_size: mapped?.fittedSheet ?? draft.fitted_sheet_size,
      duvet_cover_size:
        draft.set_type === "Parure housse de couette"
          ? (mapped?.duvetCover ?? draft.duvet_cover_size)
          : "",
    });
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
