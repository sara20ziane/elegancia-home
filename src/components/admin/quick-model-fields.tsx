import { Field, Input, Textarea } from "@/components/ui/form";
import { ProductCategoryFields, type ProductDraft } from "./product-fields";

export function QuickModelFields({
  draft,
  onChange,
}: {
  draft: ProductDraft;
  onChange: (draft: ProductDraft) => void;
}) {
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    onChange({ ...draft, [key]: value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nom arabe" required>
        <Input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          dir="rtl"
          maxLength={120}
        />
      </Field>
      <Field label="Nom français" required>
        <Input
          value={draft.name_fr}
          onChange={(e) => set("name_fr", e.target.value)}
          maxLength={120}
        />
      </Field>
      <ProductCategoryFields draft={draft} set={set} />
      <details className="sm:col-span-2">
        <summary className="cursor-pointer">Descriptions (facultatif)</summary>
        <Field label="Description arabe">
          <Textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            dir="rtl"
            maxLength={4000}
          />
        </Field>
        <Field label="Description française">
          <Textarea
            value={draft.description_fr}
            onChange={(e) => set("description_fr", e.target.value)}
            maxLength={4000}
          />
        </Field>
      </details>
      <p className="text-sm text-on-surface-muted sm:col-span-2">
        Le lien sera généré depuis le nom. Le modèle restera en brouillon.
      </p>
    </div>
  );
}
