export type EcommerceEvent =
  | "view_product"
  | "select_variant"
  | "add_to_cart"
  | "view_cart"
  | "begin_checkout"
  | "order_completed";

type Properties = {
  product_id?: string;
  product_slug?: string;
  variant_id?: string;
  quantity?: number;
  amount?: number;
};
type SafeProperties = Properties & { currency: "DZD" };
type Adapter = (event: EcommerceEvent, properties: SafeProperties) => void | Promise<void>;
let adapter: Adapter | undefined;

/** One adapter boundary for Vercel today and consent-aware providers later. */
export function setAnalyticsAdapter(next: Adapter | undefined) {
  adapter = next;
}

/** Explicit allowlist: never spread cart, customer, URL or order objects into telemetry. */
export function trackEcommerce(event: EcommerceEvent, properties: Properties = {}) {
  if (typeof window === "undefined" || !adapter) return;
  try {
    const safe: SafeProperties = { currency: "DZD" };
    for (const key of ["product_id", "variant_id"] as const) {
      const value = properties[key];
      if (typeof value === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value))
        safe[key] = value;
    }
    if (
      typeof properties.product_slug === "string" &&
      /^[\p{L}\p{N}-]{1,160}$/u.test(properties.product_slug)
    )
      safe.product_slug = properties.product_slug;
    if (Number.isSafeInteger(properties.quantity) && properties.quantity! > 0)
      safe.quantity = properties.quantity;
    if (Number.isFinite(properties.amount) && properties.amount! >= 0)
      safe.amount = properties.amount;
    const send = adapter;
    void Promise.resolve()
      .then(() => send(event, safe))
      .catch(() => {});
  } catch {
    // Telemetry is optional, including when an adapter or browser extension fails.
  }
}
