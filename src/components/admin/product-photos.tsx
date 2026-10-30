import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { uploadProductImage } from "@/lib/image";
import { attachToVariants, detachFromVariants } from "@/lib/colour-photos";
import type { AdminVariant } from "@/lib/admin-products";

function productUrls(variants: AdminVariant[]): string[] {
  const urls: string[] = [];
  for (const variant of variants) {
    for (const image of [...variant.variant_images].sort((a, b) => a.sort_order - b.sort_order)) {
      if (!urls.includes(image.url)) urls.push(image.url);
    }
  }
  return urls;
}

/**
 * Elegancia sells one visual model with several bedding configurations.
 * The same gallery therefore belongs to the model, not to a mattress dimension
 * or fabric configuration. Images are attached to every variant so the current
 * OpenStore schema remains compatible with the storefront and order flow.
 */
export function ProductPhotos({
  productId,
  variants,
}: {
  productId: string;
  variants: AdminVariant[];
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const ids = variants.map((variant) => variant.id);
  const urls = productUrls(variants);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin_product", productId] });

  const addFiles = async (files: File[]) => {
    if (ids.length === 0) return;
    setUploading(true);
    let added = 0;

    for (const [index, file] of files.entries()) {
      const { url, error } = await uploadProductImage(file, productId);
      if (error || !url) {
        toast.error(`${file.name}: ${error ?? t("common.somethingWrong")}`);
        continue;
      }
      try {
        await attachToVariants(ids, url, urls.length + index);
        added += 1;
      } catch (attachError) {
        toast.error((attachError as Error).message);
      }
    }

    setUploading(false);
    if (added > 0) {
      invalidate();
      toast.success(t("admin.photos.added", { count: added }));
    }
  };

  const remove = useMutation({
    mutationFn: (url: string) => detachFromVariants(ids, url),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-on-surface">Galerie du modèle</p>
          <p className="mt-1 text-xs text-on-surface-muted">
            Ajoute ici les photos du motif. Elles seront utilisées pour toutes ses configurations.
          </p>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading || ids.length === 0}
          onClick={() => input.current?.click()}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
          {uploading ? t("admin.images.uploading") : "Ajouter des photos"}
        </Button>
      </div>

      {urls.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {urls.map((url) => (
            <span key={url} className="relative">
              <img
                src={url}
                alt=""
                className="size-24 rounded-[12px] border border-outline object-cover sm:size-28"
              />
              <button
                type="button"
                onClick={() => remove.mutate(url)}
                disabled={remove.isPending}
                aria-label={t("common.delete")}
                className="absolute -end-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-error text-white"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-outline px-4 py-7 text-center text-sm text-on-surface-muted">
          Aucune photo pour ce modèle.
        </div>
      )}
    </div>
  );
}
