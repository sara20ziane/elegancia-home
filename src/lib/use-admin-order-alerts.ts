import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "./supabase/client";
import { useI18n } from "./i18n-context";
import {
  invalidateAdminOrders,
  subscribeToAdminOrders,
  type OrderConnectionState,
} from "./admin-order-events";

export function useAdminOrderAlerts(playSound: () => void) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const latest = useRef({ t, playSound });
  const seen = useRef(new Set<string>());
  const [connection, setConnection] = useState<OrderConnectionState>("connecting");
  useEffect(() => {
    latest.current = { t, playSound };
  }, [t, playSound]);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    // StrictMode's setup → cleanup → setup happens before this microtask.
    // Only the live effect creates a channel, including during hydration.
    queueMicrotask(() => {
      if (disposed) return;
      try {
        stop = subscribeToAdminOrders(
          getSupabase(),
          seen.current,
          (order) => {
            invalidateAdminOrders(queryClient);
            toast.success(latest.current.t("admin.orders.newReceived"), {
              id: `elegancia-new-order-${order.id}`,
              description: order.reference ?? undefined,
            });
            latest.current.playSound();
          },
          setConnection,
          () => invalidateAdminOrders(queryClient),
        );
      } catch {
        setConnection("unavailable");
      }
    });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [queryClient]);
  return connection;
}
