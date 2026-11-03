import { AddressFields } from "@/components/storefront/checkout-panels";
import { DeliveryChoice } from "@/components/storefront/delivery-choice";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/form";
import { formatDzd } from "@/lib/format";
import { MANUAL_ORDER_SOURCES, orderSourceLabel, type ManualOrderSource } from "@/lib/manual-order";
import { ManualOrderItems } from "./manual-order-items";
import { useManualOrderState } from "./manual-order-state";
import { manualOrderSubmit } from "./manual-order-submit";

export function ManualOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useManualOrderState(onClose);
  const {
    form,
    setForm,
    source,
    setSource,
    confirmed,
    setConfirmed,
    submitting,
    error,
    selectedLines,
    deliveryAvailable,
    close,
    homeDelivery,
    stopdeskFee,
  } = state;
  const submit = manualOrderSubmit(state, onClose);
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

        <ManualOrderItems state={state} />
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

          <ManualOrderTotals state={state} />
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

function ManualOrderTotals({ state }: { state: ReturnType<typeof useManualOrderState> }) {
  const { locale, subtotal, total, form, deliveryAvailable, delivery } = state;
  return (
    <dl className="flex flex-col gap-2 self-start rounded-[14px] border border-outline bg-surface-mid p-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-on-surface-muted">Sous-total</dt>
        <dd className="font-mono" dir="ltr">
          {formatDzd(subtotal, locale)}
        </dd>
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
        <dd className="font-mono text-primary" dir="ltr">
          {formatDzd(total, locale)}
        </dd>
      </div>
    </dl>
  );
}
