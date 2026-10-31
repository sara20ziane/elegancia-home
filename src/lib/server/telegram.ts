import "@tanstack/react-start/server-only";
import { splitTelegramText } from "./telegram-format";

type Notice = "order" | "parcel";

type FailureReason =
  | "config_missing"
  | "empty_message"
  | `http_${number}`
  | `api_${number}`
  | "api_invalid_response"
  | "timeout"
  | "network_or_runtime"
  | "unknown";

export function logTelegramFailure(kind: Notice, reason: FailureReason = "unknown") {
  const label = kind === "order" ? "New order" : "Packers parcel";
  console.warn(`[telegram] ${label} notification failed: ${reason}`);
}

/** Awaited within each server request; never let URLs, credentials or response bodies reach logs. */
export async function sendTelegram(text: string, kind: Notice): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    logTelegramFailure(kind, "config_missing");
    return false;
  }
  if (!text) {
    logTelegramFailure(kind, "empty_message");
    return false;
  }

  try {
    const signal = AbortSignal.timeout(5_000);
    for (const chunk of splitTelegramText(text)) {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          link_preview_options: { is_disabled: true },
        }),
        signal,
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) {
        logTelegramFailure(kind, `http_${response.status}`);
        return false;
      }
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("ok" in body)) {
        logTelegramFailure(kind, "api_invalid_response");
        return false;
      }
      if (body.ok !== true) {
        const code =
          "error_code" in body && typeof body.error_code === "number" ? body.error_code : 0;
        logTelegramFailure(kind, code ? `api_${code}` : "api_invalid_response");
        return false;
      }
    }
    return true;
  } catch (error) {
    const reason: FailureReason =
      error instanceof DOMException && error.name === "TimeoutError"
        ? "timeout"
        : "network_or_runtime";
    logTelegramFailure(kind, reason);
    return false;
  }
}
