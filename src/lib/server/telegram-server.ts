import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import { isTokenShaped } from "../order";
import {
  formatNewOrder,
  formatPackersParcel,
  type TelegramOrder,
  type TelegramParcel,
} from "./telegram-format";
import { logTelegramFailure, sendTelegram } from "./telegram";

function parseCanonicalOrder(value: unknown): TelegramOrder | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    ["customer_name", "phone", "wilaya", "address", "status", "created_at"].some(
      (key) => typeof row[key] !== "string",
    )
  )
    return null;
  if (!Number.isFinite(Date.parse(String(row.created_at)))) return null;
  if (
    ["subtotal", "delivery_fee", "total"].some(
      (key) =>
        typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || Number(row[key]) < 0,
    )
  )
    return null;
  if (
    ["commune", "stopdesk_name", "tracking_number"].some(
      (key) => row[key] != null && typeof row[key] !== "string",
    )
  )
    return null;
  if (row.delivery_method !== "home" && row.delivery_method !== "stopdesk") return null;
  if (!Array.isArray(row.items) || !row.items.length) return null;
  for (const item of row.items) {
    if (!item || typeof item !== "object") return null;
    const line = item as Record<string, unknown>;
    if (
      typeof line.product_name !== "string" ||
      (line.variant_label != null && typeof line.variant_label !== "string")
    )
      return null;
    if (
      !Number.isSafeInteger(line.quantity) ||
      Number(line.quantity) < 1 ||
      !Number.isSafeInteger(line.unit_price) ||
      Number(line.unit_price) < 0
    )
      return null;
  }
  return row as TelegramOrder;
}

/** Small best-effort replay guard for this warm instance; not durable cross-instance idempotency. */
const recent = new Map<string, number>();
const WINDOW_MS = 15 * 60_000;
function claimRecent(token: string, now: number) {
  for (const [key, at] of recent) if (at < now - WINDOW_MS) recent.delete(key);
  if (recent.has(token)) return false;
  if (recent.size >= 1_000) recent.delete(recent.keys().next().value!);
  recent.set(token, now);
  return true;
}

/** This public action accepts a capability token, never customer-supplied items or amounts. */
export async function runNotifyNewOrder(publicToken: unknown): Promise<void> {
  if (typeof publicToken !== "string" || !isTokenShaped(publicToken)) return;
  const token = publicToken.trim().toLowerCase();
  try {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      logTelegramFailure("order", "config_missing");
      return;
    }
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5_000) }),
      },
    });
    const { data, error } = await client.rpc("track_order", { p_token: token });
    if (error || !data || typeof data !== "object" || !("token" in data) || data.token !== token)
      return;
    const order = parseCanonicalOrder(data);
    const now = Date.now();
    if (
      !order ||
      Date.parse(order.created_at) < now - WINDOW_MS ||
      Date.parse(order.created_at) > now + 60_000
    )
      return;
    if (!claimRecent(token, now)) return;
    await sendTelegram(formatNewOrder(order), "order");
  } catch {
    logTelegramFailure("order", "network_or_runtime");
  }
}

/** Only called from the admin server flow once a persisted tracking number is confirmed. */
export async function notifyPackersParcel(order: TelegramParcel): Promise<void> {
  try {
    await sendTelegram(formatPackersParcel(order), "parcel");
  } catch {
    logTelegramFailure("parcel", "network_or_runtime");
  }
}
