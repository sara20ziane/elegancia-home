import "@tanstack/react-start/server-only";
import type { TrackedOrder } from "../order";

export type TelegramOrder = Pick<
  TrackedOrder,
  | "customer_name"
  | "phone"
  | "wilaya"
  | "commune"
  | "address"
  | "delivery_method"
  | "stopdesk_name"
  | "subtotal"
  | "delivery_fee"
  | "total"
  | "status"
  | "tracking_number"
  | "created_at"
  | "items"
>;
export type TelegramParcel = Pick<
  TelegramOrder,
  "customer_name" | "phone" | "wilaya" | "commune" | "delivery_method" | "total" | "tracking_number"
>;
const label = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() || "Non renseigné";
const mode = (method: string | undefined) =>
  method === "stopdesk" ? "Stop Desk" : "Livraison à domicile";
const amount = (value: number) =>
  `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(value).replace(/[\u00a0\u202f]/g, " ")} DA`;
const STATUSES: Record<string, string> = {
  pending: "À confirmer",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  refused: "Refusée",
  cancelled: "Annulée",
  returned: "Retournée",
};

/** Plain text only; public tracking tokens and customer notes are deliberately omitted. */
export function formatNewOrder(order: TelegramOrder): string {
  const date = new Intl.DateTimeFormat("fr-DZ", {
    timeZone: "Africa/Algiers",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(order.created_at));
  return [
    "🛍️ NOUVELLE COMMANDE — ELEGANCIA HOME",
    "",
    "👤 CLIENTE",
    `Nom : ${label(order.customer_name)}`,
    `Téléphone : ${label(order.phone)}`,
    `Wilaya : ${label(order.wilaya)}`,
    `Commune : ${label(order.commune)}`,
    `Adresse : ${label(order.address)}`,
    "",
    "🚚 LIVRAISON",
    `Mode : ${mode(order.delivery_method)}`,
    ...(order.delivery_method === "stopdesk"
      ? [`Point Stop Desk : ${label(order.stopdesk_name)}`]
      : []),
    "",
    "🛏️ COMMANDE",
    ...order.items.flatMap((item) => [
      `• ${label(item.product_name)}${item.variant_label ? ` — ${label(item.variant_label)}` : ""}`,
      `  Quantité : ${item.quantity}`,
      `  Prix unitaire : ${amount(item.unit_price)}`,
      `  Total ligne : ${amount(item.quantity * item.unit_price)}`,
      "",
    ]),
    "💰 MONTANTS",
    `Sous-total : ${amount(order.subtotal)}`,
    `Livraison : ${amount(order.delivery_fee)}`,
    `TOTAL : ${amount(order.total)}`,
    "",
    `⏳ Statut : ${STATUSES[order.status] ?? "Non renseigné"}`,
    `🕐 Date : ${date}`,
    order.tracking_number
      ? `🔎 Tracking Packers : ${label(order.tracking_number)}`
      : "🔎 Tracking Packers : en attente de création du colis",
  ].join("\n");
}

export function formatPackersParcel(order: TelegramParcel): string {
  return [
    "📦 COLIS PACKERS CRÉÉ — ELEGANCIA HOME",
    "",
    `👤 ${label(order.customer_name)}`,
    `📞 ${label(order.phone)}`,
    "",
    `🚚 ${mode(order.delivery_method)}`,
    `📍 ${label(order.wilaya)} — ${label(order.commune)}`,
    "",
    `💰 Montant COD : ${amount(order.total)}`,
    "",
    "🔎 Tracking Packers :",
    label(order.tracking_number),
  ].join("\n");
}

/** Keep every item and character; split at line boundaries without splitting surrogate pairs. */
export function splitTelegramText(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 4_000) {
    let end = rest.lastIndexOf("\n", 4_000);
    if (end < 1) end = 4_000;
    if (/[\uD800-\uDBFF]/.test(rest[end - 1])) end -= 1;
    chunks.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  if (rest) chunks.push(rest);
  return chunks;
}
