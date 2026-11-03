import { Field, Input } from "@/components/ui/form";
import { editVariantField } from "@/lib/bedding-presets";
import type { PresetField } from "@/lib/bedding-provenance";
import type { VariantDraft } from "./variant-draft";

export function VariantPresetInput({
  draft,
  onChange,
  field,
  label,
}: {
  draft: VariantDraft;
  onChange: (draft: VariantDraft) => void;
  field: PresetField;
  label: string;
}) {
  const origin = draft.provenance[field];
  const hint =
    origin.source === "manual"
      ? "Valeur manuelle, conservée lors des changements."
      : origin.source === "legacy"
        ? "Valeur existante : provenance non enregistrée."
        : origin.state === "not_applicable"
          ? "Preset : non applicable à cette parure."
          : origin.state === "unknown"
            ? "Preset : valeur inconnue, à compléter."
            : "Valeur du preset, actualisée si la taille, le type ou les pièces changent.";
  return (
    <Field label={label} hint={hint}>
      <Input
        value={draft[field]}
        onChange={(e) => onChange(editVariantField(draft, field, e.target.value))}
        maxLength={field === "composition" ? 220 : 40}
      />
    </Field>
  );
}
