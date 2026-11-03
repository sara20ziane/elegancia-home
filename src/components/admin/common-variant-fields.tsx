import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import type { AdminVariant } from "@/lib/admin-products";
import { applyCommon } from "@/lib/catalog-automation";

const labels = {
  fabric: "Tissu",
  fabric_origin: "Origine",
  set_type: "Type de parure",
  price: "Prix",
  compare_at_price: "Prix barré",
  weight_grams: "Poids (g)",
  composition: "Composition",
} as const;
type Key = keyof typeof labels;

export function CommonVariantFields({
  productId,
  variants,
}: {
  productId: string;
  variants: AdminVariant[];
}) {
  const [key, setKey] = useState<Key>("fabric");
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState(false);
  const numeric = ["price", "compare_at_price", "weight_grams"].includes(key);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      applyCommon(productId, {
        [key]: numeric ? (value === "" ? null : Number(value)) : value.trim() || null,
      }),
    onSuccess: () => {
      for (const queryKey of [["admin_product", productId], ["admin_products"], ["products"]])
        void client.invalidateQueries({ queryKey });
      setConfirm(false);
      toast.success("Valeur appliquée aux configurations existantes.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const valid =
    !numeric ||
    (value === ""
      ? key !== "price"
      : Number.isSafeInteger(Number(value)) && Number(value) >= (key === "price" ? 1 : 0));
  return (
    <details className="rounded border border-outline p-3">
      <summary className="cursor-pointer">Valeurs communes — appliquer à toutes</summary>
      <div className="my-3 grid gap-3 sm:grid-cols-2">
        <Field label="Champ à modifier">
          <Select
            value={key}
            onChange={(e) => {
              setKey(e.target.value as Key);
              setValue("");
            }}
          >
            {Object.entries(labels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nouvelle valeur">
          <Input
            type={numeric ? "number" : "text"}
            value={value}
            min={key === "price" ? 1 : 0}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      </div>
      <Button size="sm" disabled={!valid || !variants.length} onClick={() => setConfirm(true)}>
        Appliquer à toutes les configurations
      </Button>
      <Dialog
        open={confirm}
        onClose={() => !save.isPending && setConfirm(false)}
        title="Confirmer les modifications"
        footer={
          <>
            <Button variant="ghost" disabled={save.isPending} onClick={() => setConfirm(false)}>
              Annuler
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Confirmer pour {variants.length} configurations
            </Button>
          </>
        }
      >
        <p>
          {labels[key]} → {value || "vide"}. Les valeurs manuelles de {variants.length}{" "}
          configurations seront remplacées.
        </p>
        <ul className="mt-3 text-sm">
          {variants.map((variant) => (
            <li key={variant.id}>
              {variant.size} {variant.color_name} : {String(variant[key] ?? "vide")} →{" "}
              {value || "vide"}
            </li>
          ))}
        </ul>
      </Dialog>
    </details>
  );
}
