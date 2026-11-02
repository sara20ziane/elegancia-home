import type { ErpConfig, Finance, FinanceOrder } from "../../src/lib/erpnext/types";

export const erpConfig: ErpConfig = {
  url: "https://erp.test",
  apiKey: "test-key",
  apiSecret: "test-secret",
  company: "Elegancia Test",
  warehouse: "Test Warehouse",
  priceList: "Test DZD",
  shippingItem: "DELIVERY",
  cashAccount: "Cash Test",
  modeOfPayment: "Cash",
};

export function financeOrder(): FinanceOrder {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    customer_name: "Cliente test",
    phone: "+213 555 123 456",
    address: "Adresse de test",
    commune: "Commune test",
    wilaya: "Alger",
    status: "confirmed",
    confirmed_at: "2026-11-01T10:00:00Z",
    created_at: "2026-11-01T09:00:00Z",
    delivered_at: "2026-11-02T10:00:00Z",
    subtotal: 6000,
    delivery_fee: 600,
    total: 6600,
    carrier: "Packers",
    tracking_number: "SYNTHETIC-TRACKING",
    delivery_method: "home",
    stopdesk_name: null,
    items: [
      {
        id: "line-1",
        variant_id: "variant-1",
        product_name: "Aveline",
        variant_label: "Queen / Sauge",
        quantity: 2,
        unit_price: 3000,
        item_code: "AVELINE-QUEEN-SAUGE",
        sku: "AV-Q-S",
      },
    ],
  };
}

export function financeState(): Finance {
  return {
    order_id: financeOrder().id,
    erp_customer_id: null,
    erp_sales_order_id: null,
    erp_sales_invoice_id: null,
    erp_payment_entry_id: null,
    erp_sync_status: "unsynced",
    erp_last_sync_at: null,
    erp_sync_error: null,
    cod_received_at: null,
    cod_received_by: null,
    cod_received_amount: null,
    cod_receipt_reference: null,
  };
}
