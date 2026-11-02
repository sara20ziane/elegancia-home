import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import type { ErpClient } from "./client";
import { ensureDraft, findDocument, resource } from "./documents";
import { ErpError } from "./errors";
import { customerFields, normalizeCustomerPhone } from "./mapping";
import type { ErpDocument, FinanceOrder } from "./types";

export async function ensureCustomer(
  client: ErpClient,
  order: FinanceOrder,
  linked?: string | null,
) {
  const phone = normalizeCustomerPhone(order.phone);
  const key = `eh-customer-${createHash("sha256").update(phone).digest("hex")}`;
  let doc = linked
    ? await client.json<ErpDocument>(resource("Customer", linked))
    : await findDocument(client, "Customer", key);
  if (!doc) {
    const query = new URLSearchParams({
      or_filters: JSON.stringify([
        ["custom_elegancia_phone", "=", phone],
        ["mobile_no", "in", [phone, `+213${phone.slice(1)}`, `213${phone.slice(1)}`]],
      ]),
      fields: JSON.stringify(["name"]),
      limit_page_length: "2",
    });
    const candidates = await client.json<Array<{ name: string }>>(
      `${resource("Customer")}?${query}`,
    );
    if (!Array.isArray(candidates) || candidates.length > 1) {
      throw new ErpError(
        "customer_conflict",
        "Plusieurs clients ERPNext correspondent au téléphone.",
      );
    }
    if (candidates[0])
      doc = await client.json<ErpDocument>(resource("Customer", candidates[0].name));
  }
  const fields = customerFields(order);
  if (!doc) return ensureDraft(client, "Customer", key, fields);
  if (doc.disabled || (doc.custom_elegancia_phone && doc.custom_elegancia_phone !== phone)) {
    throw new ErpError("customer_conflict", "Client ERPNext désactivé ou téléphone lié différent.");
  }
  // Keep legal/accounting settings maintained in ERPNext. Only update available contact data.
  return client.json<ErpDocument>(resource("Customer", doc.name), "PUT", {
    ...fields,
    custom_elegancia_key: key,
  });
}
