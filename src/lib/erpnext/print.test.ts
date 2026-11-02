import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  financeDatabase: vi.fn(),
  assertAdmin: vi.fn(),
  readErpConfig: vi.fn(),
  erpEnabled: vi.fn(),
}));
vi.mock("./database", () => mocks);
vi.mock("./config", () => mocks);
vi.mock("../server/packers-auth", () => mocks);
import { invoiceResponse, trackedInvoiceAvailable } from "./print";
import { erpConfig, financeOrder } from "../../../scripts/testing/erpnext-fixtures";

let orderFound: boolean;
let invoice: string | null;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  orderFound = true;
  invoice = "SINV-TEST";
  mocks.erpEnabled.mockReturnValue(true);
  mocks.readErpConfig.mockReturnValue(erpConfig);
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            error: null,
            data:
              table === "orders"
                ? orderFound
                  ? { id: financeOrder().id }
                  : null
                : { erp_sales_invoice_id: invoice },
          }),
        }),
      }),
    }),
  };
  mocks.financeDatabase.mockReturnValue(db);
  mocks.assertAdmin.mockResolvedValue({ supabase: null, error: "forbidden" });
  fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) =>
    String(input).includes("download_pdf")
      ? new Response("%PDF-test-only", { headers: { "content-type": "application/pdf" } })
      : Response.json({
          data: {
            name: "SINV-TEST",
            docstatus: 1,
            company: erpConfig.company,
            custom_elegancia_key: `eh-invoice-${financeOrder().id}`,
          },
        }),
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("facture via route Elegancia protégée", () => {
  it("un token de suivi valide fournit seulement le PDF, sans cache ni lien ERPNext", async () => {
    const response = await invoiceResponse(new Request("https://shop.test"), {
      token: financeOrder().id,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("%PDF-test-only");
  });
  it.each(["bad-token", "", "unknown"])("token invalide %s : aucun appel ERP", async (token) => {
    expect((await invoiceResponse(new Request("https://shop.test"), { token })).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("un token inconnu ou sans facture ne donne pas accès à ERPNext", async () => {
    orderFound = false;
    expect(await trackedInvoiceAvailable(financeOrder().id)).toBe(false);
    orderFound = true;
    invoice = null;
    expect(
      (await invoiceResponse(new Request("https://shop.test"), { token: financeOrder().id }))
        .status,
    ).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("un identifiant interne exige authentification et rôle admin", async () => {
    expect(
      (await invoiceResponse(new Request("https://shop.test"), { orderId: financeOrder().id }))
        .status,
    ).toBe(401);
    const request = new Request("https://shop.test", {
      headers: { Authorization: "Bearer non-admin" },
    });
    expect((await invoiceResponse(request, { orderId: financeOrder().id })).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuse une facture brouillon ou appartenant à une autre commande", async () => {
    fetcher.mockResolvedValue(
      Response.json({
        data: { docstatus: 0, company: erpConfig.company, custom_elegancia_key: "other" },
      }),
    );
    expect(
      (await invoiceResponse(new Request("https://shop.test"), { token: financeOrder().id }))
        .status,
    ).toBe(404);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("ERPNext indisponible retourne une erreur locale sûre", async () => {
    fetcher.mockRejectedValue(new Error("private API secret"));
    const response = await invoiceResponse(new Request("https://shop.test"), {
      token: financeOrder().id,
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
  it("désactivation coupe le PDF et la détection de facture", async () => {
    mocks.erpEnabled.mockReturnValue(false);
    expect(await trackedInvoiceAvailable(financeOrder().id)).toBe(false);
    expect(
      (await invoiceResponse(new Request("https://shop.test"), { token: financeOrder().id }))
        .status,
    ).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
