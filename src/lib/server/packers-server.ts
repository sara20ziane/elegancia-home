import "@tanstack/react-start/server-only";
import { createClient } from "@supabase/supabase-js";
import { WILAYAS } from "../wilayas";
import { createPackersClient, readPackersConfig } from "./packers";

export type PackersActionResult =
  | { ok: true; tracking: string; stage: "created" | "shipped" }
  | { ok: false; error: string };

export type PackersConnectionResult =
  | { configured: false; connected: false }
  | { configured: true; connected: boolean };

export type PackersRateSyncResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

export type PackersStatusSyncResult =
  | { ok: true; checked: number; changed: number; failed: number }
  | { ok: false; error: string };

export type PackersStopDeskInfo = {
  commune: string;
  zipCode: string | null;
  label: string;
};

export type PackersStopDeskResult = {
  configured: boolean;
  wilayaCode: number | null;
  communes: string[];
  stopDesks: PackersStopDeskInfo[];
};

function userClient(accessToken: string) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function assertAdmin(accessToken: string) {
  const supabase = userClient(accessToken);
  if (!supabase) return { error: "Server Supabase configuration is missing.", supabase: null };

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return { error: "Not signed in.", supabase: null };

  const { data: role, error: roleError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (roleError || !role) {
    return { error: roleError?.message ?? "This account is not a shop administrator.", supabase: null };
  }
  return { error: null, supabase };
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-\s]/g, "")
    .trim();
}

function normalizeStatus(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/[\s-]+/g, "_");
}

function resolveWilayaCode(name: string): number | null {
  const key = normalize(name);
  const match = WILAYAS.find((wilaya) => normalize(wilaya.fr) === key || normalize(wilaya.ar) === key);
  return match?.code ?? null;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractPackersOrder(payload: unknown, tracking: string): Record<string, unknown> | null {
  const root = objectRecord(payload);
  const nested = objectRecord(root?.data);
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.data)
      ? root.data
      : Array.isArray(root?.orders)
        ? root.orders
        : Array.isArray(nested?.orders)
          ? nested.orders
          : nested
            ? [nested]
            : root
              ? [root]
              : [];

  const records = rows
    .map(objectRecord)
    .filter((row): row is Record<string, unknown> => row !== null);
  const exact = records.find((row) =>
    [row.tracking, row.tracking_number, row.numero_suivi].some(
      (candidate) => candidate != null && String(candidate) === tracking,
    ),
  );
  return exact ?? (records.length === 1 ? records[0] : null);
}

function rawPackersStatus(order: Record<string, unknown>): string | null {
  for (const candidate of [
    order.status,
    order.statut,
    order.status_name,
    order.etat,
    order.current_status,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

type CarrierState = "pending" | "shipped" | "delivered" | "refused" | "returned" | "cancelled" | "unknown";

const DELIVERED = new Set([
  "livred",
  "livre",
  "delivered",
  "encaissed",
  "payed",
  "livre_non_encaisse",
  "encaisse_non_paye",
  "livre_encaisse_non_paye",
  "paiements_prets",
  "paiement_pret",
  "paye_et_archive",
  "paiement_archive",
]);
const RETURNED = new Set([
  "return_received",
  "returned",
  "retourne",
  "retour_recu",
  "retour_archive",
  "retours_recu",
  "retours_a_dispatcher_vers_stock",
  "retours_en_transit_stock",
  "retours_en_stock",
  "retours_archive",
]);
const CANCELLED = new Set(["annule", "annulee", "cancelled"]);
const REFUSED = new Set(["refused", "refuse", "refuse_par_client", "client_refuse"]);
const SHIPPED = new Set([
  "picked",
  "picked_up",
  "collected",
  "ramasse",
  "accepted_by_carrier",
  "dispatched_to_driver",
  "attempt_delivery",
  "en_ramassage",
  "vers_hub",
  "en_hub",
  "vers_wilaya",
  "in_hub",
  "in_transit",
  "en_transit",
  "transferred",
  "en_livraison",
  "out_for_delivery",
  "en_cours_de_livraison",
  "stop_desk",
  "return_asked",
  "return_in_transit",
  "return_initiated",
  "returning",
  "en_retour",
  "retour_chez_livreur",
  "retour_transit_entrepot",
  "retour_en_traitement",
  "retours_chez_livreur",
  "retours_en_traitement",
  "retours_prets",
]);
const PENDING = new Set([
  "order_information_received_by_carrier",
  "prete_a_expedier",
  "pret_a_expedier",
  "pret_a_preparer",
  "en_preparation_stock",
  "stock_en_preparation",
  "en_preparation",
  "suspendu",
  "suspendus",
  "created",
  "pending",
  "en_attente",
  "ready",
]);

function classifyPackersStatus(rawStatus: string): CarrierState {
  const key = normalizeStatus(rawStatus);
  if (DELIVERED.has(key)) return "delivered";
  if (RETURNED.has(key)) return "returned";
  if (CANCELLED.has(key)) return "cancelled";
  if (REFUSED.has(key)) return "refused";
  if (SHIPPED.has(key)) return "shipped";
  if (PENDING.has(key)) return "pending";
  return "unknown";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runPackersConnectionTest(): Promise<PackersConnectionResult> {
  const config = readPackersConfig();
  if (!config) return { configured: false, connected: false };
  const connected = await createPackersClient(config).validateToken();
  return { configured: true, connected };
}

export async function runSyncPackersRates(input: {
  accessToken: string;
}): Promise<PackersRateSyncResult> {
  const auth = await assertAdmin(input.accessToken);
  if (auth.error || !auth.supabase) return { ok: false, error: auth.error ?? "Not authorized." };

  const config = readPackersConfig();
  if (!config) {
    return { ok: false, error: "Packers n’est pas encore connecté. Ajoute PACKERS_API_TOKEN dans Vercel." };
  }

  try {
    const rates = await createPackersClient(config).getRates();
    const rows = rates
      .map((rate) => {
        const canonical = WILAYAS.find((wilaya) => wilaya.code === rate.wilayaId);
        if (!canonical) return null;
        return {
          wilaya: canonical.fr,
          fee: Math.max(0, Math.round(rate.homeFee)),
          stopdesk_fee:
            rate.stopDeskFee === null ? null : Math.max(0, Math.round(rate.stopDeskFee)),
          eta_days: 3,
          is_active: true,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) {
      return { ok: false, error: "Packers n’a renvoyé aucun tarif de livraison." };
    }

    const { error: syncError } = await auth.supabase.rpc(
      "sync_packers_delivery_rates" as never,
      { p_rows: rows } as never,
    );
    if (syncError) return { ok: false, error: syncError.message };

    return { ok: true, count: rows.length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible de synchroniser les tarifs Packers.",
    };
  }
}

export async function runSyncPackersOrderStatuses(input: {
  accessToken: string;
}): Promise<PackersStatusSyncResult> {
  const auth = await assertAdmin(input.accessToken);
  if (auth.error || !auth.supabase) return { ok: false, error: auth.error ?? "Not authorized." };

  const config = readPackersConfig();
  if (!config) return { ok: false, error: "Packers n’est pas encore connecté." };

  const { data: orders, error } = await auth.supabase
    .from("orders")
    .select(
      "id, status, tracking_number, shipped_at, delivered_at, refused_at, refused_reason, carrier_status, carrier_status_updated_at",
    )
    .eq("carrier", "Packers")
    .not("tracking_number", "is", null)
    .in("status", ["confirmed", "shipped"])
    .order("carrier_status_updated_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return { ok: false, error: error.message };
  if (!orders?.length) return { ok: true, checked: 0, changed: 0, failed: 0 };

  const client = createPackersClient(config);
  let changed = 0;
  let failed = 0;

  for (let index = 0; index < orders.length; index += 1) {
    if (index > 0) await wait(1_250);
    const order = orders[index];
    const tracking = String(order.tracking_number ?? "");
    if (!tracking) continue;

    try {
      const payload = await client.getOrder(tracking);
      const carrierOrder = extractPackersOrder(payload, tracking);
      const rawStatus = carrierOrder ? rawPackersStatus(carrierOrder) : null;
      if (!rawStatus) {
        failed += 1;
        continue;
      }

      const now = new Date().toISOString();
      const carrierState = classifyPackersStatus(rawStatus);
      const patch: Record<string, unknown> = {
        carrier_status: rawStatus,
        carrier_status_updated_at: now,
      };
      let transitioned = false;

      if (carrierState === "shipped" && order.status === "confirmed") {
        patch.status = "shipped";
        patch.shipped_at = order.shipped_at ?? now;
        transitioned = true;
      } else if (carrierState === "delivered") {
        patch.status = "delivered";
        patch.delivered_at = order.delivered_at ?? now;
        transitioned = order.status !== "delivered";
      } else if (carrierState === "refused") {
        patch.status = "refused";
        patch.refused_at = order.refused_at ?? now;
        patch.refused_reason = order.refused_reason ?? `Packers · ${rawStatus}`;
        transitioned = order.status !== "refused";
      } else if (carrierState === "returned") {
        patch.status = "returned";
        transitioned = order.status !== "returned";
      } else if (carrierState === "cancelled") {
        patch.status = "cancelled";
        transitioned = order.status !== "cancelled";
      }

      const { error: saveError } = await auth.supabase
        .from("orders")
        .update(patch)
        .eq("id", order.id)
        .in("status", ["confirmed", "shipped"]);
      if (saveError) {
        failed += 1;
        continue;
      }
      if (transitioned) changed += 1;
    } catch {
      failed += 1;
    }
  }

  return { ok: true, checked: orders.length, changed, failed };
}

export async function runListPackersStopDeskCommunes(
  wilaya: string,
): Promise<PackersStopDeskResult> {
  const config = readPackersConfig();
  const wilayaCode = resolveWilayaCode(wilaya);
  if (!config) return { configured: false, wilayaCode, communes: [], stopDesks: [] };
  if (!wilayaCode) return { configured: true, wilayaCode: null, communes: [], stopDesks: [] };

  try {
    const communes = await createPackersClient(config).getCommunes(wilayaCode);
    const stopDesks = communes
      .filter((commune) => commune.hasStopDesk)
      .map((commune) => ({
        commune: commune.name,
        zipCode: commune.zipCode,
        label: `Packers Stop Desk · ${commune.name}`,
      }))
      .sort((a, b) => a.commune.localeCompare(b.commune, "fr"));

    return {
      configured: true,
      wilayaCode,
      communes: stopDesks.map((desk) => desk.commune),
      stopDesks,
    };
  } catch {
    return { configured: true, wilayaCode, communes: [], stopDesks: [] };
  }
}

export async function runCreatePackersParcel(input: {
  orderId: string;
  accessToken: string;
}): Promise<PackersActionResult> {
  const auth = await assertAdmin(input.accessToken);
  if (auth.error || !auth.supabase) return { ok: false, error: auth.error ?? "Not authorized." };

  const config = readPackersConfig();
  if (!config) {
    return { ok: false, error: "Packers n’est pas encore connecté. Ajoute PACKERS_API_TOKEN dans Vercel." };
  }

  const { data: order, error } = await auth.supabase
    .from("orders")
    .select(
      "id, public_token, customer_name, phone, wilaya, commune, address, note, total, status, tracking_number, delivery_method, stopdesk_name, order_items ( product_name, variant_label, quantity )",
    )
    .eq("id", input.orderId)
    .maybeSingle();

  if (error || !order) return { ok: false, error: error?.message ?? "Commande introuvable." };
  if (order.status !== "confirmed") {
    return { ok: false, error: "Confirme d’abord la commande avant de l’envoyer à Packers." };
  }
  if (order.tracking_number) {
    return { ok: false, error: `Cette commande a déjà le suivi ${order.tracking_number}.` };
  }

  const wilayaCode = resolveWilayaCode(String(order.wilaya));
  if (!wilayaCode) return { ok: false, error: `Wilaya non reconnue: ${order.wilaya}.` };

  const commune = String(order.stopdesk_name || order.commune || "").trim();
  if (!commune) return { ok: false, error: "La commune est obligatoire pour Packers." };

  const client = createPackersClient(config);
  const stopDesk = order.delivery_method === "stopdesk";
  if (stopDesk) {
    try {
      const communes = await client.getCommunes(wilayaCode);
      const candidate = communes.find((item) => normalize(item.name) === normalize(commune));
      if (!candidate?.hasStopDesk) {
        return {
          ok: false,
          error: `Packers n’indique pas de Stop Desk disponible pour ${commune}. Choisis une commune Stop Desk valide.`,
        };
      }
    } catch (checkError) {
      return {
        ok: false,
        error: checkError instanceof Error ? checkError.message : "Impossible de vérifier le Stop Desk Packers.",
      };
    }
  }

  const items = (order.order_items ?? []) as Array<{
    product_name: string;
    variant_label: string | null;
    quantity: number;
  }>;
  const products = items
    .map((item) => [item.product_name, item.variant_label, `x${item.quantity}`].filter(Boolean).join(" "))
    .join(", ");
  const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 1;

  try {
    const created = await client.createOrder({
      reference: String(order.public_token || order.id).slice(0, 36),
      customerName: String(order.customer_name),
      phone: String(order.phone),
      address: String(order.address),
      commune,
      wilayaCode,
      amount: Number(order.total),
      products,
      quantity,
      stopDesk,
      note: order.note ? String(order.note) : null,
    });

    if (created.success !== true || !created.tracking) {
      return { ok: false, error: created.message || "Packers a refusé la création du colis." };
    }

    const tracking = String(created.tracking);
    const { error: saveError } = await auth.supabase
      .from("orders")
      .update({
        carrier: "Packers",
        tracking_number: tracking,
        carrier_status: "prete_a_expedier",
        carrier_status_updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (saveError) return { ok: false, error: saveError.message };

    return { ok: true, tracking, stage: "created" };
  } catch (createError) {
    return {
      ok: false,
      error: createError instanceof Error ? createError.message : "Échec de la création Packers.",
    };
  }
}

export async function runValidatePackersParcel(input: {
  orderId: string;
  accessToken: string;
  askCollection?: boolean;
}): Promise<PackersActionResult> {
  const auth = await assertAdmin(input.accessToken);
  if (auth.error || !auth.supabase) return { ok: false, error: auth.error ?? "Not authorized." };

  const config = readPackersConfig();
  if (!config) return { ok: false, error: "Packers n’est pas encore connecté." };

  const { data: order, error } = await auth.supabase
    .from("orders")
    .select("id, status, carrier, tracking_number")
    .eq("id", input.orderId)
    .maybeSingle();
  if (error || !order) return { ok: false, error: error?.message ?? "Commande introuvable." };
  if (order.status !== "confirmed") return { ok: false, error: "La commande n’est plus au statut confirmé." };
  if (order.carrier !== "Packers" || !order.tracking_number) {
    return { ok: false, error: "Crée d’abord le colis chez Packers." };
  }

  try {
    const client = createPackersClient(config);
    const valid = await client.validateOrder(String(order.tracking_number), Boolean(input.askCollection));
    if (!valid) return { ok: false, error: "Packers n’a pas validé l’expédition." };

    const { error: saveError } = await auth.supabase
      .from("orders")
      .update({ status: "shipped", shipped_at: new Date().toISOString() })
      .eq("id", order.id);
    if (saveError) return { ok: false, error: saveError.message };

    return { ok: true, tracking: String(order.tracking_number), stage: "shipped" };
  } catch (shipError) {
    return {
      ok: false,
      error: shipError instanceof Error ? shipError.message : "Échec de la validation Packers.",
    };
  }
}
