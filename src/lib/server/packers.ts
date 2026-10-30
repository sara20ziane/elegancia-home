import "@tanstack/react-start/server-only";

/**
 * Packers runs on the EcoTrack delivery engine.
 *
 * The API token is a full-access carrier credential. Keep this module server-only
 * and never expose PACKERS_API_TOKEN through a VITE_ environment variable.
 */
const DEFAULT_BASE_URL = "https://packers.ecotrack.dz/";

export type PackersConfig = {
  token: string;
  baseUrl: string;
};

export type PackersCreateOrderInput = {
  reference: string;
  customerName: string;
  phone: string;
  address: string;
  commune: string;
  wilayaCode: number;
  amount: number;
  products: string;
  quantity: number;
  stopDesk: boolean;
  note?: string | null;
  fragile?: boolean;
};

export type PackersCreateOrderResult = {
  success: boolean;
  tracking?: string;
  message?: string;
  [key: string]: unknown;
};

export type PackersCommune = {
  name: string;
  wilayaId: number;
  zipCode: string | null;
  hasStopDesk: boolean;
};

export function readPackersConfig(): PackersConfig | null {
  const token = process.env.PACKERS_API_TOKEN?.trim();
  if (!token) return null;
  const rawBase = process.env.PACKERS_BASE_URL?.trim() || DEFAULT_BASE_URL;
  return {
    token,
    baseUrl: rawBase.endsWith("/") ? rawBase : `${rawBase}/`,
  };
}

export function createPackersClient(config: PackersConfig) {
  async function request<T>(
    path: string,
    options: { method?: string; params?: Record<string, string | number | boolean | null | undefined> } = {},
  ): Promise<T> {
    const url = new URL(path.replace(/^\//, ""), config.baseUrl);
    url.searchParams.set("api_token", config.token);
    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      cache: "no-store",
    });

    const body = await safeJson(response);
    if (!response.ok) {
      const detail = extractMessage(body);
      throw new Error(detail ? `Packers: ${detail}` : `Packers API error ${response.status}.`);
    }
    return body as T;
  }

  return {
    async validateToken(): Promise<boolean> {
      try {
        const result = await request<{ success?: boolean }>("api/v1/validate/token");
        return result?.success === true;
      } catch {
        return false;
      }
    },

    createOrder(input: PackersCreateOrderInput) {
      return request<PackersCreateOrderResult>("api/v1/create/order", {
        method: "POST",
        params: {
          reference: input.reference,
          nom_client: input.customerName,
          telephone: input.phone,
          adresse: input.address,
          commune: input.commune,
          code_wilaya: input.wilayaCode,
          montant: input.amount,
          produit: input.products,
          quantite: input.quantity,
          type: 1,
          stop_desk: input.stopDesk ? 1 : 0,
          remarque: input.note ?? undefined,
          fragile: input.fragile ? 1 : undefined,
        },
      });
    },

    async validateOrder(tracking: string, askCollection = false): Promise<boolean> {
      const result = await request<Record<string, unknown>>("api/v1/valid/order", {
        method: "POST",
        params: {
          tracking,
          ask_collection: askCollection ? 1 : 0,
        },
      });
      return result?.success === true;
    },

    getOrder(tracking: string) {
      return request<Record<string, unknown>>("api/v1/get/orders", {
        params: { tracking },
      });
    },

    getFees() {
      return request<Record<string, unknown>>("api/v1/get/fees");
    },

    async getCommunes(wilayaId: number): Promise<PackersCommune[]> {
      const response = await request<unknown>("api/v1/get/communes", {
        params: { wilaya_id: wilayaId },
      });
      const rows = Array.isArray(response)
        ? response
        : response && typeof response === "object"
          ? Object.values(response as Record<string, unknown>)
          : [];

      return rows
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
        .map((row) => ({
          name: String(row.nom ?? row.name ?? ""),
          wilayaId: Number(row.wilaya_id ?? wilayaId),
          zipCode: row.code_postal != null ? String(row.code_postal) : null,
          hasStopDesk: toBool01(row.has_stop_desk),
        }))
        .filter((row) => row.name.length > 0);
    },
  };
}

function toBool01(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const candidate = record.message ?? record.error ?? record.errors;
  if (typeof candidate === "string") return candidate;
  if (candidate) {
    try {
      return JSON.stringify(candidate);
    } catch {
      return null;
    }
  }
  return null;
}
