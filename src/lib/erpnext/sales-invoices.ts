import "@tanstack/react-start/server-only";
import type { ErpClient } from "./client";
import { ensureDraft, findDocument, submitDocument, verifySale, verifyLines } from "./documents";
import { orderFields, mapSalesOrder } from "./mapping";
import { ErpError } from "./errors";
import type { ErpDocument, FinanceOrder } from "./types";

/** Single policy point: change here if the accountant later chooses shipment. */
export function shouldInvoice(order: FinanceOrder): boolean {
  return order.status === "delivered";
}

export async function ensureSalesInvoice(
  client: ErpClient,
  order: FinanceOrder,
  customer: string,
  salesOrder: string,
) {
  const key = `eh-invoice-${order.id}`;
  let doc = await findDocument(client, "Sales Invoice", key);
  if (!doc) {
    const template = await client.json<ErpDocument>(
      "/api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
      "POST",
      { source_name: salesOrder },
    );
    // ERPNext supplies Sales Order row links and configured taxes/accounts. No stock transfer or POS payment.
    doc = await ensureDraft(client, "Sales Invoice", key, {
      ...template,
      ...orderFields(order),
      name: undefined,
      docstatus: 0,
      update_stock: 0,
      is_pos: 0,
      posting_date: (order.delivered_at || new Date().toISOString()).slice(0, 10),
      due_date: (order.delivered_at || new Date().toISOString()).slice(0, 10),
      ignore_pricing_rule: 1,
      disable_rounded_total: 1,
    });
  }
  verifySale(doc, client.config.company, customer, order.total);
  const expected = mapSalesOrder(order, customer, client.config).items;
  verifyLines(doc, expected);
  if (
    !Array.isArray(doc.items) ||
    !doc.items.every((item: Record<string, unknown>) => item.sales_order === salesOrder)
  ) {
    throw new ErpError(
      "identity_conflict",
      "La facture ERPNext ne correspond pas à la Sales Order liée.",
    );
  }
  const submitted = await submitDocument(client, doc);
  verifySale(submitted, client.config.company, customer, order.total);
  verifyLines(submitted, expected);
  return submitted;
}
