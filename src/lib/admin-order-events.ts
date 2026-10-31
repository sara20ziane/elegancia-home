import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

export type NewAdminOrder = { id: string; reference: string | null };
export type OrderConnectionState = "connecting" | "connected" | "unavailable";

/** Shared refresh point for Realtime and the existing order actions. */
export function invalidateAdminOrders(client: QueryClient) {
  for (const key of ["admin_orders", "admin_orders_count", "admin_analytics"]) {
    void client.invalidateQueries({ queryKey: [key] }).catch(() => {});
  }
}

/** Transport boundary: downstream notification handlers receive no customer details. */
export function subscribeToAdminOrders(
  client: SupabaseClient<Database>,
  seen: Set<string>,
  onOrder: (order: NewAdminOrder) => void,
  onState: (state: OrderConnectionState) => void,
  onReconnect: () => void,
) {
  let active = true;
  const channel = client.channel("elegancia-admin-orders");
  try {
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        if (!active || typeof payload.new.id !== "string" || seen.has(payload.new.id)) return;
        seen.add(payload.new.id);
        // Bounded memory, retained by the shell across channel reconnections.
        if (seen.size > 1_000) seen.delete(seen.values().next().value!);
        onOrder({
          id: payload.new.id,
          reference: typeof payload.new.public_token === "string" ? payload.new.public_token : null,
        });
      })
      .subscribe((status) => {
        if (!active) return;
        onState(status === "SUBSCRIBED" ? "connected" : "unavailable");
        // Postgres Changes is not a replay queue: reconcile counts after a connection gap.
        if (status === "SUBSCRIBED") onReconnect();
      });
  } catch {
    onState("unavailable");
  }
  return () => {
    active = false;
    try {
      void client.removeChannel(channel).catch(() => {});
    } catch {
      // Missing transport must never take down the admin shell.
    }
  };
}
