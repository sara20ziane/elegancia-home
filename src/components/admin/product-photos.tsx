import { ImageUploadPreview } from "./image-upload-preview";
import { ColourPhotos } from "./colour-photos";
import type { ImageFrame } from "@/lib/image-frame";
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
 * Multi-colour bedding models are edited colour by colour so the owner can
 * upload the correct photo directly from a phone. Products without colour
 * variants keep the simpler model-level gallery.
 */
export function ProductPhotos({
  productId,
  variants,
}: {
  productId: string;
  variants: AdminVariant[];
}) {
  const colours = new Set(
    variants.map((variant) => variant.color_name?.trim()).filter((colour): colour is string => Boolean(colour)),
  );

  if (colours.size > 0) {
    return <ColourPhotos productId={productId} variants={variants} />;
  }

  return <SharedProductPhotos productId={productId} variants={variants} />;
}

function SharedProductPhotos({
  productId,
  variants,
}: {
  productId: string;
  variants: AdminVariant[];
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const ids = variants.map((variant) => variant.id);
  const urls = productUrls(variants);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin_product", productId] });

  const addFiles = async (files: File[], frame?: ImageFrame) => {
    if (ids.length === 0) return false;
    setUploading(true);
    let added = 0;

    for (const [index, file] of files.entries()) {
      try {
        const { url, error } = await uploadProductImage(file, productId, frame);
        if (error || !url) {
          toast.error(`${file.name}: ${error ?? t("common.somethingWrong")}`);
          continue;
        }
        await attachToVariants(ids, url, urls.length + index);
        added += 1;
      } catch (attachError) {
        toast.error(
          attachError instanceof Error ? attachError.message : t("common.somethingWrong"),
        );
      }
    }

    setUploading(false);
    if (added > 0) {
      invalidate();
      toast.success(t("admin.photos.added", { count: added }));
    }
    return added > 0;
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
            setPendingFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading || pendingFiles.length > 0 || ids.length === 0}
          onClick={() => input.current?.click()}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
          {uploading ? t("admin.images.uploading") : "Ajouter des photos"}
        </Button>
      </div>

      {pendingFiles[0] && (
        <ImageUploadPreview
          key={pendingFiles[0].name}
          file={pendingFiles[0]}
          onCancel={() => setPendingFiles([])}
          onUpload={async (frame) => {
            if (await addFiles([pendingFiles[0]], frame))
              setPendingFiles((files) => files.slice(1));
          }}
        />
      )}
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
