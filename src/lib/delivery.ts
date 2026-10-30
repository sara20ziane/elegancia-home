import { queryOptions, useQuery } from "@tanstack/react-query";
import { getSupabase } from "./supabase/client";
import type { StoreSettings } from "./queries";

/**
 * Delivery pricing cache.
 *
 * `delivery_zones` is no longer manually priced. It is a local cache of the
 * tariffs returned by Packers / EcoTrack, synchronized from the admin delivery
 * page. If a wilaya has no cached Packers tariff, checkout must treat delivery
 * as unavailable rather than inventing a fallback amount.
 */
export type DeliveryZone = {
  wilaya: string;
  fee: number;
  /** Packers Stop Desk tariff. Null means Packers does not offer it for the wilaya. */
  stopdesk_fee: number | null;
  eta_days: number;
  is_active: boolean;
};

export type DeliveryMethod = "home" | "stopdesk";

async function fetchZones(): Promise<DeliveryZone[]> {
  const { data, error } = await getSupabase()
    .from("delivery_zones")
    .select("wilaya, fee, stopdesk_fee, eta_days, is_active")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as DeliveryZone[];
}

const deliveryZonesQuery = () =>
  queryOptions({ queryKey: ["delivery_zones"] as const, queryFn: fetchZones });

export function useDeliveryZones() {
  return useQuery(deliveryZonesQuery());
}

/**
 * Fee and ETA from the last successful Packers synchronization.
 * No flat fallback and no free-shipping override are allowed: Packers is the
 * single source of truth for both home delivery and Stop Desk pricing.
 */
export function resolveDelivery(
  settings: StoreSettings | null,
  zones: DeliveryZone[],
  wilaya: string | null,
  _subtotal: number,
  method: DeliveryMethod = "home",
): { fee: number; etaDays: number; source: "packers" | "unavailable"; available: boolean } {
  const zone = wilaya ? zones.find((z) => z.wilaya === wilaya) : undefined;
  const etaDays = zone?.eta_days ?? settings?.delivery_eta_days ?? 3;
  if (!zone) return { fee: 0, etaDays, source: "unavailable", available: false };
  if (method === "stopdesk") {
    if (zone.stopdesk_fee == null) {
      return { fee: 0, etaDays, source: "unavailable", available: false };
    }
    return { fee: zone.stopdesk_fee, etaDays, source: "packers", available: true };
  }
  return { fee: zone.fee, etaDays, source: "packers", available: true };
}

/** Packers Stop Desk price for a wilaya, or null where Packers does not offer it. */
export function pickupFee(zones: DeliveryZone[], wilaya: string | null): number | null {
  return zones.find((z) => z.wilaya === wilaya)?.stopdesk_fee ?? null;
}

/** Admin-only helper retained for the Packers synchronization workflow. */
export async function upsertZone(zone: {
  wilaya: string;
  fee: number;
  stopdesk_fee: number | null;
  eta_days: number;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("delivery_zones")
    .upsert({ ...zone, is_active: true }, { onConflict: "wilaya" });
  if (error) throw new Error(error.message);
}

export async function deleteZone(wilaya: string): Promise<void> {
  const { error } = await getSupabase().from("delivery_zones").delete().eq("wilaya", wilaya);
  if (error) throw new Error(error.message);
}
