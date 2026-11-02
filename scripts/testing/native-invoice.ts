import type { InvoicePayload } from "../../src/lib/finance/types";
export function invoiceFixture(count = 2): InvoicePayload {
  return {
    kind: "invoice",
    number: "FAC-2026-000001",
    date: "2026-11-02",
    reference: "TEST-ORDER",
    customer_name: "عميلة تجريبية",
    phone: "0555123456",
    address: "Adresse de test",
    commune: "Alger Centre",
    wilaya: "Alger",
    currency: "DZD",
    subtotal: count * 3000,
    delivery_fee: 600,
    total: count * 3000 + 600,
    tax: 0,
    tax_rate: null,
    tax_label: null,
    renderer_version: "elegancia-a4-v1",
    issuer: { name: "Elegancia Home" },
    items: Array.from({ length: count }, (_, i) => ({
      name: `Parure élégante ${i + 1} مفروشات`,
      sku: `TEST-${i + 1}`,
      variant: "Queen / Vert sauge",
      quantity: 1,
      unit_price: 3000,
      discount: 0,
      total: 3000,
    })),
  };
}
