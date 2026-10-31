import { useRef, useState, type FormEvent } from "react";
import type { CheckoutForm } from "@/components/storefront/checkout-panels";
import type { CartItem } from "./cart";
import { useI18n } from "./i18n-context";
import { placeOrder } from "./order";
import { saveOrderLocally } from "./saved-orders";

/** The RPC creates the order; local storage is only a best-effort bookmark afterwards. */
export function useCheckoutOrder(
  form: CheckoutForm,
  cart: { items: CartItem[]; clear: () => void },
  deliveryAvailable: boolean,
) {
  const { t } = useI18n();
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ token: string; saved: boolean } | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    if (!form.wilaya || !deliveryAvailable) {
      setError(t("checkout.rateUnavailable"));
      return;
    }
    if (!form.commune.trim()) {
      setError(t("checkout.communeRequired"));
      return;
    }
    if (form.delivery_method === "stopdesk" && !form.stopdesk_name) {
      setError(t("checkout.stopdeskUnavailable"));
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = await placeOrder(
        toCustomer(form),
        cart.items.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
      );
      if (result.error || !result.token) {
        setError(
          result.code
            ? t(`checkout.error.${result.code}`)
            : (result.error ?? t("common.somethingWrong")),
        );
        return;
      }
      const saved = saveOrderLocally({
        publicToken: result.token,
        createdAt: new Date().toISOString(),
      });
      setPlaced({ token: result.token, saved });
      cart.clear();
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  return { submitting, error, placed, submit };
}

function toCustomer(form: CheckoutForm) {
  return {
    customer_name: form.customer_name,
    phone: form.phone,
    wilaya: form.wilaya,
    commune: form.commune.trim(),
    address: form.address,
    note: form.note || null,
    delivery_method: form.delivery_method,
    stopdesk_id: null,
    stopdesk_name: form.stopdesk_name || null,
  };
}
