import { createServerFn } from "@tanstack/react-start";

export const notifyTelegramNewOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object" || !("publicToken" in input)) return null;
    return typeof input.publicToken === "string" ? input.publicToken : null;
  })
  .handler(async ({ data }): Promise<void> => {
    const { runNotifyNewOrder } = await import("./telegram-server");
    await runNotifyNewOrder(data);
  });
