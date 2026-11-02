import "@tanstack/react-start/server-only";
import { ErpError } from "./errors";
import type { ErpConfig } from "./types";

export function erpEnabled(): boolean {
  return process.env.ERPNEXT_ENABLED === "true";
}

export function readErpConfig(): ErpConfig {
  if (!erpEnabled()) throw new ErpError("disabled", "ERPNext est désactivé.");
  const required = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) throw new ErpError("configuration", `Variable serveur manquante : ${name}.`);
    return value;
  };
  let url: URL;
  try {
    url = new URL(required("ERPNEXT_URL"));
  } catch {
    throw new ErpError("configuration", "ERPNEXT_URL doit être une origine HTTPS valide.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new ErpError(
      "configuration",
      "ERPNEXT_URL doit être une origine HTTPS sans identifiants.",
    );
  }
  return {
    url: url.origin,
    apiKey: required("ERPNEXT_API_KEY"),
    apiSecret: required("ERPNEXT_API_SECRET"),
    company: required("ERPNEXT_COMPANY"),
    warehouse: required("ERPNEXT_WAREHOUSE"),
    priceList: required("ERPNEXT_PRICE_LIST"),
    shippingItem: required("ERPNEXT_SHIPPING_ITEM"),
    taxTemplate: process.env.ERPNEXT_SALES_TAX_TEMPLATE?.trim() || undefined,
    cashAccount: process.env.ERPNEXT_CASH_ACCOUNT?.trim() || undefined,
    modeOfPayment: process.env.ERPNEXT_MODE_OF_PAYMENT?.trim() || undefined,
  };
}
