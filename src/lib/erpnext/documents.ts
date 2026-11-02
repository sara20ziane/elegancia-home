import "@tanstack/react-start/server-only";
import type { ErpClient } from "./client";
import { ErpError } from "./errors";
import type { ErpDocument, ErpPayload } from "./types";

export function resource(doctype: string, name?: string): string {
  return `/api/resource/${encodeURIComponent(doctype)}${name ? `/${encodeURIComponent(name)}` : ""}`;
}

export async function findDocument(client: ErpClient, doctype: string, key: string) {
  const query = new URLSearchParams({
    filters: JSON.stringify([["custom_elegancia_key", "=", key]]),
    fields: JSON.stringify(["name"]),
    limit_page_length: "2",
  });
  const rows = await client.json<Array<{ name: string }>>(`${resource(doctype)}?${query}`);
  if (!Array.isArray(rows) || rows.length > 1) {
    throw new ErpError("identity_conflict", "Référence ERPNext ambiguë. Intervention nécessaire.");
  }
  return rows[0] ? client.json<ErpDocument>(resource(doctype, rows[0].name)) : null;
}

export async function ensureDraft(
  client: ErpClient,
  doctype: string,
  key: string,
  payload: ErpPayload,
) {
  const existing = await findDocument(client, doctype, key);
  if (existing) return existing;
  try {
    return await client.json<ErpDocument>(resource(doctype), "POST", {
      ...payload,
      custom_elegancia_key: key,
    });
  } catch (error) {
    // Recover concurrent creation, timeout after commit and duplicate unique key without replaying POST.
    const recovered = await findDocument(client, doctype, key);
    if (recovered) return recovered;
    throw error;
  }
}

export async function submitDocument(client: ErpClient, doc: ErpDocument) {
  if (doc.docstatus === 1) return doc;
  if (doc.docstatus !== 0)
    throw new ErpError("cancelled_document", "Document ERPNext annulé. Intervention nécessaire.");
  const submitted = await client.json<ErpDocument>("/api/method/frappe.client.submit", "POST", {
    doc,
  });
  if (submitted.docstatus !== 1 || submitted.name !== doc.name) {
    throw new ErpError("erp_response", "Soumission ERPNext non confirmée.");
  }
  return submitted;
}

export function verifySale(doc: ErpDocument, company: string, customer: string, total: number) {
  const payable = Number(doc.rounded_total) || Number(doc.grand_total);
  if (
    doc.company !== company ||
    doc.customer !== customer ||
    doc.currency !== "DZD" ||
    Number(doc.grand_total) !== total ||
    payable !== total ||
    doc.is_return
  ) {
    throw new ErpError(
      "amount_mismatch",
      "Identité, devise ou total ERPNext différent de la commande. Soumission bloquée.",
    );
  }
}

export function verifyLines(
  doc: ErpDocument,
  expected: Array<{ item_code: string; qty: number; rate: number }>,
) {
  const key = (item: { item_code: unknown; qty: unknown; rate: unknown }) =>
    JSON.stringify([item.item_code, Number(item.qty), Number(item.rate)]);
  const actualKeys = Array.isArray(doc.items) ? doc.items.map(key).sort() : [];
  const expectedKeys = expected.map(key).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((item, index) => actualKeys[index] !== item)
  ) {
    throw new ErpError(
      "amount_mismatch",
      "Les produits, quantités ou prix ERPNext diffèrent des lignes enregistrées.",
    );
  }
}
