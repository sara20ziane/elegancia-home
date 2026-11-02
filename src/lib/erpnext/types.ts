export type FinanceStatus = "unsynced" | "synced" | "invoiced" | "paid" | "error" | "cancelled";

export type Finance = {
  order_id: string;
  erp_customer_id: string | null;
  erp_sales_order_id: string | null;
  erp_sales_invoice_id: string | null;
  erp_payment_entry_id: string | null;
  erp_sync_status: FinanceStatus;
  erp_last_sync_at: string | null;
  erp_sync_error: string | null;
  cod_received_at: string | null;
  cod_received_by: string | null;
  cod_received_amount: number | null;
  cod_receipt_reference: string | null;
};

export type FinanceOrder = {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  commune: string | null;
  wilaya: string;
  status: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  carrier: string | null;
  tracking_number: string | null;
  delivery_method: string;
  stopdesk_name: string | null;
  items: Array<{
    id: string;
    variant_id: string | null;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_price: number;
    item_code: string | null;
    sku: string | null;
  }>;
};

export type ErpDocument = {
  name: string;
  docstatus: number;
  [field: string]: unknown;
};
export type ErpPayload = Record<string, unknown>;
export type SyncResult = { ok: boolean; enabled: boolean; error?: string };

export type ErpConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
  company: string;
  warehouse: string;
  priceList: string;
  shippingItem: string;
  taxTemplate?: string;
  cashAccount?: string;
  modeOfPayment?: string;
};
