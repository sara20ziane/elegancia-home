import "@tanstack/react-start/server-only";
import type { ErpClient } from "./client";
import { ensureDraft, resource, submitDocument, verifySale, verifyLines } from "./documents";
import { ErpError } from "./errors";
import { mapSalesOrder } from "./mapping";
import type { ErpDocument, FinanceOrder } from "./types";

export async function ensureSalesOrder(client: ErpClient, order: FinanceOrder, customer: string) {
  const payload = mapSalesOrder(order, customer, client.config);
  const codes = [...new Set(payload.items.map((item) => item.item_code))];
  const query = new URLSearchParams({
    filters: JSON.stringify([["name", "in", codes]]),
    fields: JSON.stringify(["name", "disabled", "has_variants", "is_sales_item", "is_stock_item"]),
    limit_page_length: "100",
  });
  const items = await client.json<ErpDocument[]>(`${resource("Item")}?${query}`);
  if (!Array.isArray(items) || items.length !== codes.length) {
    throw new ErpError("item_mapping", "Items ERPNext absents ou inaccessibles.");
  }
  for (const item of items) {
    if (
      item.disabled ||
      item.has_variants ||
      item.is_sales_item !== 1 ||
      (item.name === client.config.shippingItem && item.is_stock_item !== 0)
    ) {
      throw new ErpError(
        "item_mapping",
        "Item ERPNext incompatible avec la vente ou la livraison.",
      );
    }
  }
  const doc = await ensureDraft(client, "Sales Order", `eh-order-${order.id}`, payload);
  verifySale(doc, client.config.company, customer, order.total);
  verifyLines(doc, payload.items);
  const submitted = await submitDocument(client, doc);
  verifySale(submitted, client.config.company, customer, order.total);
  verifyLines(submitted, payload.items);
  return submitted;
}

export async function cancelSalesOrder(client: ErpClient, name: string, orderId: string) {
  const doc = await client.json<ErpDocument>(resource("Sales Order", name));
  if (doc.custom_elegancia_key !== `eh-order-${orderId}` || doc.company !== client.config.company) {
    throw new ErpError("identity_conflict", "La Sales Order ne correspond pas à cette commande.");
  }
  if (doc.docstatus === 2) return;
  if (doc.docstatus !== 1) {
    throw new ErpError(
      "manual_review",
      "Sales Order en brouillon : vérification manuelle nécessaire.",
    );
  }
  const cancelled = await client.json<ErpDocument>("/api/method/frappe.client.cancel", "POST", {
    doctype: "Sales Order",
    name,
  });
  if (cancelled.docstatus !== 2)
    throw new ErpError("erp_response", "Annulation ERPNext non confirmée.");
}
