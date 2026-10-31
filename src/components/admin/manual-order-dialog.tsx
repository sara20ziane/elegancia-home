import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AddressFields,
  EMPTY_CHECKOUT_FORM,
  type CheckoutForm,
} from "@/components/storefront/checkout-panels";
import { DeliveryChoice } from "@/components/storefront/delivery-choice";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/form";
import { invalidateAdminOrders } from "@/lib/admin-order-events";
import { pickupFee, resolveDelivery, useDeliveryZones } from "@/lib/delivery";
import { formatDzd } from "@/lib/format";
import { useI18n } from "@/lib/i18n-context";
import {
  MANUAL_ORDER_SOURCES,
  orderSourceLabel,
  placeManualOrder,
  type ManualOrderSource,
  type ManualOrderVariant,
  useManualOrderCatalog,
} from "@/lib/manual-order";
import { useStoreSettings } from "@/lib/queries";

type ManualLine = { variantId: string; quantity: number };

function variantLabel(variant: ManualOrderVariant) {
  return [variant.productName, variant.setType, variant.size, variant.colorName]
    .filter(Boolean)
    .join(" · ");
}

function isParure(variant: ManualOrderVariant) {
  return variant.setType === "Parure de drap" || variant.setType === "Parure housse de couette";
}

export function ManualOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const catalog = useManualOrderCatalog();
  const { data: settings } = useStoreSettings();
  const { data: zones } = useDeliveryZones();

  const [form, setForm] = useState<CheckoutForm>(EMPTY_CHECKOUT_FORM);
  const [source, setSource] = useState<ManualOrderSource>("instagram");
  const [confirmed, setConfirmed] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variants = catalog.data ?? [];
  const variantById = useMemo(() => new Map(variants.map((variant) => [variant.id, variant])), [variants]);
  const selectedLines = lines
    .map((line) => ({ ...line, variant: variantById.get(line.variantId) }))
    .filter((line): line is ManualLine & { variant: ManualOrderVariant } => Boolean(line.variant));

  const subtotal = selectedLines.reduce(
    (sum, line) => sum + line.variant.price * line.quantity,
    0,
  );
  const parureQuantity = selectedLines.reduce(
    (sum, line) => sum + (isParure(line.variant) ? line.quantity : 0),
    0,
  );
  const delivery = resolveDelivery(
    settings ?? null,
    zones ?? [],
    form.wilaya || null,
    subtotal,
    form.delivery_method,
    parureQuantity,
  );
  const homeDelivery = resolveDelivery(
    settings ?? null,
    zones ?? [],
    form.wilaya || null,
    subtotal,
    "home",
    parureQuantity,
  );
  const stopdeskFee = pickupFee(zones ?? [], form.wilaya || null, parureQuantity);
  const deliveryAvailable = Boolean(form.wilaya && delivery.available);
  const total = subtotal + (deliveryAvailable ? delivery.fee : 0);

  const reset = () => {
    setForm(EMPTY_CHECKOUT_FORM);
    setSource("instagram");
    setConfirmed(false);
    setSelectedVariantId("");
    setLines([]);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const addVariant = () => {
    const variant = variantById.get(selectedVariantId);
    if (!variant || variant.stock < 1) return;
    setLines((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      if (!existing) return [...current, { variantId: variant.id, quantity: 1 }];
      if (existing.quantity >= variant.stock) return current;
      return current.map((line) =>
        line.variantId === variant.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
    setSelectedVariantId("");
  };

  const changeQuantity = (variant: ManualOrderVariant, delta: number) => {
    setLines((current) =>
      current
        .map((line) =>
          line.variantId === variant.id
            ? { ...line, quantity: Math.max(0, Math.min(variant.stock, line.quantity + delta)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (selectedLines.length === 0) {
      setError("Ajoute au moins un article à la commande.");
      return;
    }
    if (!form.wilaya || !form.commune.trim() || !deliveryAvailable) {
      setError("Vérifie la wilaya, la commune et le tarif Packers.");
      return;
    }
    if (form.delivery_method === "stopdesk" && !form.stopdesk_name) {
      setError("Le Stop Desk n’est pas disponible pour cette commune.");
      return;
    }

    setSubmitting(true);
    try {
      await placeManualOrder(
        {
          customer_name: form.customer_name,
          phone: form.phone,
          wilaya: form.wilaya,
          commune: form.commune.trim(),
          address: form.address,
          note: form.note || null,
          delivery_method: form.delivery_method,
          stopdesk_id: null,
          stopdesk_name: form.stopdesk_name || null,
        },
        selectedLines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
        source,
        confirmed,
      );

      invalidateAdminOrders(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["manual_order_catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["admin_low_stock"] });
      toast.success(confirmed ? "Commande manuelle créée et confirmée." : "Commande manuelle créée.");
      reset();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de créer la commande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Nouvelle commande manuelle"
      description="Pour une commande reçue sur Instagram, Facebook, WhatsApp ou par téléphone."
      className="w-[min(96vw,58rem)]"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="manual-order-form"
            disabled={submitting || selectedLines.length === 0 || !deliveryAvailable}
          >
            {submitting ? "Création…" : "Créer la commande"}
          </Button>
        </>
      }
    >
      <form id="manual-order-form" onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source de la commande" required>
            <Select
              value={source}
              onChange={(event) => setSource(event.target.value as ManualOrderSource)}
              required
            >
              {MANUAL_ORDER_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {orderSourceLabel(value)}
                </option>
              ))}
            </Select>
          </Field>

          <label className="flex items-center gap-3 self-end rounded-[12px] border border-outline px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="size-4 accent-[var(--primary-solid)]"
            />
            <span>
              <span className="block font-medium">Cliente déjà confirmée</span>
              <span className="block text-xs text-on-surface-muted">
                Passe directement la commande au statut Confirmée.
              </span>
            </span>
          </label>
        </div>

        <AddressFields form={form} onChange={setForm} />

        <section className="flex flex-col gap-3 rounded-[16px] border border-outline bg-surface p-5">
          <div>
            <h3 className="font-display text-lg font-semibold">Articles</h3>
            <p className="text-xs text-on-surface-muted">
              Les prix et le stock viennent directement du catalogue Elegancia Home.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={selectedVariantId}
              onChange={(event) => setSelectedVariantId(event.target.value)}
              disabled={catalog.isPending}
              className="flex-1"
              aria-label="Configuration à ajouter"
            >
              <option value="">
                {catalog.isPending ? "Chargement du catalogue…" : "Choisir un produit / une configuration"}
              </option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id} disabled={variant.stock < 1}>
                  {variantLabel(variant)} — {formatDzd(variant.price, locale)} — stock {variant.stock}
                </option>
              ))}
            </Select>
            <Button type="button" variant="secondary" onClick={addVariant} disabled={!selectedVariantId}>
              <Plus size={16} aria-hidden="true" />
              Ajouter
            </Button>
          </div>

          {catalog.isError && (
            <p className="text-sm text-error" role="alert">
              Impossible de charger le catalogue : {catalog.error.message}
            </p>
          )}

          {selectedLines.length === 0 ? (
            <p className="rounded-[10px] bg-surface-mid px-3 py-3 text-sm text-on-surface-muted">
              Aucun article ajouté.
            </p>
          ) : (
            <ul className="divide-y divide-outline rounded-[12px] border border-outline">
              {selectedLines.map((line) => (
                <li key={line.variantId} className="flex flex-wrap items-center gap-3 px-3 py-3">
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-sm font-medium">{variantLabel(line.variant)}</p>
                    <p className="text-xs text-on-surface-muted">
                      {formatDzd(line.variant.price, locale)} · stock disponible {line.variant.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => changeQuantity(line.variant, -1)}
                      aria-label="Retirer une unité"
                    >
                      <Minus size={14} aria-hidden="true" />
                    </Button>
                    <span className="w-8 text-center font-mono text-sm">{line.quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={line.quantity >= line.variant.stock}
                      onClick={() => changeQuantity(line.variant, 1)}
                      aria-label="Ajouter une unité"
                    >
                      <Plus size={14} aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLines((current) => current.filter((item) => item.variantId !== line.variantId))}
                      aria-label="Supprimer cet article"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                  <span className="w-28 text-end font-mono text-sm" dir="ltr">
                    {formatDzd(line.variant.price * line.quantity, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <DeliveryChoice
            wilaya={form.wilaya}
            commune={form.commune}
            homeFee={homeDelivery.fee}
            pickupFee={stopdeskFee}
            method={form.delivery_method}
            stopdeskName={form.stopdesk_name}
            onChange={({ method, stopdeskName }) =>
              setForm({
                ...form,
                delivery_method: method,
                stopdesk_id: "",
                stopdesk_name: stopdeskName,
              })
            }
          />

          <dl className="flex flex-col gap-2 self-start rounded-[14px] border border-outline bg-surface-mid p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-on-surface-muted">Sous-total</dt>
              <dd className="font-mono" dir="ltr">{formatDzd(subtotal, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-muted">Livraison</dt>
              <dd className="font-mono" dir="ltr">
                {!form.wilaya
                  ? "—"
                  : deliveryAvailable
                    ? formatDzd(delivery.fee, locale)
                    : "Indisponible"}
              </dd>
            </div>
            <div className="flex justify-between border-t border-outline pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="font-mono text-primary" dir="ltr">{formatDzd(total, locale)}</dd>
            </div>
          </dl>
        </section>

        {error && (
          <p className="rounded-[10px] bg-error/10 px-3 py-2 text-sm text-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
