import type { CheckoutForm } from "@/lib/checkout-form";
import type { CartItem } from "./cart";
import { pickupFee, resolveDelivery, useDeliveryZones } from "./delivery";
import { useStoreSettings } from "./queries";

/** Shared preview only. Packers tariffs and server-side promotion calculation stay authoritative. */
export function useCheckoutQuote(form: CheckoutForm, items: CartItem[]) {
  const { data: settings } = useStoreSettings();
  const { data: zones } = useDeliveryZones();
  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const parureQuantity = items.reduce((sum, line) => {
    const marker = `${line.setType ?? ""} ${line.variantLabel ?? ""}`.toLowerCase();
    return marker.includes("parure de drap") || marker.includes("parure housse de couette")
      ? sum + line.quantity
      : sum;
  }, 0);
  const quote = (method: "home" | "stopdesk") =>
    resolveDelivery(
      settings ?? null,
      zones ?? [],
      form.wilaya || null,
      subtotal,
      method,
      parureQuantity,
    );
  return {
    settings,
    subtotal,
    parureQuantity,
    delivery: quote(form.delivery_method),
    homeDelivery: quote("home"),
    pickup: pickupFee(zones ?? [], form.wilaya || null, parureQuantity),
  };
}
