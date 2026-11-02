import "@tanstack/react-start/server-only";
import { isTokenShaped } from "../order";
import { assertAdmin } from "../server/packers-auth";
import { ErpClient } from "./client";
import { erpEnabled, readErpConfig } from "./config";
import { financeDatabase } from "./database";
import { resource } from "./documents";
import { ErpError } from "./errors";
import type { ErpDocument } from "./types";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

async function trackedInvoice(token: string) {
  if (!isTokenShaped(token)) return null;
  const db = financeDatabase();
  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("public_token", token)
    .maybeSingle();
  if (error || !data) return null;
  const finance = await db
    .from("order_finance")
    .select("erp_sales_invoice_id")
    .eq("order_id", data.id)
    .maybeSingle();
  if (finance.error || !finance.data?.erp_sales_invoice_id) return null;
  return { orderId: data.id, invoiceId: finance.data.erp_sales_invoice_id };
}

export async function trackedInvoiceAvailable(token: string): Promise<boolean> {
  if (!erpEnabled()) return false;
  try {
    return Boolean(await trackedInvoice(token));
  } catch {
    return false;
  }
}

export async function invoiceResponse(
  request: Request,
  identity: { token?: string; orderId?: string },
): Promise<Response> {
  const unavailable = (status: number) =>
    new Response("Facture indisponible.", { status, headers: PRIVATE_HEADERS });
  if (!erpEnabled()) return unavailable(404);
  try {
    let linked: { orderId: string; invoiceId: string } | null = null;
    if (identity.token) linked = await trackedInvoice(identity.token);
    else if (identity.orderId && isTokenShaped(identity.orderId)) {
      const accessToken = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
      if (!accessToken) return unavailable(401);
      const auth = await assertAdmin(accessToken);
      if (!auth.supabase) return unavailable(403);
      const order = await auth.supabase
        .from("orders")
        .select("id")
        .eq("id", identity.orderId)
        .maybeSingle();
      if (order.error || !order.data) return unavailable(404);
      const finance = await auth.supabase
        .from("order_finance")
        .select("erp_sales_invoice_id")
        .eq("order_id", order.data.id)
        .maybeSingle();
      if (!finance.error && finance.data?.erp_sales_invoice_id)
        linked = { orderId: order.data.id, invoiceId: finance.data.erp_sales_invoice_id };
    }
    if (!linked) return unavailable(404);
    const client = new ErpClient(readErpConfig());
    const invoice = await client.json<ErpDocument>(resource("Sales Invoice", linked.invoiceId));
    if (
      invoice.docstatus !== 1 ||
      invoice.company !== client.config.company ||
      invoice.custom_elegancia_key !== `eh-invoice-${linked.orderId}`
    )
      return unavailable(404);
    const params = new URLSearchParams({
      doctype: "Sales Invoice",
      name: linked.invoiceId,
      format: "Elegancia Home Invoice",
      no_letterhead: "1",
      _lang: "fr",
    });
    const bytes = await client.pdf(`/api/method/frappe.utils.print_format.download_pdf?${params}`);
    return new Response(bytes, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="facture-elegancia.pdf"',
      },
    });
  } catch (error) {
    return unavailable(error instanceof ErpError && error.code === "erp_http_403" ? 403 : 503);
  }
}
