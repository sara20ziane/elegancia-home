import "@tanstack/react-start/server-only";
import { WILAYAS } from "../wilayas";
import { assertAdmin } from "./packers-auth";
import { createPackersClient, readPackersConfig } from "./packers";
import type {
  PackersConnectionResult,
  PackersRateSyncResult,
  PackersStopDeskResult,
} from "./packers-server";

export function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[-\s]/g, "")
    .trim();
}

export function resolveWilayaCode(name: string): number | null {
  const key = normalize(name);
  const match = WILAYAS.find(
    (wilaya) => normalize(wilaya.fr) === key || normalize(wilaya.ar) === key,
  );
  return match?.code ?? null;
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
    return {
      ok: false,
      error: "Packers n’est pas encore connecté. Ajoute PACKERS_API_TOKEN dans Vercel.",
    };
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
      error:
        error instanceof Error ? error.message : "Impossible de synchroniser les tarifs Packers.",
    };
  }
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
