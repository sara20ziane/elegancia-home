import "@tanstack/react-start/server-only";
import type { financeDatabase } from "./database";
import { ErpError } from "./errors";
import type { Finance, FinanceOrder } from "./types";
import type { Json } from "../supabase/types";

type Db = ReturnType<typeof financeDatabase>;
export type Claim = { order_id: string; lock_token: string };

export async function claimSync(db: Db, orderId?: string): Promise<Claim | null> {
  const { data, error } = await db.rpc("erp_claim_sync", { p_order_id: orderId });
  if (error)
    throw new ErpError("finance_database", "Impossible de réserver la synchronisation.", true);
  return data as Claim | null;
}

export async function loadFinanceOrder(
  db: Db,
  id: string,
): Promise<{ order: FinanceOrder; finance: Finance }> {
  const { data, error } = await db
    .from("orders")
    .select(
      "id, customer_name, phone, address, commune, wilaya, status, confirmed_at, delivered_at, created_at, subtotal, delivery_fee, total, carrier, tracking_number, delivery_method, stopdesk_name, order_items(id, variant_id, product_name, variant_label, quantity, unit_price)",
    )
    .eq("id", id)
    .single();
  const finance = await db.from("order_finance").select("*").eq("order_id", id).single();
  if (error || !data || finance.error || !finance.data) {
    throw new ErpError("finance_database", "Commande ou état financier introuvable.", true);
  }
  const ids = data.order_items.flatMap((item) => (item.variant_id ? [item.variant_id] : []));
  const mappings = await db.from("erp_item_mappings").select("*").in("variant_id", ids);
  if (mappings.error)
    throw new ErpError("finance_database", "Correspondances ERPNext indisponibles.", true);
  const byId = new Map((mappings.data || []).map((mapping) => [mapping.variant_id, mapping]));
  const items = data.order_items.map((item) => ({
    ...item,
    item_code: item.variant_id ? byId.get(item.variant_id)?.erp_item_code || null : null,
    sku: item.variant_id ? byId.get(item.variant_id)?.sku || null : null,
  }));
  return { order: { ...data, items }, finance: finance.data };
}

export async function saveFinance(
  db: Db,
  claim: Claim,
  patch: Partial<Finance>,
  complete = false,
  retryable = false,
) {
  const { data, error } = await db.rpc("erp_save_sync", {
    p_order_id: claim.order_id,
    p_lock: claim.lock_token,
    p_patch: patch as Json,
    p_complete: complete,
    p_retryable: retryable,
  });
  if (error || data !== true)
    throw new ErpError("finance_database", "Écriture financière non confirmée. Réessayez.", true);
}
