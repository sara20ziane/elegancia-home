import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getAdminFinance, syncErpFinance } from "@/lib/erpnext/actions";
import { downloadAdminInvoice, financeAccessToken } from "@/lib/finance";
import type { FinanceStatus } from "@/lib/erpnext/types";
import { CodReceipt } from "./cod-receipt";

const LABELS: Record<FinanceStatus, string> = {
  unsynced: "Non synchronisé",
  synced: "Synchronisé",
  invoiced: "Facturé",
  paid: "Payé",
  error: "Erreur",
  cancelled: "Annulé dans ERPNext",
};

export function OrderFinance({
  orderId,
  status,
  total,
}: {
  orderId: string;
  status: string;
  total: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["order_finance", orderId],
    queryFn: async () =>
      getAdminFinance({ data: { orderId, accessToken: await financeAccessToken() } }),
    refetchInterval: 15_000,
  });
  const finance = query.data?.finance;
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Finance indisponible.");
    } finally {
      setBusy(false);
      void query.refetch();
    }
  };
  if (query.data && !query.data.enabled) return null;
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-outline bg-surface p-4"
      aria-label="ERPNext / Finance"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">ERPNext / Finance</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs ${finance?.erp_sync_status === "error" ? "bg-error/10 text-error" : "bg-surface-mid"}`}
        >
          {LABELS[finance?.erp_sync_status || "unsynced"]}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 break-all text-xs">
        {[
          ["Customer", finance?.erp_customer_id],
          ["Sales Order", finance?.erp_sales_order_id],
          ["Sales Invoice", finance?.erp_sales_invoice_id],
          ["Payment Entry", finance?.erp_payment_entry_id],
          [
            "Dernière synchronisation",
            finance?.erp_last_sync_at
              ? new Date(finance.erp_last_sync_at).toLocaleString("fr-FR")
              : null,
          ],
          [
            "Reversement reçu",
            finance?.cod_received_at
              ? new Date(finance.cod_received_at).toLocaleString("fr-FR")
              : null,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-on-surface-muted">{label}</dt>
            <dd>{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {(error || query.data?.error || query.isError || finance?.erp_sync_error) && (
        <p role="alert" className="text-xs text-error">
          {error ||
            query.data?.error ||
            finance?.erp_sync_error ||
            "Finance indisponible. Réessayez."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(["confirmed", "shipped", "delivered"].includes(status) || finance) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const result = await syncErpFinance({
                  data: { orderId, accessToken: await financeAccessToken() },
                });
                if (!result.ok) throw new Error(result.error);
              })
            }
          >
            {busy
              ? "Synchronisation…"
              : finance?.erp_sync_status === "error"
                ? "Réessayer"
                : "Synchroniser avec ERPNext"}
          </Button>
        )}
        {finance?.erp_sales_invoice_id && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void act(() => downloadAdminInvoice(orderId))}
          >
            Télécharger la facture
          </Button>
        )}
      </div>
      {status === "delivered" && !finance?.cod_received_at && (
        <CodReceipt orderId={orderId} total={total} onSaved={() => void query.refetch()} />
      )}
    </section>
  );
}
