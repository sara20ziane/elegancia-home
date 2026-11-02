import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
const mocks = vi.hoisted(() => ({ assertAdmin: vi.fn(), rpc: vi.fn() }));
vi.mock("../server/packers-auth", () => ({ assertAdmin: mocks.assertAdmin }));
import { runFinance } from "./server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertAdmin.mockResolvedValue({ supabase: { rpc: mocks.rpc }, error: null });
  mocks.rpc.mockResolvedValue({ data: "document-id", error: null });
});
describe("frontière serveur Finance native", () => {
  it("refuse un appel non admin avant tout accès financier", async () => {
    mocks.assertAdmin.mockResolvedValue({ supabase: null, error: "denied" });
    expect(
      (await runFinance({ accessToken: "fake", operation: "issue", input: { id: "I" } })).ok,
    ).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("l’émission transmet uniquement l’ID : les montants et statuts navigateur sont ignorés", async () => {
    await runFinance({
      accessToken: "admin",
      operation: "issue",
      input: { id: "I", total: 1, status: "paid", number: "FAKE" },
    });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("finance_issue_invoice", { p_id: "I" });
  });
  it("transmet une clé d’opération pour publier un coût, puis laisse SQL valider l’owner", async () => {
    await runFinance({
      accessToken: "admin",
      operation: "cost",
      input: { id: "request", variant_id: "V", unit_cost: 3000 },
    });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("finance_set_cost", {
      p_request: "request",
      p_variant: "V",
      p_cost: 3000,
    });
  });
  it("ne rejoue pas une écriture après une erreur réseau ambiguë", async () => {
    mocks.rpc.mockRejectedValue(new Error("Network unavailable"));
    expect(
      (
        await runFinance({
          accessToken: "admin",
          operation: "settlement",
          input: { id: "operation" },
        })
      ).ok,
    ).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("conserve le refus SQL des fonctions owner-only", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Accès Finance refusé" } });
    expect(
      await runFinance({
        accessToken: "staff",
        operation: "dashboard",
        input: { from: "2026-11-01", to: "2026-11-02" },
      }),
    ).toEqual({ ok: false, error: "Accès Finance refusé" });
  });
});
