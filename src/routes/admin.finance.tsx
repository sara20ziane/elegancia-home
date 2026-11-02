import { createFileRoute } from "@tanstack/react-router";
import { FINANCE_VIEWS, FinancePage, type FinanceView } from "@/components/finance/page";
export const Route = createFileRoute("/admin/finance")({
  validateSearch: (search: Record<string, unknown>): { view?: FinanceView } => ({
    view: FINANCE_VIEWS.includes(search.view as FinanceView)
      ? (search.view as FinanceView)
      : undefined,
  }),
  component: Page,
});
function Page() {
  const { view = "overview" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <FinancePage view={view} setView={(next) => void navigate({ search: { view: next } })} />;
}
