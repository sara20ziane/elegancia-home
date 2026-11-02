export class ErpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ErpError";
  }
}

/** Only our own messages cross the server boundary. Never forward upstream bodies/errors. */
export function safeFinanceError(error: unknown): string {
  return error instanceof ErpError
    ? `${error.code} : ${error.message}`
    : "finance_unavailable : Synchronisation indisponible. Réessayez depuis la commande.";
}
