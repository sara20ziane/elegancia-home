import { Save } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n-context";
import { localized } from "@/lib/i18n";
import { useCategories } from "@/lib/queries";
import type { AdminProduct } from "@/lib/admin-products";

export type ProductDraft = {
  name: string;
  name_fr: string;
  description: string;
  description_fr: string;
  category_ids: string[];
};

const fieldLabels = {
  fr: {
    nameAr: "Nom en arabe",
    nameFr: "Nom en français",
    descriptionAr: "Description en arabe",
    descriptionFr: "Description en français",
    categories: "Catégories",
    categoriesHint: "Un même modèle peut apparaître dans plusieurs catégories.",
    save: "Enregistrer les informations",
  },
  ar: {
    nameAr: "الاسم بالعربية",
    nameFr: "الاسم بالفرنسية",
    descriptionAr: "الوصف بالعربية",
    descriptionFr: "الوصف بالفرنسية",
    categories: "الفئات",
    categoriesHint: "يمكن أن يظهر نفس الموديل في أكثر من فئة.",
    save: "حفظ معلومات المنتج",
  },
  en: {
    nameAr: "Name in Arabic",
    nameFr: "Name in French",
    descriptionAr: "Description in Arabic",
    descriptionFr: "Description in French",
    categories: "Categories",
    categoriesHint: "The same model can appear in several categories.",
    save: "Save product details",
  },
} as const;

export function ProductFieldsCard({
  draft,
  set,
  status,
  onStatusChange,
  onSave,
  saving,
}: {
  draft: ProductDraft;
  set: <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => void;
  status: string;
  onStatusChange: (status: AdminProduct["status"]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t, locale } = useI18n();
  const { data: categories } = useCategories();
  const labels = fieldLabels[locale];

  const toggleCategory = (categoryId: string) => {
    const selected = draft.category_ids.includes(categoryId);
    set(
      "category_ids",
      selected
        ? draft.category_ids.filter((id) => id !== categoryId)
        : [...draft.category_ids, categoryId],
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.products.details")}</CardTitle>
      </CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.nameAr} required>
          <Input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={120}
            dir="rtl"
          />
        </Field>
        <Field label={labels.nameFr}>
          <Input
            value={draft.name_fr}
            onChange={(e) => set("name_fr", e.target.value)}
            maxLength={120}
            dir="ltr"
          />
        </Field>
        <Field label={labels.descriptionAr}>
          <Textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            maxLength={4000}
            dir="rtl"
          />
        </Field>
        <Field label={labels.descriptionFr}>
          <Textarea
            value={draft.description_fr}
            onChange={(e) => set("description_fr", e.target.value)}
            rows={4}
            maxLength={4000}
            dir="ltr"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label={labels.categories}
            hint={
              categories && categories.length === 0
                ? t("admin.products.noCategories")
                : labels.categoriesHint
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(categories ?? []).map((category) => {
                const checked = draft.category_ids.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 text-sm transition-colors ${
                      checked
                        ? "border-primary bg-primary/5 text-on-surface"
                        : "border-outline bg-surface hover:border-primary/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(category.id)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span>{localized(locale, category.name, category.name_fr)}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        </div>

        <Field label={t("common.status")}>
          <Select
            value={status}
            onChange={(event) => onStatusChange(event.target.value as AdminProduct["status"])}
          >
            <option value="draft">{t("common.draft")}</option>
            <option value="published">{t("common.published")}</option>
            <option value="archived">{t("common.archived")}</option>
          </Select>
        </Field>

        <div className="flex justify-end sm:col-span-2">
          <Button disabled={saving || !draft.name.trim()} onClick={onSave}>
            <Save size={16} aria-hidden="true" />
            {saving ? t("common.saving") : labels.save}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
