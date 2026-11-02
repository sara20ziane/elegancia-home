import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { ErpClient } from "./client";
import { safeFinanceError } from "./errors";
import { readErpConfig } from "./config";
import { erpConfig } from "../../../scripts/testing/erpnext-fixtures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("client ERPNext", () => {
  it.each([401, 403, 500])("sanitise HTTP %s et ne rejoue aucune écriture", async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private test-secret password", { status }));
    await expect(
      new ErpClient(erpConfig, fetcher).json("/api/resource/Customer", "POST", {}),
    ).rejects.toThrow("ERPNext");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("réessaie seulement un GET temporairement indisponible", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(Response.json({ data: [] }));
    expect(await new ErpClient(erpConfig, fetcher).json("/api/resource/Customer")).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("applique un timeout sans rejouer POST", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          expect(init?.signal).toBeInstanceOf(AbortSignal);
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("private secret", "TimeoutError")),
            { once: true },
          );
        }),
    );
    await expect(
      new ErpClient(erpConfig, fetcher, 100).json("/api/resource/Customer", "POST"),
    ).rejects.toThrow("délai");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("borne le budget global avant le réseau", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      new ErpClient(erpConfig, fetcher, 0).json("/api/resource/Customer", "POST"),
    ).rejects.toThrow("dépassé");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("authentifie côté serveur et refuse les redirections", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: {} }));
    await new ErpClient(erpConfig, fetcher).json("/api/resource/Customer");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: "token test-key:test-secret" },
    });
  });
  it("rejette les réponses invalides et ne révèle pas les erreurs inconnues", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ exc: "private secret" }));
    await expect(new ErpClient(erpConfig, fetcher).json("/api/resource/Customer")).rejects.toThrow(
      "invalide",
    );
    expect(safeFinanceError(new Error("private password"))).not.toContain("password");
  });
  it("désactivé par défaut et configuration HTTPS stricte", () => {
    vi.stubEnv("ERPNEXT_ENABLED", "false");
    expect(() => readErpConfig()).toThrow("désactivé");
    vi.stubEnv("ERPNEXT_ENABLED", "true");
    vi.stubEnv("ERPNEXT_URL", "http://erp.test");
    expect(() => readErpConfig()).toThrow("HTTPS");
  });
  it("valide le type et la signature PDF", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("<html>Login</html>", { headers: { "content-type": "application/pdf" } }),
      );
    await expect(new ErpClient(erpConfig, fetcher).pdf("/api/method/pdf")).rejects.toThrow(
      "invalide",
    );
  });
});
