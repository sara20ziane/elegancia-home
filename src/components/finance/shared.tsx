import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { financeMoney } from "@/lib/finance/period";
import { record } from "@/lib/finance/data";
import type { FinanceRow } from "@/lib/finance/types";
import { key } from "@/lib/finance/labels";
import type { ReactNode } from "react";

const MONEY = new Set([
  "total",
  "amount",
  "gross",
  "fees",
  "withheld",
  "net",
  "revenue",
  "received",
  "spent",
  "balance",
  "margin",
  "product_cost",
  "unit_cost",
  "delivery_cost",
  "cod_due",
]);
export function FinanceTable({
  rows,
  columns,
  actions,
}: {
  rows: FinanceRow[];
  columns: string[];
  actions?: (row: FinanceRow) => ReactNode;
}) {
  const { t } = useI18n();
  if (!rows.length)
    return (
      <p className="rounded-xl border border-outline p-5 text-on-surface-muted">
        {t("finance.empty")}
      </p>
    );
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-outline">
      <table className="w-full min-w-[540px] text-start text-sm">
        <thead className="bg-surface-mid text-start">
          <tr>
            {columns.map((col) => (
              <th key={col} className="p-3 text-start font-medium">
                {t(key(col))}
              </th>
            ))}
            {actions && <th className="p-3">{t("finance.actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.id || row.order_id || row.label || index)}
              className="border-t border-outline"
            >
              {columns.map((col) => {
                const value =
                  col === "name"
                    ? row.name ||
                      record(row.payload).customer_name ||
                      record(row.snapshot).customer_name ||
                      row.label
                    : col === "date"
                      ? row.date ||
                        record(row.payload).date ||
                        row.occurred_at ||
                        row.recorded_at ||
                        row.issued_at ||
                        row.created_at
                      : col === "reference"
                        ? row.reference || row.ref
                        : row[col];
                return (
                  <td
                    key={col}
                    className="max-w-64 break-words p-3"
                    dir={MONEY.has(col) ? "ltr" : undefined}
                  >
                    {MONEY.has(col)
                      ? financeMoney(value)
                      : ["status", "kind", "action", "direction", "source"].includes(col)
                        ? t(key(String(value)))
                        : String(value ?? "—")}
                  </td>
                );
              })}
              {actions && (
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinancePager({
  page,
  total,
  size = 30,
  setPage,
}: {
  page: number;
  total: number;
  size?: number;
  setPage: (page: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        {t("finance.previous")}
      </Button>
      <span className="text-sm">
        {page} / {Math.max(1, Math.ceil(total / size))}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page * size >= total}
        onClick={() => setPage(page + 1)}
      >
        {t("finance.next")}
      </Button>
    </div>
  );
}
