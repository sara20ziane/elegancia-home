import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
const { assertAdmin, createOrder, getCommunes, notifyPackersParcel } = vi.hoisted(() => ({
  assertAdmin: vi.fn(),
  createOrder: vi.fn(),
  getCommunes: vi.fn(),
  notifyPackersParcel: vi.fn(),
}));
vi.mock("./packers-auth", () => ({ assertAdmin }));
vi.mock("./packers", () => ({
  readPackersConfig: () => ({ token: "test-only", baseUrl: "https://example.invalid/" }),
  createPackersClient: () => ({ createOrder, getCommunes }),
}));
vi.mock("./telegram-server", () => ({ notifyPackersParcel }));
import { runCreatePackersParcel } from "./packers-server";
const tracking = "ECGHTG2610311948869";
const order = {
  id: "order-id",
  public_token: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  customer_name: "Cliente test",
  phone: "0555550199",
  address: "Adresse de test",
  wilaya: "Alger",
  commune: "Alger Centre",
  total: 7900,
  note: null,
  status: "confirmed",
  tracking_number: null,
  delivery_method: "home",
  stopdesk_name: null,
  order_items: [{ product_name: "Aveline", variant_label: "Queen", quantity: 1 }],
};
let update: ReturnType<typeof vi.fn>;
let single: ReturnType<typeof vi.fn>;
beforeEach(() => {
  single = vi
    .fn()
    .mockResolvedValueOnce({ data: order, error: null })
    .mockResolvedValue({ data: { tracking_number: tracking }, error: null });
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: single };
  update = vi.fn(() => query);
  const supabase = { from: vi.fn(() => ({ ...query, update })) };
  assertAdmin.mockResolvedValue({ supabase, error: null });
  createOrder.mockResolvedValue({ success: true, tracking });
  notifyPackersParcel.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("Packers Telegram notification", () => {
  it("notifies only after the exact tracking is persisted", async () => {
    const result = await runCreatePackersParcel({ orderId: order.id, accessToken: "test-only" });
    expect(result).toEqual({ ok: true, tracking, stage: "created" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ tracking_number: tracking }));
    expect(notifyPackersParcel).toHaveBeenCalledExactlyOnceWith({
      ...order,
      tracking_number: tracking,
    });
    expect(notifyPackersParcel.mock.invocationCallOrder[0]).toBeGreaterThan(
      single.mock.invocationCallOrder[1],
    );
  });
  it("keeps the successful parcel and tracking when Telegram throws", async () => {
    notifyPackersParcel.mockRejectedValue(new Error("offline"));
    await expect(
      runCreatePackersParcel({ orderId: order.id, accessToken: "test-only" }),
    ).resolves.toEqual({ ok: true, tracking, stage: "created" });
    expect(update).toHaveBeenCalledTimes(1);
  });
  it.each([
    { success: false },
    { success: true },
    { success: true, tracking: "   " },
    { success: true, tracking: {} },
  ])("does not notify for failed or invalid carrier responses", async (response) => {
    createOrder.mockResolvedValue(response);
    expect(
      await runCreatePackersParcel({ orderId: order.id, accessToken: "test-only" }),
    ).toMatchObject({ ok: false });
    expect(update).not.toHaveBeenCalled();
    expect(notifyPackersParcel).not.toHaveBeenCalled();
  });
  it("does not notify when the carrier request fails", async () => {
    createOrder.mockRejectedValue(new Error("offline"));
    expect(
      await runCreatePackersParcel({ orderId: order.id, accessToken: "test-only" }),
    ).toMatchObject({ ok: false });
    expect(notifyPackersParcel).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: { message: "save failed" } },
    { data: null, error: null },
    { data: { tracking_number: "OTHER" }, error: null },
  ])("does not notify if storage fails or no matching saved row is returned", async (saved) => {
    single.mockReset().mockResolvedValueOnce({ data: order, error: null }).mockResolvedValue(saved);
    expect(
      await runCreatePackersParcel({ orderId: order.id, accessToken: "test-only" }),
    ).toMatchObject({ ok: false });
    expect(notifyPackersParcel).not.toHaveBeenCalled();
  });
  it("does not recreate or renotify a parcel that already has tracking", async () => {
    single
      .mockReset()
      .mockResolvedValueOnce({ data: { ...order, tracking_number: tracking }, error: null });
    expect(
      await runCreatePackersParcel({ orderId: order.id, accessToken: "test-only" }),
    ).toMatchObject({ ok: false });
    expect(createOrder).not.toHaveBeenCalled();
    expect(notifyPackersParcel).not.toHaveBeenCalled();
  });
});
