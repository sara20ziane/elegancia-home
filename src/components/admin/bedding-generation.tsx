import { GenerationOptions } from "./generation-options";
import { useGeneratedSave } from "./use-generated-save";
import type { AdminVariant } from "@/lib/admin-products";
import { configurationConflicts } from "@/lib/catalog-configuration-key";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { BED_SIZE_OPTIONS, INITIAL_BEDDING_PRESETS } from "@/lib/bedding-presets";
import { useBeddingPresets } from "@/lib/catalog-automation";
import {
  generateBeddingVariants,
  validateVariant,
  type GeneratedVariant,
} from "@/lib/variant-generator";
import type { ProductDraft } from "./product-fields";
import { EMPTY_DRAFT, type VariantDraft } from "./variant-draft";
import { DraftFields } from "./variant-fields";
import { GeneratedPreview } from "./generated-preview";

export function BeddingGeneration({
  modelName,
  existingVariants = [],
  model,
  productId,
  onComplete,
}: {
  existingVariants?: AdminVariant[];
  modelName: string;
  model?: ProductDraft;
  productId?: string;
  onComplete?: (id: string) => void;
}) {
  const [base, setBase] = useState<VariantDraft>(EMPTY_DRAFT);
  const [sizes, setSizes] = useState<string[]>(["Queen size", "King size"]);
  const [custom, setCustom] = useState("");
  const [other, setOther] = useState(false);
  const [rows, setRows] = useState<GeneratedVariant[]>([]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [differentPrices, setDifferentPrices] = useState(false);
  const [differentStock, setDifferentStock] = useState(false);
  const presets = useBeddingPresets();
  const availablePresets = presets.data?.length ? presets.data : INITIAL_BEDDING_PRESETS;
  const conflicts = configurationConflicts(
    rows.map((row) => row.draft),
    existingVariants,
  );
  const save = useGeneratedSave({
    requestId,
    rows,
    model,
    productId,
    onSaved: (id) => {
      setRows([]);
      setRequestId(crypto.randomUUID());
      onComplete?.(id);
    },
  });
  const changeRows = (next: GeneratedVariant[]) => {
    setRows(next);
    setRequestId(crypto.randomUUID());
  };
  const generate = () => {
    if (
      rows.length &&
      !window.confirm("Remplacer cet aperçu et ses modifications par de nouvelles propositions ?")
    )
      return;
    if (!base.fabric.trim() || !base.set_type.trim())
      return toast.error("Indique le tissu et le type de parure.");
    if (other && !custom.trim()) return toast.error("Indique la taille personnalisée.");
    const error = validateVariant(base);
    if (error) return toast.error(error);
    const next = generateBeddingVariants(
      modelName,
      base,
      [...sizes, ...(other ? [custom] : [])],
      availablePresets,
    );
    if (!next.length) return toast.error("Choisis au moins une taille.");
    changeRows(next);
  };
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">2 — Valeurs communes et tailles</h3>
      <p className="text-sm text-on-surface-muted">
        Saisis les informations communes une seule fois. Composition, dimensions et SKU sont
        générés automatiquement pour chaque taille dans l’aperçu.
      </p>
      <fieldset disabled={save.isPending} className="flex min-w-0 flex-col gap-4">
        <DraftFields draft={base} onChange={setBase} common />
        <SizeSelection
          sizes={sizes}
          setSizes={setSizes}
          other={other}
          setOther={setOther}
          custom={custom}
          setCustom={setCustom}
        />
        <GenerationOptions
          differentPrices={differentPrices}
          setDifferentPrices={setDifferentPrices}
          differentStock={differentStock}
          setDifferentStock={setDifferentStock}
          unavailable={presets.isError}
          retrying={presets.isFetching}
          onRetry={() => void presets.refetch()}
        />
        <Button variant="secondary" onClick={generate}>
          {rows.length ? "Générer un nouvel aperçu" : "Afficher l’aperçu"}
        </Button>
        {rows.length > 0 && (
          <>
            <h3 className="font-semibold">3 — Aperçu avant enregistrement</h3>
            <GeneratedPreview
              conflicts={conflicts}
              model={modelName}
              rows={rows}
              onChange={changeRows}
              differentPrices={differentPrices}
              differentStock={differentStock}
            />
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || conflicts.some(Boolean)}
            >
              {save.isPending ? "Création…" : "Créer les configurations"}
            </Button>
          </>
        )}
      </fieldset>
    </div>
  );
}

function SizeSelection({
  sizes,
  setSizes,
  other,
  setOther,
  custom,
  setCustom,
}: {
  sizes: string[];
  setSizes: (sizes: string[]) => void;
  other: boolean;
  setOther: (other: boolean) => void;
  custom: string;
  setCustom: (custom: string) => void;
}) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 font-medium">Tailles proposées</legend>
        <div className="flex flex-wrap gap-4">
          {BED_SIZE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sizes.includes(option.value)}
                onChange={(e) =>
                  setSizes(
                    e.target.checked
                      ? [...sizes, option.value]
                      : sizes.filter((size) => size !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={other} onChange={(e) => setOther(e.target.checked)} />
            Autre
          </label>
        </div>
      </fieldset>
      {other && (
        <Field label="Autre taille">
          <Input value={custom} maxLength={30} onChange={(e) => setCustom(e.target.value)} />
        </Field>
      )}
    </>
  );
}