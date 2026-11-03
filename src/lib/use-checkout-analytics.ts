import { useEffect, useRef } from "react";
import { trackEcommerce } from "./analytics-events";
import type { CartItem } from "./cart";

export function useCheckoutAnalytics(items: CartItem[], active: boolean) {
  const started = useRef(false);
  useEffect(() => {
    if (!active || !items.length || started.current) return;
    started.current = true;
    trackEcommerce("begin_checkout", {
      quantity: items.reduce((sum, line) => sum + line.quantity, 0),
      amount: items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    });
  }, [active, items]);
}
