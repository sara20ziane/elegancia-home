import { Button } from "@/components/ui/button";
import type { AdminVariant } from "@/lib/admin-products";
import { attachToVariants, detachFromVariants } from "@/lib/colour-photos";
import { useI18n } from "@/lib/i18n-context";
import { deleteProductImage, uploadProductImage } from "@/lib/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export type Group = {
  colour: string | null;
  hex: string | null;
  variants: AdminVariant[];
  urls: string[];
};

export function ColourRow({ productId, group }: { productId: string; group: Group }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const ids = group.variants.map((v) => v.id);
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin_product", productId] });

  // One file at a time: mobile uplinks dislike parallel uploads, and one bad
  // photo must not cost the owner the other four.
  const addFiles = async (files: File[]) => {
    setUploading(true);
    let added = 0;
    for (const [index, file] of files.entries()) {
      const { url, error } = await uploadProductImage(file, productId);
      if (error || !url) {
        toast.error(`${file.name}: ${error ?? t("common.somethingWrong")}`);
        continue;
      }
      try {
        await attachToVariants(ids, url, group.urls.length + index);
        added += 1;
      } catch (attachError) {
        await deleteProductImage(url);
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
    <section className="flex flex-col gap-2 rounded-[12px] border border-outline p-3">
      <div className="flex flex-wrap items-center gap-2">
        {group.hex && (
          <span
            className="size-4 rounded-full border border-outline"
            style={{ background: group.hex }}
          />
        )}
        <span className="font-medium">{group.colour}</span>
        <span className="font-mono text-xs text-on-surface-muted">
          {group.variants.length} configuration{group.variants.length > 1 ? "s" : ""}
        </span>
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
          className="ms-auto"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
          {uploading ? t("admin.images.uploading") : "Ajouter une photo"}
        </Button>
      </div>
      {group.urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {group.urls.map((url) => (
            <span key={url} className="relative">
              <img
                src={url}
                alt={group.colour ?? ""}
                className="size-16 rounded-[10px] border border-outline object-cover"
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
      )}
    </section>
  );
}
