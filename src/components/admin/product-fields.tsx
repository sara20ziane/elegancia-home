import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n-context";
import { localized } from "@/lib/i18n";
import { useCategories } from "@/lib/queries";
import type { AdminProduct } from "@/lib/admin-products";

/** The editable text fields of a product. */
export type ProductDraft = {
  name: string;
  name_fr: string;
  description: string;
  description_fr: string;
  category_id: string;
};

const fieldLabels = {
  fr: {
    nameAr: "Nom en arabe",
    nameFr: "Nom en français",
    descriptionAr: "Description en arabe",
    descriptionFr: "Description en français",
  },
  ar: {
    nameAr: "الاسم بالعربية",
    nameFr: "الاسم بالفرنسية",
    descriptionAr: "الوصف بالعربية",
    descriptionFr: "الوصف بالفرنسية",
  },
  en: {
    nameAr: "Name in Arabic",
    nameFr: "Name in French",
    descriptionAr: "Description in Arabic",
    descriptionFr: "Description in French",
  },
} as const;

export function ProductFieldsCard({
  draft,
  set,
  status,
  onStatusChange,
}: {
  draft: ProductDraft;
  set: <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => void;
  status: string;
  onStatusChange: (status: AdminProduct["status"]) => void;
}) {
  const { t, locale } = useI18n();
  const { data: categories } = useCategories();
  const labels = fieldLabels[locale];

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

        <Field
          label={t("common.category")}
          hint={
            categories && categories.length === 0 ? t("admin.products.noCategories") : undefined
          }
        >
          <Select
            value={draft.category_id}
            onChange={(event) => set("category_id", event.target.value)}
          >
            <option value="">{t("common.none")}</option>
            {(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {localized(locale, category.name, category.name_fr)}
              </option>
            ))}
          </Select>
        </Field>

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
      </CardBody>
    </Card>
  );
}
