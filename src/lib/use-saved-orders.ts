import { useEffect, useState } from "react";
import {
  readSavedOrders,
  SAVED_ORDERS_EVENT,
  SAVED_ORDERS_KEY,
  type SavedOrder,
} from "./saved-orders";

export function useSavedOrders() {
  // Storage is read after hydration; the server and first browser render agree.
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  useEffect(() => {
    const refresh = () => setOrders(readSavedOrders());
    const onStorage = (event: StorageEvent) => {
      if (event.key === SAVED_ORDERS_KEY || event.key === null) refresh();
    };
    refresh();
    window.addEventListener(SAVED_ORDERS_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAVED_ORDERS_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return orders;
}
