import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/shipping-labels")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { shippingResponse } = await import("@/lib/server/shipping-response");
        return shippingResponse(request);
      },
    },
  },
});
