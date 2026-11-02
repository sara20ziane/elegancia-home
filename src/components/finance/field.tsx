import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { key } from "@/lib/finance/labels";
import type { FinanceField } from "./form";

export function FinanceInputField({ field }: { field: FinanceField }) {
  const { t } = useI18n();
  if (field.type === "checkbox")
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={field.name} defaultChecked={field.value === true} />
        {t(field.label || key(field.name))}
      </label>
    );
  return (
    <Field label={t(field.label || key(field.name))}>
      {field.options ? (
        <Select
          name={field.name}
          required={field.required}
          defaultValue={String(field.value ?? "")}
        >
          <option value="">—</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea
          name={field.name}
          required={field.required}
          defaultValue={String(field.value ?? "")}
          maxLength={1000}
        />
      ) : (
        <Input
          name={field.name}
          type={field.type || "text"}
          required={field.required}
          defaultValue={field.type === "file" ? undefined : String(field.value ?? "")}
          step={field.type === "number" ? "0.01" : undefined}
          min={field.type === "number" ? "0" : undefined}
          accept={
            field.brand ? "image/png,image/jpeg" : "application/pdf,image/png,image/jpeg,image/webp"
          }
          maxLength={500}
        />
      )}
    </Field>
  );
}
