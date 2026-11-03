import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import type { AdminVariant } from "@/lib/admin-products";
import {
  assignColourToVariants,
  attachToVariants,
  cloneVariantsForColour,
} from "@/lib/colour-photos";
import { deleteProductImage, uploadProductImage } from "@/lib/image";
import type { ImageFrame } from "@/lib/image-frame";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ColourRow, type Group } from "./colour-photo-row";
import { ImageUploadPreview } from "./image-upload-preview";

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

      const targetIds = await colourTargets(productId, variants, groups, colourName);
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
          Saisis le nom et choisis la photo. Les tailles, types, prix et stock du modèle seront
          recopiés automatiquement.
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

async function colourTargets(
  productId: string,
  variants: AdminVariant[],
  groups: Group[],
  colourName: string,
) {
  const template = [...groups].sort((a, b) => b.variants.length - a.variants.length)[0];
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

  return targetIds;
}
