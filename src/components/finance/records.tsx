import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth";
import { callFinance, downloadFinanceDocument } from "@/lib/finance/client";
import { record, records } from "@/lib/finance/data";
import type { FinanceRow } from "@/lib/finance/types";
import { FinancePager, FinanceTable } from "./shared";
import { key } from "@/lib/finance/labels";
import { RefundForm } from "./refund";

export function FinanceRecords({
  kind,
  columns,
  actions,
  children,
  mapRow,
}: {
  kind: string;
  columns: string[];
  actions?: (row: FinanceRow) => ReactNode;
  children?: ReactNode;
  mapRow?: (row: FinanceRow) => FinanceRow;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["finance", "list", kind, page, status],
    queryFn: () => callFinance("list", { kind, page, status }),
  });
  const data = record(query.data);
  return (
    <div className="flex flex-col gap-4">
      {children}
      {kind === "invoices" && (
        <Select
          aria-label={t("finance.status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">—</option>
          {["draft", "issued", "paid", "cancelled"].map((value) => (
            <option key={value} value={value}>
              {t(key(value))}
            </option>
          ))}
        </Select>
      )}
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <FinanceTable
            rows={mapRow ? records(data.rows).map(mapRow) : records(data.rows)}
            columns={columns}
            actions={actions}
          />
          <FinancePager page={page} total={Number(data.total || 0)} setPage={setPage} />
        </>
      )}
    </div>
  );
}

export function InvoiceActions({ row, credit = false }: { row: FinanceRow; credit?: boolean }) {
  const { t } = useI18n();
  const { role } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("finance.migration"));
    } finally {
      setBusy(false);
      void cache.invalidateQueries({ queryKey: ["finance"] });
    }
  };
  return (
    <>
      {!credit && row.status === "draft" && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("finance.issueConfirm")))
              void run(() =>
                (async () => {
                  await callFinance("issue", { id: row.id });
                  await downloadFinanceDocument(String(row.id));
                })(),
              );
          }}
        >
          {t("finance.issue")}
        </Button>
      )}
      {(credit || row.issued_at) && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(() => downloadFinanceDocument(String(row.id), credit ? "credit" : "invoice"))
          }
        >
          {t(credit ? "finance.downloadCredit" : "finance.download")}
        </Button>
      )}
      {!credit && role === "owner" && ["issued", "paid"].includes(String(row.status)) && (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            const reason = window.prompt(t("finance.reason"));
            if (reason && window.confirm(t("finance.creditConfirm")))
              void run(() => callFinance("credit", { id: row.id, reason }));
          }}
        >
          {t("finance.credit")}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
      {credit &&
        role === "owner" &&
        Number(record(row.payload).refund_due) > 0 &&
        !record(row.finance_refunds).id && <RefundForm creditId={String(row.id)} />}
    </>
  );
}
