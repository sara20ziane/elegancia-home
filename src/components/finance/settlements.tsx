import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { callFinance } from "@/lib/finance/client";
import { optionRows, record, records } from "@/lib/finance/data";
import { algiersDate, financeMoney } from "@/lib/finance/period";
import type { FinanceRow } from "@/lib/finance/types";
import { FinanceForm } from "./form";
import { FinanceRecords } from "./records";
import { FinancePager } from "./shared";

export function CodReceivables({ options }: { options: FinanceRow }) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FinanceRow[]>([]);
  const query = useQuery({
    queryKey: ["finance", "receivables", page],
    queryFn: () => callFinance("list", { kind: "receivables", page }),
  });
  const data = record(query.data);
  const rows = records(data.rows);
  const accounts = optionRows(records(options.accounts).filter((row) => row.kind !== "receivable"));
  const gross = selected.reduce((sum, row) => sum + Number(row.total), 0);
  const carriers = [...new Set(selected.map((row) => String(row.carrier)))];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl">{t("finance.selectOrders")}</h2>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <label
                key={String(row.order_id)}
                className="flex gap-3 rounded-xl border border-outline p-4 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.some((item) => item.order_id === row.order_id)}
                  onChange={(e) =>
                    setSelected((current) =>
                      e.target.checked
                        ? [...current, row]
                        : current.filter((item) => item.order_id !== row.order_id),
                    )
                  }
                />
                <span>
                  <strong>{String(row.customer_name)}</strong>
                  <span className="block text-xs text-on-surface-muted">
                    {String(row.reference)} · {String(row.carrier || "—")}
                  </span>
                  <span dir="ltr">{financeMoney(row.total)}</span>
                </span>
              </label>
            ))}
          </div>
          {!rows.length && <p>{t("finance.empty")}</p>}
          <FinancePager page={page} total={Number(data.total || 0)} setPage={setPage} />
        </>
      )}
      {selected.length > 0 && (
        <>
          <p className="font-medium">
            {t("finance.gross")} : {financeMoney(gross)} ({selected.length})
          </p>
          <FinanceForm
            key={selected.map((row) => row.order_id).join(",")}
            operation="settlement"
            extra={{ orders: selected.map((row) => row.order_id || null), expected_gross: gross }}
            onSaved={() => setSelected([])}
            fields={[
              {
                name: "carrier",
                required: true,
                options: carriers.map((value) => ({ value, label: value })),
                value: carriers.length === 1 ? carriers[0] : "",
              },
              { name: "date", type: "date", required: true, value: algiersDate() },
              { name: "reference", required: true },
              { name: "fees", type: "number", value: 0, required: true },
              { name: "withheld", type: "number", value: 0, required: true },
              { name: "net", type: "number", value: gross, required: true },
              { name: "account_id", required: true, options: accounts },
              { name: "note", type: "textarea" },
            ]}
          >
            <label className="flex gap-2 text-sm">
              <input type="checkbox" required />
              {t("finance.attest")}
            </label>
            <p className="text-xs text-on-surface-muted">{t("finance.retainedHint")}</p>
          </FinanceForm>
        </>
      )}
    </div>
  );
}

export function SettlementList({ options }: { options: FinanceRow }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState<FinanceRow | null>(null);
  return (
    <FinanceRecords
      kind="settlements"
      columns={["reference", "carrier", "gross", "fees", "withheld", "net"]}
      actions={(row) =>
        Number(row.withheld) >
        records(row.cod_withholding_receipts).reduce(
          (sum, receipt) => sum + Number(receipt.amount),
          0,
        ) ? (
          <Button size="sm" variant="outline" onClick={() => setCurrent(row)}>
            {t("finance.withholding")}
          </Button>
        ) : null
      }
    >
      {current && (
        <FinanceForm
          key={String(current.id)}
          operation="withholding"
          extra={{ settlement_id: current.id }}
          fields={[
            { name: "date", type: "date", value: algiersDate(), required: true },
            { name: "amount", type: "number", required: true },
            {
              name: "account_id",
              options: optionRows(
                records(options.accounts).filter((row) => row.kind !== "receivable"),
              ),
              required: true,
            },
          ]}
          onSaved={() => setCurrent(null)}
        >
          <label className="flex gap-2 text-sm">
            <input type="checkbox" required />
            {t("finance.attest")}
          </label>
        </FinanceForm>
      )}
    </FinanceRecords>
  );
}
