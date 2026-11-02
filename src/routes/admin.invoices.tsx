import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-context";
import { FinanceRecords, InvoiceActions } from "@/components/finance/records";
export const Route = createFileRoute("/admin/invoices")({ component: Page });
function Page() {
  const [credit, setCredit] = useState(false);
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return (
    <section className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold">{t("finance.invoicing")}</h1>
      <div className="flex gap-2">
        <Button variant={credit ? "outline" : "primary"} onClick={() => setCredit(false)}>
          {t("finance.invoices")}
        </Button>
        <Button variant={credit ? "primary" : "outline"} onClick={() => setCredit(true)}>
          {t("finance.credits")}
        </Button>
      </div>
      <FinanceRecords
        key={String(credit)}
        kind={credit ? "credits" : "invoices"}
        columns={["number", "name", "date", "total", ...(credit ? [] : ["status"])]}
        actions={(row) => <InvoiceActions row={row} credit={credit} />}
      />
    </section>
  );
}
