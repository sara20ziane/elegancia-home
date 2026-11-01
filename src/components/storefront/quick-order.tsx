import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AddressFields, CheckoutSummary, EMPTY_CHECKOUT_FORM } from "./checkout-panels";
import { DeliveryChoice } from "./delivery-choice";
import { useCheckoutOrder } from "@/lib/use-checkout-order";
import { useCheckoutQuote } from "@/lib/use-checkout-quote";
import { productOrderLine } from "@/lib/product-order";
import { useI18n } from "@/lib/i18n-context";
import type { CatalogueProduct, CatalogueVariant } from "@/lib/queries";
import { OrderPlaced } from "@/components/orders/order-placed";

const quickCopy = {
  fr: {
    cta: "Commander maintenant",
    helper: "Commande rapide sans passer par le panier",
    hide: "Masquer le formulaire",
  },
  en: {
    cta: "Order now",
    helper: "Quick order without going through the cart",
    hide: "Hide order form",
  },
  ar: {
    cta: "اطلبي الآن",
    helper: "طلب سريع بدون المرور بالسلة",
    hide: "إخفاء الاستمارة",
  },
} as const;

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
  const { t, locale } = useI18n();
  const [form, setForm] = useState(EMPTY_CHECKOUT_FORM);
  const [open, setOpen] = useState(false);
  const items = [productOrderLine(product, name, selected, images, quantity)];
  const quote = useCheckoutQuote(form, items);
  const checkout = useCheckoutOrder(form, { items, clear: () => {} }, quote.delivery.available);
  const copy = quickCopy[locale];

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
    <section className="flex flex-col gap-3 border-t border-outline pt-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="btn btn-primary btn-lg btn-block justify-between"
        aria-expanded={open}
      >
        <span>{open ? copy.hide : copy.cta}</span>
        <ChevronDown
          size={18}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {!open && <p className="text-center text-xs text-on-surface-muted">{copy.helper}</p>}

      {open && (
        <form onSubmit={checkout.submit} className="mt-1 flex flex-col gap-4">
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
      )}
    </section>
  );
}
