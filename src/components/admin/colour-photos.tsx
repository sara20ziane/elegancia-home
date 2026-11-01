import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ImageUploadPreview } from "./image-upload-preview";
import type { ImageFrame } from "@/lib/image-frame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { deleteProductImage, uploadProductImage } from "@/lib/image";
import {
  assignColourToVariants,
  attachToVariants,
  cloneVariantsForColour,
  detachFromVariants,
} from "@/lib/colour-photos";
import type { AdminVariant } from "@/lib/admin-products";

type Group = {
  colour: string | null;
  hex: string | null;
  variants: AdminVariant[];
  urls: string[];
};

/** Variants by colour, each with its photos de-duplicated across sizes. */
function groupByColour(variants: AdminVariant[]): Group[] {
  const groups = new Map<string, Group>();
  for (const variant of variants) {
    const key = variant.color_name?.trim() ?? "";
    const group = groups.get(key) ?? {
      colour: variant.color_name?.trim() || null,
      hex: variant.color_hex,
      variants: [],
      urls: [],
    };
    group.variants.push(variant);
    for (const image of [...variant.variant_images].sort((a, b) => a.sort_order - b.sort_order)) {
      if (!group.urls.includes(image.url)) group.urls.push(image.url);
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Generic colour manager for every product.
 *
 * The owner enters only a colour name and a photo. The first colour is applied
 * to the existing commercial matrix; following colours clone the most complete
 * existing matrix automatically. No GitHub or manual variant duplication is
 * needed for ordinary catalogue work.
 */
export function ColourPhotos({
  productId,
  variants,
}: {
  productId: string;
  variants: AdminVariant[];
}) {
  const groups = groupByColour(variants);
  const colouredGroups = groups.filter((group) => Boolean(group.colour));

  return (
    <div className="flex flex-col gap-4">
      <NewColour productId={productId} variants={variants} groups={colouredGroups} />

      {colouredGroups.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-on-surface">Couleurs du modèle</p>
            <p className="mt-1 text-xs text-on-surface-muted">
              Chaque photo est partagée automatiquement entre toutes les tailles de la même couleur.
            </p>
          </div>
          {colouredGroups.map((group) => (
            <ColourRow key={group.colour ?? ""} productId={productId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewColour({
  productId,
  variants,
  groups,
}: {
  productId: string;
  variants: AdminVariant[];
  groups: Group[];
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin_product", productId] });
    void queryClient.invalidateQueries({ queryKey: ["admin_products"] });
  };

  const existingNames = new Set(groups.map((group) => group.colour?.toLocaleLowerCase() ?? ""));
  const template = [...groups].sort((a, b) => b.variants.length - a.variants.length)[0];

  const create = async (frame?: ImageFrame) => {
    const colourName = name.trim();
    if (!colourName) {
      toast.error("Indique le nom de la couleur.");
      throw new Error("Missing colour name");
    }
    if (!file) {
      toast.error("Choisis une photo pour cette couleur.");
      throw new Error("Missing colour photo");
    }
    if (existingNames.has(colourName.toLocaleLowerCase())) {
      toast.error("Cette couleur existe déjà sur ce modèle.");
      throw new Error("Duplicate colour");
    }
    if (variants.length === 0) {
      toast.error("Ajoute d’abord au moins une configuration de vente.");
      throw new Error("No variant template");
    }

    setBusy(true);
    let uploadedUrl: string | null = null;
    try {
      const uploaded = await uploadProductImage(file, productId, frame);
      if (uploaded.error || !uploaded.url) {
        throw new Error(uploaded.error ?? "Impossible d’envoyer la photo.");
      }
      uploadedUrl = uploaded.url;

      let targetIds: string[];
      if (groups.length === 0) {
        targetIds = variants.map((variant) => variant.id);
        await assignColourToVariants(targetIds, colourName);
      } else {
        targetIds = await cloneVariantsForColour(
          productId,
          template.variants.map((variant) => variant.id),
          colourName,
        );
      }

      await attachToVariants(targetIds, uploadedUrl, -1);
      setName("");
      setFile(null);
      invalidate();
      toast.success(`${colourName} ajoutée avec sa photo`);
    } catch (error) {
      if (uploadedUrl) await deleteProductImage(uploadedUrl);
      const message = error instanceof Error ? error.message : "Impossible d’ajouter la couleur.";
      toast.error(message);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-primary/30 bg-primary/5 p-4">
      <div>
        <p className="flex items-center gap-2 font-medium text-on-surface">
          <Plus size={16} aria-hidden="true" />
          Ajouter une couleur
        </p>
        <p className="mt-1 text-xs text-on-surface-muted">
          Saisis le nom et choisis la photo. Les tailles, types, prix et stock du modèle seront recopiés automatiquement.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Nom de la couleur" required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex. Terracotta, bleu nuit…"
            maxLength={60}
            disabled={busy}
          />
        </Field>

        <div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
            {file ? "Changer la photo" : "Choisir la photo"}
          </Button>
        </div>
      </div>

      {file && (
        <ImageUploadPreview
          key={`${file.name}-${file.lastModified}`}
          file={file}
          onCancel={() => setFile(null)}
          onUpload={create}
        />
      )}
    </section>
  );
}

function ColourRow({ productId, group }: { productId: string; group: Group }) {
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
