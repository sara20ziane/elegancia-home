import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FinanceInputField } from "./field";
import { useI18n } from "@/lib/i18n-context";
import { callFinance, uploadFinanceFile } from "@/lib/finance/client";
import type { FinanceOperation, FinanceRow } from "@/lib/finance/types";
import type { FinanceKey } from "@/lib/finance/labels";

export type FinanceField = {
  name: string;
  label?: FinanceKey;
  type?: string;
  required?: boolean;
  value?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  brand?: boolean;
};

export function FinanceForm({
  operation,
  fields,
  extra = {},
  transform,
  children,
  onSaved,
}: {
  operation: FinanceOperation;
  fields: FinanceField[];
  extra?: FinanceRow;
  transform?: (values: FinanceRow) => FinanceRow;
  children?: ReactNode;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const cache = useQueryClient();
  const [id, setId] = useState(() => crypto.randomUUID());
  const upload = useRef<{ file: File; path: string } | null>(null);
  const mutation = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const data = new FormData(form);
      const values: FinanceRow = { id, ...extra };
      for (const field of fields) {
        const value = data.get(field.name);
        if (field.type === "file") {
          if (value instanceof File && value.size) {
            if (
              !upload.current ||
              upload.current.file.name !== value.name ||
              upload.current.file.size !== value.size
            ) {
              upload.current = { file: value, path: await uploadFinanceFile(value, field.brand) };
            }
            values[field.name] = upload.current.path;
          }
        } else
          values[field.name] = field.type === "checkbox" ? value === "on" : String(value ?? "");
      }
      await callFinance(operation, transform ? transform(values) : values);
    },
    onSuccess: () => {
      setId(crypto.randomUUID());
      upload.current = null;
      onSaved?.();
    },
    onSettled: () => {
      void cache.invalidateQueries({ queryKey: ["finance"] });
    },
  });
  return (
    <form
      key={id}
      className="grid gap-4 rounded-2xl border border-outline bg-surface p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(event.currentTarget);
      }}
    >
      {fields.map((field) => (
        <FinanceInputField key={field.name} field={field} />
      ))}
      <div className="flex flex-col gap-3 sm:col-span-2">
        {children}
        {mutation.isError && (
          <p role="alert" className="text-sm text-error">
            {mutation.error.message}
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status" className="text-sm text-primary">
            {t("finance.success")}
          </p>
        )}
        <Button className="self-start" disabled={mutation.isPending}>
          {t(mutation.isPending ? "finance.saving" : "finance.save")}
        </Button>
      </div>
    </form>
  );
}
