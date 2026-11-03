import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/form";
import { BED_SIZE_OPTIONS } from "@/lib/bedding-presets";
import { saveGenerated, useBeddingPresets } from "@/lib/catalog-automation";
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
  model,
  productId,
  onComplete,
}: {
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
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => saveGenerated(requestId, rows, model, productId),
    onSuccess: (id) => {
      for (const key of [["admin_product", id], ["admin_products"], ["products"]])
        void queryClient.invalidateQueries({ queryKey: key });
      setRows([]);
      setRequestId(crypto.randomUUID());
      toast.success("Configurations créées. Le statut du modèle est conservé.");
      onComplete?.(id);
    },
    onError: (error: Error) => toast.error(error.message),
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
      presets.data ?? [],
    );
    if (!next.length) return toast.error("Choisis au moins une taille.");
    changeRows(next);
  };
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">2 — Valeurs communes et tailles</h3>
      <p className="text-sm text-on-surface-muted">
        Saisis ces informations une seule fois. Les tailles recevront les mêmes valeurs de départ.
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
        <Switch
          label="Prix différents selon la taille"
          checked={differentPrices}
          onChange={(e) => setDifferentPrices(e.target.checked)}
        />
        <Switch
          label="Stock par configuration"
          checked={differentStock}
          onChange={(e) => setDifferentStock(e.target.checked)}
        />
        {presets.isError && (
          <p role="alert" className="text-sm">
            Presets personnels indisponibles. Seules les dimensions confirmées seront proposées.
          </p>
        )}
        <Button variant="secondary" disabled={presets.isPending} onClick={generate}>
          {rows.length ? "Générer un nouvel aperçu" : "Afficher l’aperçu"}
        </Button>
        {rows.length > 0 && (
          <>
            <h3 className="font-semibold">3 — Aperçu avant enregistrement</h3>
            <GeneratedPreview
              model={modelName}
              rows={rows}
              onChange={changeRows}
              differentPrices={differentPrices}
              differentStock={differentStock}
            />
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
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
