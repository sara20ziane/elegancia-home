import { useQuery } from "@tanstack/react-query";
import { hasTrackedInvoice } from "@/lib/erpnext/actions";

export function InvoiceDownload({ token }: { token: string }) {
  const invoice = useQuery({
    queryKey: ["tracked_invoice", token],
    queryFn: () => hasTrackedInvoice({ data: { token } }),
    retry: false,
  });
  if (!invoice.data) return null;
  return (
    <a
      className="btn btn-outline self-start"
      href={`/api/invoices/${encodeURIComponent(token)}`}
      download
      rel="noreferrer"
    >
      Télécharger ma facture
    </a>
  );
}
