/** Treat user strings as spreadsheet text, including leading whitespace/BOM before a formula. */
export function spreadsheetText(value: string | number | null): string | number | null {
  return typeof value === "string" && /^[\s\uFEFF]*[=+@-]/u.test(value) ? `'${value}` : value;
}
