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
  it("posts plain JSON with preview disabled and a timeout", async () => {
    expect(await sendTelegram("<b>Plain customer text</b>", "order")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-telegram-token/sendMessage");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      chat_id: "test-private-chat",
      text: "<b>Plain customer text</b>",
      disable_web_page_preview: true,
      link_preview_options: { is_disabled: true },
    });
    expect(console.warn).not.toHaveBeenCalled();
  });
  it.each([
    new Response("private response", { status: 500 }),
    new Response('{"ok":false}'),
    new Response("invalid-json"),
  ])("swallows HTTP and Telegram errors with safe logs", async (response) => {
    fetchMock.mockResolvedValue(response);
    expect(await sendTelegram("private customer details", "order")).toBe(false);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[telegram] New order notification failed",
    );
  });
  it.each([
    new Error("URL with secret and customer data"),
    new DOMException("private timeout info", "TimeoutError"),
  ])("swallows network/timeout errors", async (error) => {
    fetchMock.mockRejectedValue(error);
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    await expect(sendTelegram("private text", "parcel")).resolves.toBe(false);
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[telegram] Packers parcel notification failed",
    );
  });
  it.each(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"])(
    "does not call fetch when %s is absent",
    async (name) => {
      vi.stubEnv(name, "");
      await expect(sendTelegram("message", "order")).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
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
