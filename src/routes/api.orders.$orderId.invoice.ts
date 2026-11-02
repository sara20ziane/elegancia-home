import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/orders/$orderId/invoice")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { invoiceResponse } = await import("@/lib/erpnext/print");
        return invoiceResponse(request, { orderId: params.orderId });
      },
    },
  },
});
