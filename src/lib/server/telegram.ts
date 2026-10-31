import "@tanstack/react-start/server-only";
import { splitTelegramText } from "./telegram-format";

type Notice = "order" | "parcel";

/**
 * Keep diagnostics useful without ever logging credentials, chat IDs, message
 * bodies, order tokens or Telegram response bodies.
 */
export function logTelegramFailure(kind: Notice, reason = "unknown") {
  console.warn(
    `${
      kind === "order"
        ? "[telegram] New order notification failed"
        : "[telegram] Packers parcel notification failed"
    } (${reason})`,
  );
}

function telegramApiReason(status: number, body: unknown): string {
  const description =
    body && typeof body === "object" && "description" in body && typeof body.description === "string"
      ? body.description.toLowerCase()
      : "";

  if (status === 401) return "api_unauthorized";
  if (status === 403) return "api_forbidden";
  if (status === 429) return "api_rate_limited";
  if (status === 400 && description.includes("chat not found")) return "api_chat_not_found";
  if (status >= 400) return `api_http_${status}`;
  return "api_rejected";
}

/** Awaited within each server request; never let URLs, credentials or response bodies reach logs. */
export async function sendTelegram(text: string, kind: Notice): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token) {
    logTelegramFailure(kind, "missing_bot_token");
    return false;
  }
  if (!chatId) {
    logTelegramFailure(kind, "missing_chat_id");
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
          disable_web_page_preview: true,
          link_preview_options: { is_disabled: true },
        }),
        signal,
        cache: "no-store",
        redirect: "error",
      });

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        if (!response.ok) {
          logTelegramFailure(kind, telegramApiReason(response.status, null));
          return false;
        }
        logTelegramFailure(kind, "api_invalid_response");
        return false;
      }

      if (
        !response.ok ||
        !body ||
        typeof body !== "object" ||
        !("ok" in body) ||
        body.ok !== true
      ) {
        logTelegramFailure(kind, telegramApiReason(response.status, body));
        return false;
      }
    }
    return true;
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === "TimeoutError"
        ? "timeout"
        : "network_or_unexpected";
    logTelegramFailure(kind, reason);
    return false;
  }
}
