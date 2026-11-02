import "@tanstack/react-start/server-only";
import { ErpClient } from "./client";
import { erpEnabled, readErpConfig } from "./config";
import { ensureCustomer } from "./customers";
import { financeDatabase } from "./database";
import { findDocument } from "./documents";
import { ErpError, safeFinanceError } from "./errors";
import { normalizeCustomerPhone } from "./mapping";
import { ensurePayment } from "./payments";
import { claimSync, loadFinanceOrder, saveFinance, type Claim } from "./repository";
import { ensureSalesInvoice, shouldInvoice } from "./sales-invoices";
import { cancelSalesOrder, ensureSalesOrder } from "./sales-orders";
import { verifyErpSetup } from "./setup";
import type { Finance, FinanceOrder, SyncResult } from "./types";

type Db = ReturnType<typeof financeDatabase>;

async function syncDocuments(
  db: Db,
  claim: Claim,
  client: ErpClient,
  order: FinanceOrder,
  finance: Finance,
) {
  if (["cancelled", "refused", "returned"].includes(order.status)) {
    const invoice =
      finance.erp_sales_invoice_id ||
      (await findDocument(client, "Sales Invoice", `eh-invoice-${order.id}`));
    if (invoice)
      throw new ErpError(
        "manual_review",
        "Facture existante : annulation ou avoir à traiter par le comptable dans ERPNext.",
      );
    const salesOrder =
      finance.erp_sales_order_id ||
      (await findDocument(client, "Sales Order", `eh-order-${order.id}`))?.name;
    if (salesOrder) await cancelSalesOrder(client, salesOrder, order.id);
    await saveFinance(
      db,
      claim,
      {
        erp_sales_order_id: salesOrder || null,
        erp_sync_status: "cancelled",
        erp_sync_error: null,
      },
      true,
    );
    return;
  }
  if (!["confirmed", "shipped", "delivered"].includes(order.status) || !order.confirmed_at) {
    throw new ErpError(
      "manual_review",
      "Confirmation locale manquante ou commande réouverte. Vérification manuelle requise.",
    );
  }
  await verifyErpSetup(client);
  const phone = normalizeCustomerPhone(order.phone);
  const linked = await db
    .from("erp_customers")
    .select("erp_customer_id")
    .eq("phone", phone)
    .maybeSingle();
  if (linked.error) throw new ErpError("finance_database", "Liens clients indisponibles.", true);
  const customer = await ensureCustomer(
    client,
    order,
    linked.data?.erp_customer_id || finance.erp_customer_id,
  );
  const savedCustomer = await db
    .from("erp_customers")
    .upsert({ phone, erp_customer_id: customer.name }, { onConflict: "phone" });
  if (savedCustomer.error)
    throw new ErpError("finance_database", "Lien client non enregistré.", true);
  finance.erp_customer_id = customer.name;
  await saveFinance(db, claim, { erp_customer_id: customer.name });
  const salesOrder = await ensureSalesOrder(client, order, customer.name);
  finance.erp_sales_order_id = salesOrder.name;
  await saveFinance(db, claim, { erp_sales_order_id: salesOrder.name });
  let status: Finance["erp_sync_status"] = "synced";
  if (shouldInvoice(order)) {
    const invoice = await ensureSalesInvoice(client, order, customer.name, salesOrder.name);
    finance.erp_sales_invoice_id = invoice.name;
    status = "invoiced";
    await saveFinance(db, claim, { erp_sales_invoice_id: invoice.name, erp_sync_status: status });
    if (finance.cod_received_at) {
      const payment = await ensurePayment(client, order, finance, invoice);
      status = "paid";
      await saveFinance(db, claim, { erp_payment_entry_id: payment.name });
      const { resource } = await import("./documents");
      const paidInvoice = await client.json<{ outstanding_amount: number }>(
        resource("Sales Invoice", invoice.name),
      );
      if (Number(paidInvoice.outstanding_amount) !== 0) {
        throw new ErpError(
          "manual_review",
          "Paiement soumis mais solde ERPNext non nul. Rapprochement manuel requis.",
        );
      }
    }
  }
  await saveFinance(db, claim, { erp_sync_status: status, erp_sync_error: null }, true);
}

/** One bounded work item. The durable DB queue survives browser disconnects and process crashes. */
export async function runFinanceSync(orderId?: string): Promise<SyncResult> {
  if (!erpEnabled()) return { ok: true, enabled: false };
  let db: Db | undefined;
  let claim: Claim | null = null;
  try {
    db = financeDatabase();
    claim = await claimSync(db, orderId);
    if (!claim) return { ok: true, enabled: true };
    const config = readErpConfig();
    const { order, finance } = await loadFinanceOrder(db, claim.order_id);
    await syncDocuments(db, claim, new ErpClient(config), order, finance);
    return { ok: true, enabled: true };
  } catch (error) {
    const message = safeFinanceError(error);
    if (db && claim) {
      try {
        await saveFinance(
          db,
          claim,
          { erp_sync_status: "error", erp_sync_error: message },
          true,
          error instanceof ErpError && error.retryable,
        );
      } catch {
        // The lease expires; the queue will recover even if Supabase also became unavailable.
      }
    }
    console.warn("[erpnext]", error instanceof ErpError ? error.code : "finance_unavailable");
    return { ok: false, enabled: true, error: message };
  }
}
