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

export function qualifiesForFreeDelivery(method: DeliveryMethod, parureQuantity: number): boolean {
  return method === "stopdesk" ? parureQuantity >= 2 : parureQuantity >= 3;
}

/**
 * Base tariff always comes from Packers. Elegancia may then cover that fee as a
 * commercial promotion: 2+ parures => free Stop Desk, 3+ parures => free home.
 */
export function resolveDelivery(
  settings: StoreSettings | null,
  zones: DeliveryZone[],
  wilaya: string | null,
  _subtotal: number,
  method: DeliveryMethod = "home",
  parureQuantity = 0,
): { fee: number; etaDays: number; source: "packers" | "promotion" | "unavailable"; available: boolean } {
  const zone = wilaya ? zones.find((z) => z.wilaya === wilaya) : undefined;
  const etaDays = zone?.eta_days ?? settings?.delivery_eta_days ?? 3;
  if (!zone) return { fee: 0, etaDays, source: "unavailable", available: false };

  const baseFee = method === "stopdesk" ? zone.stopdesk_fee : zone.fee;
  if (baseFee == null) {
    return { fee: 0, etaDays, source: "unavailable", available: false };
  }
  if (qualifiesForFreeDelivery(method, parureQuantity)) {
    return { fee: 0, etaDays, source: "promotion", available: true };
  }
  return { fee: baseFee, etaDays, source: "packers", available: true };
}

/** Packers Stop Desk price for a wilaya, with Elegancia's offer applied. */
export function pickupFee(
  zones: DeliveryZone[],
  wilaya: string | null,
  parureQuantity = 0,
): number | null {
  const fee = zones.find((z) => z.wilaya === wilaya)?.stopdesk_fee ?? null;
  if (fee == null) return null;
  return parureQuantity >= 2 ? 0 : fee;
}

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
