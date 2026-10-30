import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { useI18n } from "@/lib/i18n-context";
import { formatDzd } from "@/lib/format";
import { priceRange, productImage } from "@/lib/queries";
import {
  createProduct,
  deleteProduct,
  setProductStatus,
  suggestSlug,
  useAdminProductsPage,
  type AdminProduct,
} from "@/lib/admin-products";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
});

function useProductInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [["admin_products"], ["products"], ["admin_product"]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

function ProductsPage() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const products = useAdminProductsPage(page);
  const [open, setOpen] = useState(false);

  if (products.isPending) return <LoadingState />;
  if (products.isError) {
    return <ErrorState message={products.error.message} onRetry={() => void products.refetch()} />;
  }

  const list = products.data?.rows ?? [];
  const total = products.data?.total ?? 0;
  const pageCount = products.data?.pageCount ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Modèles</h1>
          <p className="mt-1 text-sm text-on-surface-muted">
            Gère les modèles Elegancia et leurs configurations de vente.
          </p>
        </div>
        <span className="flex items-center gap-3">
          <span className="font-mono text-xs text-on-surface-muted" data-testid="products-total">
            {total}
          </span>
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Nouveau modèle
          </Button>
        </span>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Aucun modèle pour le moment"
          action={<Button onClick={() => setOpen(true)}>Créer le premier modèle</Button>}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {list.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            testId="products-pagination"
          />
        </>
      )}

      <CreateProductDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function ProductRow({ product }: { product: AdminProduct }) {
  const { t, locale } = useI18n();
  const invalidate = useProductInvalidation();

  const image = productImage(product as never);
  const range = priceRange(product as never);
  const configurations = product.product_variants.length;
  const stock = product.product_variants.reduce((sum, variant) => sum + variant.stock, 0);

  const toggle = useMutation({
    mutationFn: () =>
      setProductStatus(
        product.id,
        product.status === "published" ? "draft" : "published",
        Boolean(product.published_at),
      ),
    onSuccess: invalidate,
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteProduct(product.id),
    onSuccess: invalidate,
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const statusLabel =
    product.status === "published"
      ? t("common.published")
      : product.status === "archived"
        ? t("common.archived")
        : t("common.draft");

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-[16px] border border-outline bg-surface p-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-[10px] bg-surface-high">
        {image ? (
          <img src={image} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="grid size-full place-items-center text-on-surface-muted">
            <ImageOff size={18} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/product/$id"
            params={{ id: product.id }}
            className="font-medium hover:text-primary"
          >
            {product.name}
          </Link>
          <Badge tone={product.status === "published" ? "positive" : "neutral"}>
            {statusLabel}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-on-surface-muted">
          {configurations} configuration{configurations === 1 ? "" : "s"} · Stock total {stock}
          {range ? ` · À partir de ${formatDzd(range.min, locale)}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={toggle.isPending || configurations === 0}
          onClick={() => toggle.mutate()}
        >
          {product.status === "published" ? "Dépublier" : "Publier"}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/product/$id" params={{ id: product.id }}>
            {t("common.edit")}
          </Link>
        </Button>
        <button
          type="button"
          onClick={() => remove.mutate()}
          aria-label={`${t("common.delete")} ${product.name}`}
          className="text-on-surface-muted hover:text-error"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function CreateProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const invalidate = useProductInvalidation();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const cleanName = name.trim();
      return createProduct({ name: cleanName, slug: suggestSlug(cleanName), kind: "single" });
    },
    onSuccess: (id) => {
      invalidate();
      onClose();
      setName("");
      toast.success("Modèle créé");
      void navigate({ to: "/admin/product/$id", params: { id } });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nouveau modèle Elegancia"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Création…" : "Créer le modèle"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nom du modèle" hint="Ex. Aveline, Velina, Sunny" required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            autoFocus
            placeholder="Aveline"
          />
        </Field>
        <p className="text-xs leading-5 text-on-surface-muted">
          Après création, tu pourras ajouter les photos, la catégorie et toutes les configurations
          de tissu, pièces, dimensions, prix et stock.
        </p>
      </div>
    </Dialog>
  );
}
