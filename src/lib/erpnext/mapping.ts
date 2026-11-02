import { ErpError } from "./errors";
import type { ErpConfig, FinanceOrder } from "./types";

export function normalizeCustomerPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").replace(/^00213/, "213");
  const local = digits.startsWith("213") ? `0${digits.slice(3)}` : digits;
  if (!/^0[567][0-9]{8}$/.test(local)) {
    throw new ErpError("customer_phone", "Téléphone client invalide pour le rapprochement.");
  }
  return local;
}

export function customerFields(order: FinanceOrder) {
  return {
    customer_name: order.customer_name,
    customer_type: "Individual",
    custom_elegancia_phone: normalizeCustomerPhone(order.phone),
    custom_elegancia_address: order.address,
    custom_elegancia_commune: order.commune || "",
    custom_elegancia_wilaya: order.wilaya,
  };
}

export function orderFields(order: FinanceOrder) {
  return {
    custom_elegancia_order_id: order.id,
    custom_elegancia_phone: order.phone,
    custom_elegancia_address: order.address,
    custom_elegancia_commune: order.commune || "",
    custom_elegancia_wilaya: order.wilaya,
    custom_elegancia_delivery: [
      order.delivery_method,
      order.stopdesk_name,
      order.carrier,
      order.tracking_number,
    ]
      .filter(Boolean)
      .join(" · "),
    custom_elegancia_delivery_fee: order.delivery_fee,
  };
}

export function mapSalesOrder(order: FinanceOrder, customer: string, config: ErpConfig) {
  if (
    !order.items.length ||
    ![order.subtotal, order.delivery_fee, order.total].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
  )
    throw new ErpError("amount_mismatch", "Montants locaux invalides.");
  let subtotal = 0;
  const items = order.items.map((item) => {
    if (!item.item_code || !item.variant_id) {
      throw new ErpError("item_mapping", "Correspondance variante → Item ERPNext manquante.");
    }
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isSafeInteger(item.unit_price) ||
      item.unit_price < 0
    ) {
      throw new ErpError("amount_mismatch", "Ligne locale invalide.");
    }
    subtotal += item.quantity * item.unit_price;
    return {
      item_code: item.item_code,
      item_name: item.product_name,
      description: [item.product_name, item.variant_label].filter(Boolean).join(" / "),
      custom_elegancia_sku: item.sku || "",
      qty: item.quantity,
      rate: item.unit_price,
      warehouse: config.warehouse,
    };
  });
  if (subtotal !== order.subtotal || subtotal + order.delivery_fee !== order.total) {
    throw new ErpError(
      "amount_mismatch",
      "Les lignes locales ne correspondent pas au total enregistré.",
    );
  }
  if (order.delivery_fee > 0)
    items.push({
      item_code: config.shippingItem,
      item_name: "Frais de livraison",
      description: "Frais de livraison",
      custom_elegancia_sku: "",
      qty: 1,
      rate: order.delivery_fee,
      warehouse: config.warehouse,
    });
  return {
    ...orderFields(order),
    company: config.company,
    customer,
    currency: "DZD",
    selling_price_list: config.priceList,
    price_list_currency: "DZD",
    conversion_rate: 1,
    plc_conversion_rate: 1,
    transaction_date: (order.confirmed_at || order.created_at).slice(0, 10),
    delivery_date: new Date().toISOString().slice(0, 10),
    ignore_pricing_rule: 1,
    disable_rounded_total: 1,
    taxes_and_charges: config.taxTemplate || "",
    items,
  };
}
