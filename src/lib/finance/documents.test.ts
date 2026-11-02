import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  assertAdmin: vi.fn(),
  renderInvoicePdf: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("../server/packers-auth", () => ({ assertAdmin: mocks.assertAdmin }));
vi.mock("./pdf-template", () => ({ renderInvoicePdf: mocks.renderInvoicePdf }));
import { financePdfResponse, invoiceAvailability, pdfHash } from "./documents";
import { invoiceFixture } from "../../../scripts/testing/native-invoice";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const token = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let bytes: Uint8Array | null;
let archived: { pdf_path: string | null; pdf_sha256: string | null };
let writes: number;
let failStorage: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  bytes = null;
  archived = { pdf_path: null, pdf_sha256: null };
  writes = 0;
  failStorage = false;
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-secret");
  mocks.renderInvoicePdf.mockResolvedValue(new TextEncoder().encode("%PDF-synthetic-test"));
  const db = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "finance_public_documents")
        return {
          data: args.p_token === token ? { invoice_id: id, credit_id: null } : null,
          error: null,
        };
      if (name === "finance_document")
        return {
          data: {
            id,
            number: "FAC-TEST",
            payload: invoiceFixture(),
            renderer_version: "elegancia-a4-v1",
            ...archived,
          },
          error: null,
        };
      archived = { pdf_path: String(args.p_path), pdf_sha256: String(args.p_hash) };
      return { data: null, error: null };
    }),
    storage: {
      from: () => ({
        download: async () =>
          failStorage
            ? { data: null, error: { message: "network private secret" } }
            : bytes
              ? { data: { arrayBuffer: async () => bytes!.buffer }, error: null }
              : { data: null, error: { message: "Object not found" } },
        upload: async (_path: string, data: Uint8Array, options: { upsert: boolean }) => {
          expect(options.upsert).toBe(false);
          if (!bytes) {
            bytes = data;
            writes += 1;
          }
          return { error: null };
        },
      }),
    },
  };
  mocks.createClient.mockReturnValue(db);
  mocks.assertAdmin.mockResolvedValue({ supabase: db, error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("accès et conservation des factures natives", () => {
  it("le bon token reçoit uniquement son PDF sans cache", async () => {
    const response = await financePdfResponse(new Request("https://shop.test"), { token });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("%PDF-synthetic-test");
  });
  it.each(["bad", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"])(
    "un autre token %s ne donne accès à aucun document",
    async (bad) => {
      expect(
        (await financePdfResponse(new Request("https://shop.test"), { token: bad })).status,
      ).toBe(404);
      expect(mocks.renderInvoicePdf).not.toHaveBeenCalled();
    },
  );
  it("un ID interne exige authentification et rôle admin", async () => {
    expect((await financePdfResponse(new Request("https://shop.test"), { id })).status).toBe(401);
    mocks.assertAdmin.mockResolvedValue({ supabase: null, error: "forbidden" });
    expect(
      (
        await financePdfResponse(
          new Request("https://shop.test", { headers: { Authorization: "Bearer staffless" } }),
          { id },
        )
      ).status,
    ).toBe(403);
  });
  it("archive une seule fois et conserve exactement les octets et leur hash", async () => {
    const first = await financePdfResponse(new Request("https://shop.test"), { token });
    const firstBytes = new Uint8Array(await first.arrayBuffer());
    mocks.renderInvoicePdf.mockResolvedValue(new TextEncoder().encode("%PDF-different-output"));
    const second = await financePdfResponse(new Request("https://shop.test"), { token });
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(firstBytes);
    expect(archived.pdf_sha256).toBe(pdfHash(firstBytes));
    expect(writes).toBe(1);
    expect(mocks.renderInvoicePdf).toHaveBeenCalledTimes(1);
  });
  it("refuse une archive dont le contenu diffère du hash", async () => {
    await financePdfResponse(new Request("https://shop.test"), { token });
    bytes = new TextEncoder().encode("%PDF-tampered");
    expect((await financePdfResponse(new Request("https://shop.test"), { token })).status).toBe(
      503,
    );
  });
  it("stockage indisponible : aucune réémission et aucune fuite de secret", async () => {
    failStorage = true;
    const response = await financePdfResponse(new Request("https://shop.test"), { token });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
    expect(mocks.renderInvoicePdf).not.toHaveBeenCalled();
  });
  it("une configuration serveur absente ne casse pas le suivi", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await invoiceAvailability(token)).toEqual({ invoice: false, credit: false });
  });
});
