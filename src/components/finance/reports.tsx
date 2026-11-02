import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { useI18n } from "@/lib/i18n-context";
import { callFinance } from "@/lib/finance/client";
import { record, records } from "@/lib/finance/data";
import { financeCsv, financePeriod } from "@/lib/finance/period";
import { FinancePeriod } from "./period";
import { FinanceTable, FinancePager } from "./shared";
import { key } from "@/lib/finance/labels";

export function FinanceReports() {
  const { t } = useI18n();
  const [period, setPeriod] = useState(() => financePeriod("month"));
  const [kind, setKind] = useState("source");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["finance", "report", period, kind, page],
    queryFn: () => callFinance("report", { ...period, kind, page }),
  });
  const data = record(query.data);
  const columns =
    kind === "orders"
      ? [
          "reference",
          "source",
          "total",
          "product_cost",
          "delivery_cost",
          "margin",
          "settlement_days",
        ]
      : kind === "expenses"
        ? ["name", "amount"]
        : kind === "accounts"
          ? ["name", "received", "spent"]
          : ["name", "revenue", "product_cost", "delivery_cost", "margin"];
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      if (Number(data.total) > 5000) throw new Error(t("finance.exportLimit"));
      const result = [...records(data.rows)];
      for (let next = 1; next <= Math.ceil(Number(data.total) / 50); next += 1) {
        if (next === page) continue;
        result.push(
          ...records(record(await callFinance("report", { ...period, kind, page: next })).rows),
        );
      }
      const url = URL.createObjectURL(
        new Blob([financeCsv(result)], { type: "text/csv;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `finance-${kind}-${period.from}-${period.to}.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("finance.migration"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-on-surface-muted">{t("finance.reportHint")}</p>
      <FinancePeriod
        value={period}
        onChange={(value) => {
          setPeriod(value);
          setPage(1);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <Select
          aria-label={t("finance.reports")}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
        >
          {[
            "source",
            "product",
            "category",
            "wilaya",
            "carrier",
            "orders",
            "expenses",
            "accounts",
          ].map((value) => (
            <option key={value} value={value}>
              {t(value === "accounts" ? "finance.cash" : key(value))}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          disabled={busy || query.isPending || query.isError}
          onClick={() => void download()}
        >
          {t("finance.export")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <FinanceTable rows={records(data.rows)} columns={columns} />
          <FinancePager page={page} total={Number(data.total)} size={50} setPage={setPage} />
        </>
      )}
    </div>
  );
}
