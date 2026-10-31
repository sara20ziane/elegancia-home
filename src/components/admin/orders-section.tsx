import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, PhoneCall, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdminOrderList } from "./order-list";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useI18n } from "@/lib/i18n-context";
import type { AdminOrder } from "@/lib/admin";
import { downloadText, fetchOrders, ordersToCsv } from "@/lib/orders-file";
import { getSupabase } from "@/lib/supabase/client";
import { syncPackersOrderStatuses } from "@/lib/server/packers-actions";

async function accessToken() {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session administrateur introuvable.");
  return token;
}

/**
 * The orders section of the dashboard.
 *
 * The queue is a filter, not a re-sort. Packers statuses are refreshed once in
 * the background when this section mounts, and can also be refreshed manually.
 */
export function OrdersSection({
  orders,
  total,
  page,
  pageCount,
  queueCount,
  queueOnly,
  onToggleQueue,
  onPageChange,
}: {
  orders: AdminOrder[];
  total: number;
  page: number;
  pageCount: number;
  queueCount: number;
  queueOnly: boolean;
  onToggleQueue: () => void;
  onPageChange: (page: number) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const autoSyncStarted = useRef(false);

  const sync = useMutation({
    mutationFn: async (showToast: boolean) => {
      const token = await accessToken();
      const result = await syncPackersOrderStatuses({ data: { accessToken: token } });
      if (!result.ok) throw new Error(result.error);
      return { ...result, showToast };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["admin_orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin_orders_count"] });
      if (!result.showToast) return;
      if (result.checked === 0) {
        toast.success("Aucune commande Packers à synchroniser.");
        return;
      }
      toast.success(
        `Packers synchronisé · ${result.checked} vérifiée${result.checked > 1 ? "s" : ""}` +
          ` · ${result.changed} statut${result.changed > 1 ? "s" : ""} modifié${result.changed > 1 ? "s" : ""}` +
          (result.failed > 0 ? ` · ${result.failed} échec${result.failed > 1 ? "s" : ""}` : ""),
      );
    },
    onError: (error: Error, showToast) => {
      if (showToast) toast.error(error.message);
    },
  });

  const runSync = sync.mutate;
  useEffect(() => {
    if (autoSyncStarted.current) return;
    autoSyncStarted.current = true;
    runSync(false);
  }, [runSync]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <PhoneCall size={17} className="text-primary" aria-hidden="true" />
          {t("admin.orders.title")}
          {queueCount > 0 && (
            <span className="grid size-6 place-items-center rounded-full bg-tertiary text-xs font-semibold text-on-tertiary">
              {queueCount}
            </span>
          )}
        </h2>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-on-surface-muted" data-testid="orders-total">
            {total}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={sync.isPending}
            onClick={() => sync.mutate(true)}
          >
            <RefreshCw
              size={15}
              className={sync.isPending ? "animate-spin" : undefined}
              aria-hidden="true"
            />
            {sync.isPending ? "Synchronisation…" : "Synchroniser Packers"}
          </Button>
          <Link to="/admin/slips" className="btn btn-ghost btn-sm">
            <Printer size={15} aria-hidden="true" />
            {t("admin.slip.printConfirmed")}
          </Link>
          <ExportButton />
          <Button
            variant={queueOnly ? "primary" : "ghost"}
            size="sm"
            aria-pressed={queueOnly}
            onClick={onToggleQueue}
          >
            {queueOnly ? t("admin.orders.all") : t("admin.orders.queue")}
          </Button>
        </span>
      </div>

      <AdminOrderList orders={orders} />

      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        testId="orders-pagination"
      />
    </section>
  );
}

/** Every order, not the page on screen: an export that silently stops at 15 is worse than none. */
function ExportButton() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const exportAll = async () => {
    setBusy(true);
    try {
      const csv = ordersToCsv(await fetchOrders({}));
      downloadText(`orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => void exportAll()}>
      <Download size={15} aria-hidden="true" />
      {t("admin.orders.exportCsv")}
    </Button>
  );
}
