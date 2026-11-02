import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n-context";
import { callFinance } from "@/lib/finance/client";
import { record } from "@/lib/finance/data";
import { FinanceDashboard } from "./dashboard";
import { FinanceRecords } from "./records";
import { CodReceivables, SettlementList } from "./settlements";
import { CostEditor, PurchaseList } from "./purchases";
import { ExpenseList } from "./expenses";
import { AccountManagement, FinancialSettings, ReferenceEditors } from "./settings";
import { FinanceReports } from "./reports";
import { key } from "@/lib/finance/labels";

export const FINANCE_VIEWS = [
  "overview",
  "receivables",
  "settlements",
  "expenses",
  "purchases",
  "suppliers",
  "cash",
  "costs",
  "reports",
  "settings",
  "audit",
] as const;
export type FinanceView = (typeof FINANCE_VIEWS)[number];

export function FinancePage({
  view,
  setView,
}: {
  view: FinanceView;
  setView: (view: FinanceView) => void;
}) {
  const { t } = useI18n();
  const { role } = useAuth();
  const query = useQuery({
    queryKey: ["finance", "options"],
    queryFn: () => callFinance("options"),
    enabled: role === "owner",
  });
  const options = record(query.data);
  if (role !== "owner") return <p role="alert">{t("finance.ownerOnly")}</p>;
  return (
    <section className="flex min-w-0 flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold">{t("finance.title")}</h1>
      <nav aria-label={t("finance.title")} className="flex gap-2 overflow-x-auto pb-2">
        {FINANCE_VIEWS.map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setView(tab)}
            aria-current={view === tab ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm ${view === tab ? "border-primary bg-primary text-on-primary" : "border-outline"}`}
          >
            {t(key(tab))}
          </button>
        ))}
      </nav>
      {query.isError && (
        <p role="alert" className="text-error">
          {t("finance.migration")}
        </p>
      )}
      {view === "overview" && <FinanceDashboard />}
      {view === "receivables" && <CodReceivables options={options} />}
      {view === "settlements" && <SettlementList options={options} />}
      {view === "expenses" && <ExpenseList options={options} />}
      {view === "purchases" && <PurchaseList options={options} />}
      {view === "suppliers" && <ReferenceEditors suppliers options={options} />}
      {view === "cash" && <AccountManagement options={options} />}
      {view === "costs" && <CostEditor options={options} />}
      {view === "reports" && <FinanceReports />}
      {view === "settings" && (
        <>
          <FinancialSettings options={options} />
          <ReferenceEditors options={options} />
        </>
      )}
      {view === "audit" && (
        <FinanceRecords kind="audit" columns={["date", "action", "created_by"]} />
      )}
    </section>
  );
}
