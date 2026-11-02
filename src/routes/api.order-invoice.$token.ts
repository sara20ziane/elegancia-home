import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/order-invoice/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { financePdfResponse } = await import("@/lib/finance/documents");
        return financePdfResponse(request, { token: params.token });
      },
    },
  },
});
