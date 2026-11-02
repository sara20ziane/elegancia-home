import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n-context";
import { financePeriod } from "@/lib/finance/period";
import { key } from "@/lib/finance/labels";

export function FinancePeriod({
  value,
  onChange,
}: {
  value: { from: string; to: string };
  onChange: (next: { from: string; to: string }) => void;
}) {
  const { t } = useI18n();
  const [preset, setPreset] = useState("month");
  return (
    <div className="grid gap-3 rounded-xl border border-outline p-3 sm:grid-cols-3">
      <Select
        aria-label={t("finance.custom")}
        value={preset}
        onChange={(e) => {
          setPreset(e.target.value);
          if (e.target.value !== "custom") onChange(financePeriod(e.target.value));
        }}
      >
        {["today", "week", "month", "year", "custom"].map((item) => (
          <option key={item} value={item}>
            {t(key(item))}
          </option>
        ))}
      </Select>
      <Field label={t("finance.from")}>
        <Input
          type="date"
          value={value.from}
          onChange={(e) => {
            setPreset("custom");
            onChange({ ...value, from: e.target.value });
          }}
        />
      </Field>
      <Field label={t("finance.to")}>
        <Input
          type="date"
          value={value.to}
          onChange={(e) => {
            setPreset("custom");
            onChange({ ...value, to: e.target.value });
          }}
        />
      </Field>
    </div>
  );
}
