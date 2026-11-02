import type { Json } from "../supabase/types";

export type FinanceRow = { [key: string]: Json | undefined };
export type FinanceResult = { ok: true; data: Json } | { ok: false; error: string };
export type FinanceOperation =
  | "list"
  | "options"
  | "dashboard"
  | "report"
  | "order"
  | "configure"
  | "entity"
  | "cost"
  | "prepare"
  | "issue"
  | "credit"
  | "settlement"
  | "withholding"
  | "expense"
  | "purchase"
  | "pay_purchase"
  | "refund"
  | "adjust";
export type FinanceInput = { accessToken: string; operation: FinanceOperation; input: FinanceRow };
type InvoiceLine = {
  name: string;
  sku: string | null;
  variant: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
};
export type InvoicePayload = {
  kind: "invoice" | "credit";
  number: string;
  original_number?: string;
  date: string;
  reference: string;
  customer_name: string;
  phone: string;
  address: string;
  commune: string | null;
  wilaya: string;
  currency: "DZD";
  subtotal: number;
  delivery_fee: number;
  total: number;
  tax: number;
  tax_rate: number | null;
  tax_label: string | null;
  reason?: string;
  renderer_version: string;
  items: InvoiceLine[];
  issuer: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    rc?: string | null;
    nif?: string | null;
    nis?: string | null;
    ai?: string | null;
    logo_path?: string | null;
    brand_color?: string | null;
  };
};
export type InvoiceDocument = {
  id: string;
  number: string;
  payload: InvoicePayload;
  pdf_path: string | null;
  pdf_sha256: string | null;
  renderer_version: string;
};
