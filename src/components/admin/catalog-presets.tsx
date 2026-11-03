import { PRESET_FIELDS } from "@/lib/bedding-provenance";
import { PresetValueField } from "./preset-value-field";
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
      composition: { state: "unknown" },
      fitted_sheet_size: { state: "unknown" },
      flat_sheet_size: { state: "unknown" },
      duvet_cover_size: { state: "unknown" },
    });
  return (
    <details className="rounded-[12px] border border-outline p-4">
      <summary className="cursor-pointer font-medium">
        Standards Elegancia — presets configurables
      </summary>
      <p className="my-3 text-sm text-on-surface-muted">
        Une règle par taille, type de parure et nombre de pièces. Saisis uniquement les valeurs
        confirmées. Aucun modèle existant ne sera modifié.
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
            {preset.name} · {preset.size} · {preset.piece_count} pièces
          </option>
        ))}
      </Select>
      <Button variant="ghost" onClick={start}>
        Nouveau preset
      </Button>
      {draft && (
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-3 sm:grid-cols-2">
          {Object.entries(fields)
            .filter(([field]) => !PRESET_FIELDS.includes(field as (typeof PRESET_FIELDS)[number]))
            .map(([field, label]) => {
              const key = field as "name" | "size" | "set_type" | "piece_count";
              const numeric = key === "piece_count";
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
          {PRESET_FIELDS.map((key) => (
            <PresetValueField
              key={key}
              label={fields[key]}
              value={draft[key]}
              onChange={(value) => setDraft({ ...draft, [key]: value })}
            />
          ))}
          <Button
            disabled={
              !draft.name.trim() ||
              !draft.size.trim() ||
              !draft.set_type.trim() ||
              !Number.isInteger(Number(draft.piece_count)) ||
              Number(draft.piece_count) < 1 ||
              PRESET_FIELDS.some((key) => draft[key].state === "known" && !draft[key].value.trim())
            }
            onClick={() => save.mutate(draft)}
          >
            Enregistrer le preset
          </Button>
        </fieldset>
      )}
    </details>
  );
}
