import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/erpnext/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { financeCron } = await import("@/lib/erpnext/cron");
        return financeCron(request);
      },
    },
  },
});
