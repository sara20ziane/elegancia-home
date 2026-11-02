import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { ErpClient } from "./client";
import { ensureCustomer } from "./customers";
import { ensureSalesOrder, cancelSalesOrder } from "./sales-orders";
import { ensureSalesInvoice, shouldInvoice } from "./sales-invoices";
import { ensurePayment } from "./payments";
import { verifyErpSetup } from "./setup";
import { verifyLines } from "./documents";
import { erpConfig, financeOrder, financeState } from "../../../scripts/testing/erpnext-fixtures";
import { MockErp } from "../../../scripts/testing/erpnext-mock";

let erp: MockErp;
let client: ErpClient;
beforeEach(() => {
  erp = new MockErp();
  client = new ErpClient(erpConfig, erp.fetcher);
});

async function invoiceFixture() {
  const order = financeOrder();
  order.status = "delivered";
  const customer = await ensureCustomer(client, order);
  const so = await ensureSalesOrder(client, order, customer.name);
  const invoice = await ensureSalesInvoice(client, order, customer.name, so.name);
  const finance = financeState();
  finance.erp_customer_id = customer.name;
  finance.cod_received_at = "2026-11-02T12:00:00Z";
  finance.cod_received_amount = order.total;
  finance.cod_receipt_reference = "SYNTHETIC-RECEIPT";
  return { order, customer, so, invoice, finance };
}

describe("cycle financier idempotent", () => {
  it("réutilise un Customer par téléphone normalisé sur plusieurs commandes", async () => {
    const order = financeOrder();
    const first = await ensureCustomer(client, order);
    order.phone = "0555123456";
    const second = await ensureCustomer(client, order);
    expect(second.name).toBe(first.name);
    expect(erp.writes.filter((write) => write === "create:Customer")).toHaveLength(1);
  });
  it("double confirmation concurrente : un seul Customer et une seule Sales Order", async () => {
    const order = financeOrder();
    const customers = await Promise.all([
      ensureCustomer(client, order),
      ensureCustomer(client, order),
    ]);
    expect(customers[0].name).toBe(customers[1].name);
    const orders = await Promise.all([
      ensureSalesOrder(client, order, customers[0].name),
      ensureSalesOrder(client, order, customers[0].name),
    ]);
    expect(orders[0].name).toBe(orders[1].name);
    expect(erp.writes.filter((write) => write === "create:Sales Order")).toHaveLength(1);
  });
  it("retrouve une création dont la réponse a été perdue", async () => {
    erp.loseCreateResponse = true;
    const doc = await ensureCustomer(client, financeOrder());
    expect(doc.name).toBeTruthy();
    expect(erp.writes.filter((write) => write === "create:Customer")).toHaveLength(1);
  });
  it("reprend une soumission dont la réponse a été perdue sans recréer la vente", async () => {
    const order = financeOrder();
    const customer = await ensureCustomer(client, order);
    erp.loseSubmitResponse = true;
    await expect(ensureSalesOrder(client, order, customer.name)).rejects.toThrow("indisponible");
    const recovered = await ensureSalesOrder(client, order, customer.name);
    expect(recovered.docstatus).toBe(1);
    expect(erp.writes.filter((write) => write === "submit:Sales Order")).toHaveLength(1);
  });
  it("double livraison et facture existante : une seule facture liée à la Sales Order", async () => {
    const { order, customer, so, invoice } = await invoiceFixture();
    const repeated = await ensureSalesInvoice(client, order, customer.name, so.name);
    expect(repeated.name).toBe(invoice.name);
    expect(erp.writes.filter((write) => write === "create:Sales Invoice")).toHaveLength(1);
    expect(invoice.update_stock).toBe(0);
    expect(invoice.is_pos).toBe(0);
    expect(erp.writes).not.toContain("create:Payment Entry");
  });
  it("double reversement et Payment Entry existant : un seul paiement", async () => {
    const { order, finance, invoice } = await invoiceFixture();
    const [first, repeated] = await Promise.all([
      ensurePayment(client, order, finance, invoice),
      ensurePayment(client, order, finance, invoice),
    ]);
    expect(repeated.name).toBe(first.name);
    expect(erp.writes.filter((write) => write === "create:Payment Entry")).toHaveLength(1);
  });
  it("ne paie pas une commande livrée sans reversement reçu", async () => {
    const { order, invoice } = await invoiceFixture();
    await expect(ensurePayment(client, order, financeState(), invoice)).rejects.toThrow(
      "reversement",
    );
    expect(erp.writes).not.toContain("create:Payment Entry");
  });
  it("bloque les écarts de total et les modifications de lignes après synchronisation", async () => {
    const { order, customer, so } = await invoiceFixture();
    erp.docs.get(`Sales Order/${so.name}`)!.grand_total = 1;
    await expect(ensureSalesOrder(client, order, customer.name)).rejects.toThrow("total");
  });
  it("annule la Sales Order une seule fois", async () => {
    const order = financeOrder();
    const customer = await ensureCustomer(client, order);
    const so = await ensureSalesOrder(client, order, customer.name);
    await cancelSalesOrder(client, so.name, order.id);
    await cancelSalesOrder(client, so.name, order.id);
    expect(erp.writes.filter((write) => write === "cancel:Sales Order")).toHaveLength(1);
  });
  it("centralise le trigger de facturation sur delivered", () => {
    for (const status of ["pending", "confirmed", "shipped", "cancelled", "returned"])
      expect(shouldInvoice({ ...financeOrder(), status })).toBe(false);
    expect(shouldInvoice({ ...financeOrder(), status: "delivered" })).toBe(true);
  });
  it("compare les lignes sans dépendre de leur ordre et refuse un produit substitué", () => {
    const expected = [
      { item_code: "A", qty: 1, rate: 100 },
      { item_code: "B", qty: 2, rate: 200 },
    ];
    const doc = { name: "SO", docstatus: 1, items: [...expected].reverse() };
    expect(() => verifyLines(doc, expected)).not.toThrow();
    doc.items[0] = { item_code: "C", qty: 2, rate: 200 };
    expect(() => verifyLines(doc, expected)).toThrow("produits");
  });
  it("refuse une installation sans contrainte unique distante", async () => {
    await verifyErpSetup(client);
    erp.docs.get("Custom Field/Sales Invoice-custom_elegancia_key")!.unique = 0;
    await expect(verifyErpSetup(client)).rejects.toThrow("uniques");
  });
});
