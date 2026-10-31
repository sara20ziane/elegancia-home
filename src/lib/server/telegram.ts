import "@tanstack/react-start/server-only";
import { splitTelegramText } from "./telegram-format";

type Notice = "order" | "parcel";
export function logTelegramFailure(kind: Notice) {
  console.warn(
    kind === "order"
      ? "[telegram] New order notification failed"
      : "[telegram] Packers parcel notification failed",
  );
}

/** Awaited within each server request; never let URLs, credentials or response bodies reach logs. */
export async function sendTelegram(text: string, kind: Notice): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId || !text) throw new Error("Unavailable");
    const signal = AbortSignal.timeout(5_000);
    for (const chunk of splitTelegramText(text)) {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          disable_web_page_preview: true,
          link_preview_options: { is_disabled: true },
        }),
        signal,
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) throw new Error("Unavailable");
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("ok" in body) || body.ok !== true)
        throw new Error("Unavailable");
    }
    return true;
  } catch {
    logTelegramFailure(kind);
    return false;
  }
}
