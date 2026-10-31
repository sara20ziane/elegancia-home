import type { TelegramOrder } from "../../src/lib/server/telegram-format";

/** Synthetic customer and order; never a live Telegram credential or real purchase. */
export const telegramOrder: TelegramOrder = {
  customer_name: "Cliente test",
  phone: "0555550199",
  wilaya: "Alger",
  commune: "Alger Centre",
  address: "Adresse de test",
  delivery_method: "home",
  stopdesk_name: null,
  subtotal: 7500,
  delivery_fee: 400,
  total: 7900,
  status: "pending",
  tracking_number: null,
  created_at: "2026-10-31T13:09:00Z",
  items: [
    {
      product_name: "Aveline",
      variant_label: "Queen — Parure de drap",
      quantity: 1,
      unit_price: 7500,
    },
  ],
};
