import { Field, Input, Select } from "@/components/ui/form";
import type { PresetValue } from "@/lib/bedding-provenance";

export function PresetValueField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PresetValue;
  onChange: (value: PresetValue) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Field label={`${label} — règle`}>
        <Select
          value={value.state}
          onChange={(e) =>
            onChange(
              e.target.value === "known"
                ? { state: "known", value: "" }
                : { state: e.target.value as "unknown" | "not_applicable" },
            )
          }
        >
          <option value="unknown">Inconnu — à compléter</option>
          <option value="known">Valeur connue</option>
          <option value="not_applicable">Non applicable — aucune pièce</option>
        </Select>
      </Field>
      {value.state === "known" && (
        <Field label={label}>
          <Input
            value={value.value}
            onChange={(e) => onChange({ state: "known", value: e.target.value })}
            maxLength={220}
          />
        </Field>
      )}
    </div>
  );
}
