import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import type { BeddingPreset } from "@/lib/bedding-presets";
import { saveBeddingPreset, useBeddingPresets } from "@/lib/catalog-automation";

const fields = {
  name: "Nom du preset",
  size: "Taille du lit",
  set_type: "Type de parure",
  piece_count: "Nombre de pièces",
  composition: "Composition exacte",
  fitted_sheet_size: "Drap-housse / matelas",
  flat_sheet_size: "Drap plat",
  duvet_cover_size: "Housse de couette",
  weight_grams: "Poids (g)",
} as const;

export function CatalogPresets() {
  const presets = useBeddingPresets();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BeddingPreset | null>(null);
  const save = useMutation({
    mutationFn: (value: BeddingPreset) => saveBeddingPreset(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalog_presets"] });
      setDraft(null);
      toast.success("Preset enregistré pour les prochaines générations.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const start = () =>
    setDraft({
      id: crypto.randomUUID(),
      name: "",
      size: "",
      set_type: "",
      piece_count: "",
      composition: "",
      fitted_sheet_size: "",
      flat_sheet_size: "",
      duvet_cover_size: "",
      weight_grams: "",
    });
  return (
    <details className="rounded-[12px] border border-outline p-4">
      <summary className="cursor-pointer font-medium">
        Standards Elegancia — presets configurables
      </summary>
      <p className="my-3 text-sm text-on-surface-muted">
        Une règle par taille et type de parure. Saisis uniquement les valeurs confirmées. Aucun
        modèle existant ne sera modifié.
      </p>
      {presets.isError && (
        <p role="alert">
          Impossible de charger les presets. Vérifie que la migration catalogue est appliquée.
        </p>
      )}
      <Select
        aria-label="Preset à modifier"
        value={draft?.id ?? ""}
        onChange={(e) =>
          setDraft(presets.data?.find((preset) => preset.id === e.target.value) ?? null)
        }
      >
        <option value="">Choisir un preset</option>
        {presets.data?.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </Select>
      <Button variant="ghost" onClick={start}>
        Nouveau preset
      </Button>
      {draft && (
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-3 sm:grid-cols-2">
          {Object.entries(fields).map(([field, label]) => {
            const key = field as keyof typeof fields;
            const numeric = key === "piece_count" || key === "weight_grams";
            return (
              <Field key={key} label={label}>
                <Input
                  value={draft[key]}
                  type={numeric ? "number" : "text"}
                  min={key === "piece_count" ? 1 : 0}
                  maxLength={220}
                  placeholder={key === "size" ? "Queen size" : undefined}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </Field>
            );
          })}
          <Button
            disabled={!draft.name.trim() || !draft.size.trim() || !draft.set_type.trim()}
            onClick={() => save.mutate(draft)}
          >
            Enregistrer le preset
          </Button>
        </fieldset>
      )}
    </details>
  );
}
