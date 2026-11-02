import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { useI18n } from "@/lib/i18n-context";
import { callFinance } from "@/lib/finance/client";
import { record, records } from "@/lib/finance/data";
import { financeMoney, financePeriod } from "@/lib/finance/period";
import { FinancePeriod } from "./period";
import { FinanceTable } from "./shared";
import { key } from "@/lib/finance/labels";

export function FinanceDashboard() {
  const { t } = useI18n();
  const [period, setPeriod] = useState(() => financePeriod("month"));
  const query = useQuery({
    queryKey: ["finance", "dashboard", period],
    queryFn: () => callFinance("dashboard", period),
  });
  const data = record(query.data);
  return (
    <div className="flex flex-col gap-5">
      <FinancePeriod value={period} onChange={setPeriod} />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              "revenue",
              "received",
              "cod_due",
              "expenses",
              "product_cost",
              "gross_margin",
              "operating_result",
            ].map((metric) => (
              <article key={metric} className="rounded-2xl border border-outline bg-surface p-5">
                <p className="text-sm text-on-surface-muted">{t(key(metric))}</p>
                <p className="mt-2 font-display text-2xl font-semibold" dir="ltr">
                  {financeMoney(data[metric])}
                </p>
              </article>
            ))}
          </div>
          {Number(data.missing_costs) > 0 && (
            <p role="status" className="rounded-xl bg-tertiary/10 p-3 text-sm">
              {t("finance.unknownCost")} ({String(data.missing_costs)})
            </p>
          )}
          {Number(data.estimated_delivery_costs) > 0 && (
            <p className="text-sm text-on-surface-muted">{t("finance.estimate")}</p>
          )}
          {Number(data.failures) > 0 && (
            <p role="alert" className="text-error">
              {t("finance.failure")} ({String(data.failures)})
            </p>
          )}
          <h2 className="font-display text-xl">{t("finance.cash")}</h2>
          <FinanceTable rows={records(data.accounts)} columns={["name", "balance"]} />
        </>
      )}
      <p className="text-xs text-on-surface-muted">{t("finance.disclaimer")}</p>
    </div>
  );
}
