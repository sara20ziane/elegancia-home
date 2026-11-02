import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  claimSync: vi.fn(),
  loadFinanceOrder: vi.fn(),
  saveFinance: vi.fn(),
  financeDatabase: vi.fn(),
}));
vi.mock("./repository", () => mocks);
vi.mock("./database", () => mocks);
import { runFinanceSync } from "./sync";
import { financeOrder, financeState, erpConfig } from "../../../scripts/testing/erpnext-fixtures";
import { MockErp } from "../../../scripts/testing/erpnext-mock";

let erp: MockErp;
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    ERPNEXT_ENABLED: "true",
    ERPNEXT_URL: erpConfig.url,
    ERPNEXT_API_KEY: erpConfig.apiKey,
    ERPNEXT_API_SECRET: erpConfig.apiSecret,
    ERPNEXT_COMPANY: erpConfig.company,
    ERPNEXT_WAREHOUSE: erpConfig.warehouse,
    ERPNEXT_PRICE_LIST: erpConfig.priceList,
    ERPNEXT_SHIPPING_ITEM: erpConfig.shippingItem,
    ERPNEXT_CASH_ACCOUNT: erpConfig.cashAccount!,
    ERPNEXT_MODE_OF_PAYMENT: erpConfig.modeOfPayment!,
  }))
    vi.stubEnv(key, value);
  erp = new MockErp();
  vi.stubGlobal("fetch", erp.fetcher);
  mocks.claimSync.mockResolvedValue({ order_id: financeOrder().id, lock_token: "lease" });
  mocks.loadFinanceOrder.mockResolvedValue({ order: financeOrder(), finance: financeState() });
  mocks.saveFinance.mockResolvedValue(undefined);
  mocks.financeDatabase.mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: async () => ({ error: null }),
    }),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("orchestration en mode dégradé", () => {
  it("flag désactivé : aucun accès ERPNext ou base privilégiée", async () => {
    vi.stubEnv("ERPNEXT_ENABLED", "false");
    expect(await runFinanceSync()).toEqual({ ok: true, enabled: false });
    expect(mocks.financeDatabase).not.toHaveBeenCalled();
    expect(erp.writes).toEqual([]);
  });
  it.each([401, 403, 500])(
    "HTTP %s garde la commande et enregistre une erreur sûre",
    async (status) => {
      erp.status = status;
      expect((await runFinanceSync()).ok).toBe(false);
      expect(mocks.saveFinance).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          erp_sync_status: "error",
          erp_sync_error: expect.not.stringContaining("private"),
        }),
        true,
        status === 500,
      );
    },
  );
  it("indisponibilité réseau : échec réessayable sans propagation au checkout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private API secret")));
    await expect(runFinanceSync()).resolves.toMatchObject({ ok: false, enabled: true });
    expect(mocks.saveFinance).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ erp_sync_status: "error" }),
      true,
      true,
    );
  });
  it("aucune facture sur simple confirmation", async () => {
    expect((await runFinanceSync()).ok).toBe(true);
    expect(erp.writes).toContain("create:Sales Order");
    expect(erp.writes).not.toContain("create:Sales Invoice");
  });
  it("une livraison crée une créance sans paiement", async () => {
    mocks.loadFinanceOrder.mockResolvedValue({
      order: { ...financeOrder(), status: "delivered" },
      finance: financeState(),
    });
    expect((await runFinanceSync()).ok).toBe(true);
    expect(erp.writes).toContain("create:Sales Invoice");
    expect(erp.writes).not.toContain("create:Payment Entry");
  });
  it("reversement reçu : paiement soumis et solde vérifié", async () => {
    const finance = {
      ...financeState(),
      cod_received_at: "2026-11-02T12:00:00Z",
      cod_received_amount: 6600,
      cod_receipt_reference: "receipt",
    };
    mocks.loadFinanceOrder.mockResolvedValue({
      order: { ...financeOrder(), status: "delivered" },
      finance,
    });
    expect((await runFinanceSync()).ok).toBe(true);
    expect(mocks.saveFinance).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      { erp_sync_status: "paid", erp_sync_error: null },
      true,
    );
  });
  it("annulation avant confirmation ne crée aucun document", async () => {
    mocks.loadFinanceOrder.mockResolvedValue({
      order: { ...financeOrder(), status: "cancelled", confirmed_at: null },
      finance: financeState(),
    });
    expect((await runFinanceSync()).ok).toBe(true);
    expect(erp.writes).toEqual([]);
  });
  it("facture existante puis retour : intervention comptable, aucune suppression", async () => {
    mocks.loadFinanceOrder.mockResolvedValue({
      order: { ...financeOrder(), status: "returned" },
      finance: { ...financeState(), erp_sales_invoice_id: "existing-invoice" },
    });
    expect((await runFinanceSync()).error).toContain("comptable");
    expect(erp.writes).toEqual([]);
  });
  it("un autre worker possède déjà la réservation", async () => {
    mocks.claimSync.mockResolvedValue(null);
    expect((await runFinanceSync()).ok).toBe(true);
    expect(erp.writes).toEqual([]);
  });
});
