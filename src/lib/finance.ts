import { getSupabase } from "./supabase/client";
import { syncErpFinance } from "./erpnext/actions";

export async function financeAccessToken(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) throw new Error("Session administrateur requise.");
  return data.session.access_token;
}

/** Delivery/confirmation succeeds independently. A failed kick remains in the durable queue. */
export async function requestFinanceSync(order: { orderId?: string; publicToken?: string } = {}) {
  try {
    await syncErpFinance({ data: { ...order, accessToken: await financeAccessToken() } });
  } catch {
    // The finance panel/queue will report and retry. Never invalidate an existing order.
  }
}

export async function downloadAdminInvoice(orderId: string) {
  const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/invoice`, {
    headers: { Authorization: `Bearer ${await financeAccessToken()}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Facture indisponible. Réessayez ultérieurement.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "facture-elegancia.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
