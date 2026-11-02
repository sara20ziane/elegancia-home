import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { optionRows, record, records } from "@/lib/finance/data";
import { algiersDate } from "@/lib/finance/period";
import type { FinanceRow } from "@/lib/finance/types";
import { FinanceForm } from "./form";
import { FinanceRecords } from "./records";

function PurchaseEditor({ options }: { options: FinanceRow }) {
  const { t } = useI18n();
  const [items, setItems] = useState([
    { id: crypto.randomUUID(), variant_id: "", quantity: "1", unit_cost: "" },
  ]);
  const variants = optionRows(options.variants);
  const change = (index: number, field: string, value: string) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  return (
    <FinanceForm
      operation="purchase"
      extra={{
        items: items.map(({ variant_id, quantity, unit_cost }) => ({
          variant_id,
          quantity,
          unit_cost,
        })),
      }}
      fields={[
        { name: "supplier_id", options: optionRows(options.suppliers), required: true },
        { name: "date", type: "date", value: algiersDate(), required: true },
        { name: "reference", required: true },
        {
          name: "account_id",
          options: optionRows(records(options.accounts).filter((row) => row.kind !== "receivable")),
        },
        { name: "receipt_path", type: "file" },
        { name: "note", type: "textarea" },
      ]}
      onSaved={() =>
        setItems([{ id: crypto.randomUUID(), variant_id: "", quantity: "1", unit_cost: "" }])
      }
    >
      <p className="text-xs text-on-surface-muted">{t("finance.purchaseHint")}</p>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="grid gap-2 rounded-xl border border-outline p-3 sm:grid-cols-4"
        >
          <Select
            required
            aria-label={t("finance.variant_id")}
            value={item.variant_id}
            onChange={(e) => change(index, "variant_id", e.target.value)}
          >
            <option value="">—</option>
            {variants.map((variant) => (
              <option key={variant.value} value={variant.value}>
                {variant.label}
              </option>
            ))}
          </Select>
          <Input
            required
            aria-label={t("finance.quantity")}
            type="number"
            min="1"
            step="1"
            value={item.quantity}
            onChange={(e) => change(index, "quantity", e.target.value)}
          />
          <Input
            required
            aria-label={t("finance.unit_cost")}
            type="number"
            min="0"
            step="0.01"
            value={item.unit_cost}
            onChange={(e) => change(index, "unit_cost", e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={items.length === 1}
            onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
          >
            {t("finance.removeLine")}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={items.length >= 100}
        onClick={() =>
          setItems((current) => [
            ...current,
            { id: crypto.randomUUID(), variant_id: "", quantity: "1", unit_cost: "" },
          ])
        }
      >
        {t("finance.addLine")}
      </Button>
    </FinanceForm>
  );
}

export function PurchaseList({ options }: { options: FinanceRow }) {
  const { t } = useI18n();
  const [paying, setPaying] = useState<FinanceRow | null>(null);
  return (
    <FinanceRecords
      kind="purchases"
      columns={["reference", "date", "total", "status"]}
      actions={(row) =>
        row.status === "unpaid" ? (
          <Button size="sm" variant="outline" onClick={() => setPaying(row)}>
            {t("finance.pay")}
          </Button>
        ) : null
      }
    >
      <PurchaseEditor options={options} />
      {paying && (
        <FinanceForm
          operation="pay_purchase"
          extra={{ id: paying.id }}
          fields={[
            {
              name: "account_id",
              options: optionRows(
                records(options.accounts).filter((row) => row.kind !== "receivable"),
              ),
              required: true,
            },
            { name: "date", type: "date", value: algiersDate(), required: true },
          ]}
          onSaved={() => setPaying(null)}
        />
      )}
    </FinanceRecords>
  );
}

export function CostEditor({ options }: { options: FinanceRow }) {
  const { t } = useI18n();
  return (
    <FinanceRecords
      kind="costs"
      columns={["variant_id", "unit_cost", "date"]}
      mapRow={(row) => ({
        ...row,
        variant_id:
          optionRows(options.variants).find((item) => item.value === row.variant_id)?.label ||
          row.variant_id,
      })}
    >
      <p className="text-sm text-on-surface-muted">{t("finance.costHint")}</p>
      <FinanceForm
        operation="cost"
        fields={[
          { name: "variant_id", options: optionRows(record(options).variants), required: true },
          { name: "unit_cost", type: "number", required: true },
        ]}
      />
    </FinanceRecords>
  );
}
