import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
const { rpc, sendTelegram, logTelegramFailure } = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendTelegram: vi.fn(),
  logTelegramFailure: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ rpc })) }));
vi.mock("./telegram", () => ({ sendTelegram, logTelegramFailure }));
import { telegramOrder } from "../../../scripts/testing/telegram-fixtures";
import { runNotifyNewOrder, notifyPackersParcel } from "./telegram-server";
const token = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let index = 0;
let publicToken: string;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T13:10:00Z"));
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-only");
  vi.stubEnv("TELEGRAM_CHAT_ID", "test-only");
  publicToken = token.slice(0, -4) + (++index).toString().padStart(4, "0");
  rpc.mockResolvedValue({ data: { ...telegramOrder, token: publicToken }, error: null });
  sendTelegram.mockResolvedValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("canonical new-order notification", () => {
  it("only reads track_order with the public token and sends canonical amounts/items", async () => {
    await runNotifyNewOrder(publicToken);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("track_order", { p_token: publicToken });
    expect(sendTelegram).toHaveBeenCalledWith(expect.stringContaining("TOTAL : 7 900 DA"), "order");
    expect(sendTelegram.mock.calls[0][0]).not.toContain(publicToken);
  });
  it("ignores invalid input and missing orders", async () => {
    for (const invalid of [null, "internal-id", { publicToken }]) await runNotifyNewOrder(invalid);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: null });
    await runNotifyNewOrder(publicToken);
    expect(sendTelegram).not.toHaveBeenCalled();
  });
  it.each([
    { ...telegramOrder, total: "client-price" },
    { ...telegramOrder, items: [] },
    { ...telegramOrder, items: [{ quantity: -1, unit_price: 1, product_name: "bad" }] },
    { ...telegramOrder, created_at: "2020-01-01T00:00:00Z" },
    { ...telegramOrder, created_at: "2030-01-01T00:00:00Z" },
  ])("rejects unusable and old canonical responses", async (data) => {
    rpc.mockResolvedValue({ data: { ...data, token: publicToken }, error: null });
    await runNotifyNewOrder(publicToken);
    expect(sendTelegram).not.toHaveBeenCalled();
  });
  it("suppresses duplicates in concurrent calls on a warm instance", async () => {
    await Promise.all([runNotifyNewOrder(publicToken), runNotifyNewOrder(publicToken)]);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
  });
  it("never rejects on Supabase or Telegram failure", async () => {
    rpc.mockRejectedValueOnce(new Error("private data"));
    await expect(runNotifyNewOrder(publicToken)).resolves.toBeUndefined();
    sendTelegram.mockRejectedValue(new Error("private data"));
    await expect(runNotifyNewOrder(publicToken)).resolves.toBeUndefined();
    expect(logTelegramFailure).toHaveBeenCalledWith("order");
  });
  it("skips calls when Telegram configuration is missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    await runNotifyNewOrder(publicToken);
    expect(rpc).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });
  it("does not reject a saved parcel when Telegram throws", async () => {
    sendTelegram.mockRejectedValue(new Error("private data"));
    await expect(
      notifyPackersParcel({ ...telegramOrder, tracking_number: "ECGHTG2610311948869" }),
    ).resolves.toBeUndefined();
    expect(logTelegramFailure).toHaveBeenCalledWith("parcel");
  });
});
