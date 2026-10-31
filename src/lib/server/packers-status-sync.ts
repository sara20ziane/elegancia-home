import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PackersStatusSyncResult } from "./packers-server";
import {
  eligiblePackersOrder,
  mapPackersStatus,
  packersStatusPatch,
  parsePackersOrder,
  readVerifiedPackersRules,
  type SyncOrder,
} from "./packers-status";

/** Small rotating batches fit an admin request; no credentials or personal payloads are logged. */
export async function syncPackersStatuses(
  supabase: SupabaseClient,
  client: { getOrder: (tracking: string) => Promise<unknown> },
): Promise<PackersStatusSyncResult> {
  try {
    const rules = readVerifiedPackersRules(process.env.PACKERS_VERIFIED_STATUS_RULES);
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, carrier, status, tracking_number, delivered_at, refused_at, refused_reason")
      .eq("carrier", "Packers")
      .not("tracking_number", "is", null)
      .in("status", ["confirmed", "shipped"])
      .order("carrier_status_updated_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .limit(10);
    if (error) return { ok: false, error: "Impossible de lire les commandes Packers." };
    let checked = 0;
    let changed = 0;
    let failed = 0;
    let unrecognized = 0;
    for (const order of (orders ?? []) as SyncOrder[]) {
      if (!eligiblePackersOrder(order)) continue;
      if (checked > 0) await new Promise((resolve) => setTimeout(resolve, 1_250));
      checked += 1;
      try {
        const raw = parsePackersOrder(
          await client.getOrder(order.tracking_number!),
          order.tracking_number!,
        );
        if (!raw) {
          failed += 1;
          continue;
        }
        if (!mapPackersStatus(raw, rules)) unrecognized += 1;
        const patch = packersStatusPatch(order, raw, rules, new Date().toISOString());
        // Compare-and-set includes carrier and tracking: stale API responses cannot overwrite edits.
        const { data: saved, error: saveError } = await supabase
          .from("orders")
          .update(patch)
          .eq("id", order.id)
          .eq("carrier", "Packers")
          .eq("tracking_number", order.tracking_number)
          .eq("status", order.status)
          .select("id");
        if (saveError) failed += 1;
        else if (patch.status && saved?.length === 1) changed += 1;
      } catch {
        failed += 1;
      }
    }
    return { ok: true, checked, changed, failed, unrecognized };
  } catch {
    return { ok: false, error: "Configuration de synchronisation Packers invalide." };
  }
}
