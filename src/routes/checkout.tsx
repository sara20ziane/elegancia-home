import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Gift } from "lucide-react";
import { StoreLayout } from "@/components/storefront/store-layout";
import {
  AddressFields,
  CheckoutSummary,
  CodNotice,
  EMPTY_CHECKOUT_FORM,
  type CheckoutForm,
} from "@/components/storefront/checkout-panels";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { useCart } from "@/lib/cart";
import { translate } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-context";
import { useCheckoutQuote } from "@/lib/use-checkout-quote";
import { DeliveryChoice } from "@/components/storefront/delivery-choice";
import { isDemoShop } from "@/components/storefront/demo-banner";
import { OrderPlaced } from "@/components/orders/order-placed";
import { useCheckoutOrder } from "@/lib/use-checkout-order";

export const Route = createFileRoute("/checkout")({
  head: ({ match }) => ({ meta: [{ title: translate(match.context.locale, "checkout.title") }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useI18n();
  const cart = useCart();

  const [form, setForm] = useState<CheckoutForm>(EMPTY_CHECKOUT_FORM);
  const { settings, delivery, homeDelivery, pickup, parureQuantity } = useCheckoutQuote(
    form,
    cart.items,
  );
  const deliveryAvailable = !form.wilaya || delivery.available;

  const { submitting, error, placed, submit } = useCheckoutOrder(form, cart, delivery.available);
  if (placed)
    return <OrderPlaced token={placed.token} phone={form.phone} createdAt={placed.createdAt} />;
  if (settings && !settings.accepts_cod) {
    return <NothingToCheckOut title={t("shop.closed")} body={t("shop.closedBody")} />;
  }
  if (cart.items.length === 0) return <NothingToCheckOut title={t("cart.empty")} />;

  return (
    <StoreLayout>
      <div className="container-page py-10">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-on-surface-muted hover:text-on-surface"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
          {t("cart.continueShopping")}
        </Link>

        <h1 className="mb-6 font-display text-2xl font-semibold sm:text-3xl">
          {t("checkout.title")}
        </h1>

        <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-5">
            {isDemoShop && (
              <p
                role="note"
                className="rounded-[10px] border border-tertiary/40 bg-tertiary/10 px-4 py-3 text-sm font-medium"
              >
                {t("demo.checkout")}
              </p>
            )}
            <AddressFields form={form} onChange={setForm} />

            <div className="flex items-start gap-3 rounded-[14px] border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
              <Gift size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium text-on-surface">Offre livraison Elegancia</p>
                {parureQuantity >= 3 ? (
                  <p className="mt-1 text-on-surface-muted">
                    Livraison offerte à domicile ou en Stop Desk pour vos {parureQuantity} parures.
                  </p>
                ) : parureQuantity >= 2 ? (
                  <p className="mt-1 text-on-surface-muted">
                    Livraison Stop Desk offerte. Ajoutez encore 1 parure pour profiter aussi de la
                    livraison à domicile gratuite.
                  </p>
                ) : (
                  <p className="mt-1 text-on-surface-muted">
                    2 parures achetées : Stop Desk offert · 3 parures achetées : livraison à
                    domicile offerte.
                  </p>
                )}
              </div>
            </div>

            {form.wilaya && !homeDelivery.available && (
              <p className="rounded-[12px] border border-tertiary/30 bg-tertiary/10 px-4 py-3 text-sm text-tertiary">
                Tarif Packers indisponible pour cette wilaya. La commande reste bloquée tant que les
                tarifs ne sont pas synchronisés.
              </p>
            )}
            <DeliveryChoice
              wilaya={form.wilaya}
              commune={form.commune}
              homeFee={homeDelivery.fee}
              pickupFee={pickup}
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
            <CodNotice />
          </div>

          <CheckoutSummary
            deliveryFee={delivery.fee}
            hasWilaya={Boolean(form.wilaya)}
            deliveryAvailable={deliveryAvailable}
            error={error}
            submitting={submitting}
          />
        </form>
      </div>
    </StoreLayout>
  );
}

function NothingToCheckOut({ title, body }: { title: string; body?: string }) {
  const { t } = useI18n();
  return (
    <StoreLayout>
      <div className="container-page py-16">
        <EmptyState
          title={title}
          body={body}
          action={
            <Button asChild variant="secondary">
              <Link to="/">{t("cart.emptyAction")}</Link>
            </Button>
          }
        />
      </div>
    </StoreLayout>
  );
}
