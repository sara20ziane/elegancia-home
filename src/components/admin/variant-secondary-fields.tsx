import { Field, Input } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import type { VariantDraft } from "./variant-draft";
export function VariantSecondaryFields({
  draft,
  onChange,
}: {
  draft: VariantDraft;
  onChange: (next: VariantDraft) => void;
}) {
  const { t } = useI18n();
  const set = <K extends keyof VariantDraft>(key: K, value: VariantDraft[K]) =>
    onChange({ ...draft, [key]: value });
  return (
    <>
      <section className="rounded-[14px] border border-outline p-4">
        <p className="mb-3 text-sm font-semibold text-on-surface">Composition et dimensions</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Composition du pack" hint="Ex. Housse de couette + drap-housse + 4 taies">
              <Input
                value={draft.composition}
                onChange={(e) => set("composition", e.target.value)}
                maxLength={220}
              />
            </Field>
          </div>

          <Field label="Drap plat">
            <Input
              value={draft.flat_sheet_size}
              onChange={(e) => set("flat_sheet_size", e.target.value)}
              placeholder="250 × 240 cm"
              maxLength={40}
            />
          </Field>

          <Field label="Drap-housse / dimension matelas">
            <Input
              value={draft.fitted_sheet_size}
              onChange={(e) => set("fitted_sheet_size", e.target.value)}
              placeholder="160 × 190 cm"
              maxLength={40}
            />
          </Field>

          <Field label="Housse de couette">
            <Input
              value={draft.duvet_cover_size}
              onChange={(e) => set("duvet_cover_size", e.target.value)}
              placeholder="220 × 240 cm"
              maxLength={40}
            />
          </Field>
        </div>
      </section>

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

          <Field label="SKU">
            <Input
              value={draft.sku}
              onChange={(e) => set("sku", e.target.value)}
              dir="ltr"
              className="font-mono"
              maxLength={40}
            />
          </Field>
        </div>
      </section>
    </>
  );
}
