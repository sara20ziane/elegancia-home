import { createServerFn } from "@tanstack/react-start";
import type { AdminFinanceInput } from "./admin-server";

function validateInput(input: AdminFinanceInput) {
  if (
    !input ||
    typeof input.accessToken !== "string" ||
    input.accessToken.length > 10_000 ||
    (input.orderId !== undefined && typeof input.orderId !== "string") ||
    (input.publicToken !== undefined && typeof input.publicToken !== "string")
  ) {
    throw new Error("Requête finance invalide.");
  }
  return input;
}

export const getAdminFinance = createServerFn({ method: "POST" })
  .validator(validateInput)
  .handler(async ({ data }) => {
    const { readAdminFinance } = await import("./admin-server");
    return readAdminFinance(data);
  });

export const syncErpFinance = createServerFn({ method: "POST" })
  .validator(validateInput)
  .handler(async ({ data }) => {
    const { syncAdminFinance } = await import("./admin-server");
    return syncAdminFinance(data);
  });

export const receiveCodPayment = createServerFn({ method: "POST" })
  .validator(
    (input: AdminFinanceInput & { amount: number; reference: string; receivedAt: string }) => {
      validateInput(input);
      if (
        !Number.isSafeInteger(input.amount) ||
        input.amount < 0 ||
        typeof input.reference !== "string" ||
        input.reference.length > 200 ||
        typeof input.receivedAt !== "string" ||
        input.receivedAt.length > 40
      ) {
        throw new Error("Reversement invalide.");
      }
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { recordCodReceipt } = await import("./admin-server");
    return recordCodReceipt(data);
  });

export const hasTrackedInvoice = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => (typeof input?.token === "string" ? input.token : ""))
  .handler(async ({ data }) => {
    const { trackedInvoiceAvailable } = await import("./print");
    return trackedInvoiceAvailable(data);
  });
