import { createServerFn } from "@tanstack/react-start";
import type { FinanceInput, FinanceResult } from "./types";

export const financeAction = createServerFn({ method: "POST" })
  .validator((input: FinanceInput) => {
    if (
      !input ||
      typeof input.accessToken !== "string" ||
      input.accessToken.length > 10000 ||
      typeof input.operation !== "string" ||
      !input.input ||
      typeof input.input !== "object" ||
      JSON.stringify(input.input).length > 100000
    )
      throw new Error("Requête Finance invalide.");
    return input;
  })
  .handler(async ({ data }): Promise<FinanceResult> => {
    const { runFinance } = await import("./server");
    return runFinance(data);
  });

export const publicInvoiceStatus = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => (typeof input?.token === "string" ? input.token : ""))
  .handler(async ({ data }): Promise<{ invoice: boolean; credit: boolean }> => {
    const { invoiceAvailability } = await import("./documents");
    return invoiceAvailability(data);
  });
