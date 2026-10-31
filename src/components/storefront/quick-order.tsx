import { useState } from "react";
import { AddressFields, CheckoutSummary, EMPTY_CHECKOUT_FORM } from "./checkout-panels";
import { DeliveryChoice } from "./delivery-choice";
import { useCheckoutOrder } from "@/lib/use-checkout-order";
import { useCheckoutQuote } from "@/lib/use-checkout-quote";
import { productOrderLine } from "@/lib/product-order";
import { useI18n } from "@/lib/i18n-context";
import type { CatalogueProduct, CatalogueVariant } from "@/lib/queries";
import { OrderPlaced } from "@/components/orders/order-placed";

/** Independent single-product order: same checkout flow, without modifying the multi-product cart. */
export function QuickOrder({
  product,
  name,
  selected,
  images,
  quantity,
}: {
  product: CatalogueProduct;
  name: string;
  selected: CatalogueVariant;
  images: string[];
  quantity: number;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_CHECKOUT_FORM);
  const items = [productOrderLine(product, name, selected, images, quantity)];
  const quote = useCheckoutQuote(form, items);
  const checkout = useCheckoutOrder(form, { items, clear: () => {} }, quote.delivery.available);
  if (checkout.placed)
    return (
      <OrderPlaced
        token={checkout.placed.token}
        createdAt={checkout.placed.createdAt}
        phone={form.phone}
        embedded
      />
    );
  if (quote.settings && !quote.settings.accepts_cod) return null;
  return (
    <form onSubmit={checkout.submit} className="flex flex-col gap-4 border-t border-outline pt-5">
      <h2 className="font-display text-lg font-semibold">{t("quick.title")}</h2>
      <AddressFields form={form} onChange={setForm} />
      <DeliveryChoice
        wilaya={form.wilaya}
        commune={form.commune}
        homeFee={quote.homeDelivery.fee}
        pickupFee={quote.pickup}
        method={form.delivery_method}
        stopdeskName={form.stopdesk_name}
        onChange={({ method, stopdeskName }) =>
          setForm({
            ...form,
            delivery_method: method,
            stopdesk_name: stopdeskName,
            stopdesk_id: "",
          })
        }
      />
      <CheckoutSummary
        lines={items}
        deliveryFee={quote.delivery.fee}
        deliveryAvailable={quote.delivery.available}
        hasWilaya={Boolean(form.wilaya)}
        error={checkout.error}
        submitting={checkout.submitting}
      />
    </form>
  );
}
