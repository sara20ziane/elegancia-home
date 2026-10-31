import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { sendTelegram } from "./telegram";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-telegram-token");
  vi.stubEnv("TELEGRAM_CHAT_ID", "test-private-chat");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  fetchMock.mockResolvedValue(new Response('{"ok":true}'));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("Telegram delivery", () => {
  it("posts plain JSON with the current preview option and a timeout", async () => {
    expect(await sendTelegram("<b>Plain customer text</b>", "order")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-telegram-token/sendMessage");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      chat_id: "test-private-chat",
      text: "<b>Plain customer text</b>",
      link_preview_options: { is_disabled: true },
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("reports a safe HTTP status without logging Telegram response data", async () => {
    fetchMock.mockResolvedValue(new Response("private response", { status: 401 }));
    expect(await sendTelegram("private customer details", "order")).toBe(false);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[telegram] New order notification failed: http_401",
    );
  });

  it("reports the Telegram API error code without logging the response body", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"ok":false,"error_code":400,"description":"private Telegram detail"}'),
    );
    expect(await sendTelegram("private customer details", "order")).toBe(false);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[telegram] New order notification failed: api_400",
    );
  });

  it.each([
    new Response('{"ok":false}'),
    new Response('{"unexpected":true}'),
  ])("swallows malformed Telegram API responses with safe logs", async (response) => {
    fetchMock.mockResolvedValue(response);
    expect(await sendTelegram("private customer details", "order")).toBe(false);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[telegram] New order notification failed: api_invalid_response",
    );
  });

  it.each([
    [new Error("URL with secret and customer data"), "network_or_runtime"],
    [new DOMException("private timeout info", "TimeoutError"), "timeout"],
  ] as const)("swallows network/timeout errors", async (error, reason) => {
    fetchMock.mockRejectedValue(error);
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    await expect(sendTelegram("private text", "parcel")).resolves.toBe(false);
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      `[telegram] Packers parcel notification failed: ${reason}`,
    );
  });

  it.each(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"])(
    "does not call fetch when %s is absent",
    async (name) => {
      vi.stubEnv(name, "");
      await expect(sendTelegram("message", "order")).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledExactlyOnceWith(
        "[telegram] New order notification failed: config_missing",
      );
    },
  );

  it("sends multiple chunks within one shared deadline", async () => {
    fetchMock.mockImplementation(async () => new Response('{"ok":true}'));
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const text = "x".repeat(9000);
    expect(await sendTelegram(text, "order")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).text).join("")).toBe(text);
  });
});
