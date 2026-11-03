import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { VariantPresetInput } from "./variant-preset-input";
import { editVariantField } from "@/lib/bedding-presets";
import { useI18n } from "@/lib/i18n-context";
import type { VariantDraft } from "./variant-draft";
export function VariantSecondaryFields({
  draft,
  onChange,
  common = false,
}: {
  draft: VariantDraft;
  onChange: (next: VariantDraft) => void;
  common?: boolean;
}) {
  const { t } = useI18n();
  const set = <K extends Exclude<keyof VariantDraft, "provenance">>(
    key: K,
    value: VariantDraft[K],
  ) => onChange(editVariantField(draft, key, value));
  return (
    <>
      {!common && (
        <section className="rounded-[14px] border border-outline p-4">
          <p className="mb-3 text-sm font-semibold text-on-surface">Composition et dimensions</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4">
              <VariantPresetInput
                draft={draft}
                onChange={onChange}
                field="composition"
                label="Composition du pack"
              />
            </div>
            <VariantPresetInput
              draft={draft}
              onChange={onChange}
              field="flat_sheet_size"
              label="Drap plat"
            />
            <VariantPresetInput
              draft={draft}
              onChange={onChange}
              field="fitted_sheet_size"
              label="Drap-housse / dimension matelas"
            />
            <VariantPresetInput
              draft={draft}
              onChange={onChange}
              field="duvet_cover_size"
              label="Housse de couette"
            />
          </div>
        </section>
      )}

      <section className="rounded-[14px] border border-outline p-4">
        <p className="mb-3 text-sm font-semibold text-on-surface">Gestion</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("admin.variants.compareAt")} hint={t("admin.variants.compareAtHint")}>
            <Input
              type="number"
              min={0}
              value={draft.compare_at_price}
              onChange={(e) => set("compare_at_price", e.target.value)}
              dir="ltr"
              className="font-mono"
            />
          </Field>

          <Field label={t("admin.variants.weight")}>
            <Input
              type="number"
              min={0}
              value={draft.weight_grams}
              onChange={(e) => set("weight_grams", e.target.value)}
              dir="ltr"
              className="font-mono"
            />
          </Field>

          {!common && (
            <Field label="SKU">
              <Input
                value={draft.sku}
                onChange={(e) => set("sku", e.target.value)}
                dir="ltr"
                className="font-mono"
                maxLength={40}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm("Vider le SKU pour le régénérer au prochain enregistrement ?"))
                    set("sku", "");
                }}
              >
                Régénérer le SKU
              </Button>
            </Field>
          )}
        </div>
      </section>
    </>
  );
}