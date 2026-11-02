import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { callFinance } from "@/lib/finance/client";
import { optionRows, record, records } from "@/lib/finance/data";
import { algiersDate } from "@/lib/finance/period";
import { FinanceForm } from "./form";
export function RefundForm({ creditId }: { creditId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["finance", "options"],
    queryFn: () => callFinance("options"),
    enabled: open,
  });
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("finance.refund")}
      </Button>
    );
  return (
    <FinanceForm
      operation="refund"
      extra={{ id: creditId }}
      onSaved={() => setOpen(false)}
      fields={[
        {
          name: "account_id",
          options: optionRows(
            records(record(query.data).accounts).filter((row) => row.kind !== "receivable"),
          ),
          required: true,
        },
        { name: "date", type: "date", value: algiersDate(), required: true },
      ]}
    >
      <label className="flex gap-2 text-sm">
        <input type="checkbox" required />
        {t("finance.refund")}
      </label>
    </FinanceForm>
  );
}
