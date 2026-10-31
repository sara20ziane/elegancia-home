import { isTokenShaped } from "./order";

export type SavedOrder = { publicToken: string; createdAt: string | null };
export const SAVED_ORDERS_KEY = "elegancia-saved-orders-v1";
export const SAVED_ORDERS_EVENT = "elegancia-saved-orders-changed";
const MAX_ORDERS = 30;

/** Whitelist fields on both read and write; never persist the tracking RPC payload. */
function sanitize(value: unknown): SavedOrder[] {
  if (!Array.isArray(value)) return [];
  const orders = new Map<string, SavedOrder>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.publicToken !== "string" || !isTokenShaped(row.publicToken)) continue;
    const publicToken = row.publicToken.trim().toLowerCase();
    if (orders.has(publicToken)) continue;
    const createdAt =
      typeof row.createdAt === "string" && Number.isFinite(Date.parse(row.createdAt))
        ? new Date(row.createdAt).toISOString()
        : null;
    orders.set(publicToken, { publicToken, createdAt });
    if (orders.size === MAX_ORDERS) break;
  }
  return [...orders.values()];
}

export function readSavedOrders(): SavedOrder[] {
  try {
    if (typeof window === "undefined") return [];
    return sanitize(JSON.parse(window.localStorage.getItem(SAVED_ORDERS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writeSavedOrders(orders: SavedOrder[]): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify(sanitize(orders)));
    window.dispatchEvent(new Event(SAVED_ORDERS_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function saveOrderLocally(order: SavedOrder): boolean {
  if (!isTokenShaped(order.publicToken)) return false;
  const existing = readSavedOrders();
  const token = order.publicToken.trim().toLowerCase();
  const prior = existing.find((item) => item.publicToken === token);
  return writeSavedOrders([
    { publicToken: token, createdAt: prior?.createdAt ?? order.createdAt },
    ...existing.filter((item) => item.publicToken !== token),
  ]);
}

/** Removes a browser bookmark only; never calls Supabase. */
export function removeSavedOrder(publicToken: string): boolean {
  return writeSavedOrders(readSavedOrders().filter((order) => order.publicToken !== publicToken));
}
