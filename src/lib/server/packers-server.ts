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

function resolveWilayaCode(name: string): number | null {
  const key = normalize(name);
  const match = WILAYAS.find((wilaya) => normalize(wilaya.fr) === key || normalize(wilaya.ar) === key);
  return match?.code ?? null;
}

export async function runPackersConnectionTest(): Promise<PackersConnectionResult> {
  const config = readPackersConfig();
  if (!config) return { configured: false, connected: false };
  const connected = await createPackersClient(config).validateToken();
  return { configured: true, connected };
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
      .update({ carrier: "Packers", tracking_number: tracking })
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
