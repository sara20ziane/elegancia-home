import "@tanstack/react-start/server-only";
import type { ErpClient } from "./client";
import { ensureDraft, findDocument, resource, submitDocument } from "./documents";
import { ErpError } from "./errors";
import type { ErpDocument, Finance, FinanceOrder } from "./types";

export async function ensurePayment(
  client: ErpClient,
  order: FinanceOrder,
  finance: Finance,
  invoice: ErpDocument,
) {
  if (
    !finance.cod_received_at ||
    finance.cod_received_amount !== order.total ||
    !finance.cod_receipt_reference
  ) {
    throw new ErpError(
      "cod_receipt",
      "Un reversement intégral réellement reçu doit être enregistré.",
    );
  }
  const key = `eh-payment-${order.id}`;
  let doc = await findDocument(client, "Payment Entry", key);
  if (!doc) {
    if (!client.config.cashAccount || !client.config.modeOfPayment) {
      throw new ErpError(
        "configuration",
        "Configurer ERPNEXT_CASH_ACCOUNT et ERPNEXT_MODE_OF_PAYMENT.",
      );
    }
    const account = await client.json<ErpDocument>(resource("Account", client.config.cashAccount));
    if (
      account.company !== client.config.company ||
      account.account_currency !== "DZD" ||
      account.is_group ||
      account.disabled
    ) {
      throw new ErpError("payment_account", "Compte d’encaissement ERPNext incompatible.");
    }
    if (Number(invoice.outstanding_amount) !== order.total) {
      throw new ErpError(
        "manual_review",
        "La créance a déjà été modifiée dans ERPNext. Rapprochement manuel requis.",
      );
    }
    const template = await client.json<ErpDocument>(
      "/api/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry",
      "POST",
      { dt: "Sales Invoice", dn: invoice.name, bank_account: client.config.cashAccount },
    );
    doc = await ensureDraft(client, "Payment Entry", key, {
      ...template,
      name: undefined,
      docstatus: 0,
      custom_elegancia_order_id: order.id,
      posting_date: finance.cod_received_at.slice(0, 10),
      reference_date: finance.cod_received_at.slice(0, 10),
      reference_no: finance.cod_receipt_reference,
      mode_of_payment: client.config.modeOfPayment,
    });
  }
  const references = doc.references;
  if (
    doc.company !== client.config.company ||
    doc.payment_type !== "Receive" ||
    doc.party_type !== "Customer" ||
    doc.party !== finance.erp_customer_id ||
    doc.paid_to !== client.config.cashAccount ||
    doc.paid_from_account_currency !== "DZD" ||
    doc.paid_to_account_currency !== "DZD" ||
    Number(doc.paid_amount) !== order.total ||
    Number(doc.received_amount) !== order.total ||
    !Array.isArray(references) ||
    references.length !== 1 ||
    references[0].reference_doctype !== "Sales Invoice" ||
    references[0].reference_name !== invoice.name ||
    Number(references[0].allocated_amount) !== order.total ||
    Number(doc.difference_amount) !== 0
  ) {
    throw new ErpError(
      "amount_mismatch",
      "Payment Entry incompatible avec le reversement enregistré.",
    );
  }
  return submitDocument(client, doc);
}
