import type { Json } from "../supabase/types";
import type { FinanceRow } from "./types";

export function record(value: Json | undefined): FinanceRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export function records(value: Json | undefined): FinanceRow[] {
  return Array.isArray(value)
    ? value.filter((row) => row && typeof row === "object" && !Array.isArray(row)).map(record)
    : [];
}
export function optionRows(value: Json | undefined): { value: string; label: string }[] {
  return records(value)
    .filter((row) => row.active !== false)
    .map((row) => ({
      value: String(row.id),
      label: row.name
        ? String(row.name)
        : [record(row.products).name, row.size, row.color_name, row.sku]
            .filter(Boolean)
            .join(" / "),
    }));
}
