import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/invoices/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { invoiceResponse } = await import("@/lib/erpnext/print");
        return invoiceResponse(request, { token: params.token });
      },
    },
  },
});
