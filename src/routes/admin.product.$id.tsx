import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { ColourPhotos } from "@/components/admin/colour-photos";
import { VariantEditor } from "@/components/admin/variant-editor";
import { ProductPhotos } from "@/components/admin/product-photos";
import { ProductFieldsCard, type ProductDraft } from "@/components/admin/product-fields";
import { PackBuilder } from "@/components/admin/pack-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { useI18n } from "@/lib/i18n-context";
import { setProductCategories, updateProduct, useAdminProduct } from "@/lib/admin-products";
import { useProductPicker } from "@/lib/product-picker";

export const Route = createFileRoute("/admin/product/$id")({
  component: ProductEditPage,
});

type Patch = Parameters<typeof updateProduct>[1];

function ProductEditPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: product, isPending } = useAdminProduct(id);
  const { data: allProducts } = useProductPicker();
  const allVariants = (allProducts ?? []).flatMap((p) => p.product_variants);

  const [draft, setDraft] = useState<ProductDraft | null>(null);

  useEffect(() => {
    if (product && !draft) {
      const linkedCategories = product.product_categories.map((link) => link.category_id);
      setDraft({
        name: product.name,
        name_fr: product.name_fr ?? "",
        description: product.description ?? "",
        description_fr: product.description_fr ?? "",
        category_ids:
          linkedCategories.length > 0
            ? linkedCategories
            : product.category_id
              ? [product.category_id]
              : [],
      });
    }
  }, [product, draft]);

  const invalidate = () => {
    for (const key of [
      ["admin_product", id],
      ["admin_products"],
      ["product", product?.slug],
      ["products"],
      ["categories"],
      ["admin_categories"],
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const save = useMutation({
    mutationFn: (patch: Patch) => updateProduct(id, patch),
    onSuccess: () => {
      invalidate();
      toast.success(t("common.save"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveDetails = useMutation({
    mutationFn: async (values: ProductDraft) => {
      const normalized: ProductDraft = {
        name: values.name.trim(),
        name_fr: values.name_fr.trim(),
        description: values.description.trim(),
        description_fr: values.description_fr.trim(),
        category_ids: [...values.category_ids],
      };

      await updateProduct(id, {
        name: normalized.name,
        name_fr: normalized.name_fr || null,
        description: normalized.description || null,
        description_fr: normalized.description_fr || null,
      });
      await setProductCategories(id, normalized.category_ids);
      return normalized;
    },
    onSuccess: (savedDraft) => {
      setDraft(savedDraft);
      invalidate();
      toast.success("Informations du modèle enregistrées");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending) return <LoadingState />;
  if (!product) return <EmptyState title={t("order.notFound")} />;
  if (!draft) return <LoadingState />;

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const publishable = product.product_variants.length > 0;
  const published = product.status === "published";
  const busy = save.isPending || saveDetails.isPending;
  const hasColours = product.product_variants.some((variant) => Boolean(variant.color_name?.trim()));

  const togglePublish = () =>
    save.mutate({
      status: published ? "draft" : "published",
      ...(published || product.published_at ? {} : { published_at: new Date().toISOString() }),
    });

  const saveFields = () => saveDetails.mutate(draft);

  return (
    <div className="flex flex-col gap-6">
      <ProductHeader
        name={product.name}
        slug={product.slug}
        published={published}
        publishable={publishable}
        busy={busy}
        onTogglePublish={togglePublish}
        onSaveFields={saveFields}
      />

      {!publishable && (
        <p className="rounded-[10px] border border-tertiary/40 bg-tertiary/5 px-4 py-3 text-sm">
          Ajoute au moins une configuration de vente avant de publier ce modèle.
        </p>
      )}

      <ProductFieldsCard
        draft={draft}
        set={set}
        status={product.status}
        onStatusChange={(status) => save.mutate({ status })}
        onSave={saveFields}
        saving={saveDetails.isPending}
      />

      <Card>
        <CardHeader>
          <CardTitle>Configurations de vente</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-muted">
            Une configuration correspond à une combinaison vendable : tissu, type de parure,
            nombre de pièces, dimension du matelas, prix et stock.
          </p>
          <VariantEditor productId={id} variants={product.product_variants} />
        </CardBody>
      </Card>

      {product.product_variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Photos et couleurs</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <ColourPhotos productId={id} variants={product.product_variants} />

            {!hasColours && (
              <div className="border-t border-outline pt-5">
                <ProductPhotos productId={id} variants={product.product_variants} />
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {product.kind === "pack" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.products.packContents")}</CardTitle>
          </CardHeader>
          <CardBody>
            <PackBuilder productId={id} variants={allVariants} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function ProductHeader({
  name,
  slug,
  published,
  publishable,
  busy,
  onTogglePublish,
  onSaveFields,
}: {
  name: string;
  slug: string;
  published: boolean;
  publishable: boolean;
  busy: boolean;
  onTogglePublish: () => void;
  onSaveFields: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/products"
          className="btn btn-ghost btn-icon !rounded-full !border !border-outline"
          aria-label={t("common.back")}
        >
          <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-semibold">{name}</h1>
          <p className="font-mono text-xs text-on-surface-muted" dir="ltr">
            /product/{slug}
          </p>
        </div>
        <Badge tone={published ? "positive" : "neutral"}>
          {published ? t("common.published") : t("common.draft")}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={!publishable || busy}
          title={publishable ? undefined : "Ajoute une configuration avant de publier"}
          onClick={onTogglePublish}
        >
          {published ? t("admin.products.unpublish") : t("admin.products.publish")}
        </Button>
        <Button disabled={busy} onClick={onSaveFields}>
          <Save size={16} aria-hidden="true" />
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
