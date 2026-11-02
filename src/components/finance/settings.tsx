import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { callFinance } from "@/lib/finance/client";
import { optionRows, record, records } from "@/lib/finance/data";
import { algiersDate } from "@/lib/finance/period";
import type { FinanceRow } from "@/lib/finance/types";
import { FinanceForm } from "./form";
import { FinanceTable } from "./shared";
import { key } from "@/lib/finance/labels";
import { FinanceRecords } from "./records";

export function FinancialSettings({ options }: { options: FinanceRow }) {
  const query = useQuery({
    queryKey: ["finance", "settings"],
    queryFn: () => callFinance("list", { kind: "settings" }),
  });
  const current = records(record(query.data).rows)[0];
  const { t } = useI18n();
  if (query.isError)
    return (
      <p role="alert" className="text-error">
        {query.error.message}
      </p>
    );
  if (!current) return null;
  return (
    <FinanceForm
      operation="configure"
      fields={[
        { name: "enabled", type: "checkbox", value: current.enabled === true },
        { name: "auto_issue", type: "checkbox", value: current.auto_issue === true },
        {
          name: "issue_trigger",
          value: String(current.issue_trigger),
          options: ["confirmed", "shipped", "delivered"].map((value) => ({
            value,
            label: t(key(value)),
          })),
        },
        {
          name: "cod_account_id",
          options: optionRows(records(options.accounts).filter((row) => row.kind === "receivable")),
          value: String(current.cod_account_id || ""),
        },
        ...[
          "company_name",
          "legal_address",
          "phone",
          "email",
          "rc",
          "nif",
          "nis",
          "ai",
          "tax_label",
        ].map((name) => ({ name, value: String(current[name] || "") })),
        { name: "tax_rate", type: "number", value: String(current.tax_rate ?? "") },
        { name: "logo_path", type: "file", brand: true },
      ]}
    />
  );
}

export function AccountManagement({ options }: { options: FinanceRow }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<FinanceRow | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <FinanceTable
        rows={records(options.accounts)}
        columns={["name", "kind"]}
        actions={(row) => (
          <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
            {t("finance.settings")}
          </Button>
        )}
      />
      <FinanceForm
        key={String(editing?.id || "new")}
        operation="entity"
        extra={editing ? { id: editing.id } : {}}
        transform={(values) => ({ kind: "account", values })}
        onSaved={() => setEditing(null)}
        fields={[
          { name: "name", value: String(editing?.name || ""), required: true },
          {
            name: "kind",
            value: String(editing?.kind || ""),
            required: true,
            options: ["cash", "bank", "receivable"].map((value) => ({
              value,
              label: t(value === "cash" ? "finance.cashType" : key(value)),
            })),
          },
          { name: "active", type: "checkbox", value: editing ? editing.active === true : true },
        ]}
      />
      <h2 className="font-display text-xl">{t("finance.adjust")}</h2>
      <FinanceForm
        operation="adjust"
        fields={[
          {
            name: "account_id",
            options: optionRows(
              records(options.accounts).filter((row) => row.kind !== "receivable"),
            ),
            required: true,
          },
          { name: "amount", type: "number", required: true },
          { name: "date", type: "date", value: algiersDate(), required: true },
          {
            name: "direction",
            required: true,
            options: ["in", "out"].map((value) => ({ value, label: t(key(value)) })),
          },
          { name: "note", type: "textarea", required: true },
        ]}
      />
      <FinanceRecords kind="movements" columns={["date", "kind", "amount", "direction"]} />
    </div>
  );
}

export function ReferenceEditors({
  suppliers = false,
  options,
}: {
  suppliers?: boolean;
  options: FinanceRow;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<FinanceRow | null>(null);
  if (suppliers)
    return (
      <FinanceRecords
        kind="suppliers"
        columns={["name", "phone", "email"]}
        actions={(row) => (
          <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
            {t("finance.edit")}
          </Button>
        )}
      >
        <FinanceForm
          operation="entity"
          key={String(editing?.id || "new")}
          extra={editing ? { id: editing.id } : {}}
          onSaved={() => setEditing(null)}
          transform={(values) => ({ kind: "supplier", values })}
          fields={["name", "phone", "email", "address", "note"].map((name) => ({
            name,
            required: name === "name",
            value: String(editing?.[name] || ""),
          }))}
        />
      </FinanceRecords>
    );
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl">{t("finance.category_id")}</h2>
      <FinanceTable rows={records(options.categories)} columns={["name"]} />
      <FinanceForm
        operation="entity"
        transform={(values) => ({ kind: "category", values })}
        fields={[{ name: "name", required: true }]}
      />
    </div>
  );
}
