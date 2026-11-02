import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth";
import { callFinance } from "@/lib/finance/client";
import { record } from "@/lib/finance/data";
import { financeMoney } from "@/lib/finance/period";
import { InvoiceActions } from "./records";
import { key } from "@/lib/finance/labels";

export function OrderFinanceSection({ orderId, status }: { orderId: string; status: string }) {
  const { t } = useI18n();
  const { role } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["finance", "order", orderId],
    queryFn: () => callFinance("order", { order_id: orderId }),
    retry: false,
  });
  const data = record(query.data);
  const prepare = async () => {
    if (data.historical && !window.confirm(t("finance.importConfirm"))) return;
    setBusy(true);
    setError("");
    try {
      await callFinance("prepare", { order_id: orderId, import: data.historical === true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("finance.migration"));
    } finally {
      setBusy(false);
      void cache.invalidateQueries({ queryKey: ["finance"] });
    }
  };
  if (query.isError || (!data.enabled && !data.captured)) return null;
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-outline p-4"
      aria-label={t("finance.title")}
    >
      <h3 className="font-medium">{t("finance.title")}</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-on-surface-muted">{t("finance.total")}</dt>
          <dd dir="ltr">{financeMoney(data.total)}</dd>
        </div>
        <div>
          <dt className="text-on-surface-muted">{t("finance.cod_due")}</dt>
          <dd dir="ltr">{financeMoney(data.cod_due)}</dd>
        </div>
        <div>
          <dt className="text-on-surface-muted">{t("finance.invoicing")}</dt>
          <dd>
            {String(data.invoice_number || "—")}{" "}
            {data.invoice_status ? t(key(String(data.invoice_status))) : ""}
          </dd>
        </div>
        <div>
          <dt className="text-on-surface-muted">{t("finance.settlements")}</dt>
          <dd>{String(data.settlement_reference || "—")}</dd>
        </div>
        {role === "owner" && (
          <>
            <div>
              <dt>{t("finance.product_cost")}</dt>
              <dd dir="ltr">{financeMoney(data.product_cost)}</dd>
            </div>
            <div>
              <dt>{t("finance.gross_margin")}</dt>
              <dd dir="ltr">{financeMoney(data.margin)}</dd>
            </div>
          </>
        )}
      </dl>
      {data.failure && (
        <p role="alert" className="text-sm text-error">
          {t("finance.failure")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(!data.invoice_id || data.failure) &&
          ["confirmed", "shipped", "delivered"].includes(status) &&
          (!data.historical || role === "owner") && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void prepare()}>
              {t(
                data.failure
                  ? "finance.retry"
                  : data.historical
                    ? "finance.import"
                    : "finance.prepare",
              )}
            </Button>
          )}
        {role === "owner" && status === "delivered" && Number(data.cod_due) > 0 && (
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/finance" search={{ view: "receivables" }}>
              {t("finance.recordSettlement")}
            </Link>
          </Button>
        )}
        {data.invoice_id && (
          <InvoiceActions
            row={{
              id: data.invoice_id,
              status: data.invoice_status,
              issued_at: data.invoice_number ? true : null,
            }}
          />
        )}
        {data.credit_id && <InvoiceActions row={{ id: data.credit_id }} credit />}
      </div>
    </section>
  );
}
