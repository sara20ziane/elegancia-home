export function algiersDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function financePeriod(preset: string, today = algiersDate()): { from: string; to: string } {
  if (preset === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  const start = new Date(`${today}T12:00:00Z`);
  if (preset === "week") start.setUTCDate(start.getUTCDate() - 6);
  return { from: start.toISOString().slice(0, 10), to: today };
}

export function financeMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function financeCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[\s\uFEFF]*[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      headers.map(cell).join(";"),
      ...rows.map((row) => headers.map((key) => cell(row[key])).join(";")),
    ].join("\r\n")
  );
}
