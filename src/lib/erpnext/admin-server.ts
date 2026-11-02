import "@tanstack/react-start/server-only";
import { assertAdmin } from "../server/packers-auth";
import { isTokenShaped } from "../order";
import { erpEnabled } from "./config";
import { financeDatabase } from "./database";
import { ErpError, safeFinanceError } from "./errors";
import { runFinanceSync } from "./sync";
import type { Finance, SyncResult } from "./types";

export type AdminFinanceInput = { accessToken: string; orderId?: string; publicToken?: string };

async function authorize(input: AdminFinanceInput) {
  const auth = await assertAdmin(input.accessToken);
  if (!auth.supabase) throw new ErpError("forbidden", "Accès administrateur requis.");
  if (input.orderId && !isTokenShaped(input.orderId))
    throw new ErpError("invalid_order", "Commande invalide.");
  if (input.publicToken && !isTokenShaped(input.publicToken))
    throw new ErpError("invalid_order", "Référence invalide.");
  if (!input.orderId && !input.publicToken) return { supabase: auth.supabase, orderId: undefined };
  let query = auth.supabase.from("orders").select("id");
  query = input.orderId
    ? query.eq("id", input.orderId)
    : query.eq("public_token", input.publicToken);
  const { data, error } = await query.single();
  if (error || !data) throw new ErpError("not_found", "Commande introuvable.");
  return { supabase: auth.supabase, orderId: String(data.id) };
}

export async function readAdminFinance(
  input: AdminFinanceInput,
): Promise<{ enabled: boolean; finance: Finance | null; error?: string }> {
  try {
    const auth = await authorize(input);
    if (!erpEnabled()) return { enabled: false, finance: null };
    const { data, error } = await auth.supabase
      .from("order_finance")
      .select("*")
      .eq("order_id", auth.orderId)
      .maybeSingle();
    if (error) throw error;
    return { enabled: true, finance: data as Finance | null };
  } catch (error) {
    return { enabled: erpEnabled(), finance: null, error: safeFinanceError(error) };
  }
}

export async function syncAdminFinance(input: AdminFinanceInput): Promise<SyncResult> {
  try {
    const auth = await authorize(input);
    if (!erpEnabled()) return { ok: true, enabled: false };
    if (auth.orderId) {
      const db = financeDatabase();
      const { error } = await db.rpc("erp_request_sync", { p_order_id: auth.orderId });
      if (error) throw error;
    }
    return await runFinanceSync(auth.orderId);
  } catch (error) {
    return { ok: false, enabled: erpEnabled(), error: safeFinanceError(error) };
  }
}

export async function recordCodReceipt(
  input: AdminFinanceInput & { amount: number; reference: string; receivedAt: string },
): Promise<SyncResult> {
  try {
    const auth = await authorize(input);
    if (!erpEnabled()) return { ok: true, enabled: false };
    const { error } = await auth.supabase.rpc("erp_record_cod_receipt", {
      p_order_id: auth.orderId,
      p_amount: input.amount,
      p_reference: input.reference,
      p_received_at: input.receivedAt,
    });
    if (error)
      throw new ErpError(
        "cod_receipt",
        "Reversement refusé : commande livrée, montant intégral, date passée et référence requis. Un reçu enregistré est immuable.",
      );
    return await runFinanceSync(auth.orderId);
  } catch (error) {
    return { ok: false, enabled: erpEnabled(), error: safeFinanceError(error) };
  }
}
