import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listRecentExports, retryOrderExport } from "@/lib/order-export";

export function ExportAttempts() {
  const client = useQueryClient();
  const jobs = useQuery({
    queryKey: ["order_export_log"],
    queryFn: () => listRecentExports(8),
    refetchInterval: 15000,
  });
  const retry = useMutation({
    mutationFn: retryOrderExport,
    onSuccess: () => void client.invalidateQueries({ queryKey: ["order_export_log"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="border-t border-outline pt-4 text-xs">
      <p>
        Synchronisation différée : « queued » signifie envoyé, « succeeded » signifie réception
        confirmée. Cinq tentatives maximum.
      </p>
      {jobs.isError && (
        <p role="alert">Suivi indisponible. Vérifiez les migrations de l’intégration.</p>
      )}
      <ul className="mt-2 space-y-2">
        {(jobs.data ?? []).map((job) => (
          <li key={job.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {job.label} · {job.status} · {job.attempts}/5
              {job.last_error && ` · ${job.last_error}`}
            </span>
            {job.status === "failed" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={retry.isPending}
                onClick={() => retry.mutate(job.id)}
              >
                Réessayer
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
