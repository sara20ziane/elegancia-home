import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/finance/$id/pdf")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { financePdfResponse } = await import("@/lib/finance/documents");
        return financePdfResponse(request, { id: params.id });
      },
    },
  },
});
