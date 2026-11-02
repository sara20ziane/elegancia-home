import { useQuery } from "@tanstack/react-query";
import { publicInvoiceStatus } from "@/lib/finance/actions";
import { useI18n } from "@/lib/i18n-context";
export function InvoiceDownload({ token }: { token: string }) {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["public_invoice", token],
    queryFn: () => publicInvoiceStatus({ data: { token } }),
    retry: false,
  });
  if (!query.data?.invoice) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <a
        className="btn btn-secondary"
        href={`/api/order-invoice/${encodeURIComponent(token)}`}
        download
        rel="noreferrer"
      >
        {t("finance.customerDownload")}
      </a>
      {query.data.credit && (
        <a
          className="btn btn-secondary"
          href={`/api/order-invoice/${encodeURIComponent(token)}?kind=credit`}
          download
          rel="noreferrer"
        >
          {t("finance.customerCredit")}
        </a>
      )}
    </div>
  );
}
