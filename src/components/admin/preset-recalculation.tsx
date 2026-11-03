import { PRESET_FIELDS } from "@/lib/bedding-provenance";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { beddingPresetPatch } from "@/lib/bedding-presets";
import { useBeddingPresets } from "@/lib/catalog-automation";
import type { VariantDraft } from "./variant-draft";

export function PresetRecalculation({
  draft,
  onChange,
}: {
  draft: VariantDraft;
  onChange: (draft: VariantDraft) => void;
}) {
  const presets = useBeddingPresets();
  const [preview, setPreview] = useState<Partial<VariantDraft> | null>(null);
  const propose = () => {
    setPreview(beddingPresetPatch(draft, presets.data));
  };
  const changes = preview
    ? ([...PRESET_FIELDS].filter(
        (key) =>
          preview[key] !== undefined &&
          (preview[key] !== draft[key] ||
            JSON.stringify(preview.provenance?.[key as (typeof PRESET_FIELDS)[number]]) !==
              JSON.stringify(draft.provenance[key as (typeof PRESET_FIELDS)[number]])),
      ) as Exclude<keyof VariantDraft, "provenance">[])
    : [];
  const labels: Partial<Record<keyof VariantDraft, string>> = {
    fitted_sheet_size: "Drap-housse",
    flat_sheet_size: "Drap plat",
    duvet_cover_size: "Housse de couette",
    composition: "Composition",
  };
  return (
    <div className="my-3 flex flex-col gap-2">
      <Button variant="ghost" size="sm" disabled={presets.isPending} onClick={propose}>
        Recalculer depuis le preset
      </Button>
      {preview && (
        <div className="rounded border border-outline p-3 text-sm">
          {changes.length ? (
            <ul>
              {changes.map((key) => (
                <li key={key}>
                  {labels[key]} : {draft[key] || "vide"} → {preview[key] || "vide"}
                </li>
              ))}
            </ul>
          ) : (
            <p>Aucun changement proposé avec les règles connues.</p>
          )}
          <Button
            size="sm"
            disabled={!changes.length}
            onClick={() => {
              onChange({
                ...draft,
                provenance: preview.provenance ?? draft.provenance,
                ...Object.fromEntries(changes.map((key) => [key, preview[key]])),
              });
              setPreview(null);
            }}
          >
            Appliquer ces changements
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
