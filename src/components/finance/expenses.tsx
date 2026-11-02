import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { getSupabase } from "@/lib/supabase/client";
import { optionRows, records } from "@/lib/finance/data";
import { algiersDate } from "@/lib/finance/period";
import type { FinanceRow } from "@/lib/finance/types";
import { FinanceForm } from "./form";
import { FinanceRecords } from "./records";

export function ExpenseList({ options }: { options: FinanceRow }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<FinanceRow | null>(null);
  const [error, setError] = useState("");
  const receipt = async (path: string) => {
    const result = await getSupabase().storage.from("finance-documents").createSignedUrl(path, 60);
    if (result.error) setError(result.error.message);
    else window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <FinanceRecords
      kind="expenses"
      columns={["date", "description", "amount", "status"]}
      actions={(row) => (
        <>
          {row.status === "posted" && (
            <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
              {t("finance.correct")}
            </Button>
          )}
          {row.receipt_path && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void receipt(String(row.receipt_path))}
            >
              {t("finance.receipt_path")}
            </Button>
          )}
        </>
      )}
    >
      {error && (
        <p className="text-error" role="alert">
          {error}
        </p>
      )}
      <FinanceForm
        key={String(editing?.id || "new")}
        operation="expense"
        extra={editing ? { replaces_id: editing.id } : {}}
        onSaved={() => setEditing(null)}
        fields={[
          { name: "date", type: "date", value: algiersDate(), required: true },
          {
            name: "category_id",
            options: optionRows(options.categories),
            value: String(editing?.category_id || ""),
            required: true,
          },
          { name: "description", value: String(editing?.description || ""), required: true },
          { name: "amount", type: "number", value: String(editing?.amount || ""), required: true },
          {
            name: "account_id",
            options: optionRows(
              records(options.accounts).filter((row) => row.kind !== "receivable"),
            ),
            value: String(editing?.account_id || ""),
            required: true,
          },
          {
            name: "supplier_id",
            options: optionRows(options.suppliers),
            value: String(editing?.supplier_id || ""),
          },
          { name: "receipt_path", type: "file" },
          { name: "note", type: "textarea" },
        ]}
      >
        {editing && (
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            onClick={() => setEditing(null)}
          >
            {t("finance.new")}
          </Button>
        )}
      </FinanceForm>
    </FinanceRecords>
  );
}
