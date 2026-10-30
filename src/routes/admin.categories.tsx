import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CategoryRow } from "@/components/admin/category-row";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import {
  ADMIN_CATEGORIES_KEY,
  createCategory,
  deleteCategory,
  updateCategory,
  useAdminCategories,
  type AdminCategory,
} from "@/lib/admin-categories";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesPage,
});

const ELEGANCIA_PRESETS = [
  { fr: "Parure de drap", ar: "أطقم الشراشف" },
  { fr: "Parure housse de couette", ar: "أطقم أغطية اللحاف" },
  { fr: "Plaid", ar: "بطانيات خفيفة" },
  { fr: "Taies d’oreillers", ar: "أغطية الوسائد" },
  { fr: "Jetées", ar: "مفارش السرير" },
] as const;

const COPY = {
  fr: {
    title: "Catégories de la boutique",
    intro:
      "Organise les modèles Elegancia comme les clientes les cherchent. Un même modèle peut appartenir à plusieurs catégories.",
    createTitle: "Ajouter une catégorie",
    arabic: "Nom arabe",
    french: "Nom français",
    frenchHint: "Utilisé dans la version française de la boutique.",
    add: "Ajouter",
    suggestions: "Suggestions Elegancia",
    suggestionsBody:
      "Clique sur une suggestion pour préremplir les deux noms. Rien n’est créé tant que tu n’appuies pas sur Ajouter.",
    alreadyAdded: "Déjà ajoutée",
    empty: "Aucune catégorie pour le moment.",
  },
  en: {
    title: "Store categories",
    intro:
      "Organise Elegancia models the way customers browse them. One model can belong to several categories.",
    createTitle: "Add a category",
    arabic: "Arabic name",
    french: "French name",
    frenchHint: "Used in the French version of the store.",
    add: "Add",
    suggestions: "Elegancia suggestions",
    suggestionsBody:
      "Choose a suggestion to prefill both names. Nothing is created until you press Add.",
    alreadyAdded: "Already added",
    empty: "No categories yet.",
  },
  ar: {
    title: "فئات المتجر",
    intro:
      "رتّبي موديلات Elegancia حسب طريقة بحث الزبونات. يمكن أن ينتمي نفس الموديل إلى أكثر من فئة.",
    createTitle: "إضافة فئة",
    arabic: "الاسم بالعربية",
    french: "الاسم بالفرنسية",
    frenchHint: "يظهر في النسخة الفرنسية من المتجر.",
    add: "إضافة",
    suggestions: "اقتراحات Elegancia",
    suggestionsBody:
      "اختاري اقتراحاً لملء الاسمين تلقائياً. لن يتم إنشاء شيء حتى تضغطي على إضافة.",
    alreadyAdded: "مضافة بالفعل",
    empty: "لا توجد فئات بعد.",
  },
} as const;

function normalise(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function CategoriesPage() {
  const { locale } = useI18n();
  const c = COPY[locale] ?? COPY.fr;
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useAdminCategories();
  const [name, setName] = useState("");
  const [nameFr, setNameFr] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_CATEGORIES_KEY });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };
  const onError = (mutationError: Error) => toast.error(mutationError.message);

  const create = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      invalidate();
      setName("");
      setNameFr("");
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateCategory>[1] }) =>
      updateCategory(id, patch),
    onSuccess: invalidate,
    onError,
  });
  const remove = useMutation({ mutationFn: deleteCategory, onSuccess: invalidate, onError });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={error.message} onRetry={() => void refetch()} />;

  const list = data ?? [];
  const busy = create.isPending || update.isPending || remove.isPending;

  const move = (index: number, direction: -1 | 1) => {
    const neighbour = list[index + direction];
    if (!neighbour) return;
    list.forEach((category, position) => {
      const target =
        position === index ? index + direction : position === index + direction ? index : position;
      if (category.sort_order !== target) {
        update.mutate({ id: category.id, patch: { sort_order: target } });
      }
    });
  };

  const confirmDelete = (category: AdminCategory) => {
    const message =
      locale === "ar"
        ? `هذه الفئة مرتبطة بـ ${category.product_count} موديل. حذفها سيزيل هذه الفئة فقط من الموديلات المرتبطة بها. متابعة؟`
        : locale === "en"
          ? `This category is linked to ${category.product_count} model(s). Deleting it only removes this category from those models. Continue?`
          : `Cette catégorie est liée à ${category.product_count} modèle(s). Sa suppression retirera seulement cette catégorie de ces modèles. Continuer ?`;
    if (category.product_count === 0 || window.confirm(message)) remove.mutate(category.id);
  };

  const exists = (preset: (typeof ELEGANCIA_PRESETS)[number]) =>
    list.some(
      (category) =>
        normalise(category.name) === normalise(preset.ar) ||
        normalise(category.name_fr) === normalise(preset.fr),
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">{c.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-on-surface-muted">{c.intro}</p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-5">
          <div>
            <h2 className="font-display text-lg font-semibold">{c.createTitle}</h2>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate({
                name: name.trim(),
                name_fr: nameFr.trim() || null,
                sort_order: list.length,
              });
            }}
          >
            <Field label={c.arabic} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                dir="rtl"
                required
                minLength={2}
                placeholder="مثال: أطقم الشراشف"
              />
            </Field>
            <Field label={c.french} hint={c.frenchHint}>
              <Input
                value={nameFr}
                onChange={(e) => setNameFr(e.target.value)}
                dir="ltr"
                placeholder="Ex. Parure de drap"
              />
            </Field>
            <Button type="submit" disabled={busy || name.trim().length < 2}>
              <Plus size={16} aria-hidden="true" />
              {c.add}
            </Button>
          </form>

          <div className="border-t border-outline pt-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" aria-hidden="true" />
              <h3 className="font-semibold">{c.suggestions}</h3>
            </div>
            <p className="mt-1 text-xs text-on-surface-muted">{c.suggestionsBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ELEGANCIA_PRESETS.map((preset) => {
                const added = exists(preset);
                return (
                  <button
                    key={preset.fr}
                    type="button"
                    disabled={added || busy}
                    onClick={() => {
                      setName(preset.ar);
                      setNameFr(preset.fr);
                    }}
                    className="rounded-full border border-outline bg-surface px-3 py-2 text-start text-xs transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-default disabled:opacity-45"
                  >
                    <span className="font-medium">{preset.fr}</span>
                    <span className="mx-1.5 text-outline-strong">·</span>
                    <span dir="rtl">{preset.ar}</span>
                    {added && <span className="ms-2 text-positive">✓ {c.alreadyAdded}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      {list.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((category, index) => (
            <CategoryRow
              key={`${category.id}-${category.name}-${category.name_fr ?? ""}`}
              category={category}
              position={index + 1}
              first={index === 0}
              last={index === list.length - 1}
              busy={busy}
              onRename={(newName, newNameFr) =>
                update.mutate({ id: category.id, patch: { name: newName, name_fr: newNameFr } })
              }
              onToggle={() =>
                update.mutate({ id: category.id, patch: { is_active: !category.is_active } })
              }
              onMove={(direction) => move(index, direction)}
              onDelete={() => confirmDelete(category)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
