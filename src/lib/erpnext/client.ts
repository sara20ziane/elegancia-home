import "@tanstack/react-start/server-only";
import { ErpError } from "./errors";
import type { ErpConfig } from "./types";

export class ErpClient {
  private readonly deadline: number;

  constructor(
    readonly config: ErpConfig,
    private readonly fetcher: typeof fetch = fetch,
    budgetMs = 40_000,
  ) {
    this.deadline = Date.now() + budgetMs;
  }

  private async request(path: string, method: string, body?: unknown): Promise<Response> {
    // Only internal, relative API paths. Redirects must never carry our credentials elsewhere.
    if (!path.startsWith("/api/") || path.startsWith("//")) {
      throw new ErpError("configuration", "Chemin ERPNext invalide.");
    }
    const timeout = Math.min(8_000, this.deadline - Date.now());
    if (timeout <= 0) throw new ErpError("timeout", "Délai ERPNext dépassé.", true);
    try {
      const response = await this.fetcher(`${this.config.url}${path}`, {
        method,
        headers: {
          Authorization: `token ${this.config.apiKey}:${this.config.apiSecret}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) {
        const status = response.status;
        throw new ErpError(
          `erp_http_${status}`,
          status === 401 || status === 403
            ? "Accès ERPNext refusé. Vérifiez le compte d’intégration."
            : "ERPNext a refusé la requête. Vérifiez le document côté ERPNext.",
          status === 429 || status >= 500,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof ErpError) throw error;
      throw new ErpError("network_timeout", "ERPNext indisponible ou délai dépassé.", true);
    }
  }

  async json<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    // Retry reads only. A failed write may already have committed in ERPNext.
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await this.request(path, method, body);
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object") throw new Error("Invalid envelope");
        const envelope = payload as Record<string, unknown>;
        const value = envelope.data ?? envelope.message;
        if (value === undefined || envelope.exc || envelope.exc_type)
          throw new Error("Invalid response");
        return value as T;
      } catch (error) {
        if (attempt === 0 && method === "GET" && error instanceof ErpError && error.retryable)
          continue;
        if (error instanceof ErpError) throw error;
        throw new ErpError("erp_response", "Réponse ERPNext invalide.");
      }
    }
  }

  async pdf(path: string): Promise<ArrayBuffer> {
    const response = await this.request(path, "GET");
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
      throw new ErpError("erp_pdf", "ERPNext n’a pas retourné de facture PDF.");
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 15_000_000 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      throw new ErpError("erp_pdf", "PDF ERPNext invalide.");
    }
    return bytes;
  }
}
